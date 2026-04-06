from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.db.session import get_db
from app.models import models
from app.api import deps

router = APIRouter()

# ==========================
# 🔥 PENTEST FIX: ESQUEMA PYDANTIC PARA EVITAR FUGA DE DATOS 🔥
# ==========================
class NotificationResponse(BaseModel):
    id: int
    company_id: int
    user_id: int
    case_id: Optional[int] = None
    module_id: Optional[int] = None
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================
# ENDPOINTS
# ==========================
@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    # 🔥 PENTEST FIX: Doble candado (Usuario + Empresa) 🔥
    return db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.company_id == current_user.company_id
    ).order_by(models.Notification.created_at.desc()).limit(50).all()

@router.put("/{notif_id}/read")
def mark_as_read(
    notif_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    # 🔥 PENTEST FIX: Doble candado en la actualización 🔥
    notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.user_id == current_user.id,
        models.Notification.company_id == current_user.company_id 
    ).first()
    
    if not notif: 
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
        
    notif.is_read = True
    db.commit()
    return {"message": "Marcada como leída"}