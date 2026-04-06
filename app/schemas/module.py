from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ==========================
# SCHEMAS PARA CATEGORÍAS DE MÓDULOS (NUEVO)
# ==========================
class ModuleCategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Nombre de la categoría/carpeta")
    icon: Optional[str] = Field("folder", max_length=50, description="Ícono de la categoría")

class ModuleCategoryCreate(ModuleCategoryBase):
    pass

class ModuleCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)

class ModuleCategoryResponse(ModuleCategoryBase):
    id: int
    order: int
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================
# SCHEMAS PARA MODULES (ACTUALIZADOS)
# ==========================
class ModuleBase(BaseModel):
    # 🔥 PENTEST FIX: Límites estrictos para evitar DoS y desbordamientos 🔥
    name: str = Field(..., min_length=2, max_length=100, description="Nombre del módulo")
    description: Optional[str] = Field(None, max_length=500, description="Descripción opcional del módulo")
    icon: Optional[str] = Field("box", max_length=50, description="Identificador del ícono (ej. 'box', 'users')")
    is_active: Optional[bool] = True
    
    # 🔥 NUEVO CAMPO PARA LAS CARPETAS 🔥
    category_id: Optional[int] = Field(None, description="ID de la categoría a la que pertenece. Nulo si está suelto.")

class ModuleCreate(ModuleBase):
    pass

class ModuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    icon: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None
    category_id: Optional[int] = Field(None) # 🔥 Agregado para poder moverlo de carpeta

class ModuleResponse(ModuleBase):
    id: int
    order: int # 🔥 Agregado para saber en qué orden se muestra
    created_at: datetime

    class Config:
        from_attributes = True