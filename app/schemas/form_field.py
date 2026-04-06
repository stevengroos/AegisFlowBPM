from pydantic import BaseModel, Field
from typing import List, Optional, Any, Union

# ==========================================
# 🔥 NUEVO: ESQUEMAS PARA SECCIONES (FormSection)
# ==========================================
class FormSectionBase(BaseModel):
    # 🔥 PENTEST FIX: Límites de texto para el título de la sección 🔥
    title: str = Field(..., min_length=1, max_length=150)
    order: int = 0
    # 🔥 PENTEST FIX: Forzar matemáticamente que solo se permitan 1, 2 o 3 columnas 🔥
    columns: int = Field(1, ge=1, le=3, description="Soporte para 1, 2 o 3 columnas visuales")
    form_id: int

class FormSectionCreate(FormSectionBase):
    pass

class FormSectionResponse(FormSectionBase):
    id: int
    company_id: int

    class Config:
        from_attributes = True


# ==========================================
# ESQUEMAS PARA CAMPOS (FormField)
# ==========================================
class FormFieldBase(BaseModel):
    # 🔥 PENTEST FIX: Límites de texto para las etiquetas y tipos de campo 🔥
    label: str = Field(..., min_length=1, max_length=200, description="El nombre que ve el usuario (ej: 'Fecha de inicio')")
    field_type: str = Field(..., max_length=50, description="Tipo: 'text', 'number', 'date', etc.")
    required: bool = False
    order: int = 0
    options: Optional[Union[List[str], dict, Any]] = None
    is_active: bool = True
    show_in_create: Optional[bool] = True
    form_id: Optional[int] = None 
    api_name: Optional[str] = Field(None, max_length=250)
    is_primary: Optional[bool] = False 
    
    section_id: Optional[int] = None
    subform_config: Optional[Union[List[dict], Any]] = [] 
    
class FormFieldCreate(FormFieldBase):
    pass

class FormFieldResponse(FormFieldBase):
    id: int
    company_id: int

    class Config:
        from_attributes = True