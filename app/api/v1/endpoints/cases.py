from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from pydantic import BaseModel 
from datetime import datetime, timedelta, timezone 
from sqlalchemy.sql import func 
import traceback 
import requests 
import pandas as pd
import io
import json
import asyncio

from app.core.emails import send_security_alert_async
from app.db.session import get_db, SessionLocal
from app.models import models
from app.api import deps
from app.schemas import case as case_schema
from app.schemas import audit as audit_schema
from app.core.audit import log_event

from app.core import security_utils
from app.core.global_audit import log_global_event

router = APIRouter()

MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024 # Límite de 5MB para evitar OOM

# =======================================================
# 🔥 ENVIADOR DE CORREOS EN SEGUNDO PLANO (NO BLOQUEANTE) 🔥
# =======================================================
async def safe_send_email_background(company_id: int, email_to: str, subject: str, body_html: str):
    """Abre una sesión de base de datos temporal solo para el correo y la cierra al terminar."""
    from app.core.emails import send_security_alert_async
    db_session = SessionLocal()
    try:
        await send_security_alert_async(db_session, company_id, email_to, subject, body_html)
    except Exception as e:
        print(f"Error enviando correo en segundo plano: {e}")
    finally:
        db_session.close()


# =======================================================
# 🔥 PENTEST FIX: GUARDAESPALDAS PARA LOW-CODE (SSRF PROTECTION) 🔥
# =======================================================
class SafeHTTPClient:
    """Wrapper seguro para permitir peticiones HTTP limitando vectores de ataque."""
    
    def _is_safe_url(self, url: str) -> bool:
        forbidden_patterns = ["127.0.0.1", "localhost", "169.254", "10.", "192.168."]
        url_lower = url.lower()
        if not url_lower.startswith("http"):
            return False
        return not any(p in url_lower for p in forbidden_patterns)

    def get(self, url: str, headers: dict = None):
        if not self._is_safe_url(url):
            return {"status": 403, "error": "URL bloqueada por políticas de seguridad (SSRF)."}
        try:
            # Forzamos timeout de 3 segundos para evitar que congelen nuestro backend
            resp = requests.get(url, headers=headers, timeout=3)
            try:
                data = resp.json()
            except:
                data = resp.text
            return {"status": resp.status_code, "data": data}
        except Exception as e:
            return {"status": 500, "error": str(e)}

    def post(self, url: str, json: dict = None, headers: dict = None):
        if not self._is_safe_url(url):
            return {"status": 403, "error": "URL bloqueada por políticas de seguridad (SSRF)."}
        try:
            resp = requests.post(url, json=json, headers=headers, timeout=3)
            try:
                data = resp.json()
            except:
                data = resp.text
            return {"status": resp.status_code, "data": data}
        except Exception as e:
            return {"status": 500, "error": str(e)}

# =======================================================
# 🔥 EJECUTOR DE WEBHOOKS SEGURO (iPaaS) 🔥
# =======================================================
def execute_webhook(rule, case_id: int, case_data: dict, status_name: str = ""):
    """Envía peticiones HTTP seguras a Slack o sistemas de terceros."""
    client = SafeHTTPClient()
    url = rule.target_field
    if not url: return
    
    # Preparamos el payload reemplazando variables
    payload_str = rule.action_value or "{}"
    payload_str = payload_str.replace("{case_id}", str(case_id))
    payload_str = payload_str.replace("{status_name}", status_name)
    
    # Para el {case_data}, si es Slack mandamos texto bonito, si es Webhook mandamos JSON puro
    if rule.action_type == "SEND_SLACK":
        # Formateamos los datos del caso para que se vean bien en Slack
        formatted_data = "\n".join([f"*{k}*: {v}" for k, v in case_data.items()])
        payload_str = payload_str.replace("{case_data}", formatted_data)
        
        # Slack requiere un formato específico: {"text": "El mensaje"}
        json_data = {"text": payload_str}
        client.post(url, json=json_data)
        
    elif rule.action_type == "WEBHOOK_OUT":
        # Para webhooks genéricos
        try:
            # Reemplazar {case_data} con el objeto JSON real como string
            payload_str = payload_str.replace('"{case_data}"', json.dumps(case_data))
            json_data = json.loads(payload_str)
        except:
            # Si el usuario escribió un JSON inválido, mandamos los datos básicos por si acaso
            json_data = {"case_id": case_id, "data": case_data}
            
        method = (rule.action_config or {}).get("method", "POST")
        if method == "POST":
            client.post(url, json=json_data)
        elif method == "PUT":
            # Nuestro SafeHTTPClient solo tiene GET y POST, pero podemos mapear PUT a POST si hace falta, 
            # o si luego le agregas el método PUT a la clase, se usará. Por ahora usamos POST por defecto.
            client.post(url, json=json_data)
        else:
            client.get(url)

# ==========================
# ESQUEMAS
# ==========================
class CaseCreate(BaseModel):
    form_id: int 
    data: dict
    module_id: int
    assigned_to: Optional[int] = None

class CaseUpdate(BaseModel):
    data: dict
    assigned_to: Optional[int] = None

class StatusUpdate(BaseModel):
    new_status_id: int

