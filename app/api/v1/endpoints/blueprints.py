from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.security_utils import check_settings_permission
from app.core.global_audit import log_global_event

router = APIRouter()

# ==========================
# ESQUEMAS PYDANTIC
# ==========================
class BlueprintBase(BaseModel):
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
    # 🔥 FASE 1.1: Nuevos campos de versionado añadidos a la respuesta
    version: Optional[int] = 1
    is_draft: Optional[bool] = False
    parent_blueprint_id: Optional[int] = None

    class Config:
        from_attributes = True

# ==========================
# FUNCIONES AUXILIARES
# ==========================
def clone_blueprint_dependencies(db: Session, old_bp_id: int, new_bp_id: int):
    """
    Clona en cascada todos los estados, transiciones, acciones y validaciones
    de una versión anterior a la nueva versión del Blueprint.
    """
    # 1. Clonar Statuses (Estados)
    old_statuses = db.query(models.Status).filter(models.Status.blueprint_id == old_bp_id).all()
    status_map = {} # Diccionario para mapear ID viejo -> ID nuevo
    
    for os in old_statuses:
        ns = models.Status(
            company_id=os.company_id,
            blueprint_id=new_bp_id,
            name=os.name,
            is_initial=os.is_initial,
            sla_hours=os.sla_hours,
            # 🔥 FASE BPMN: COPIAMOS FORMAS Y POSICIONES 🔥
            bpmn_shape=os.bpmn_shape,
            position_x=os.position_x,
            position_y=os.position_y
        )
        db.add(ns)
        db.flush() # Flush para obtener el ID generado instantáneamente
        status_map[os.id] = ns.id

    # 2. Clonar Transitions (Flechas)
    old_transitions = db.query(models.Transition).filter(models.Transition.blueprint_id == old_bp_id).all()
    
    for ot in old_transitions:
        nt = models.Transition(
            company_id=ot.company_id,
            blueprint_id=new_bp_id,
            name=ot.name,
            from_status_id=status_map.get(ot.from_status_id), # Apuntamos al ID clonado
            to_status_id=status_map.get(ot.to_status_id)      # Apuntamos al ID clonado
        )
        db.add(nt)
        db.flush()

        # 3. Clonar Acciones Automáticas de la transición
        old_actions = db.query(models.TransitionAction).filter(models.TransitionAction.transition_id == ot.id).all()
        for oa in old_actions:
            na = models.TransitionAction(
                company_id=oa.company_id,
                transition_id=nt.id, # Apuntamos a la nueva transición
                action_type=oa.action_type,
                target_field=oa.target_field,
                action_value=oa.action_value,
                function_code=oa.function_code,
                action_config=oa.action_config
            )
            db.add(na)

        # 4. Clonar Validaciones de la transición
        old_validations = db.query(models.TransitionValidation).filter(models.TransitionValidation.transition_id == ot.id).all()
        for ov in old_validations:
            nv = models.TransitionValidation(
                company_id=ov.company_id,
                transition_id=nt.id, # Apuntamos a la nueva transición
                target_field=ov.target_field,
                operator=ov.operator,
                validation_value=ov.validation_value,
                error_message=ov.error_message
            )
            db.add(nv)
            
    db.commit()

