from sqlalchemy.orm import Session
from app.models import models

def log_event(
    db: Session, 
    user_id: int, 
    company_id: int, 
    case_id: int, 
    action: str, 
    old_v: dict = None, 
    new_v: dict = None
):
    log = models.AuditLog(
        user_id=user_id,
        company_id=company_id,
        case_id=case_id,
        action=action,
        old_value=old_v,
        new_value=new_v
    )
    db.add(log)
    # No hacemos commit aquí, dejamos que el endpoint principal lo haga
    # para asegurar que si falla el cambio, no se guarde el log.