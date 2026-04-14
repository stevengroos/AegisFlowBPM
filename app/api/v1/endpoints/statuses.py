from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.security_utils import check_settings_permission

# 🔥 IMPORTAMOS EL ESPÍA DE AUDITORÍA 🔥
from app.core.global_audit import log_global_event

router = APIRouter()

# ==========================
# ESQUEMAS PYDANTIC
# ==========================
class StatusBase(BaseModel):
    name: str
    is_initial: bool = False
    blueprint_id: Optional[int] = None
    # 🔥 FASE 2: Permitimos recibir y enviar las horas de SLA 🔥
    sla_hours: Optional[int] = None
    # =========================================================
    # 🔥 NUEVO FASE BPMN: Forma visual del estado 🔥
    # =========================================================
    bpmn_shape: Optional[str] = "task" 
    position_x: Optional[int] = 50
    position_y: Optional[int] = 50

class StatusCreate(StatusBase):
    pass

class StatusUpdate(BaseModel):
    name: Optional[str] = None
    is_initial: Optional[bool] = None
    # 🔥 FASE 2: Permitimos actualizar las horas de SLA 🔥
    sla_hours: Optional[int] = None
    # 🔥 NUEVO FASE BPMN 🔥
    bpmn_shape: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None

class StatusResponse(StatusBase):
    id: int
    company_id: int

    class Config:
        from_attributes = True

# ==========================
# ENDPOINTS
# ==========================
@router.get("/", response_model=List[StatusResponse])
def get_statuses(
    blueprint_id: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    query = db.query(models.Status).filter(
        models.Status.company_id == current_user.company_id
    )
    if blueprint_id:
        query = query.filter(models.Status.blueprint_id == blueprint_id)
        
    return query.order_by(models.Status.id).all()

@router.post("/", response_model=StatusResponse)
def create_status(
    status_in: StatusCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    
    if status_in.blueprint_id:
        bp = db.query(models.Blueprint).filter(
            models.Blueprint.id == status_in.blueprint_id,
            models.Blueprint.company_id == current_user.company_id
        ).first()
        if not bp:
            raise HTTPException(status_code=403, detail="El Blueprint especificado no existe o no pertenece a tu empresa.")

    existing_count = db.query(models.Status).filter(
        models.Status.company_id == current_user.company_id,
        models.Status.blueprint_id == status_in.blueprint_id 
    ).count()
    
    if status_in.is_initial:
        db.query(models.Status).filter(
            models.Status.company_id == current_user.company_id,
            models.Status.blueprint_id == status_in.blueprint_id 
        ).update({"is_initial": False})

    new_status = models.Status(
        name=status_in.name,
        is_initial=status_in.is_initial if existing_count > 0 else True,
        blueprint_id=status_in.blueprint_id, 
        company_id=current_user.company_id,
        sla_hours=status_in.sla_hours, # 🔥 FASE 2
        bpmn_shape=status_in.bpmn_shape, # 🔥 FASE BPMN: Guardamos la forma 🔥
        position_x=status_in.position_x,
        position_y=status_in.position_y
    )
    
    db.add(new_status)
    db.commit()
    db.refresh(new_status)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="STATUS", action="CREATE", entity_id=new_status.id,
        details=f"Creó el estado '{new_status.name}' en el flujo ID {status_in.blueprint_id}", request=request
    )
    
    return new_status

@router.put("/{status_id}", response_model=StatusResponse)
def update_status(
    status_id: int,
    status_in: StatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    status = db.query(models.Status).filter(
        models.Status.id == status_id,
        models.Status.company_id == current_user.company_id
    ).first()
    
    if not status:
        raise HTTPException(status_code=404, detail="Estado no encontrado")
        
    old_data = {
        "name": status.name,
        "is_initial": status.is_initial,
        "sla_hours": status.sla_hours, # 🔥 FASE 2
        "bpmn_shape": status.bpmn_shape # 🔥 FASE BPMN
    }
        
    if status_in.name is not None:
        status.name = status_in.name
        
    if status_in.is_initial is not None and status_in.is_initial is True:
        db.query(models.Status).filter(
            models.Status.company_id == current_user.company_id,
            models.Status.blueprint_id == status.blueprint_id,
            models.Status.id != status_id
        ).update({"is_initial": False})
        status.is_initial = True
        
    update_data = status_in.dict(exclude_unset=True)
    # 🔥 FASE 2: Actualizamos el SLA si lo envían en la petición 🔥
    if "sla_hours" in update_data:
        status.sla_hours = update_data["sla_hours"]
        
    # 🔥 FASE BPMN: Actualizamos la forma si la envían en la petición 🔥
    if "bpmn_shape" in update_data:
        status.bpmn_shape = update_data["bpmn_shape"]
        
    # 🔥 GUARDAMOS LAS NUEVAS COORDENADAS SI SE MOVIÓ EL NODO 🔥
    if "position_x" in update_data:
        status.position_x = update_data["position_x"]
    if "position_y" in update_data:
        status.position_y = update_data["position_y"]
        
    db.commit()
    db.refresh(status)
    
    new_data = {
        "name": status.name,
        "is_initial": status.is_initial,
        "sla_hours": status.sla_hours, # 🔥 FASE 2
        "bpmn_shape": status.bpmn_shape # 🔥 FASE BPMN
    }
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="STATUS", action="UPDATE", entity_id=status.id,
        details=f"Editó el estado '{status.name}'", 
        old_value=old_data, new_value=new_data, request=request
    )
    
    return status

@router.delete("/{status_id}")
def delete_status(
    status_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    status = db.query(models.Status).filter(
        models.Status.id == status_id,
        models.Status.company_id == current_user.company_id
    ).first()
    
    if not status:
        raise HTTPException(status_code=404, detail="Estado no encontrado")
        
    cases_in_status = db.query(models.Case).filter(
        models.Case.status_id == status_id,
        models.Case.company_id == current_user.company_id
    ).first()
    
    if cases_in_status:
        raise HTTPException(
            status_code=400, 
            detail="No puedes eliminar este estado porque hay casos usándolo. Mueve los casos primero."
        )
        
    if status.is_initial:
        remaining = db.query(models.Status).filter(
            models.Status.company_id == current_user.company_id,
            models.Status.blueprint_id == status.blueprint_id, 
            models.Status.id != status_id
        ).count()
        if remaining > 0:
            raise HTTPException(
                status_code=400,
                detail="No puedes borrar el estado inicial. Nombra otro estado como inicial primero."
            )
            
    status_name = status.name
    bp_id = status.blueprint_id
            
    db.delete(status)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="STATUS", action="DELETE", entity_id=status_id,
        details=f"Eliminó el estado '{status_name}' del flujo ID {bp_id}", request=request
    )
    
    return {"message": "Estado eliminado con éxito"}