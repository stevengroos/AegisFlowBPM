import json
import sys
import io
import traceback
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator # 🔥 Añadidos protectores Pydantic
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.security_utils import check_settings_permission

# 🔥 IMPORTAMOS EL ESPÍA DE AUDITORÍA 🔥
from app.core.global_audit import log_global_event

router = APIRouter()

# ==========================
# ESQUEMAS PYDANTIC (Transiciones)
# ==========================
class ScriptTestRequest(BaseModel):
    function_code: str
    mock_data: Dict[str, Any]
class TransitionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150) # 🔥 PENTEST FIX: Límites de texto
    from_status_id: int
    to_status_id: int
    blueprint_id: int

class TransitionUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)

class TransitionResponse(BaseModel):
    id: int
    company_id: int
    name: str
    from_status_id: int
    to_status_id: int
    blueprint_id: Optional[int] = None

    class Config:
        from_attributes = True

# ==========================
# ESQUEMAS PYDANTIC (Acciones Automáticas)
# ==========================
class TransitionActionCreate(BaseModel):
    action_type: str = Field(..., max_length=50)
    target_field: Optional[str] = Field(None, max_length=150)
    action_value: Optional[str] = Field(None, max_length=250)
    
    # 🔥 PENTEST FIX: Evitar que suban 20MB de código y rompan el servidor 🔥
    function_code: Optional[str] = Field(None, max_length=10000)
    action_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    # 🔥 PENTEST FIX: Evitar JSON Bombs en la configuración 🔥
    @field_validator('action_config')
    @classmethod
    def prevent_json_bomb(cls, v):
        if v and len(json.dumps(v)) > 50000: # 50KB máximo
            raise ValueError("La configuración de la acción excede el límite de tamaño.")
        return v

class TransitionActionResponse(BaseModel):
    id: int
    transition_id: int
    action_type: str
    target_field: Optional[str] = None
    action_value: Optional[str] = None
    function_code: Optional[str] = None 
    action_config: Optional[Dict[str, Any]] = {} 

    class Config:
        from_attributes = True

# ==========================
# ESQUEMAS PYDANTIC (Validaciones de Transición)
# ==========================
class TransitionValidationCreate(BaseModel):
    target_field: str = Field(..., max_length=150)
    operator: str = Field(..., max_length=50) # Ej: "==", "!=", "IS_EMPTY", "NOT_EMPTY"
    validation_value: Optional[str] = Field(None, max_length=250)
    error_message: Optional[str] = Field(None, max_length=500)

class TransitionValidationResponse(BaseModel):
    id: int
    transition_id: int
    target_field: str
    operator: str
    validation_value: Optional[str] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True
        
