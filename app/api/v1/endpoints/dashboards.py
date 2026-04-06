from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
import pandas as pd
import traceback
import json 

from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.security_utils import check_settings_permission
from app.core.global_audit import log_global_event

router = APIRouter()

# ==========================================
# SISTEMA DE CACHÉ EN MEMORIA 
# ==========================================
REPORT_CACHE = {}
CACHE_EXPIRATION_MINUTES = 5

def get_cache_key(company_id: int, report_id: int) -> str:
    # 🔥 PENTEST FIX: Llave Multi-Tenant para evitar fuga de datos entre empresas 🔥
    return f"{company_id}_{report_id}"

# ==========================================
# ESQUEMAS PYDANTIC
# ==========================================
class ReportBase(BaseModel):
    name: str
    chart_type: str
    function_code: str
    config: Optional[Dict[str, Any]] = {}
    grid_layout: Optional[Dict[str, Any]] = {"w": 6, "h": 4, "x": 0, "y": 0}

class ReportCreate(ReportBase):
    pass

class ReportResponse(ReportBase):
    id: int
    dashboard_id: int
    company_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class DashboardBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "bar-chart-2"
    order: Optional[int] = 0
    is_active: Optional[bool] = True

class DashboardCreate(DashboardBase):
    pass

class DashboardResponse(DashboardBase):
    id: int
    company_id: int
    created_at: datetime
    reports: List[ReportResponse] = []
    class Config:
        from_attributes = True

class TestScriptPayload(BaseModel):
    function_code: str

class ReportOrderItem(BaseModel):
    report_id: int
    order: int

class DashboardLayoutUpdate(BaseModel):
    layout: List[ReportOrderItem]


# ==========================================
# ENDPOINTS DE DASHBOARDS
# ==========================================
@router.get("/", response_model=List[DashboardResponse])
def get_dashboards(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    return db.query(models.Dashboard).filter(
        models.Dashboard.company_id == current_user.company_id,
        models.Dashboard.is_active == True
    ).order_by(models.Dashboard.order.asc()).all()

@router.post("/", response_model=DashboardResponse)
def create_dashboard(
    dashboard_in: DashboardCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    new_dashboard = models.Dashboard(**dashboard_in.dict(), company_id=current_user.company_id)
    db.add(new_dashboard)
    db.commit()
    db.refresh(new_dashboard)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="DASHBOARD", action="CREATE", entity_id=new_dashboard.id,
        details=f"Creó el dashboard '{new_dashboard.name}'", request=request
    )
    return new_dashboard

@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: int, 
    dashboard_in: DashboardCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    dashboard = db.query(models.Dashboard).filter(
        models.Dashboard.id == dashboard_id, 
        models.Dashboard.company_id == current_user.company_id
    ).first()
    
    if not dashboard: 
        raise HTTPException(404, "Dashboard no encontrado")
        
    old_name = dashboard.name
    
    for key, value in dashboard_in.dict(exclude_unset=True).items():
        setattr(dashboard, key, value)
        
    db.commit()
    db.refresh(dashboard)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="DASHBOARD", action="UPDATE", entity_id=dashboard.id,
        details=f"Renombró/Editó el dashboard '{old_name}' a '{dashboard.name}'", request=request
    )
    return dashboard

@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    dashboard = db.query(models.Dashboard).filter(models.Dashboard.id == dashboard_id, models.Dashboard.company_id == current_user.company_id).first()
    if not dashboard: raise HTTPException(404, "Dashboard no encontrado")
    
    for report in dashboard.reports:
        # 🔥 PENTEST FIX: Limpiar caché usando la llave compuesta
        cache_key = get_cache_key(current_user.company_id, report.id)
        REPORT_CACHE.pop(cache_key, None)
        
    dash_name = dashboard.name
    db.delete(dashboard)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="DASHBOARD", action="DELETE", entity_id=dashboard_id,
        details=f"Eliminó el dashboard '{dash_name}' y todos sus reportes", request=request
    )
    return {"message": "Dashboard eliminado"}


