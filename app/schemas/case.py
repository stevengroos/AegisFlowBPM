import json
from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any, Optional
from datetime import datetime

class CaseBase(BaseModel):
    module_id: Optional[int] = None 
    data: Dict[str, Any] 
    ui_rules: Optional[Dict[str, Any]] = Field(default_factory=dict)

    # 🔥 PENTEST FIX: Validador para evitar "JSON Bombs" y colapso de RAM 🔥
    @field_validator('data', 'ui_rules')
    @classmethod
    def prevent_json_bomb(cls, v):
        if v is None:
            return v
        # Convertimos el diccionario a string para medir su peso aproximado en bytes
        # 100,000 caracteres son aprox 100KB, más que suficiente para un formulario.
        if len(json.dumps(v)) > 100000:
            raise ValueError("El contenido del formulario es demasiado grande. Límite excedido.")
        return v

class CaseCreate(BaseModel):
    form_id: int 
    module_id: int 
    data: Dict[str, Any]
    assigned_to: Optional[int] = None 

    @field_validator('data')
    @classmethod
    def prevent_json_bomb(cls, v):
        if len(json.dumps(v)) > 100000:
            raise ValueError("El contenido del formulario es demasiado grande.")
        return v

class CaseUpdate(BaseModel):
    data: Dict[str, Any]
    assigned_to: Optional[int] = None 

    @field_validator('data')
    @classmethod
    def prevent_json_bomb(cls, v):
        if len(json.dumps(v)) > 100000:
            raise ValueError("El contenido del formulario es demasiado grande.")
        return v

class CaseResponse(CaseBase):
    id: int
    company_id: int
    created_by: int
    created_at: datetime
    status_id: Optional[int] = None
    form_id: Optional[int] = None
    deleted_at: Optional[datetime] = None
    assigned_to: Optional[int] = None 
    deleted_by: Optional[int] = None
    
    class Config:
        from_attributes = True