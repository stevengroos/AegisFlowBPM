from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import List
import json

from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.global_audit import log_global_event
from app.core.audit import log_event  

# Importamos tu motor de reglas para que se disparen cuando el webhook cree/actualice un caso
from app.api.v1.endpoints.cases import process_global_rules, StatusUpdate

router = APIRouter()

# ==========================
# ESQUEMAS
# ==========================
class WebhookCreate(BaseModel):
    name: str
    module_id: int
    form_id: int

class WebhookResponse(BaseModel):
    id: int
    name: str
    token: str
    module_id: int
    form_id: int
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


# =======================================================
# 🔥 1. API PÚBLICA RESTful (INBOUND WEBHOOKS) 🔥
# =======================================================

@router.post("/in/{token}")
async def create_external_record(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """[POST] Crea un nuevo caso en el módulo y formulario vinculado."""
    webhook = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.token == token,
        models.WebhookEndpoint.is_active == True
    ).first()

    if not webhook:
        raise HTTPException(status_code=401, detail="Token de webhook inválido o inactivo.")

    try:
        payload = await request.json()
    except:
        raise HTTPException(status_code=400, detail="El cuerpo de la petición debe ser un JSON válido.")

    blueprint = db.query(models.Blueprint).filter(
        models.Blueprint.company_id == webhook.company_id,
        models.Blueprint.module_id == webhook.module_id,
        models.Blueprint.is_active == True
    ).first()

    initial_status_id = None
    if blueprint:
        status = db.query(models.Status).filter(
            models.Status.blueprint_id == blueprint.id, 
            models.Status.is_initial == True
        ).first()
        if status:
            initial_status_id = status.id

    new_case = models.Case(
        company_id=webhook.company_id,
        created_by=webhook.created_by,
        module_id=webhook.module_id,
        form_id=webhook.form_id,
        status_id=initial_status_id,
        data=payload,
        ui_rules={}
    )

    system_user_id = webhook.created_by or 0
    process_global_rules(db, new_case, system_user_id, "ON_CREATE", background_tasks=background_tasks)

    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    return {"status": "success", "message": "Registro creado.", "case_id": new_case.id}


@router.get("/in/{token}/{case_id}")
def get_external_record(
    token: str,
    case_id: int,
    db: Session = Depends(get_db)
):
    """[GET] Consulta los datos de un caso específico usando el token como autorización."""
    webhook = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.token == token,
        models.WebhookEndpoint.is_active == True
    ).first()

    if not webhook:
        raise HTTPException(status_code=401, detail="Token de webhook inválido.")

    case = db.query(models.Case).filter(
        models.Case.id == case_id, 
        models.Case.company_id == webhook.company_id,
        models.Case.module_id == webhook.module_id
    ).first()

    if not case:
        raise HTTPException(status_code=404, detail="Registro no encontrado en este módulo.")

    return {
        "status": "success", 
        "case_id": case.id, 
        "status_id": case.status_id,
        "created_at": case.created_at,
        "data": case.data
    }


