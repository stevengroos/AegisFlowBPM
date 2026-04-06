from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field # 🔥 Importamos Field
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.security_utils import check_settings_permission

# 🔥 IMPORTAMOS EL ESPÍA DE AUDITORÍA 🔥
from app.core.global_audit import log_global_event

router = APIRouter()

# Esquemas Pydantic
class BlueprintBase(BaseModel):
    # 🔥 PENTEST FIX: Límites de texto para evitar DoS 🔥
    name: str = Field(..., min_length=2, max_length=150)
    trigger_field: Optional[str] = Field(None, max_length=150)
    trigger_value: Optional[str] = Field(None, max_length=150)
    is_active: bool = True
    module_id: Optional[int] = None

class BlueprintCreate(BlueprintBase):
    pass

class BlueprintUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    trigger_field: Optional[str] = Field(None, max_length=150)
    trigger_value: Optional[str] = Field(None, max_length=150)
    is_active: Optional[bool] = None
    module_id: Optional[int] = None

class BlueprintResponse(BlueprintBase):
    id: int
    company_id: int

    class Config:
        from_attributes = True

# Endpoints
@router.get("/", response_model=List[BlueprintResponse])
def get_blueprints(
    module_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    query = db.query(models.Blueprint).filter(
        models.Blueprint.company_id == current_user.company_id
    )
    
    if module_id:
        query = query.filter(models.Blueprint.module_id == module_id)
        
    return query.all()

@router.post("/", response_model=BlueprintResponse)
def create_blueprint(
    blueprint_in: BlueprintCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    
    # 🔥 PENTEST FIX: IDOR / BOLA Validation 🔥
    if blueprint_in.module_id:
        module_exists = db.query(models.Module).filter(
            models.Module.id == blueprint_in.module_id,
            models.Module.company_id == current_user.company_id
        ).first()
        if not module_exists:
            raise HTTPException(status_code=403, detail="El módulo especificado no existe o no pertenece a tu empresa.")

    new_blueprint = models.Blueprint(
        name=blueprint_in.name,
        trigger_field=blueprint_in.trigger_field,
        trigger_value=blueprint_in.trigger_value,
        module_id=blueprint_in.module_id,
        company_id=current_user.company_id
    )
    db.add(new_blueprint)
    db.commit()
    db.refresh(new_blueprint)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="BLUEPRINT", action="CREATE", entity_id=new_blueprint.id,
        details=f"Creó el blueprint/flujo '{new_blueprint.name}'", request=request
    )
    
    return new_blueprint

@router.put("/{blueprint_id}", response_model=BlueprintResponse)
def update_blueprint(
    blueprint_id: int,
    blueprint_in: BlueprintUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    
    blueprint = db.query(models.Blueprint).filter(
        models.Blueprint.id == blueprint_id,
        models.Blueprint.company_id == current_user.company_id
    ).first()
    
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint no encontrado")
        
    # 🔥 PENTEST FIX: IDOR / BOLA Validation para actualización 🔥
    if blueprint_in.module_id and blueprint_in.module_id != blueprint.module_id:
        module_exists = db.query(models.Module).filter(
            models.Module.id == blueprint_in.module_id,
            models.Module.company_id == current_user.company_id
        ).first()
        if not module_exists:
            raise HTTPException(status_code=403, detail="El módulo especificado no existe o no pertenece a tu empresa.")
        
    old_data = {
        "name": blueprint.name, 
        "trigger_field": blueprint.trigger_field, 
        "trigger_value": blueprint.trigger_value,
        "is_active": blueprint.is_active,
        "module_id": blueprint.module_id
    }
    
    update_data = blueprint_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(blueprint, key, value)
        
    db.commit()
    db.refresh(blueprint)
    
    new_data = {
        "name": blueprint.name, 
        "trigger_field": blueprint.trigger_field, 
        "trigger_value": blueprint.trigger_value,
        "is_active": blueprint.is_active,
        "module_id": blueprint.module_id
    }
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="BLUEPRINT", action="UPDATE", entity_id=blueprint.id,
        details=f"Editó el blueprint/flujo '{blueprint.name}'", 
        old_value=old_data, new_value=new_data, request=request
    )
    
    return blueprint

@router.delete("/{blueprint_id}")
def delete_blueprint(
    blueprint_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    blueprint = db.query(models.Blueprint).filter(
        models.Blueprint.id == blueprint_id,
        models.Blueprint.company_id == current_user.company_id
    ).first()
    
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint no encontrado")
        
    blueprint_name = blueprint.name
    
    db.delete(blueprint)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="BLUEPRINT", action="DELETE", entity_id=blueprint_id,
        details=f"Eliminó el blueprint/flujo '{blueprint_name}'", request=request
    )
    
    return {"message": "Blueprint eliminado con éxito"}