@router.put("/{dashboard_id}/layout")
def update_dashboard_layout(
    dashboard_id: int,
    payload: DashboardLayoutUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    dash = db.query(models.Dashboard).filter(
        models.Dashboard.id == dashboard_id, 
        models.Dashboard.company_id == current_user.company_id
    ).first()
    if not dash: raise HTTPException(404, "Dashboard no encontrado")

    for item in payload.layout:
        report = db.query(models.Report).filter(
            models.Report.id == item.report_id, 
            models.Report.dashboard_id == dashboard_id
        ).first()
        
        if report:
            layout = dict(report.grid_layout) if report.grid_layout else {}
            layout["order"] = item.order
            report.grid_layout = layout
            # 🔥 PENTEST FIX: Limpiar caché usando la llave compuesta
            cache_key = get_cache_key(current_user.company_id, report.id)
            REPORT_CACHE.pop(cache_key, None)

    db.commit()

    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="DASHBOARD", action="UPDATE_LAYOUT", entity_id=dashboard_id,
        details=f"Reordenó los gráficos del dashboard '{dash.name}'", request=request
    )
    return {"message": "Diseño guardado exitosamente"}


# ==========================================
# ENDPOINTS DE REPORTES (WIDGETS)
# ==========================================
@router.post("/{dashboard_id}/reports", response_model=ReportResponse)
def create_report(
    dashboard_id: int, 
    report_in: ReportCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    dash = db.query(models.Dashboard).filter(models.Dashboard.id == dashboard_id, models.Dashboard.company_id == current_user.company_id).first()
    if not dash: raise HTTPException(404, "Dashboard no encontrado")
    
    new_report = models.Report(**report_in.dict(), dashboard_id=dashboard_id, company_id=current_user.company_id)
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="REPORT", action="CREATE", entity_id=new_report.id,
        details=f"Creó el reporte '{new_report.name}' en el dashboard '{dash.name}'", request=request
    )
    return new_report

@router.put("/reports/{report_id}", response_model=ReportResponse)
def update_report(
    report_id: int, 
    report_in: ReportCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    report = db.query(models.Report).filter(models.Report.id == report_id, models.Report.company_id == current_user.company_id).first()
    if not report: raise HTTPException(404, "Reporte no encontrado")
    
    for key, value in report_in.dict(exclude_unset=True).items():
        setattr(report, key, value)
        
    db.commit()
    db.refresh(report)
    
    # 🔥 PENTEST FIX: Limpiar caché usando la llave compuesta
    cache_key = get_cache_key(current_user.company_id, report.id)
    REPORT_CACHE.pop(cache_key, None)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="REPORT", action="UPDATE", entity_id=report.id,
        details=f"Editó el reporte '{report.name}'", request=request
    )
    return report

@router.delete("/reports/{report_id}")
def delete_report(
    report_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    report = db.query(models.Report).filter(models.Report.id == report_id, models.Report.company_id == current_user.company_id).first()
    if not report: raise HTTPException(404, "Reporte no encontrado")
    
    # 🔥 PENTEST FIX: Limpiar caché usando la llave compuesta
    cache_key = get_cache_key(current_user.company_id, report.id)
    REPORT_CACHE.pop(cache_key, None)
    
    rep_name = report.name
    db.delete(report)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="REPORT", action="DELETE", entity_id=report_id,
        details=f"Eliminó el reporte '{rep_name}'", request=request
    )
    return {"message": "Reporte eliminado"}