# =======================================================
# 🔥 MOTOR DE REGLAS GLOBALES 🔥
# =======================================================
def process_global_rules(db: Session, case: models.Case, user_id: int, event_type: str, old_data: dict = None, background_tasks: BackgroundTasks = None):
    try:
        rules = db.query(models.AutomationRule).filter(
            models.AutomationRule.company_id == case.company_id,
            models.AutomationRule.module_id == case.module_id,
            models.AutomationRule.is_active == True
        ).all()
    except Exception:
        return

    updated_data = dict(case.data) if case.data else {}
    updated_ui = dict(case.ui_rules) if case.ui_rules else {}
    data_changed = False
    ui_changed = False 

    for rule in rules:
        if rule.event_type == "ON_FIELD_CHANGE":
            if not old_data: continue 
            old_val = old_data.get(rule.trigger_field)
            new_val = updated_data.get(rule.trigger_field)
            if old_val == new_val: continue 
        elif rule.event_type != event_type:
            continue 

        if rule.condition_field and rule.condition_operator and rule.condition_value:
            val = str(updated_data.get(rule.condition_field, ""))
            cond_val = str(rule.condition_value)
            op = rule.condition_operator

            if op == "==" and val != cond_val: continue
            if op == "!=" and val == cond_val: continue
            if op == "CONTAINS" and cond_val.lower() not in val.lower(): continue
            if op == ">":
                try: 
                    if float(val) <= float(cond_val): continue
                except: continue
            if op == "<":
                try: 
                    if float(val) >= float(cond_val): continue
                except: continue

        if rule.action_type == "UPDATE_FIELD" and rule.target_field:
            if rule.action_value == "{NOW}":
                updated_data[rule.target_field] = datetime.now().strftime("%Y-%m-%d")
            else:
                updated_data[rule.target_field] = rule.action_value
            data_changed = True

        elif rule.action_type == "CHANGE_OWNER":
            v_str = str(rule.action_value)
            if v_str.isdigit():
                case.assigned_to = int(v_str)
            elif v_str.startswith("role_") or v_str.startswith("profile_"):
                # 🔥 ASIGNACIÓN ROUND ROBIN 🔥
                parts = v_str.split("_")
                group_type = parts[0] # 'role' o 'profile'
                group_id = int(parts[1])
                
                if group_type == "role":
                    eligible_users = db.query(models.User).filter(models.User.role_id == group_id, models.User.company_id == case.company_id, models.User.is_active == True).order_by(models.User.id).all()
                else:
                    eligible_users = db.query(models.User).filter(models.User.profile_id == group_id, models.User.company_id == case.company_id, models.User.is_active == True).order_by(models.User.id).all()
                    
                if eligible_users:
                    tracker = db.query(models.RoundRobinTracker).filter(
                        models.RoundRobinTracker.company_id == case.company_id,
                        models.RoundRobinTracker.group_type == group_type,
                        models.RoundRobinTracker.group_id == group_id
                    ).first()
                    
                    next_user = eligible_users[0]
                    
                    if tracker and tracker.last_user_id:
                        last_index = next((i for i, u in enumerate(eligible_users) if u.id == tracker.last_user_id), -1)
                        if last_index != -1 and last_index + 1 < len(eligible_users):
                            next_user = eligible_users[last_index + 1]
                            
                    case.assigned_to = next_user.id
                    
                    if not tracker:
                        tracker = models.RoundRobinTracker(company_id=case.company_id, group_type=group_type, group_id=group_id)
                        db.add(tracker)
                    tracker.last_user_id = next_user.id

        elif rule.action_type == "COPY_FIELD":
            if rule.action_value and rule.target_field and rule.action_value in updated_data:
                updated_data[rule.target_field] = updated_data[rule.action_value]
                data_changed = True

        elif rule.action_type == "CREATE_RECORD":
            config = rule.action_config or {}
            target_mod_id = config.get("module_id")
            target_form_id = config.get("form_id")
            mapping = config.get("mapping", {})
            
            if target_mod_id and target_form_id:
                new_record_data = {}
                for tgt_field, src_info in mapping.items():
                    if src_info.get("type") == "static":
                        new_record_data[tgt_field] = src_info.get("value")
                    elif src_info.get("type") == "dynamic":
                        src_field = src_info.get("value")
                        new_record_data[tgt_field] = updated_data.get(src_field, "")
                        
                initial_status = db.query(models.Status).join(models.Blueprint).filter(
                    models.Blueprint.module_id == target_mod_id,
                    models.Blueprint.company_id == case.company_id,
                    models.Blueprint.is_active == True,
                    models.Status.is_initial == True
                ).first()
                
                new_case = models.Case(
                    company_id=case.company_id,
                    created_by=user_id,
                    module_id=target_mod_id,
                    status_id=initial_status.id if initial_status else None,
                    form_id=target_form_id,
                    data=new_record_data,
                    ui_rules={}
                )
                db.add(new_case)
                db.flush()
                
                log_event(
                    db=db, user_id=user_id, company_id=case.company_id,
                    case_id=case.id, action="AUTOMATION_CREATE_RECORD",
                    old_v=None,
                    new_v={"created_case_id": new_case.id, "target_module_id": target_mod_id, "rule_name": rule.name}
                )
                
        elif rule.action_type in ["WEBHOOK_OUT", "SEND_SLACK"]:
            # 🔥 FASE 3: INTEGRACIONES EXTERNAS (Ejecución silenciosa) 🔥
            try:
                execute_webhook(rule, case.id, updated_data)
            except Exception as e:
                print(f"Error ejecutando integración (Regla ID {rule.id}): {e}")        

        elif rule.action_type == "CUSTOM_FUNCTION" and rule.function_code:
            # 🔥 PENTEST FIX: Sandbox con SafeHTTPClient y variables controladas 🔥
            local_env = {
                "case_data": updated_data,
                "user_id": user_id,
                "current_date": datetime.now().strftime("%Y-%m-%d"),
                "http": SafeHTTPClient()
            }
            try:
                # Ejecutamos el script. Si el usuario modifica 'case_data', lo capturamos.
                exec(rule.function_code, {"__builtins__": {}}, local_env)
                updated_data = local_env.get("case_data", updated_data)
                data_changed = True
            except Exception as e:
                print(f"Error ejecutando Low-Code (Regla ID {rule.id}): {e}")

        elif rule.action_type == "SEND_NOTIFICATION" and rule.target_field:
            try:
                targets = []
                config = rule.action_config or {}
                
                # Leer configuración avanzada si existe
                if config.get("notify_users"):
                    targets.extend(config["notify_users"])
                if config.get("notify_roles"):
                    role_users = db.query(models.User.id).filter(models.User.role_id.in_(config["notify_roles"]), models.User.company_id == case.company_id).all()
                    targets.extend([u[0] for u in role_users])
                if config.get("notify_profiles"):
                    profile_users = db.query(models.User.id).filter(models.User.profile_id.in_(config["notify_profiles"]), models.User.company_id == case.company_id).all()
                    targets.extend([u[0] for u in profile_users])
                    
                # Si no hay config avanzada, notificar al creador (comportamiento legacy)
                if not targets:
                    targets = [case.created_by if case.created_by else user_id]
                    
                # Eliminar duplicados
                unique_targets = list(set(targets))
                
                # Crear notificaciones masivas
                for target_id in unique_targets:
                            notification = models.Notification(
                                company_id=case.company_id,
                                user_id=target_id,
                                case_id=case.id,
                                module_id=case.module_id,
                                title=rule.target_field, 
                                message=rule.action_value or "Se ha disparado una alerta automática." 
                            )
                            db.add(notification)
                            
                            # 🔥 NUEVO: ENVIAR POR CORREO SI ESTÁ MARCADO (EN SEGUNDO PLANO) 🔥
                            if config.get("send_email"):
                                user_obj = db.query(models.User).filter(models.User.id == target_id).first()
                                if user_obj and user_obj.email:
                                    email_body = f"""
                                    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 8px;">
                                        <h2 style="color: #2563eb; margin-top: 0;">{rule.target_field}</h2>
                                        <p style="color: #374151; font-size: 16px; line-height: 1.5;">{rule.action_value or 'Se ha disparado una alerta en AegisFlow.'}</p>
                                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                                        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
                                            Este es un mensaje automático del sistema. Registro afectado: #{case.id}
                                        </p>
                                    </div>
                                    """
                                    if background_tasks:
                                        background_tasks.add_task(
                                            safe_send_email_background,
                                            case.company_id,
                                            user_obj.email,
                                            rule.target_field,
                                            email_body
                                        )

            except Exception as e:
                pass

        elif rule.action_type.startswith("SET_") and rule.target_field:
            f = rule.target_field
            t = rule.action_type

            # 🔥 NUEVA LÓGICA PARA SECCIONES 🔥
            target_fields = [f]
            
            if f.startswith("section_"):
                section_id = int(f.replace("section_", ""))
                fields_in_section = db.query(models.FormField).filter(
                    models.FormField.section_id == section_id,
                    models.FormField.company_id == case.company_id
                ).all()
                target_fields = [field.api_name or field.label for field in fields_in_section]
                
            for target_f in target_fields:
                if target_f not in updated_ui: 
                    updated_ui[target_f] = {}
                    
                if t == "SET_HIDDEN": updated_ui[target_f]["hidden"] = True
                elif t == "SET_VISIBLE": updated_ui[target_f]["hidden"] = False
                elif t == "SET_READONLY": updated_ui[target_f]["readonly"] = True
                elif t == "SET_EDITABLE": updated_ui[target_f]["readonly"] = False
                elif t == "SET_REQUIRED": updated_ui[target_f]["required"] = True
                elif t == "SET_OPTIONAL": updated_ui[target_f]["required"] = False
                
            ui_changed = True

    if data_changed:
        case.data = updated_data
    if ui_changed:
        case.ui_rules = updated_ui


