from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Dict
from sqlalchemy.exc import IntegrityError
from app.db.session import get_db
from app.models import models

# 🔥 IMPORTAMOS LOS NUEVOS SCHEMAS DE CATEGORÍAS 🔥
from app.schemas.module import (
    ModuleCreate, ModuleUpdate, ModuleResponse,
    ModuleCategoryCreate, ModuleCategoryUpdate, ModuleCategoryResponse
)
from app.api import deps

from app.core.security_utils import check_settings_permission
from app.core.global_audit import log_global_event

router = APIRouter()

# ==========================================
# 🔥 ENDPOINTS PARA CATEGORÍAS (CARPETAS) 🔥
# ==========================================

@router.get("/categories/", response_model=List[ModuleCategoryResponse])
def get_categories(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    categories = db.query(models.ModuleCategory).filter(
        models.ModuleCategory.company_id == current_user.company_id
    ).order_by(models.ModuleCategory.order.asc(), models.ModuleCategory.id.asc()).all()
    return categories

@router.post("/categories/", response_model=ModuleCategoryResponse)
def create_category(
    category: ModuleCategoryCreate, 
    request: Request, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_category = models.ModuleCategory(**category.dict(), company_id=current_user.company_id) 
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE_CATEGORY", action="CREATE", entity_id=db_category.id,
        details=f"Creó la categoría de módulos '{db_category.name}'", request=request
    )
    return db_category

@router.put("/categories/reorder")
def reorder_categories(
    order_data: Dict[str, int], 
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    for cat_id_str, new_order in order_data.items():
        cat_id = int(cat_id_str)
        category = db.query(models.ModuleCategory).filter(
            models.ModuleCategory.id == cat_id,
            models.ModuleCategory.company_id == current_user.company_id
        ).first()
        if category:
            category.order = new_order
            
    db.commit()
    return {"message": "Orden de categorías actualizado"}

@router.put("/categories/{category_id}", response_model=ModuleCategoryResponse)
def update_category(
    category_id: int, 
    category_data: ModuleCategoryUpdate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_category = db.query(models.ModuleCategory).filter(
        models.ModuleCategory.id == category_id,
        models.ModuleCategory.company_id == current_user.company_id
    ).first()
    
    if not db_category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    update_data = category_data.dict(exclude_unset=True) 
    for key, value in update_data.items():
        setattr(db_category, key, value)
        
    db.commit()
    db.refresh(db_category)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE_CATEGORY", action="UPDATE", entity_id=db_category.id,
        details=f"Editó la categoría '{db_category.name}'", request=request
    )
    return db_category

@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_category = db.query(models.ModuleCategory).filter(
        models.ModuleCategory.id == category_id,
        models.ModuleCategory.company_id == current_user.company_id
    ).first()
    
    if not db_category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    cat_name = db_category.name 
    db.delete(db_category) # Los módulos no se borran, solo se salen de la carpeta gracias a ondelete="SET NULL"
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE_CATEGORY", action="DELETE", entity_id=category_id,
        details=f"Eliminó la categoría '{cat_name}'. Los módulos internos ahora están sueltos.", request=request
    )
    return {"message": "Categoría eliminada exitosamente"}

# ==========================================
# 🔥 ENDPOINTS CLÁSICOS DE MÓDULOS 🔥
# ==========================================

@router.post("/", response_model=ModuleResponse)
def create_module(
    module: ModuleCreate, 
    request: Request, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_module = models.Module(**module.dict(), company_id=current_user.company_id) 
    db.add(db_module)
    
    try:
        db.commit()
        db.refresh(db_module)
    except IntegrityError:
        db.rollback() 
        raise HTTPException(
            status_code=400, 
            detail=f"El módulo '{module.name}' ya existe en tu empresa."
        )
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE", action="CREATE", entity_id=db_module.id,
        details=f"Creó el módulo '{db_module.name}'", request=request
    )
    
    return db_module

@router.get("/", response_model=List[ModuleResponse])
def get_modules(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    all_modules = db.query(models.Module).filter(
        models.Module.company_id == current_user.company_id
    ).order_by(models.Module.order.asc()).offset(skip).limit(limit).all()
    
    if current_user.is_superadmin:
        return all_modules
        
    if not current_user.profile_id:
        return []
        
    profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
    if not profile or not profile.permissions:
        return []
        
    allowed_modules = []
    for mod in all_modules:
        mod_perms = profile.permissions.get("modules", {}).get(str(mod.id), {})
        if mod_perms.get("view"):
            allowed_modules.append(mod)
            
    return allowed_modules

@router.put("/reorder")
def reorder_modules(
    order_data: Dict[str, int], 
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    for module_id_str, new_order in order_data.items():
        module_id = int(module_id_str)
        module = db.query(models.Module).filter(
            models.Module.id == module_id,
            models.Module.company_id == current_user.company_id
        ).first()
        if module:
            module.order = new_order
            
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE", action="REORDER",
        details="Reordenó la posición de los módulos en el menú principal", request=request
    )
    
    return {"message": "Orden de módulos actualizado exitosamente"}


@router.get("/{module_id}", response_model=ModuleResponse)
def get_module(
    module_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    db_module = db.query(models.Module).filter(
        models.Module.id == module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if db_module is None:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
        
    if not current_user.is_superadmin:
        profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
        if not profile or not profile.permissions: 
            raise HTTPException(status_code=403, detail="Acceso denegado")
            
        if not profile.permissions.get("modules", {}).get(str(module_id), {}).get("view"):
            raise HTTPException(status_code=403, detail="No tienes permiso para ver este módulo")
            
    return db_module

@router.put("/{module_id}", response_model=ModuleResponse)
def update_module(
    module_id: int, 
    module_data: ModuleUpdate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_module = db.query(models.Module).filter(
        models.Module.id == module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if not db_module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    
    old_data = {"name": db_module.name, "description": db_module.description, "icon": db_module.icon}
    
    update_data = module_data.dict(exclude_unset=True) 
    for key, value in update_data.items():
        setattr(db_module, key, value)
        
    db.commit()
    db.refresh(db_module)
    
    new_data = {"name": db_module.name, "description": db_module.description, "icon": db_module.icon}
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE", action="UPDATE", entity_id=db_module.id,
        details=f"Editó el módulo '{db_module.name}'",
        old_value=old_data, new_value=new_data, request=request
    )
    
    return db_module

@router.delete("/{module_id}")
def delete_module(
    module_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_module = db.query(models.Module).filter(
        models.Module.id == module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if not db_module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    
    module_name = db_module.name 
    
    db.delete(db_module)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE", action="DELETE", entity_id=module_id,
        details=f"Eliminó por completo el módulo '{module_name}'", request=request
    )
    
    return {"message": "Módulo eliminado exitosamente"}