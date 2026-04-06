import logging
from sqlalchemy.orm import Session
from fastapi import Request
from typing import Optional
from app.models import models

# Configurar el logger oficial (Capturable por CloudWatch, Datadog, etc.)
logger = logging.getLogger(__name__)

def get_real_ip(request: Request) -> Optional[str]:
    """
    Extrae la IP real del usuario, incluso si estamos detrás de Cloudflare, Nginx o AWS ALB.
    """
    if not request:
        return None
        
    # 1. Revisar X-Forwarded-For (Estándar de proxies y load balancers)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Puede venir como una lista de IPs separada por comas: "IP_Cliente, IP_Proxy1, IP_Proxy2"
        # La primera IP siempre es la del cliente original.
        return forwarded_for.split(",")[0].strip()
    
    # 2. Revisar X-Real-IP (Común en Nginx)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
        
    # 3. Fallback a la conexión directa (Localhost o sin proxy)
    return request.client.host if request.client else None


def log_global_event(
    db: Session,
    user_id: int,
    company_id: int,
    entity_type: str,
    action: str,
    details: str = None,
    entity_id: Optional[int] = None,
    old_value: dict = None,
    new_value: dict = None,
    request: Request = None
):
    """
    Registra un evento en la Auditoría Global del sistema.
    """
    ip_address = get_real_ip(request)
    user_agent = request.headers.get("user-agent") if request else None

    try:
        log_entry = models.GlobalAuditLog(
            company_id=company_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            details=details,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        # 🔥 PENTEST FIX: Usamos logger.error en lugar de print para asegurar el monitoreo 🔥
        logger.error(f"⚠️ Error crítico al guardar en auditoría global: {str(e)}", exc_info=True)
        db.rollback() # Evita que un error de auditoría rompa la acción principal