# =======================================================
# ENDPOINTS CLÁSICOS
# =======================================================

@router.post("/", response_model=case_schema.CaseResponse) 
def create_case(
    case_in: CaseCreate,
    request: Request,
    background_tasks: BackgroundTasks, # 🔥 INYECTADO
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    security_utils.check_module_permission(db, current_user, case_in.module_id, "create")

    # Validar que el Formulario pertenezca a la empresa
    form = db.query(models.Form).filter(
        models.Form.id == case_in.form_id, 
        models.Form.company_id == current_user.company_id
    ).first()
    if not form:
        raise HTTPException(status_code=403, detail="El formulario no es válido o no pertenece a tu empresa.")

    blueprints = db.query(models.Blueprint).filter(
        models.Blueprint.company_id == current_user.company_id,
        models.Blueprint.module_id == case_in.module_id,
        models.Blueprint.is_active == True
    ).all()

    selected_blueprint_id = None
    for bp in blueprints:
        if bp.trigger_field and bp.trigger_value:
            val_in_case = case_in.data.get(bp.trigger_field)
            if str(val_in_case) == str(bp.trigger_value):
                selected_blueprint_id = bp.id
                break
        else:
            selected_blueprint_id = bp.id
            break

    initial_status = None
    if selected_blueprint_id:
        initial_status = db.query(models.Status).filter(
            models.Status.blueprint_id == selected_blueprint_id,
            models.Status.is_initial == True
        ).first()

    status_id = initial_status.id if initial_status else None

    new_case = models.Case(
        company_id=current_user.company_id,
        created_by=current_user.id,
        module_id=case_in.module_id,
        status_id=status_id,
        form_id=case_in.form_id, 
        data=case_in.data,
        assigned_to=case_in.assigned_to,
        ui_rules={} 
    )
    
    process_global_rules(db, new_case, current_user.id, "ON_CREATE", background_tasks=background_tasks)
    
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    
    orphaned_notifications = db.query(models.Notification).filter(
        models.Notification.company_id == current_user.company_id,
        models.Notification.case_id == None,
        models.Notification.module_id == new_case.module_id,
        models.Notification.user_id == current_user.id
    ).all()
    
    for note in orphaned_notifications:
        note.case_id = new_case.id
    db.commit()
    
    log_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        case_id=new_case.id, action="CREATE_CASE", old_v=None,
        new_v={"data": new_case.data, "status_id": new_case.status_id, "module_id": new_case.module_id}
    )
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="CASE", action="CREATE", entity_id=new_case.id,
        details=f"Creó el registro #{new_case.id} en el módulo ID {case_in.module_id}",
        new_value=new_case.data, 
        request=request
    )
    
    return new_case

