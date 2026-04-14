from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

# ==========================================
# ESQUEMAS DE ENTRADA (Request)
# ==========================================
class SessionCreate(BaseModel):
    company_id: int
    client_user_id: int
    
class SessionResolve(BaseModel):
    agent_id: int

class CSATSubmit(BaseModel):
    score: int
    comment: Optional[str] = None


# ==========================================
# ESQUEMAS DE SALIDA (Response)
# ==========================================
class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    sender_id: Optional[int] = None
    sender_name: Optional[str] = None # 🔥 NUEVO: Para mostrar en la burbuja quién atiende
    message: str
    is_internal_note: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SupportSessionResponse(BaseModel):
    id: int
    
    # Datos de la Empresa
    company_id: int
    company_name: Optional[str] = None # 🔥 NUEVO: Para el panel de la derecha del agente
    
    # Datos del Cliente
    client_user_id: int
    client_name: Optional[str] = None # 🔥 NUEVO: Ej. "Steven Admin"
    client_email: Optional[str] = None # 🔥 NUEVO: Para contactarlo después
    
    # Datos del Agente
    agent_user_id: Optional[int] = None
    agent_name: Optional[str] = None # 🔥 NUEVO: El súper admin que tomó el caso
    
    status: str
    started_at: datetime
    resolved_at: Optional[datetime] = None
    
    # Calificación
    csat_score: Optional[int] = None
    csat_comment: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)