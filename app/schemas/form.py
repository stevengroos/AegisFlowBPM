# app/schemas/form.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class FormBase(BaseModel):
    # 🔥 PENTEST FIX: Límites de longitud para prevenir DoS y Errores de BD 🔥
    name: str = Field(..., min_length=2, max_length=150, description="Nombre del formulario")
    description: Optional[str] = Field(None, max_length=1000, description="Descripción del formulario")
    is_active: bool = True
    module_id: Optional[int] = None

class FormCreate(FormBase):
    pass 

class FormResponse(FormBase):
    id: int
    company_id: int
    created_at: datetime
    # 🔥 Forzamos la declaración aquí para que Pydantic v2 no tenga dudas
    module_id: Optional[int] = None 
    
    class Config:
        from_attributes = True