# ==========================
# ENDPOINTS (Transiciones)
# ==========================
@router.get("/", response_model=List[TransitionResponse])
def get_transitions(
    blueprint_id: Optional[int] = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    query = db.query(models.Transition).filter(
        models.Transition.company_id == current_user.company_id
    )
    if blueprint_id:
        query = query.filter(models.Transition.blueprint_id == blueprint_id)
    return query.all()

@router.post("/", response_model=TransitionResponse)
def create_transition(
    transition_in: TransitionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    
    bp = db.query(models.Blueprint).filter(
        models.Blueprint.id == transition_in.blueprint_id,
        models.Blueprint.company_id == current_user.company_id
    ).first()
    
    if not bp:
        raise HTTPException(status_code=400, detail="El Blueprint especificado no existe o no pertenece a tu empresa.")
        
    for s_id in [transition_in.from_status_id, transition_in.to_status_id]:
        status = db.query(models.Status).filter(
            models.Status.id == s_id,
            models.Status.company_id == current_user.company_id,
            models.Status.blueprint_id == bp.id
        ).first()
        if not status:
            raise HTTPException(status_code=400, detail=f"El estado ID {s_id} no existe o no pertenece al mismo Blueprint.")

    new_transition = models.Transition(
        name=transition_in.name,
        from_status_id=transition_in.from_status_id,
        to_status_id=transition_in.to_status_id,
        blueprint_id=transition_in.blueprint_id, 
        company_id=current_user.company_id
    )
    db.add(new_transition)
    db.commit()
    db.refresh(new_transition)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION", action="CREATE", entity_id=new_transition.id,
        details=f"Creó la transición '{new_transition.name}' en el flujo ID {bp.id}", request=request
    )
    
    return new_transition

@router.put("/{transition_id}", response_model=TransitionResponse)
def update_transition(
    transition_id: int,
    transition_in: TransitionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    transition = db.query(models.Transition).filter(
        models.Transition.id == transition_id,
        models.Transition.company_id == current_user.company_id
    ).first()
    
    if not transition:
        raise HTTPException(status_code=404, detail="Transición no encontrada")
        
    old_name = transition.name
    transition.name = transition_in.name
    db.commit()
    db.refresh(transition)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION", action="UPDATE", entity_id=transition.id,
        details=f"Renombró la transición '{old_name}' a '{transition.name}'", request=request
    )
    
    return transition

@router.delete("/{transition_id}")
def delete_transition(
    transition_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    transition = db.query(models.Transition).filter(
        models.Transition.id == transition_id,
        models.Transition.company_id == current_user.company_id
    ).first()
    
    if not transition:
        raise HTTPException(status_code=404, detail="Transición no encontrada")
        
    transition_name = transition.name
    bp_id = transition.blueprint_id
    
    db.delete(transition)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION", action="DELETE", entity_id=transition_id,
        details=f"Eliminó la transición '{transition_name}' del flujo ID {bp_id}", request=request
    )
    
    return {"message": "Transición eliminada"}

# ==========================
# ENDPOINTS (Acciones Automáticas)
# ==========================
@router.get("/{transition_id}/actions", response_model=List[TransitionActionResponse])
def get_transition_actions(
    transition_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # 🔥 PENTEST FIX: Validar que la transición existe y pertenece a la empresa 🔥
    transition = db.query(models.Transition).filter(
        models.Transition.id == transition_id,
        models.Transition.company_id == current_user.company_id
    ).first()
    
    if not transition:
        raise HTTPException(status_code=404, detail="Transición no encontrada")
        
    actions = db.query(models.TransitionAction).filter(
        models.TransitionAction.transition_id == transition_id,
        models.TransitionAction.company_id == current_user.company_id
    ).all()
    return actions

@router.post("/{transition_id}/actions", response_model=TransitionActionResponse)
def create_transition_action(
    transition_id: int,
    action_in: TransitionActionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    transition = db.query(models.Transition).filter(
        models.Transition.id == transition_id,
        models.Transition.company_id == current_user.company_id
    ).first()
    
    if not transition:
        raise HTTPException(status_code=404, detail="Transición no encontrada")

    new_action = models.TransitionAction(
        company_id=current_user.company_id,
        transition_id=transition_id,
        action_type=action_in.action_type,
        target_field=action_in.target_field,
        action_value=action_in.action_value,
        function_code=action_in.function_code,
        action_config=action_in.action_config 
    )
    db.add(new_action)
    db.commit()
    db.refresh(new_action)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION_ACTION", action="CREATE", entity_id=new_action.id,
        details=f"Creó una acción automática tipo '{new_action.action_type}' en la transición ID {transition_id}", request=request
    )
    
    return new_action

@router.put("/actions/{action_id}", response_model=TransitionActionResponse)
def update_transition_action(
    action_id: int,
    action_in: TransitionActionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    action = db.query(models.TransitionAction).filter(
        models.TransitionAction.id == action_id,
        models.TransitionAction.company_id == current_user.company_id
    ).first()
    
    if not action:
        raise HTTPException(status_code=404, detail="Acción no encontrada")
        
    action.action_type = action_in.action_type
    action.target_field = action_in.target_field
    action.action_value = action_in.action_value
    action.function_code = action_in.function_code
    action.action_config = action_in.action_config

    db.commit()
    db.refresh(action)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION_ACTION", action="UPDATE", entity_id=action.id,
        details=f"Editó la acción automática ID {action.id} (Tipo: {action.action_type})", request=request
    )
    
    return action

@router.delete("/actions/{action_id}")
def delete_transition_action(
    action_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    action = db.query(models.TransitionAction).filter(
        models.TransitionAction.id == action_id,
        models.TransitionAction.company_id == current_user.company_id
    ).first()
    
    if not action:
        raise HTTPException(status_code=404, detail="Acción no encontrada")
        
    act_type = action.action_type
    trans_id = action.transition_id
        
    db.delete(action)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION_ACTION", action="DELETE", entity_id=action_id,
        details=f"Eliminó una acción automática tipo '{act_type}' de la transición ID {trans_id}", request=request
    )
    
    return {"message": "Acción eliminada correctamente"}

# ==========================
# ENDPOINTS (Validaciones Automáticas)
# ==========================
@router.get("/{transition_id}/validations", response_model=List[TransitionValidationResponse])
def get_transition_validations(
    transition_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # Verificamos que el usuario tenga acceso a la transición
    transition = db.query(models.Transition).filter(
        models.Transition.id == transition_id,
        models.Transition.company_id == current_user.company_id
    ).first()
    
    if not transition:
        raise HTTPException(status_code=404, detail="Transición no encontrada")
        
    validations = db.query(models.TransitionValidation).filter(
        models.TransitionValidation.transition_id == transition_id,
        models.TransitionValidation.company_id == current_user.company_id
    ).all()
    return validations

@router.post("/{transition_id}/validations", response_model=TransitionValidationResponse)
def create_transition_validation(
    transition_id: int,
    val_in: TransitionValidationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    transition = db.query(models.Transition).filter(
        models.Transition.id == transition_id,
        models.Transition.company_id == current_user.company_id
    ).first()
    
    if not transition:
        raise HTTPException(status_code=404, detail="Transición no encontrada")

    new_validation = models.TransitionValidation(
        company_id=current_user.company_id,
        transition_id=transition_id,
        target_field=val_in.target_field,
        operator=val_in.operator,
        validation_value=val_in.validation_value,
        error_message=val_in.error_message
    )
    db.add(new_validation)
    db.commit()
    db.refresh(new_validation)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION_VALIDATION", action="CREATE", entity_id=new_validation.id,
        details=f"Creó una regla de bloqueo en la transición ID {transition_id} (Campo: {val_in.target_field})", request=request
    )
    
    return new_validation

@router.put("/validations/{validation_id}", response_model=TransitionValidationResponse)
def update_transition_validation(
    validation_id: int,
    val_in: TransitionValidationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    validation = db.query(models.TransitionValidation).filter(
        models.TransitionValidation.id == validation_id,
        models.TransitionValidation.company_id == current_user.company_id
    ).first()
    
    if not validation:
        raise HTTPException(status_code=404, detail="Validación no encontrada")
        
    validation.target_field = val_in.target_field
    validation.operator = val_in.operator
    validation.validation_value = val_in.validation_value
    validation.error_message = val_in.error_message

    db.commit()
    db.refresh(validation)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION_VALIDATION", action="UPDATE", entity_id=validation.id,
        details=f"Editó la regla de bloqueo en el campo '{val_in.target_field}'", request=request
    )
    
    return validation

@router.delete("/validations/{validation_id}")
def delete_transition_validation(
    validation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_blueprints")
    validation = db.query(models.TransitionValidation).filter(
        models.TransitionValidation.id == validation_id,
        models.TransitionValidation.company_id == current_user.company_id
    ).first()
    
    if not validation:
        raise HTTPException(status_code=404, detail="Validación no encontrada")
        
    target = validation.target_field
    trans_id = validation.transition_id
        
    db.delete(validation)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="TRANSITION_VALIDATION", action="DELETE", entity_id=validation_id,
        details=f"Eliminó la regla de bloqueo del campo '{target}' en la transición ID {trans_id}", request=request
    )
    
    return {"message": "Regla de validación eliminada correctamente"}

# ==========================
# ENDPOINT DE PRUEBA (SANDBOX LOW-CODE)
# ==========================
@router.post("/actions/test-script")
def test_python_script(
    req: ScriptTestRequest,
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Ejecuta un script de Python en un entorno de prueba seguro sin afectar la base de datos.
    Captura los 'print()' y los errores de sintaxis para mostrarlos en el frontend.
    """
    # 1. Creamos un Mock del Cliente HTTP para no disparar webhooks reales durante la prueba
    class MockHTTPClient:
        def get(self, url, headers=None): 
            print(f"[TEST MOCK] GET simulado a: {url}")
            return {"status": 200, "data": "Mocked GET response"}
        def post(self, url, json=None, headers=None): 
            print(f"[TEST MOCK] POST simulado a: {url} con payload: {json}")
            return {"status": 200, "data": "Mocked POST response"}

    # 2. Preparamos el entorno aislado (Sandbox)
    local_env = {
        "case_data": req.mock_data,
        "user_id": current_user.id,
        "current_date": datetime.now().strftime("%Y-%m-%d"),
        "http": MockHTTPClient()
    }
    
    # 3. Trampa para capturar los 'print()' del usuario
    stdout_trap = io.StringIO()
    original_stdout = sys.stdout
    sys.stdout = stdout_trap

    try:
        # 4. Ejecutamos el código
        exec(req.function_code, {"__builtins__": {}}, local_env)
        
        # 5. Restauramos la consola del servidor inmediatamente
        sys.stdout = original_stdout
        
        return {
            "success": True,
            "modified_data": local_env.get("case_data", req.mock_data),
            "console_output": stdout_trap.getvalue()
        }
    except Exception as e:
        # Restauramos la consola si hay error
        sys.stdout = original_stdout
        
        # Extraemos la traza del error para que el usuario sepa en qué línea falló
        error_trace = traceback.format_exc()
        return {
            "success": False,
            "error_message": str(e),
            "traceback": error_trace
        }