@router.put("/in/{token}/{case_id}")
async def update_external_record(
    token: str,
    case_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """[PUT] Actualiza la data de un caso existente. Hace un 'merge' del JSON."""
    webhook = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.token == token,
        models.WebhookEndpoint.is_active == True
    ).first()

    if not webhook:
        raise HTTPException(status_code=401, detail="Token de webhook inválido.")

    case = db.query(models.Case).filter(
        models.Case.id == case_id, 
        models.Case.company_id == webhook.company_id,
        models.Case.module_id == webhook.module_id
    ).first()

    if not case:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")

    try:
        payload = await request.json()
    except:
        raise HTTPException(status_code=400, detail="El cuerpo debe ser un JSON válido.")

    # Guardamos los datos antiguos para la auditoría
    old_data = dict(case.data) if case.data else {}
    
    # Hacemos el merge con los nuevos datos
    current_data = dict(case.data) if case.data else {}
    current_data.update(payload)
    case.data = current_data

    system_user_id = webhook.created_by or 0
    process_global_rules(db, case, system_user_id, "ON_UPDATE", old_data=old_data, background_tasks=background_tasks)

    # 🔥 FIX: Refrescamos los datos locales para que la auditoría guarde la data limpia y el nuevo estado 🔥
    current_data = dict(case.data) if case.data else {}

    # 🔥 1. REGISTRO EN LA LÍNEA DE TIEMPO DEL CASO (PRODUCTO)
    log_event(
        db=db, user_id=system_user_id, company_id=webhook.company_id,
        case_id=case.id, action="UPDATE_DATA_API", # Le ponemos un nombre especial para saber que vino del Webhook
        old_v={"data": old_data, "status_id": case.status_id},
        new_v={"data": current_data, "status_id": case.status_id}
    )
    
    # 🔥 2. REGISTRO EN LA AUDITORÍA GLOBAL DE LA EMPRESA
    log_global_event(
        db=db, user_id=system_user_id, company_id=webhook.company_id,
        entity_type="CASE", action="WEBHOOK_UPDATE", entity_id=case.id,
        details=f"Registro #{case.id} actualizado mediante la API de Integración (Webhook: {webhook.name}).",
        old_value=old_data, new_value=current_data, request=request
    )

    db.commit()

    return {"status": "success", "message": "Registro actualizado.", "case_id": case.id}


# =======================================================
# 🔥 2. GESTIÓN INTERNA (CRUD PARA ADMINS) 🔥
# =======================================================

@router.post("/", response_model=dict)
def create_webhook(
    webhook_in: WebhookCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden crear Webhooks.")

    new_webhook = models.WebhookEndpoint(
        company_id=current_user.company_id,
        module_id=webhook_in.module_id,
        form_id=webhook_in.form_id,
        created_by=current_user.id,
        name=webhook_in.name
    )
    
    db.add(new_webhook)
    db.commit()
    db.refresh(new_webhook)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="WEBHOOK", action="CREATE", entity_id=new_webhook.id,
        details=f"Creó el webhook '{new_webhook.name}' para el módulo {webhook_in.module_id}", request=request
    )

    return {
        "message": "Webhook generado exitosamente",
        "webhook_url": f"/api/v1/webhooks/in/{new_webhook.token}",
        "id": new_webhook.id
    }

@router.get("/module/{module_id}", response_model=List[WebhookResponse])
def get_webhooks(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="No tienes permisos.")

    webhooks = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.company_id == current_user.company_id,
        models.WebhookEndpoint.module_id == module_id
    ).order_by(models.WebhookEndpoint.created_at.desc()).all()
    
    for w in webhooks:
        w.created_at = w.created_at.strftime("%Y-%m-%d %H:%M:%S") if w.created_at else ""
        
    return webhooks

@router.delete("/{webhook_id}")
def delete_webhook(
    webhook_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="No tienes permisos.")

    webhook = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.id == webhook_id,
        models.WebhookEndpoint.company_id == current_user.company_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    db.delete(webhook)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="WEBHOOK", action="DELETE", entity_id=webhook_id,
        details=f"Eliminó el webhook '{webhook.name}'", request=request
    )

    return {"message": "Webhook eliminado permanentemente."}


