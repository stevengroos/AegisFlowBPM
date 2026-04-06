from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import re

class UserCreate(BaseModel):
    # Validado automáticamente por EmailStr
    email: EmailStr
    
    # Límite de longitud para evitar DoS en RAM 
    company_name: str = Field(..., min_length=2, max_length=100, description="Nombre de la empresa")
    
    # Límites seguros para la contraseña
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator('password')
    @classmethod
    def validate_password_complexity(cls, v):
        # ISO 27001 FIX: Forzar al menos una mayúscula, una minúscula y un número 
        if not re.match(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+', v):
            raise ValueError('La contraseña debe contener al menos una mayúscula, una minúscula y un número.')
        return v

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# ==========================================
#  NUEVOS ESQUEMAS PARA MFA (Google Auth) 
# ==========================================
class MfaSetupResponse(BaseModel):
    secret: str
    qr_code_url: str # La URL que convertiremos en imagen en React

class MfaVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, description="Código de 6 dígitos")