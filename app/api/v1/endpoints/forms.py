from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.schemas import form as schema

from app.core.security_utils import check_settings_permission

# 🔥 IMPORTAMOS EL ESPÍA DE AUDITORÍA 🔥
from app.core.global_audit import log_global_event

router = APIRouter()

@router.get("/", response_model=List[schema.FormResponse])
def get_forms(
    module_id: Optional[int] = None,
    include_inactive: bool = False, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    query = db.query(models.Form).filter(
        models.Form.company_id == current_user.company_id
    )
    
    if not include_inactive:
        query = query.filter(models.Form.is_active == True)
        
    if module_id:
        query = query.filter(models.Form.module_id == module_id)
        
    return query.all()

@router.post("/", response_model=schema.FormResponse)
def create_form(
    form_in: schema.FormCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_forms")

    # 🔥 PENTEST FIX: Permitir crear formularios globales (module_id = None) 🔥
    if form_in.module_id is not None:
        module = db.query(models.Module).filter(
            models.Module.id == form_in.module_id,
            models.Module.company_id == current_user.company_id
        ).first()
        
        if not module:
            raise HTTPException(status_code=403, detail="El módulo especificado no existe o no pertenece a tu empresa.")

    form_data = form_in.dict()
    form_data.pop('is_active', None) 
    
    new_form = models.Form(
        **form_data,
        company_id=current_user.company_id,
        is_active=True 
    )
    db.add(new_form)
    db.commit()
    db.refresh(new_form)
    
    # 🕵️‍♂️ AUDITORÍA GLOBAL
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FORM", action="CREATE", entity_id=new_form.id,
        details=f"Creó el formulario '{new_form.name}'", request=request
    )
    
    return new_form

@router.put("/{form_id}", response_model=schema.FormResponse)
def update_form(
    form_id: int,
    form_in: schema.FormCreate, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_forms")
    
    form_query = db.query(models.Form).filter(
        models.Form.id == form_id,
        models.Form.company_id == current_user.company_id
    )
    
    db_form = form_query.first()
    if not db_form:
        raise HTTPException(status_code=404, detail="Formulario no encontrado")
        
    # 🔥 PENTEST FIX: Validar el cambio de módulo, permitiendo desvincular (None) 🔥
    if form_in.module_id != db_form.module_id:
        if form_in.module_id is not None:
            module = db.query(models.Module).filter(
                models.Module.id == form_in.module_id,
                models.Module.company_id == current_user.company_id
            ).first()
            if not module:
                raise HTTPException(status_code=403, detail="El módulo destino no existe o no pertenece a tu empresa.")
        
    # Capturamos el estado "Viejo"
    old_data = {"name": db_form.name, "description": db_form.description, "module_id": db_form.module_id}
    
    update_data = form_in.dict(exclude_unset=True)
    if 'is_active' in update_data:
        del update_data['is_active'] 
        
    form_query.update(update_data)
    db.commit()
    
    updated_form = form_query.first()
    
    # Capturamos el estado "Nuevo"
    new_data = {"name": updated_form.name, "description": updated_form.description, "module_id": updated_form.module_id}
    
    # 🕵️‍♂️ AUDITORÍA GLOBAL
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FORM", action="UPDATE", entity_id=updated_form.id,
        details=f"Editó el formulario '{updated_form.name}'", 
        old_value=old_data, new_value=new_data, request=request
    )
    
    return updated_form

@router.delete("/{form_id}")
def archive_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_forms")
    
    form = db.query(models.Form).filter(
        models.Form.id == form_id,
        models.Form.company_id == current_user.company_id
    ).first()
    
    if not form:
        raise HTTPException(status_code=404, detail="Formulario no encontrado")
    
    form_name = form.name
    form.is_active = False
    db.commit()
    
    # 🕵️‍♂️ AUDITORÍA GLOBAL
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FORM", action="ARCHIVE", entity_id=form_id,
        details=f"Archivó (desactivó) el formulario '{form_name}'", request=request
    )
    
    return {"message": "Formulario archivado exitosamente"}

# ==============================================================
# ENDPOINT PARA RESTAURAR FORMULARIO
# ==============================================================
@router.post("/{form_id}/restore", response_model=schema.FormResponse)
def restore_form(
    form_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_forms")
    
    form = db.query(models.Form).filter(
        models.Form.id == form_id,
        models.Form.company_id == current_user.company_id
    ).first()
    
    if not form:
        raise HTTPException(status_code=404, detail="Formulario no encontrado")
    
    form.is_active = True
    db.commit()
    db.refresh(form)
    
    # 🕵️‍♂️ AUDITORÍA GLOBAL
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FORM", action="RESTORE", entity_id=form.id,
        details=f"Restauró el formulario '{form.name}'", request=request
    )
    
    return form