@router.get("/", response_model=List[case_schema.CaseResponse])
def get_cases(
    module_id: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    query = db.query(models.Case).filter(
        models.Case.company_id == current_user.company_id,
        models.Case.deleted_at == None 
    )

    if module_id:
        security_utils.check_module_permission(db, current_user, module_id, "view")
        query = query.filter(models.Case.module_id == module_id) 

    if not current_user.is_superadmin:
        profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
        mod_perms = profile.permissions.get("modules", {}).get(str(module_id)) if profile and profile.permissions and module_id else {}
        
        visible_user_ids = security_utils.get_visible_users(db, current_user, mod_perms)
        
        query = query.filter(
            (models.Case.created_by.in_(visible_user_ids)) | 
            (models.Case.assigned_to.in_(visible_user_ids))
        )

    return query.order_by(models.Case.id.desc()).all()

@router.get("/recycle-bin", response_model=List[case_schema.CaseResponse])
def get_recycle_bin(
    module_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if not current_user.is_superadmin:
        profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
        if not profile or not profile.permissions.get("settings", {}).get("view_recycle_bin"):
            raise HTTPException(403, "No tienes permiso para ver la papelera")

    sixty_days_ago = datetime.now(timezone.utc) - timedelta(days=60)
    db.query(models.Case).filter(
        models.Case.company_id == current_user.company_id,
        models.Case.deleted_at != None,
        models.Case.deleted_at < sixty_days_ago
    ).delete()
    db.commit()

    query = db.query(models.Case).filter(
        models.Case.company_id == current_user.company_id,
        models.Case.deleted_at != None
    )
    
    if module_id:
        query = query.filter(models.Case.module_id == module_id)

    return query.order_by(models.Case.deleted_at.desc()).all()

@router.get("/{case_id}/history", response_model=List[audit_schema.AuditLogResponse])
def get_case_history(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    case = db.query(models.Case).filter(
        models.Case.id == case_id, 
        models.Case.company_id == current_user.company_id
    ).first()
    
    if not case: raise HTTPException(404, "Caso no encontrado")
        
    security_utils.check_record_permission(db, current_user, case, "view")

    history = db.query(models.AuditLog).filter(
        models.AuditLog.case_id == case_id,
        models.AuditLog.company_id == current_user.company_id
    ).order_by(models.AuditLog.created_at.desc()).all()
    
    return [{
        "id": log.id, "case_id": log.case_id, "user_id": log.user_id, "company_id": log.company_id,
        "action": log.action, "old_v": log.old_value, "new_v": log.new_value, "created_at": log.created_at
    } for log in history]

@router.get("/{case_id}", response_model=case_schema.CaseResponse)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    case = db.query(models.Case).filter(
        models.Case.id == case_id,
        models.Case.company_id == current_user.company_id
    ).first()
    if not case: raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    security_utils.check_record_permission(db, current_user, case, "view")
    
    if not current_user.is_superadmin:
        profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
        mod_perms = profile.permissions.get("modules", {}).get(str(case.module_id)) if profile and profile.permissions else {}
        
        visible_user_ids = security_utils.get_visible_users(db, current_user, mod_perms)
        if case.created_by not in visible_user_ids and case.assigned_to not in visible_user_ids:
            raise HTTPException(403, "No tienes jerarquía para ver este registro.")

    return case

@router.delete("/{case_id}")
def soft_delete_case(
    case_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    case = db.query(models.Case).filter(
        models.Case.id == case_id, 
        models.Case.company_id == current_user.company_id
    ).first()
    
    if not case: 
        raise HTTPException(404, "Caso no encontrado")
    
    security_utils.check_record_permission(db, current_user, case, "delete")

    case.deleted_at = func.now()
    
    if hasattr(case, 'deleted_by'):
        case.deleted_by = current_user.id 
    
    db.commit()
    
    log_global_event(
        db=db, 
        user_id=current_user.id, 
        company_id=current_user.company_id,
        entity_type="CASE", 
        action="SOFT_DELETE", 
        entity_id=case_id,
        details=f"Envió a la papelera el registro #{case_id} (Módulo ID {case.module_id})", 
        request=request
    )
    
    return {"message": "Caso movido a la papelera"}

@router.post("/{case_id}/restore")
def restore_case(
    case_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if not current_user.is_superadmin: 
        profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
        if not profile or not profile.permissions.get("settings", {}).get("view_recycle_bin"):
            raise HTTPException(403, "No tienes permiso para restaurar desde la papelera")
            
    case = db.query(models.Case).filter(models.Case.id == case_id, models.Case.company_id == current_user.company_id).first()
    if not case: raise HTTPException(404, "Caso no encontrado")
    case.deleted_at = None 
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="CASE", action="RESTORE", entity_id=case_id,
        details=f"Restauró el registro #{case_id} desde la papelera", request=request
    )
    
    return {"message": "Caso restaurado exitosamente"}

@router.delete("/{case_id}/permanent")
def permanent_delete_case(
    case_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if not current_user.is_superadmin: raise HTTPException(403, "Solo el administrador puede borrar permanentemente")
    case = db.query(models.Case).filter(models.Case.id == case_id, models.Case.company_id == current_user.company_id).first()
    if not case: raise HTTPException(404, "Caso no encontrado")
    
    module_id = case.module_id
    db.delete(case) 
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="CASE", action="HARD_DELETE", entity_id=case_id,
        details=f"Destruyó permanentemente el registro #{case_id} (Módulo ID {module_id})", request=request
    )
    
    return {"message": "Caso destruido permanentemente"}

@router.put("/{case_id}", response_model=case_schema.CaseResponse)
def update_case(
    case_id: int,
    case_in: CaseUpdate,
    request: Request,
    background_tasks: BackgroundTasks, # 🔥 INYECTADO
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    case = db.query(models.Case).filter(models.Case.id == case_id, models.Case.company_id == current_user.company_id).first()
    if not case: raise HTTPException(status_code=404, detail="Caso no encontrado")

    security_utils.check_record_permission(db, current_user, case, "edit")

    old_data = dict(case.data)
    old_status_id = case.status_id

    if case.status_id:
        outgoing_transitions = db.query(models.Transition).filter(
            models.Transition.from_status_id == case.status_id
        ).count()

        if outgoing_transitions > 0:
            current_status = db.query(models.Status).filter(models.Status.id == case.status_id).first()
            if current_status and current_status.blueprint_id:
                bp = db.query(models.Blueprint).filter(models.Blueprint.id == current_status.blueprint_id).first()
                if bp and bp.trigger_field:
                    trigger_f = bp.trigger_field
                    if trigger_f in case_in.data and trigger_f in case.data:
                        if case_in.data[trigger_f] != case.data[trigger_f]:
                            case_in.data[trigger_f] = case.data[trigger_f] 

    updated_data = dict(case.data)
    updated_data.update(case_in.data)
    case.data = updated_data
    
    if case_in.assigned_to is not None or hasattr(case_in, 'assigned_to'):
        case.assigned_to = case_in.assigned_to

    process_global_rules(db, case, current_user.id, "ON_UPDATE", old_data, background_tasks=background_tasks)

    if not case.status_id:
        blueprints = db.query(models.Blueprint).filter(
            models.Blueprint.company_id == current_user.company_id,
            models.Blueprint.module_id == case.module_id, 
            models.Blueprint.is_active == True
        ).all()
        for bp in blueprints:
            if bp.trigger_field and bp.trigger_value:
                val_in_case = case.data.get(bp.trigger_field)
                if str(val_in_case) == str(bp.trigger_value):
                    initial_status = db.query(models.Status).filter(models.Status.blueprint_id == bp.id, models.Status.is_initial == True).first()
                    if initial_status: 
                        case.status_id = initial_status.id
                        case.entered_status_at = func.now()
                    break
            else:
                initial_status = db.query(models.Status).filter(models.Status.blueprint_id == bp.id, models.Status.is_initial == True).first()
                if initial_status: 
                    case.status_id = initial_status.id
                    case.entered_status_at = func.now()
                break

    log_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        case_id=case.id, action="UPDATE_DATA",
        old_v={"data": old_data, "status_id": old_status_id},
        new_v={"data": case.data, "status_id": case.status_id}
    )
    db.commit()
    db.refresh(case)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="CASE", action="UPDATE", entity_id=case.id,
        details=f"Editó datos del registro #{case.id}",
        old_value=old_data, new_value=case.data, request=request
    )
    
    return case

@router.put("/{case_id}/status")
def change_case_status(
    case_id: int,
    status_in: StatusUpdate,
    request: Request, 
    background_tasks: BackgroundTasks, # 🔥 INYECTADO
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    case = db.query(models.Case).filter(
        models.Case.id == case_id,
        models.Case.company_id == current_user.company_id
    ).first()
    
    if not case: raise HTTPException(status_code=404, detail="Caso no encontrado")
    security_utils.check_record_permission(db, current_user, case, "edit")

    new_status = db.query(models.Status).filter(
        models.Status.id == status_in.new_status_id,
        models.Status.company_id == current_user.company_id
    ).first()

    if not new_status:
        raise HTTPException(status_code=400, detail="Estado no válido")

    old_status = case.status_id
    if old_status == status_in.new_status_id:
        return {"message": "El caso ya se encuentra en este estado", "new_status": case.status_id}

    case.status_id = status_in.new_status_id
    case.entered_status_at = func.now()
    
    transition = db.query(models.Transition).filter(
        models.Transition.from_status_id == old_status,
        models.Transition.to_status_id == status_in.new_status_id,
        models.Transition.company_id == current_user.company_id
    ).first()

    if transition:
        # =======================================================
        # 🔥 1. EVALUAR REGLAS DE VALIDACIÓN (BLOQUEOS) 🔥
        # =======================================================
        validations = db.query(models.TransitionValidation).filter(
            models.TransitionValidation.transition_id == transition.id
        ).all()
        
        for val in validations:
            current_value = case.data.get(val.target_field)
            failed = False
            if val.operator == "IS_EMPTY":
                if current_value is not None and str(current_value).strip() != "":
                    failed = True
            elif val.operator == "NOT_EMPTY":
                if current_value is None or str(current_value).strip() == "":
                    failed = True
            elif val.operator == "==":
                if str(current_value) != str(val.validation_value):
                    failed = True
            elif val.operator == "!=":
                if str(current_value) == str(val.validation_value):
                    failed = True
            elif val.operator == "CONTAINS":
                if val.validation_value and str(val.validation_value).lower() not in str(current_value).lower():
                    failed = True
            elif val.operator == ">":
                try: 
                    if float(current_value) <= float(val.validation_value): failed = True
                except: failed = True
            elif val.operator == "<":
                try: 
                    if float(current_value) >= float(val.validation_value): failed = True
                except: failed = True

            if failed:
                error_msg = val.error_message or f"No se cumple la regla de validación para el campo '{val.target_field}'."
                raise HTTPException(status_code=400, detail=error_msg)
            
        actions = db.query(models.TransitionAction).filter(
            models.TransitionAction.transition_id == transition.id
        ).all()
        
        if actions:
            updated_data = dict(case.data) if case.data else {}
            updated_ui = dict(case.ui_rules) if case.ui_rules else {}
            
            for act in actions:
                f = act.target_field
                t = act.action_type
                v = act.action_value
                config = act.action_config or {} 
                
                if t == "UPDATE_VALUE":
                    if v == "{NOW}":
                        updated_data[f] = datetime.now().strftime("%Y-%m-%d")
                    else:
                        updated_data[f] = v
                        
                elif t == "CHANGE_OWNER":
                    v_str = str(v)
                    if v_str.isdigit():
                        case.assigned_to = int(v_str)
                    elif v_str.startswith("role_") or v_str.startswith("profile_"):
                        parts = v_str.split("_")
                        group_type = parts[0]
                        group_id = int(parts[1])
                        
                        if group_type == "role":
                            eligible_users = db.query(models.User).filter(models.User.role_id == group_id, models.User.company_id == case.company_id, models.User.is_active == True).order_by(models.User.id).all()
                        else:
                            eligible_users = db.query(models.User).filter(models.User.profile_id == group_id, models.User.company_id == case.company_id, models.User.is_active == True).order_by(models.User.id).all()
                            
                        if eligible_users:
                            tracker = db.query(models.RoundRobinTracker).filter(
                                models.RoundRobinTracker.company_id == case.company_id,
                                models.RoundRobinTracker.group_type == group_type,
                                models.RoundRobinTracker.group_id == group_id
                            ).first()
                            
                            next_user = eligible_users[0]
                            
                            if tracker and tracker.last_user_id:
                                last_index = next((i for i, u in enumerate(eligible_users) if u.id == tracker.last_user_id), -1)
                                if last_index != -1 and last_index + 1 < len(eligible_users):
                                    next_user = eligible_users[last_index + 1]
                                    
                            case.assigned_to = next_user.id
                            
                            if not tracker:
                                tracker = models.RoundRobinTracker(company_id=case.company_id, group_type=group_type, group_id=group_id)
                                db.add(tracker)
                            tracker.last_user_id = next_user.id

                elif t == "COPY_FIELD":
                    if v and f and v in updated_data:
                        updated_data[f] = updated_data[v]

                elif t == "CREATE_RECORD":
                    target_mod_id = config.get("module_id")
                    target_form_id = config.get("form_id")
                    mapping = config.get("mapping", {})
                    
                    if target_mod_id and target_form_id:
                        new_record_data = {}
                        for tgt_field, src_info in mapping.items():
                            if src_info.get("type") == "static":
                                new_record_data[tgt_field] = src_info.get("value")
                            elif src_info.get("type") == "dynamic":
                                src_field = src_info.get("value")
                                new_record_data[tgt_field] = updated_data.get(src_field, "")
                                
                        initial_status = db.query(models.Status).join(models.Blueprint).filter(
                            models.Blueprint.module_id == target_mod_id,
                            models.Blueprint.company_id == case.company_id,
                            models.Blueprint.is_active == True,
                            models.Status.is_initial == True
                        ).first()
                        
                        new_case = models.Case(
                            company_id=case.company_id,
                            created_by=current_user.id,
                            module_id=target_mod_id,
                            status_id=initial_status.id if initial_status else None,
                            form_id=target_form_id,
                            data=new_record_data,
                            ui_rules={}
                        )
                        db.add(new_case)
                        db.flush() 
                        
                        log_event(
                            db=db, user_id=current_user.id, company_id=case.company_id,
                            case_id=case.id, action="AUTOMATION_CREATE_RECORD",
                            old_v=None,
                            new_v={"created_case_id": new_case.id, "target_module_id": target_mod_id}
                        )
                        
                elif t in ["WEBHOOK_OUT", "SEND_SLACK"]:
                    # 🔥 FASE 3: INTEGRACIONES EXTERNAS EN TRANSICIONES 🔥
                    try:
                        execute_webhook(act, case.id, updated_data, new_status.name)
                    except Exception as e:
                        print(f"Error ejecutando integración (Transición ID {transition.id}): {e}")

                elif t == "CUSTOM_FUNCTION" and act.function_code:
                    local_env = {
                        "case_data": updated_data,
                        "user_id": current_user.id,
                        "current_date": datetime.now().strftime("%Y-%m-%d"),
                        "http": SafeHTTPClient()
                    }
                    try:
                        exec(act.function_code, {"__builtins__": {}}, local_env)
                        updated_data = local_env.get("case_data", updated_data)
                    except Exception as e:
                        print(f"Error ejecutando Low-Code en transición: {e}")

                elif t == "SEND_NOTIFICATION" and f:
                    try:
                        targets = []
                        if config.get("notify_users"):
                            targets.extend(config["notify_users"])
                        if config.get("notify_roles"):
                            role_users = db.query(models.User.id).filter(models.User.role_id.in_(config["notify_roles"]), models.User.company_id == case.company_id).all()
                            targets.extend([u[0] for u in role_users])
                        if config.get("notify_profiles"):
                            profile_users = db.query(models.User.id).filter(models.User.profile_id.in_(config["notify_profiles"]), models.User.company_id == case.company_id).all()
                            targets.extend([u[0] for u in profile_users])
                            
                        if not targets:
                            targets = [case.created_by if case.created_by else current_user.id]
                            
                        unique_targets = list(set(targets))
                        
                        for target_id in unique_targets:
                            notification = models.Notification(
                                company_id=case.company_id,
                                user_id=target_id,
                                case_id=case.id,
                                module_id=case.module_id,
                                title=f, 
                                message=v or "Se ha disparado una alerta en el flujo." 
                            )
                            db.add(notification)
                            
                            # 🔥 NUEVO: ENVIAR POR CORREO SI ESTÁ MARCADO (EN SEGUNDO PLANO) 🔥
                            if config.get("send_email"):
                                user_obj = db.query(models.User).filter(models.User.id == target_id).first()
                                if user_obj and user_obj.email:
                                    email_body = f"""
                                    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 8px;">
                                        <h2 style="color: #2563eb; margin-top: 0;">{f}</h2>
                                        <p style="color: #374151; font-size: 16px; line-height: 1.5;">{v or 'Se ha disparado una alerta en AegisFlow.'}</p>
                                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                                        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
                                            Este es un mensaje automático del sistema. Registro afectado: #{case.id}
                                        </p>
                                    </div>
                                    """
                                    background_tasks.add_task(
                                        safe_send_email_background,
                                        case.company_id,
                                        user_obj.email,
                                        f,
                                        email_body
                                    )

                    except Exception as e:
                        pass
                        
                elif t.startswith("SET_") and f:
                    target_fields = [f] 
                    
                    if f.startswith("section_"):
                        section_id = int(f.replace("section_", ""))
                        fields_in_section = db.query(models.FormField).filter(
                            models.FormField.section_id == section_id,
                            models.FormField.company_id == current_user.company_id
                        ).all()
                        target_fields = [field.api_name or field.label for field in fields_in_section]
                        
                    for target_f in target_fields:
                        if target_f not in updated_ui:
                            updated_ui[target_f] = {}
                        if t == "SET_HIDDEN": updated_ui[target_f]["hidden"] = True
                        elif t == "SET_VISIBLE": updated_ui[target_f]["hidden"] = False
                        elif t == "SET_READONLY": updated_ui[target_f]["readonly"] = True
                        elif t == "SET_EDITABLE": updated_ui[target_f]["readonly"] = False
                        elif t == "SET_REQUIRED": updated_ui[target_f]["required"] = True
                        elif t == "SET_OPTIONAL": updated_ui[target_f]["required"] = False

            case.data = updated_data
            case.ui_rules = updated_ui

    log_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        case_id=case.id, action="UPDATE_STATUS",
        old_v={"status_id": old_status},
        new_v={"status_id": case.status_id}
    )
    
    db.commit()
    db.refresh(case)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="CASE", action="UPDATE_STATUS", entity_id=case.id,
        details=f"Avanzó el registro #{case.id} de estado (ID: {old_status} -> {case.status_id})", request=request
    )
    
    return {"message": "Estado y automatizaciones actualizados con éxito", "new_status": case.status_id}


# =======================================================
# 🔥 IMPORTACIÓN MASIVA DESDE EXCEL/CSV 🔥
# =======================================================

@router.post("/import/analyze/{module_id}")
async def analyze_import_file(
    module_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    security_utils.check_module_permission(db, current_user, module_id, "create")

    content = await file.read()
    if len(content) > MAX_IMPORT_FILE_SIZE:
        raise HTTPException(400, "El archivo es demasiado grande (Máximo 5MB).")

    filename = file.filename.lower()

    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(400, "Formato no soportado. Usa .csv o .xlsx")

        columns = df.columns.tolist()
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(400, f"Error al leer el archivo: {str(e)}")


@router.post("/import/execute/{module_id}")
async def execute_import(
    module_id: int,
    request: Request,
    file: UploadFile = File(...),
    mapping: str = Form(...), 
    form_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    security_utils.check_module_permission(db, current_user, module_id, "create")
    
    form = db.query(models.Form).filter(
        models.Form.id == form_id, 
        models.Form.company_id == current_user.company_id
    ).first()
    if not form:
        raise HTTPException(status_code=403, detail="El formulario no es válido o no pertenece a tu empresa.")

    try:
        mapping_dict = json.loads(mapping) 
    except:
        raise HTTPException(400, "El formato de mapeo no es válido.")

    content = await file.read()
    if len(content) > MAX_IMPORT_FILE_SIZE:
        raise HTTPException(400, "El archivo es demasiado grande (Máximo 5MB).")

    filename = file.filename

    try:
        if filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.lower().endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(400, "Formato no soportado. Usa .csv o .xlsx")

        df = df.fillna("")

        new_batch = models.ImportBatch(
            company_id=current_user.company_id,
            user_id=current_user.id,
            module_id=module_id,
            filename=filename,
            record_count=0,
            status="COMPLETED"
        )
        db.add(new_batch)
        db.flush() 

        blueprints = db.query(models.Blueprint).filter(
            models.Blueprint.company_id == current_user.company_id,
            models.Blueprint.module_id == module_id,
            models.Blueprint.is_active == True
        ).all()

        initial_status_id = None
        if blueprints:
            bp = blueprints[0] 
            status = db.query(models.Status).filter(models.Status.blueprint_id == bp.id, models.Status.is_initial == True).first()
            if status:
                initial_status_id = status.id

        cases_to_create = []
        for index, row in df.iterrows():
            case_data = {}
            for excel_col, api_name in mapping_dict.items():
                if excel_col in df.columns:
                    val = row[excel_col]
                    case_data[api_name] = val if val != "" else ""

            new_case = models.Case(
                company_id=current_user.company_id,
                created_by=current_user.id,
                module_id=module_id,
                status_id=initial_status_id,
                form_id=form_id,
                data=case_data,
                ui_rules={},
                import_batch_id=new_batch.id 
            )
            cases_to_create.append(new_case)

        db.add_all(cases_to_create)
        new_batch.record_count = len(cases_to_create)
        db.commit()
        
        log_global_event(
            db=db, user_id=current_user.id, company_id=current_user.company_id,
            entity_type="IMPORT_BATCH", action="IMPORT_DATA", entity_id=new_batch.id,
            details=f"Importó {len(cases_to_create)} registros al módulo ID {module_id} usando '{filename}'", request=request
        )

        return {"message": f"Se importaron {len(cases_to_create)} registros exitosamente."}

    except Exception as e:
        db.rollback()
        raise HTTPException(400, f"Error al procesar la importación: {str(e)}")


@router.get("/import/history/{module_id}")
def get_import_history(
    module_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    security_utils.check_module_permission(db, current_user, module_id, "view")
    
    batches = db.query(models.ImportBatch).filter(
        models.ImportBatch.company_id == current_user.company_id,
        models.ImportBatch.module_id == module_id
    ).order_by(models.ImportBatch.created_at.desc()).all()
    
    return [{
        "id": b.id,
        "filename": b.filename,
        "record_count": b.record_count,
        "status": b.status,
        "created_at": b.created_at,
        "user_id": b.user_id
    } for b in batches]


@router.post("/import/undo/{batch_id}")
def undo_import(
    batch_id: int, 
    request: Request, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    batch = db.query(models.ImportBatch).filter(
        models.ImportBatch.id == batch_id,
        models.ImportBatch.company_id == current_user.company_id
    ).first()

    if not batch: 
        raise HTTPException(404, "Lote de importación no encontrado")
        
    security_utils.check_module_permission(db, current_user, batch.module_id, "delete")

    if batch.status == "UNDONE": 
        raise HTTPException(400, "Esta importación ya fue deshecha anteriormente")

    db.query(models.Case).filter(models.Case.import_batch_id == batch_id).delete(synchronize_session=False)

    batch_filename = batch.filename
    records_deleted = batch.record_count
    batch.status = "UNDONE"
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="IMPORT_BATCH", action="UNDO_IMPORT", entity_id=batch_id,
        details=f"Deshizo la importación '{batch_filename}' destruyendo {records_deleted} registros", request=request
    )

    return {"message": f"Importación deshecha. Se eliminaron permanentemente {records_deleted} registros."}

# =======================================================
# 🔥 FASE 1: CHAT CONTEXTUAL Y COMENTARIOS 🔥
# =======================================================
import re

@router.get("/{case_id}/comments", response_model=List[case_schema.CaseCommentResponse])
def get_case_comments(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    case = db.query(models.Case).filter(
        models.Case.id == case_id,
        models.Case.company_id == current_user.company_id
    ).first()
    if not case:
        raise HTTPException(404, "Caso no encontrado")

    security_utils.check_record_permission(db, current_user, case, "view")

    comments = db.query(models.CaseComment, models.User.first_name, models.User.last_name).outerjoin(
        models.User, models.CaseComment.user_id == models.User.id
    ).filter(
        models.CaseComment.case_id == case_id,
        models.CaseComment.company_id == current_user.company_id
    ).order_by(models.CaseComment.created_at.asc()).all() 

    response = []
    for comment, fname, lname in comments:
        user_name = "Sistema" if comment.is_system_message else (f"{fname or ''} {lname or ''}".strip() or "Usuario Desconocido")
        response.append({
            "id": comment.id,
            "content": comment.content,
            "case_id": comment.case_id,
            "user_id": comment.user_id,
            "user_name": user_name,
            "is_system_message": comment.is_system_message,
            "created_at": comment.created_at
        })
    return response

@router.post("/{case_id}/comments", response_model=case_schema.CaseCommentResponse)
def add_case_comment(
    case_id: int,
    comment_in: case_schema.CaseCommentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    case = db.query(models.Case).filter(
        models.Case.id == case_id,
        models.Case.company_id == current_user.company_id
    ).first()
    if not case:
        raise HTTPException(404, "Caso no encontrado")

    security_utils.check_record_permission(db, current_user, case, "view")

    raw_content = comment_in.content

    mentions = re.findall(r'@\[([^\]]+)\]\(([^)]+)\)', raw_content)
    clean_content = re.sub(r'@\[([^\]]+)\]\([^)]+\)', r'@\1', raw_content)

    new_comment = models.CaseComment(
        company_id=current_user.company_id,
        case_id=case_id,
        user_id=current_user.id,
        content=clean_content,
        is_system_message=False
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    if mentions:
        for display_name, user_id_str in mentions:
            try:
                target_user_id = int(user_id_str)
                target_user = db.query(models.User).filter(
                    models.User.id == target_user_id,
                    models.User.company_id == current_user.company_id
                ).first()

                if target_user and target_user.id != current_user.id:
                    notification = models.Notification(
                        company_id=current_user.company_id,
                        user_id=target_user.id,
                        case_id=case_id,
                        module_id=case.module_id,
                        title="Nueva Mención",
                        message=f"{current_user.first_name or 'Alguien'} te mencionó: '{clean_content[:40]}...'"
                    )
                    db.add(notification)
            except ValueError:
                continue 
        db.commit()

    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="CASE_COMMENT", action="CREATE", entity_id=new_comment.id,
        details=f"Añadió un comentario en el registro #{case_id}", request=request
    )

    user_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
    return {
        "id": new_comment.id,
        "content": new_comment.content,
        "case_id": new_comment.case_id,
        "user_id": new_comment.user_id,
        "user_name": user_name or current_user.email,
        "is_system_message": new_comment.is_system_message,
        "created_at": new_comment.created_at
    }
    
# 1. Creamos un pequeño esquema para recibir los datos masivos
class BulkUpdatePayload(BaseModel):
    case_ids: List[int]
    field_api_name: str
    new_value: Any

# 2. El endpoint que hace la magia
@router.put("/bulk/update")
def bulk_update_cases(
    payload: BulkUpdatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Actualiza un campo específico para múltiples registros en una sola transacción.
    """
    cases = db.query(models.Case).filter(
        models.Case.id.in_(payload.case_ids),
        models.Case.company_id == current_user.company_id
    ).all()

    if not cases:
        raise HTTPException(status_code=404, detail="No se encontraron registros válidos para actualizar.")

    updated_count = 0
    
    for case in cases:
        # Clonamos el diccionario de data para que SQLAlchemy detecte el cambio
        current_data = dict(case.data) if case.data else {}
        
        # Actualizamos el campo
        current_data[payload.field_api_name] = payload.new_value
        case.data = current_data
        
        updated_count += 1

    # Hacemos 1 solo COMMIT a la base de datos para los 100 registros. ¡Súper eficiente!
    db.commit()

    return {"message": f"{updated_count} registros actualizados exitosamente."}