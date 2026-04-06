from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.config import settings
from app.models import models
from app.schemas import user as user_schema

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

def get_current_user(
    db: Session = Depends(get_db), 
    token: str = Depends(reusable_oauth2)
) -> models.User:
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar el token de acceso (Puede estar expirado o revocado)",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        email: str = payload.get("sub")
        # 🔥 PENTEST FIX: Extraemos la versión de sesión del token 🔥
        token_session_version: int = payload.get("session_version")
        
        if email is None or token_session_version is None:
            raise credentials_exception
            
        token_data = user_schema.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    
    if not user:
        raise credentials_exception
        
    if not user.is_active:
        # 🔥 FIX: Ahora devolvemos 401 para que Axios active la expulsión 🔥
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Tu usuario ha sido inactivado por un administrador.",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    # 🔥 PENTEST FIX: KILL SWITCH (Compara el token con la BD) 🔥
    if token_session_version != user.session_version:
        raise credentials_exception # ¡Pateado! Su token es de una versión vieja
        
    return user