# ==========================================
# MOTOR DE EJECUCIÓN (HÍBRIDO SEGURO)
# ==========================================
def evaluate_rule(data: dict, rule: dict) -> bool:
    field = rule.get("field")
    operator = rule.get("operator")
    target_value = rule.get("value")
    
    actual_value = data.get(field)
    if actual_value is None: actual_value = ""
    
    try:
        if operator == "==": return str(actual_value) == str(target_value)
        if operator == "!=": return str(actual_value) != str(target_value)
        if operator == "<":  return float(actual_value) < float(target_value)
        if operator == ">":  return float(actual_value) > float(target_value)
        if operator == "<=": return float(actual_value) <= float(target_value)
        if operator == ">=": return float(actual_value) >= float(target_value)
        if operator == "contains": return str(target_value).lower() in str(actual_value).lower()
        if operator == "notContains": return str(target_value).lower() not in str(actual_value).lower()
        if operator == "null": return actual_value == ""
        if operator == "notNull": return actual_value != ""
    except (ValueError, TypeError):
        return False
        
    return False

def evaluate_group(data: dict, group: dict) -> bool:
    if not group or "rules" not in group or not group["rules"]:
        return True 
        
    combinator = group.get("combinator", "and")
    results = []
    
    for rule in group["rules"]:
        if "rules" in rule: 
            results.append(evaluate_group(data, rule))
        else: 
            results.append(evaluate_rule(data, rule))
            
    if combinator == "and": return all(results)
    if combinator == "or":  return any(results)
    
    return True


# 🔥 PENTEST FIX: DICCIONARIO DE FUNCIONES SEGURAS PARA EL ENTORNO EXEC 🔥
SAFE_BUILTINS = {
    "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict, "float": float, 
    "int": int, "len": len, "list": list, "max": max, "min": min, "round": round, 
    "set": set, "str": str, "sum": sum, "tuple": tuple, "zip": zip,
    "print": print, "Exception": Exception, "ValueError": ValueError, "TypeError": TypeError
}


