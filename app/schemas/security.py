from pydantic import BaseModel, Field, EmailStr, field_validator, ValidationInfo
from typing import Optional, List, Dict, Any
from datetime import datetime
import re
# ==========================================
# ROLES
# ==========================================
class RoleBase(BaseModel):
    name: str
    parent_id: Optional[int] = None
    rank: Optional[int] = 1

class RoleResponse(RoleBase):
    id: int
    company_id: int
    class Config:
        from_attributes = True

# ==========================================
# PERFILES
# ==========================================
class ProfileBase(BaseModel):
    name: str
    permissions: Dict[str, Any]

class ProfileResponse(ProfileBase):
    id: int
    company_id: int
    class Config:
        from_attributes = True

# ==========================================
# USUARIOS (Accesos e Invitaciones)
# ==========================================
class UserAccessUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[int] = None
    profile_id: Optional[int] = None

class UserInvite(BaseModel):
    email: EmailStr 
    first_name: str
    last_name: str
    role_id: Optional[int] = None
    profile_id: Optional[int] = None
    
    send_invite: bool = True 
    
    # Quitamos la validación de complejidad de aquí. 
    # Solo aseguramos tamaño para evitar ataques DoS en memoria.
    password: Optional[str] = Field(None, min_length=6, max_length=128)

    @field_validator('password')
    @classmethod
    def validate_password_presence(cls, v: Optional[str], info: ValidationInfo):
        send_invite = info.data.get('send_invite', False)
        
        # Si NO eligió invitación, la contraseña NO puede estar vacía
        if not send_invite and not v:
            raise ValueError("Debes proporcionar una contraseña o marcar 'Enviar invitación por correo'.")
            
        return v

# ==========================================
# 🔥 NUEVO: POLÍTICAS DE SEGURIDAD GRANULARES 🔥
# ==========================================
class SecurityPolicyBase(BaseModel):
    # Identificadores de Grupo (Estilo Zoho One)
    name: str = "Política Global"
    profile_id: Optional[int] = None
    role_id: Optional[int] = None
    
    # Protección contra Fuerza Bruta
    max_login_attempts: int = Field(5, ge=1, le=10, description="Intentos antes del bloqueo")
    temp_lockout_minutes: int = Field(15, ge=1, le=1440, description="Minutos de castigo")
    max_temp_lockouts: int = Field(3, ge=1, le=10, description="Bloqueos temporales permitidos")
    
    # Expiración de Contraseña
    password_expiration_active: bool = False
    password_expiration_days: int = Field(90, ge=1, le=365)
    
    # Historial de Contraseñas
    password_history_active: bool = False
    password_history_count: int = Field(3, ge=1, le=10)
    
    # Sesión e Inactividad
    inactivity_timeout_minutes: int = Field(15, ge=1, le=1440)
    max_concurrent_sessions: int = Field(3, ge=1, le=20)
    
    # Complejidad de Contraseña
    password_complexity_active: bool = False
    pwd_min_length: int = Field(8, ge=6, le=64)
    pwd_max_length: int = Field(128, ge=8, le=256)
    pwd_require_uppercase: bool = True
    pwd_require_lowercase: bool = True
    pwd_require_numbers: bool = True
    pwd_require_special: bool = True
    
    # Restricción de IPs
    ip_whitelist_active: bool = False
    allowed_ips: List[str] = Field(default=[])
    
    # 🔥 MFA (Google Authenticator)
    mfa_active: bool = False
    mfa_required: bool = False

class SecurityPolicyUpdate(SecurityPolicyBase):
    pass

class SecurityPolicyResponse(SecurityPolicyBase):
    id: int
    company_id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True