# ==========================
# ENDPOINTS
# ==========================
@router.get("/", response_model=List[BlueprintResponse])
def get_blueprints(
    module_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # 🔥 FIX: Solo devolvemos las versiones ACTIVAS en la lista principal
    query = db.query(models.Blueprint).filter(
        models.Blueprint.company_id == current_user.company_id,
        models.Blueprint.is_active == True
    )
    
    if module_id:
        query = query.filter(models.Blueprint.module_id == module_id)
        
    return query.all()

# 🔥 NUEVO: Endpoint para traer el historial de versiones de un Blueprint
@router.get("/{blueprint_id}/versions", response_model=List[BlueprintResponse])
def get_blueprint_versions(
    blueprint_id: int,
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
        
    # Traemos todo el "linaje" (flujos inactivos/activos con el mismo nombre y módulo)
    versions = db.query(models.Blueprint).filter(
        models.Blueprint.company_id == current_user.company_id,
        models.Blueprint.name == blueprint.name,
        models.Blueprint.module_id == blueprint.module_id
    ).order_by(models.Blueprint.version.desc()).all()
    
    return versions

@router.post("/", response_model=BlueprintResponse)
def create_blueprint(
    blueprint_in: BlueprintCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    
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
        company_id=current_user.company_id,
        version=1, # Todo flujo nuevo nace en V1
        is_draft=False
    )
    db.add(new_blueprint)
    db.commit()
    db.refresh(new_blueprint)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="BLUEPRINT", action="CREATE", entity_id=new_blueprint.id,
        details=f"Creó el blueprint/flujo '{new_blueprint.name}' (V1)", request=request
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
        
    if blueprint_in.module_id and blueprint_in.module_id != blueprint.module_id:
        module_exists = db.query(models.Module).filter(
            models.Module.id == blueprint_in.module_id,
            models.Module.company_id == current_user.company_id
        ).first()
        if not module_exists:
            raise HTTPException(status_code=403, detail="El módulo especificado no existe o no pertenece a tu empresa.")
        
    old_data = {
        "name": blueprint.name, 
        "version": blueprint.version or 1,
        "is_active": blueprint.is_active
    }
    
    # 🔥 FASE 1.1: ARCHIVAR Y VERSIONAR 🔥
    # Apagamos el actual para que los nuevos casos no lo usen
    blueprint.is_active = False
    
    update_data = blueprint_in.dict(exclude_unset=True)
    
    # 🔥 FIX: APAGÓN MASIVO DE VERSIONES VIEJAS
    is_going_to_be_active = update_data.get('is_active', True)
    if is_going_to_be_active:
        db.query(models.Blueprint).filter(
            models.Blueprint.company_id == current_user.company_id,
            models.Blueprint.module_id == blueprint.module_id,
            models.Blueprint.name == blueprint.name
        ).update({"is_active": False})

    # =================================================================
    # 🔥 FIX DE NUMERACIÓN: EVITAR VERSIONES REPETIDAS (EJ. VARIAS V1) 🔥
    # =================================================================
    # Buscamos la versión MÁS ALTA que exista en el historial para este flujo
    latest_bp = db.query(models.Blueprint).filter(
        models.Blueprint.company_id == current_user.company_id,
        models.Blueprint.module_id == blueprint.module_id,
        models.Blueprint.name == blueprint.name
    ).order_by(models.Blueprint.version.desc()).first()
    
    # Calculamos el siguiente número lógico
    next_version_number = (latest_bp.version if latest_bp and latest_bp.version else 1) + 1

    # Creamos el nuevo registro (¡SOLO UNA VEZ!)
    new_blueprint = models.Blueprint(
        name=update_data.get('name', blueprint.name),
        trigger_field=update_data.get('trigger_field', blueprint.trigger_field),
        trigger_value=update_data.get('trigger_value', blueprint.trigger_value),
        module_id=update_data.get('module_id', blueprint.module_id),
        company_id=current_user.company_id,
        version=next_version_number, # 🔥 Usamos la numeración inteligente calculada arriba
        parent_blueprint_id=blueprint.id, # Rastreamos el linaje (de qué ID provino)
        is_active=update_data.get('is_active', True),
        is_draft=False
    )
    
    db.add(new_blueprint)
    db.commit()
    db.refresh(new_blueprint)
    
    # 🔥 Clonamos en cascada la estructura profunda 🔥
    clone_blueprint_dependencies(db, blueprint.id, new_blueprint.id)
    
    new_data = {
        "name": new_blueprint.name, 
        "version": new_blueprint.version,
        "is_active": new_blueprint.is_active
    }
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="BLUEPRINT", action="CREATE_VERSION", entity_id=new_blueprint.id,
        details=f"Generó la versión {new_blueprint.version} del flujo '{new_blueprint.name}'", 
        old_value=old_data, new_value=new_data, request=request
    )
    
    return new_blueprint

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