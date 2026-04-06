from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime

class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    old_v: Optional[Dict[str, Any]] = None
    new_v: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True