@router.get("/{webhook_id}/example")
def get_webhook_json_example(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    webhook = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.id == webhook_id,
        models.WebhookEndpoint.company_id == current_user.company_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    fields = db.query(models.FormField).filter(
        models.FormField.form_id == webhook.form_id,
        models.FormField.is_active == True
    ).order_by(models.FormField.order).all()

    example_payload = {}

    for f in fields:
        key = f.api_name or f.label
        if not key: continue

        if f.field_type in ['number', 'currency']:
            example_payload[key] = 1500.50
        elif f.field_type == 'checkbox':
            example_payload[key] = True
        elif f.field_type == 'date':
            example_payload[key] = "2026-10-15"
        elif f.field_type == 'phone':
            example_payload[key] = "595981123456"
        elif f.field_type in ['file', 'image', 'url']:
            example_payload[key] = "https://ejemplo.com/archivo.pdf"
        elif f.field_type == 'subform':
            sub_obj = {}
            if f.subform_config and isinstance(f.subform_config, list):
                for col in f.subform_config:
                    col_key = col.get('label', 'columna')
                    col_type = col.get('type', 'text')
                    if col_type in ['number', 'currency']: sub_obj[col_key] = 99.99
                    elif col_type == 'date': sub_obj[col_key] = "2026-10-15"
                    else: sub_obj[col_key] = "Dato de tabla"
            example_payload[key] = [sub_obj]
        else:
            example_payload[key] = f"Texto de ejemplo para {f.label}"

    # =======================================================
    # 🔥 FIX: DOCUMENTAR LA LLAVE SECRETA EN EL FRONTEND 🔥
    # =======================================================
    example_payload["_cambiar_estado_id"] = "OPCIONAL: Envía aquí el ID numérico del estado para mover la tarjeta."

    return {"example": example_payload}


# =======================================================
# 🔥 3. EL OÍDO DE SIGNATURIT (WEBHOOK DE EVENTOS) 🔥
# =======================================================
@router.post("/signaturit")
async def signaturit_webhook(
    request: Request,
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="El cuerpo debe ser un JSON válido.")

    document = payload.get("document", {})
    signaturit_id = document.get("id")
    
    if not signaturit_id:
        signaturit_id = payload.get("signature", {}).get("id")

    if not signaturit_id:
        return {"status": "ignored", "message": "No se encontró un ID de firma válido en el payload."}

    sig_request = db.query(models.SignatureRequest).filter(
        models.SignatureRequest.signaturit_id == signaturit_id
    ).first()

    if not sig_request:
        return {"status": "ignored", "message": "Registro no encontrado en AegisFlow."}

    nuevo_estado = document.get("status")
    if nuevo_estado:
        sig_request.status = nuevo_estado

    event_type = payload.get("event")
    
    if event_type == "document_signed":
        log_global_event(
            db=db, user_id=sig_request.created_by, company_id=sig_request.company_id,
            entity_type="SIGNATURE", action="DOCUMENT_SIGNED", entity_id=sig_request.case_id,
            details=f"Documento de Signaturit ({signaturit_id}) acaba de ser firmado.", request=request
        )

    elif event_type == "signature_request_completed" or nuevo_estado == "completed":
        log_global_event(
            db=db, user_id=sig_request.created_by, company_id=sig_request.company_id,
            entity_type="SIGNATURE", action="COMPLETED", entity_id=sig_request.case_id,
            details=f"Todos los firmantes completaron el documento ({signaturit_id}).", request=request
        )
        
        case = db.query(models.Case).filter(models.Case.id == sig_request.case_id).first()
        if case and case.status_id:
            outgoing_transitions = db.query(models.Transition).filter(
                models.Transition.from_status_id == case.status_id
            ).all()
            
            for t in outgoing_transitions:
                val = db.query(models.TransitionValidation).filter(
                    models.TransitionValidation.transition_id == t.id,
                    models.TransitionValidation.operator == "HAS_COMPLETED_SIGNATURE"
                ).first()
                
                if val:
                    from app.api.v1.endpoints.cases import change_case_status 
                    system_user = db.query(models.User).filter(models.User.id == sig_request.created_by).first()
                    if system_user:
                        try:
                            change_case_status(
                                case_id=case.id,
                                status_in=StatusUpdate(new_status_id=t.to_status_id),
                                request=request,
                                background_tasks=background_tasks,
                                db=db,
                                current_user=system_user
                            )
                        except Exception as e:
                            print(f"Error en el auto-avance de Signaturit: {str(e)}")
                    break 

    db.commit()
    return {"status": "success", "message": "Webhook procesado correctamente"}

# =======================================================
# 🔥 4. EL OÍDO DE CHATWOOT (OMNICANALIDAD CRM) 🔥
# =======================================================
@router.post("/chatwoot/{module_id}")
async def chatwoot_webhook(
    module_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Recibe eventos desde Chatwoot (WhatsApp, Instagram, etc) y crea Casos en AegisFlow.
    Esta URL debes pegarla en la configuración de Integraciones de tu cuenta de Chatwoot.
    Ej: https://tu-api.com/api/v1/webhooks/chatwoot/15
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON inválido.")

    # 1. Verificamos que la integración de Chatwoot esté activa para este módulo
    integration = db.query(models.ModuleIntegration).filter(
        models.ModuleIntegration.module_id == module_id,
        models.ModuleIntegration.provider_name == 'chatwoot',
        models.ModuleIntegration.is_active == True
    ).first()

    if not integration:
        return {"status": "ignored", "message": "La integración de Chatwoot está inactiva o no configurada para este módulo."}

    event = payload.get("event")
    message_type = payload.get("message_type")

    # Solo nos interesan los mensajes entrantes (del cliente) para crear el caso
    if event == "message_created" and message_type == "incoming":
        conversation = payload.get("conversation", {})
        sender = payload.get("sender", {})
        
        conv_id = conversation.get("id")
        content = payload.get("content", "")
        
        # 2. Escudo Anti-Duplicados: Buscamos si ya existe un caso abierto para esta conversación
        # Utilizamos PostgreSQL puro para buscar dentro del JSON 'data'
        existing_case = db.query(models.Case).filter(
            models.Case.module_id == module_id,
            models.Case.company_id == integration.company_id,
            models.Case.data.op("->>")("chatwoot_conversation_id") == str(conv_id)
        ).first()

        if existing_case:
            # Si el ticket ya existe, ignoramos la creación de uno nuevo.
            # (En el futuro, podríamos inyectar este mensaje en el historial del caso)
            return {"status": "ignored", "message": "Ya existe un caso activo para esta conversación."}

        # 3. Buscamos el estado inicial del Blueprint para inyectar el caso
        blueprint = db.query(models.Blueprint).filter(
            models.Blueprint.company_id == integration.company_id,
            models.Blueprint.module_id == module_id,
            models.Blueprint.is_active == True
        ).first()

        initial_status_id = None
        if blueprint:
            status = db.query(models.Status).filter(
                models.Status.blueprint_id == blueprint.id, 
                models.Status.is_initial == True
            ).first()
            if status:
                initial_status_id = status.id

        # 4. Formatear los datos extraídos de Chatwoot
        # Extraemos el teléfono, el nombre y por qué canal nos escribió
        case_data = {
            "chatwoot_conversation_id": str(conv_id),
            "mensaje_original": content,
            "nombre_cliente": sender.get("name", "Cliente Desconocido"),
            "email_cliente": sender.get("email", ""),
            "telefono_cliente": sender.get("phone_number", ""),
            "canal_origen": conversation.get("channel", "Desconocido") # ej. "Channel::Whatsapp"
        }

        # 5. Crear el Caso en la Base de Datos
        new_case = models.Case(
            company_id=integration.company_id,
            created_by=0, # 0 indica que fue creado por el Sistema/API
            module_id=module_id,
            form_id=None, # Como viene de una API, no requiere atarse a un formulario estrictamente
            status_id=initial_status_id,
            data=case_data,
            ui_rules={}
        )

        # 6. Disparar reglas globales (Automatizaciones)
        # Esto permite que AegisFlow envíe un email al equipo de ventas diciendo "Hay un nuevo WhatsApp"
        process_global_rules(db, new_case, 0, "ON_CREATE", background_tasks=background_tasks)

        db.add(new_case)
        db.commit()
        
        return {"status": "success", "message": "Caso de Chatwoot creado exitosamente.", "case_id": new_case.id}

    return {"status": "ignored", "message": "Evento no procesable para la creación de un caso."}