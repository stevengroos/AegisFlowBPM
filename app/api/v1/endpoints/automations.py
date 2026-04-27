import json
import sys
import io
import traceback
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator
from datetime import datetime

from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.security_utils import check_settings_permission
from app.core.global_audit import log_global_event

router = APIRouter()

# ==========================
# ESQUEMAS PYDANTIC
# ==========================
class ScriptTestRequest(BaseModel):
    function_code: str
    mock_data: Dict[str, Any]
class AutomationRuleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    event_type: str = Field(..., max_length=50)
    trigger_field: Optional[str] = Field(None, max_length=150)
    condition_field: Optional[str] = Field(None, max_length=150)
    condition_operator: Optional[str] = Field(None, max_length=20)
    condition_value: Optional[str] = Field(None, max_length=250)
    action_type: str = Field(..., max_length=50)
    target_field: Optional[str] = Field(None, max_length=150)
    action_value: Optional[str] = Field(None, max_length=250)
    # Limitamos el código a ~10,000 caracteres (suficiente para funciones complejas, pero seguro)
    function_code: Optional[str] = Field(None, max_length=10000)
    action_config: Optional[Dict[str, Any]] = Field(default_factory=dict)

    # 🔥 PENTEST FIX: Evitar JSON Bombs en la configuración 🔥
    @field_validator('action_config')
    @classmethod
    def prevent_json_bomb(cls, v):
        if v and len(json.dumps(v)) > 50000: # 50KB máximo
            raise ValueError("La configuración de la acción excede el límite de tamaño.")
        return v

class AutomationRuleCreate(AutomationRuleBase):
    module_id: int

# 🔥 BUG FIX: Nuevo esquema para permitir actualizaciones parciales y apagar reglas 🔥
class AutomationRuleUpdate(AutomationRuleBase):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    event_type: Optional[str] = Field(None, max_length=50)
    action_type: Optional[str] = Field(None, max_length=50)
    module_id: Optional[int] = None
    is_active: Optional[bool] = None

class AutomationRuleResponse(AutomationRuleBase):
    id: int
    company_id: int
    module_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================
# ENDPOINTS
# ==========================
@router.get("/", response_model=List[AutomationRuleResponse])
def get_rules(
    module_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.company_id == current_user.company_id,
        models.AutomationRule.module_id == module_id
    ).all()
    return rules

@router.post("/", response_model=AutomationRuleResponse)
def create_rule(
    rule_in: AutomationRuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_automations")
    
    module = db.query(models.Module).filter(
        models.Module.id == rule_in.module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if not module:
        raise HTTPException(status_code=403, detail="El módulo especificado no existe o no pertenece a tu empresa.")

    new_rule = models.AutomationRule(
        company_id=current_user.company_id,
        **rule_in.dict()
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="AUTOMATION", action="CREATE", entity_id=new_rule.id,
        details=f"Creó la regla de automatización '{new_rule.name}'", request=request
    )
    
    return new_rule

@router.delete("/{rule_id}")
def delete_rule(
    rule_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_automations")
    rule = db.query(models.AutomationRule).filter(
        models.AutomationRule.id == rule_id,
        models.AutomationRule.company_id == current_user.company_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
        
    rule_name = rule.name
    
    db.delete(rule)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="AUTOMATION", action="DELETE", entity_id=rule_id,
        details=f"Eliminó la regla de automatización '{rule_name}'", request=request
    )
    
    return {"message": "Regla eliminada exitosamente"}

@router.put("/{rule_id}", response_model=AutomationRuleResponse)
def update_rule(
    rule_id: int,
    rule_in: AutomationRuleUpdate, # 🔥 Usamos el nuevo esquema
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_automations")
    rule = db.query(models.AutomationRule).filter(
        models.AutomationRule.id == rule_id,
        models.AutomationRule.company_id == current_user.company_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")

    if rule_in.module_id is not None and rule_in.module_id != rule.module_id:
        module = db.query(models.Module).filter(
            models.Module.id == rule_in.module_id,
            models.Module.company_id == current_user.company_id
        ).first()
        if not module:
            raise HTTPException(status_code=403, detail="El módulo destino no existe o no pertenece a tu empresa.")

    old_data = {
        "name": rule.name,
        "event_type": rule.event_type,
        "action_type": rule.action_type,
        "is_active": rule.is_active
    }

    # 🔥 FIX: exclude_unset=True permite actualizar solo los campos enviados sin sobrescribir con nulos
    update_data = rule_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)
    
    new_data = {
        "name": rule.name,
        "event_type": rule.event_type,
        "action_type": rule.action_type,
        "is_active": rule.is_active
    }
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="AUTOMATION", action="UPDATE", entity_id=rule.id,
        details=f"Editó la regla de automatización '{rule.name}'", 
        old_value=old_data, new_value=new_data, request=request
    )
    
    return rule

# ==========================
# ENDPOINT DE PRUEBA (SANDBOX LOW-CODE PARA AUTOMATIZACIONES)
# ==========================
@router.post("/test-script")
def test_global_python_script(
    req: ScriptTestRequest,
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Ejecuta un script de Python en un entorno seguro.
    Idéntico al de transiciones, pero montado en la ruta de automatizaciones globales.
    """
    class MockHTTPClient:
        def get(self, url, headers=None): 
            print(f"[TEST MOCK] GET simulado a: {url}")
            return {"status": 200, "data": "Mocked GET response"}
        def post(self, url, json=None, headers=None): 
            print(f"[TEST MOCK] POST simulado a: {url} con payload: {json}")
            return {"status": 200, "data": "Mocked POST response"}

    local_env = {
        "case_data": req.mock_data,
        "user_id": current_user.id,
        "current_date": datetime.now().strftime("%Y-%m-%d"),
        "http": MockHTTPClient()
    }
    
    stdout_trap = io.StringIO()
    original_stdout = sys.stdout
    sys.stdout = stdout_trap

    try:
        exec(req.function_code, {"__builtins__": {}}, local_env)
        sys.stdout = original_stdout
        
        return {
            "success": True,
            "modified_data": local_env.get("case_data", req.mock_data),
            "console_output": stdout_trap.getvalue()
        }
    except Exception as e:
        sys.stdout = original_stdout
        error_trace = traceback.format_exc()
        return {
            "success": False,
            "error_message": str(e),
            "traceback": error_trace
        }