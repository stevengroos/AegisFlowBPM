from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Any, List
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.models import models
from app.api import deps

# 🔥 IMPORTAMOS EL GUARDIA DE SEGURIDAD ESTANDARIZADO 🔥
from app.core.security_utils import check_settings_permission

router = APIRouter()

# ==========================================
# ESQUEMAS PYDANTIC
# ==========================================
class GlobalAuditLogResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    entity_type: str
    entity_id: Optional[int] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None

class PaginatedAuditResponse(BaseModel):
    total: int
    logs: List[GlobalAuditLogResponse]

# ==========================================
# ENDPOINTS
# ==========================================
@router.get("/", response_model=PaginatedAuditResponse)
def get_global_audit_logs(
    skip: int = 0,
    limit: int = 50,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # 🔥 PENTEST FIX: Usamos el permiso correcto 'view_audit' en lugar de 'manage_security' 🔥
    check_settings_permission(db, current_user, "view_audit")

    # Armamos la consulta uniendo los logs con la tabla de usuarios para saber sus nombres
    # y filtramos estrictamente por la empresa (Tenant) del usuario
    query = db.query(models.GlobalAuditLog, models.User).outerjoin(
        models.User, models.GlobalAuditLog.user_id == models.User.id
    ).filter(models.GlobalAuditLog.company_id == current_user.company_id)

    # Filtros
    if entity_type:
        query = query.filter(models.GlobalAuditLog.entity_type == entity_type)
    if action:
        query = query.filter(models.GlobalAuditLog.action == action)
    if search:
        # Buscar en los detalles o en el nombre del usuario
        query = query.filter(
            (models.GlobalAuditLog.details.ilike(f"%{search}%")) |
            (models.User.first_name.ilike(f"%{search}%")) |
            (models.User.last_name.ilike(f"%{search}%")) |
            (models.User.email.ilike(f"%{search}%"))
        )

    # Nota de rendimiento: count() puede ser lento en tablas muy grandes (millones de registros).
    # Para un MVP o V1 está perfecto.
    total = query.count()
    logs = query.order_by(models.GlobalAuditLog.created_at.desc()).offset(skip).limit(limit).all()

    # Formateamos la respuesta
    result = []
    for log, user in logs:
        user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() if user else "Usuario Eliminado"
        if not user_name and user: 
            user_name = user.email
            
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_name": user_name,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "action": log.action,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at,
            "old_value": log.old_value,
            "new_value": log.new_value
        })

    return {"total": total, "logs": result}