@router.get("/reports/{report_id}/execute")
def execute_report(
    report_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    # 🔥 PENTEST FIX: Lectura de caché segura
    cache_key = get_cache_key(current_user.company_id, report_id)
    cached = REPORT_CACHE.get(cache_key)
    if cached and (datetime.now() - cached["timestamp"]) < timedelta(minutes=CACHE_EXPIRATION_MINUTES):
        return cached["data"]
        
    report = db.query(models.Report).filter(models.Report.id == report_id, models.Report.company_id == current_user.company_id).first()
    if not report: 
        raise HTTPException(404, "Reporte no encontrado")
        
    final_response = None
        
    if report.function_code == "VISUAL_MODE_FLAG":
        config = report.config or {}
        module_id = config.get("module_id")
        y_axis_type = config.get("y_axis_type", "count") 
        y_axis_field = config.get("y_axis_field")
        x_axis = config.get("x_axis")
        
        raw_filters_str = config.get("raw_filters", "{}") 
        
        if not module_id: raise HTTPException(400, "Falta definir el módulo de origen de datos.")
            
        cases = db.query(models.Case).filter(
            models.Case.module_id == module_id, models.Case.company_id == current_user.company_id, models.Case.deleted_at == None
        ).all()
        
        if not cases:
            final_response = {"report_id": report.id, "chart_type": report.chart_type, "data": []}
        else:
            try:
                filter_rules = json.loads(raw_filters_str) if raw_filters_str else {}
                
                filtered_cases_data = []
                for c in cases:
                    if evaluate_group(c.data, filter_rules):
                        filtered_cases_data.append(c.data)
                
                df = pd.DataFrame(filtered_cases_data)
                final_data = []
                
                if df.empty:
                     final_response = {"report_id": report.id, "chart_type": report.chart_type, "config": report.config, "data": []}
                else:
                    if not x_axis:
                        if y_axis_type == "count": total = len(df)
                        else:
                            df[y_axis_field] = pd.to_numeric(df[y_axis_field], errors='coerce').fillna(0)
                            total = df[y_axis_field].sum() if y_axis_type == "sum" else df[y_axis_field].mean()
                        final_data = [{"name": "Total", "value": round(total, 2)}]
                    else:
                        if x_axis not in df.columns: raise HTTPException(400, f"El campo para el Eje X '{x_axis}' no existe en este módulo.")
                        df[x_axis] = df[x_axis].replace("", "Sin definir")
                        
                        if y_axis_type == "count":
                            grouped = df.groupby(x_axis).size().to_dict()
                        else:
                            if y_axis_field not in df.columns: raise HTTPException(400, f"El campo métrico '{y_axis_field}' no existe.")
                            df[y_axis_field] = pd.to_numeric(df[y_axis_field], errors='coerce').fillna(0)
                            if y_axis_type == "sum": grouped = df.groupby(x_axis)[y_axis_field].sum().to_dict()
                            elif y_axis_type == "avg": grouped = df.groupby(x_axis)[y_axis_field].mean().to_dict()

                        final_data = [{"name": str(k), "value": round(v, 2)} for k, v in grouped.items()]
                        final_data = sorted(final_data, key=lambda x: x["value"], reverse=True)

                    final_response = {
                        "report_id": report.id, "chart_type": report.chart_type, "config": report.config, "data": final_data
                    }
                    
            except Exception as e:
                print(traceback.format_exc())
                raise HTTPException(400, f"Error calculando métricas: {str(e)}")

    else:
        # 🔥 PENTEST FIX: Ejecución segura con Builtins controlados 🔥
        local_env = {
            "db": SandboxDB(db), "models": models, "pd": pd,
            "company_id": current_user.company_id, "user_id": current_user.id, "result": None 
        }
        try:
            exec(report.function_code, {"__builtins__": SAFE_BUILTINS}, local_env)
            final_data = local_env.get("result")
            if final_data is None: raise ValueError("El script no definió 'result'.")
            final_response = {
                "report_id": report.id, "chart_type": report.chart_type, "config": report.config, "data": final_data
            }
        except Exception as e:
            print(traceback.format_exc())
            raise HTTPException(status_code=400, detail=f"Error en script: {str(e)}")
            
    if final_response:
        REPORT_CACHE[cache_key] = {
            "timestamp": datetime.now(),
            "data": final_response
        }
        
    return final_response

# ==========================================
# SANDBOX SEGURA: PROBADOR DE SCRIPTS
# ==========================================
class SandboxQuery:
    def __init__(self, original_query):
        self.original_query = original_query
    def filter(self, *args, **kwargs):
        return SandboxQuery(self.original_query.filter(*args, **kwargs))
    def all(self):
        return self.original_query.limit(10).all() 
    def first(self):
        return self.original_query.first()
    def count(self):
        return self.original_query.count()

class SandboxDB:
    def __init__(self, real_db):
        self.db = real_db
    def query(self, *args, **kwargs):
        return SandboxQuery(self.db.query(*args, **kwargs))

@router.post("/test-script")
def test_python_script(
    payload: TestScriptPayload,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    local_env = {
        "db": SandboxDB(db), 
        "models": models, 
        "pd": pd,
        "company_id": current_user.company_id, 
        "user_id": current_user.id, 
        "result": None 
    }
    
    try:
        # 🔥 PENTEST FIX: Entorno aislado
        exec(payload.function_code, {"__builtins__": SAFE_BUILTINS}, local_env)
        final_data = local_env.get("result")
        if final_data is None: 
            raise ValueError("El script funcionó, pero olvidaste guardar los datos en la variable 'result'.")
            
        return {"success": True, "data": final_data}
        
    except Exception as e:
        error_msg = str(e)
        return {"success": False, "error": error_msg}
    
# ==========================================
# 🔥 NUEVO: ENDPOINT DE INTELIGENCIA DE SEGURIDAD (CON DRILL-DOWN) 🔥
# ==========================================
@router.get("/security-metrics")
def get_security_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_ids: List[int] = Query(None),
    role_ids: List[int] = Query(None),
    profile_ids: List[int] = Query(None),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Recopila métricas vitales, IPs sospechosas, feed de auditoría,
    y listas detalladas (Drill-Down) para los Modales del Dashboard.
    """
    check_settings_permission(db, current_user, "manage_security")
    company_id = current_user.company_id
    now = datetime.now(timezone.utc)

    # 1. Procesar Fechas
    if start_date:
        parsed_start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    else:
        parsed_start = now - timedelta(days=7)
        
    if end_date:
        parsed_end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    else:
        parsed_end = now

    # 2. Construir Filtro Base de Usuarios
    user_query = db.query(models.User.id).filter(models.User.company_id == company_id)
    if user_ids: user_query = user_query.filter(models.User.id.in_(user_ids))
    if role_ids: user_query = user_query.filter(models.User.role_id.in_(role_ids))
    if profile_ids: user_query = user_query.filter(models.User.profile_id.in_(profile_ids))
    
    valid_user_ids = [u[0] for u in user_query.all()]
    
    base_user_filter = [models.User.company_id == company_id]
    log_filter = [
        models.GlobalAuditLog.company_id == company_id,
        models.GlobalAuditLog.entity_type.in_(["AUTH", "SECURITY"]),
        models.GlobalAuditLog.created_at >= parsed_start,
        models.GlobalAuditLog.created_at <= parsed_end
    ]
    
    if user_ids or role_ids or profile_ids:
        if not valid_user_ids: 
            return {
                "kpis": {"total_users": 0, "mfa_enabled": 0, "mfa_adoption_rate": 0, "permanently_blocked": 0, "temporarily_blocked": 0, "active_sessions": 0, "failed_attempts_sum": 0},
                "timeline": [], "top_ips": [], "recent_logs": [],
                "drilldown": {"mfa_vulnerables": [], "active_sessions_list": [], "brute_force_users": [], "blocked_users": []}
            }
        base_user_filter.append(models.User.id.in_(valid_user_ids))
        log_filter.append(models.GlobalAuditLog.user_id.in_(valid_user_ids))

    # --- 3. Calcular KPIs ---
    total_users = db.query(models.User).filter(*base_user_filter).count()
    mfa_enabled = db.query(models.User).filter(*base_user_filter, models.User.is_mfa_enabled == True).count()
    permanently_blocked = db.query(models.User).filter(*base_user_filter, models.User.is_active == False).count()
    temporarily_blocked = db.query(models.User).filter(*base_user_filter, models.User.locked_until != None, models.User.locked_until > now).count()
    
    active_sessions_q = db.query(models.ActiveSession).filter(models.ActiveSession.company_id == company_id, models.ActiveSession.expires_at > now)
    if user_ids or role_ids or profile_ids:
        active_sessions_q = active_sessions_q.filter(models.ActiveSession.user_id.in_(valid_user_ids))
    active_sessions = active_sessions_q.count()

    failed_attempts_sum = db.query(func.sum(models.User.failed_login_attempts)).filter(*base_user_filter).scalar() or 0

    # --- 4. Gráfica Timeline ---
    audit_logs = db.query(
        func.date(models.GlobalAuditLog.created_at).label('date'),
        models.GlobalAuditLog.action,
        func.count(models.GlobalAuditLog.id).label('count')
    ).filter(*log_filter).group_by('date', models.GlobalAuditLog.action).all()

    activity_timeline = {}
    for log_date, action, count in audit_logs:
        date_str = str(log_date)
        if date_str not in activity_timeline:
            activity_timeline[date_str] = {"date": date_str, "exitosos": 0, "fallidos": 0, "mfa_eventos": 0}
            
        if action == "LOGIN_SUCCESS": activity_timeline[date_str]["exitosos"] += count
        elif action in ["MFA_FAILED", "LOGIN_FAILED"]: activity_timeline[date_str]["fallidos"] += count
        elif action in ["MFA_ACTIVATED", "MFA_DISABLED"]: activity_timeline[date_str]["mfa_eventos"] += count

    timeline_data = sorted(list(activity_timeline.values()), key=lambda x: x["date"])

    # --- 5. Top IPs ---
    top_ips_query = db.query(
        models.GlobalAuditLog.ip_address,
        func.count(models.GlobalAuditLog.id).label('count')
    ).filter(*log_filter, models.GlobalAuditLog.action.in_(["LOGIN_FAILED", "MFA_FAILED", "LOGIN_LOCKED"])).group_by(models.GlobalAuditLog.ip_address).order_by(desc('count')).limit(5).all()
    top_ips = [{"ip": ip or "Desconocida", "count": count} for ip, count in top_ips_query]

    # --- 6. Feed de Auditoría ---
    recent_logs_query = db.query(models.GlobalAuditLog, models.User.first_name, models.User.last_name, models.User.email).outerjoin(models.User, models.GlobalAuditLog.user_id == models.User.id).filter(*log_filter).order_by(desc(models.GlobalAuditLog.created_at)).limit(50).all()
    recent_logs = [{"id": log.id, "created_at": log.created_at.isoformat(), "action": log.action, "details": log.details, "ip_address": log.ip_address or "N/A", "user_name": f"{fname or ''} {lname or ''}".strip() or email or "Sistema"} for log, fname, lname, email in recent_logs_query]

    # ==========================================
    # 🔥 7. DRILL-DOWN DATA (Para los Modales) 🔥
    # ==========================================
    
    # 7.1 Usuarios SIN MFA (Vulnerables)
    vuln_users_query = db.query(models.User).filter(
        *base_user_filter, 
        or_(models.User.is_mfa_enabled == False, models.User.is_mfa_enabled == None)
    ).all()
    vuln_users = [{"id": u.id, "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email, "email": u.email} for u in vuln_users_query]

    # 7.2 Lista de Sesiones Activas Detalladas
    active_sessions_list = []
    if active_sessions > 0:
        sessions_query = db.query(models.ActiveSession, models.User.email).join(models.User, models.ActiveSession.user_id == models.User.id).filter(models.ActiveSession.company_id == company_id, models.ActiveSession.expires_at > now)
        if user_ids or role_ids or profile_ids: sessions_query = sessions_query.filter(models.ActiveSession.user_id.in_(valid_user_ids))
        for sess, email in sessions_query.all():
            active_sessions_list.append({"user_email": email, "ip_address": sess.ip_address or "N/A", "user_agent": sess.user_agent or "N/A", "expires_at": sess.expires_at.isoformat()})

    # 7.3 Usuarios con Intentos Fallidos (> 0)
    brute_force_users_query = db.query(models.User).filter(*base_user_filter, models.User.failed_login_attempts > 0).order_by(desc(models.User.failed_login_attempts)).all()
    brute_force_users = [{"email": u.email, "failed_attempts": u.failed_login_attempts} for u in brute_force_users_query]

    # 7.4 Usuarios Bloqueados
    blocked_users_query = db.query(models.User).filter(*base_user_filter, or_(models.User.is_active == False, models.User.locked_until > now)).all()
    blocked_users = []
    for u in blocked_users_query:
        block_type = "Temporal" if u.locked_until and u.locked_until > now else "Permanente"
        expires = u.locked_until.isoformat() if u.locked_until else "N/A"
        blocked_users.append({"email": u.email, "type": block_type, "expires_at": expires})

    return {
        "kpis": {
            "total_users": total_users,
            "mfa_enabled": mfa_enabled,
            "mfa_adoption_rate": round((mfa_enabled / total_users * 100) if total_users > 0 else 0, 1),
            "permanently_blocked": permanently_blocked,
            "temporarily_blocked": temporarily_blocked,
            "active_sessions": active_sessions,
            "failed_attempts_sum": failed_attempts_sum
        },
        "timeline": timeline_data,
        "top_ips": top_ips,
        "recent_logs": recent_logs,
        "drilldown": {
            "mfa_vulnerables": vuln_users,
            "active_sessions_list": active_sessions_list,
            "brute_force_users": brute_force_users,
            "blocked_users": blocked_users
        }
    }