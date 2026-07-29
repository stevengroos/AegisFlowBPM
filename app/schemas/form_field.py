from pydantic import BaseModel, Field
from typing import List, Optional, Any, Union

# ==========================================
# ESQUEMAS PARA SECCIONES (FormSection)
# ==========================================
class FormSectionBase(BaseModel):
    # PENTEST FIX: Límites de texto para el título de la sección
    title: str = Field(..., min_length=1, max_length=150)
    order: int = 0
    # PENTEST FIX: Forzar matemáticamente que solo se permitan 1, 2 o 3 columnas
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
# 🔥 NUEVO: ESQUEMAS DE CONFIGURACIÓN AVANZADA 🔥
# ==========================================
class CurrencyConfig(BaseModel):
    decimal_places: int = Field(2, ge=0, le=4, description="Cantidad de decimales (0 a 4)")
    decimal_separator: str = Field(",", max_length=1)
    thousand_separator: str = Field(".", max_length=1)
    symbol: str = Field("$", max_length=5)
    symbol_position: str = Field("left", pattern="^(left|right)$")

class PhoneConfig(BaseModel):
    default_country: str = Field("PY", max_length=3, description="Código ISO del país (ej. PY, MX, AR, US)")
    restrict_country: bool = Field(False, description="Si es True, el usuario no puede cambiar la bandera")
    
class AutoNumberConfig(BaseModel):
    prefix: str = Field("", max_length=20, description="Prefijo (ej: FAC-, CASO-)")
    starting_number: int = Field(1, ge=1, description="Número por el que empieza el conteo")
    padding: int = Field(4, ge=1, le=10, description="Cantidad de ceros a rellenar (ej: 4 = 0001)")


## ==========================================
# ESQUEMAS PARA CAMPOS (FormField)
# ==========================================
class FormFieldBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=200, description="El nombre que ve el usuario (ej: 'Fecha de inicio')")
    
    # 🔥 CORRECCIÓN: Volvemos a incluir 'date' en la descripción 🔥
    field_type: str = Field(..., max_length=50, description="Tipo: 'text', 'number', 'date', 'currency', 'phone','email', 'auto_number', etc.")
    
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