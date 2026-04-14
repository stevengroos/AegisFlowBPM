from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# ==========================
# ESQUEMAS PARA VERSIONES
# ==========================
class VersionBase(BaseModel):
    content_html: str
    content_state: Optional[Dict[str, Any]] = None
    editor_type: str = "visual"

class VersionCreate(VersionBase):
    pass

class VersionResponse(VersionBase):
    id: int
    template_id: int
    version_number: int
    created_by: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================
# ESQUEMAS PARA PLANTILLAS
# ==========================
class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    module_id: int
    is_active: bool = True

class TemplateCreate(TemplateBase):
    initial_version: VersionCreate # Cuando creamos la plantilla, debe venir con su primera versión

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class TemplateResponse(TemplateBase):
    id: int
    company_id: int
    created_at: datetime
    versions: List[VersionResponse] = []

    class Config:
        from_attributes = True