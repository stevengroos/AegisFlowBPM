from datetime import datetime, timedelta, timezone
import uuid
import re # 🔥 NUEVO: Para validar contraseñas con Regex 🔥
from typing import Any, Union, Dict, List
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 🔥 FIX: Ahora devuelve un diccionario con el token, el jti y la fecha de expiración 🔥
def create_access_token(subject: Union[str, Any], session_version: int, expires_delta: timedelta = None) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    jti = str(uuid.uuid4()) # ID único extraído para poder guardarlo en la DB
    
    to_encode = {
        "exp": expire,
        "iat": now,
        "jti": jti,
        "sub": str(subject),
        "type": "access", 
        "session_version": session_version 
    }
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return {
        "access_token": encoded_jwt,
        "jti": jti,
        "expire": expire
    }

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# =========================================================
# 🔥 NUEVO: VALIDADOR DE COMPLEJIDAD DE CONTRASEÑAS 🔥
# =========================================================
def validate_password_complexity(password: str, policy: Any) -> List[str]:
    """
    Evalúa una contraseña contra las políticas configuradas por la empresa.
    Retorna una lista con errores. Si la lista está vacía, la clave es segura.
    """
    errors = []
    
    # Si las políticas están apagadas, solo validamos un mínimo de seguridad lógico
    if not policy or not policy.password_complexity_active:
        if len(password) < 6:
            errors.append("La contraseña debe tener al menos 6 caracteres.")
        return errors

    # Validaciones según la política corporativa
    if len(password) < policy.pwd_min_length:
        errors.append(f"La contraseña debe tener al menos {policy.pwd_min_length} caracteres.")
    
    if len(password) > policy.pwd_max_length:
        errors.append(f"La contraseña no puede exceder los {policy.pwd_max_length} caracteres.")
        
    if policy.pwd_require_uppercase and not re.search(r"[A-Z]", password):
        errors.append("Debe incluir al menos una letra mayúscula.")
        
    if policy.pwd_require_lowercase and not re.search(r"[a-z]", password):
        errors.append("Debe incluir al menos una letra minúscula.")
        
    if policy.pwd_require_numbers and not re.search(r"[0-9]", password):
        errors.append("Debe incluir al menos un número.")
        
    if policy.pwd_require_special and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        errors.append("Debe incluir al menos un carácter especial (ej: !@#$%^&*).")
        
    return errors