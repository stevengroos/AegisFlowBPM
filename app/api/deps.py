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
        token_session_version: int = payload.get("session_version")
        
        # 🔥 FASE 5: Buscamos si el token trae la llave maestra de impersonation
        impersonating_company_id = payload.get("impersonating_company_id")
        
        if email is None or token_session_version is None:
            raise credentials_exception
            
        token_data = user_schema.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    
    if not user:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Tu usuario ha sido inactivado por un administrador.",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    if token_session_version != user.session_version:
        raise credentials_exception
        
    # =========================================================
    # 🔥 MAGIA DE IMPERSONATION (TENANT SWAP) 🔥
    # =========================================================
    # Guardamos su identidad original como una propiedad fantasma para la auditoría (global_audit)
    user.real_company_id = user.company_id 
    user.is_impersonating = False

    if impersonating_company_id:
        # Doble validación de seguridad: ¿Sigue siendo SuperAdmin del HQ?
        company = db.query(models.Company).filter(models.Company.id == user.company_id).first()
        if user.is_superadmin and company and company.is_system_company:
            
            # 1. Expulsamos el objeto de la sesión de SQLAlchemy. 
            # Esto evita que un db.commit() accidental guarde el cambio en la base de datos.
            db.expunge(user)
            
            # 2. Le ponemos la camiseta de la empresa objetivo
            user.company_id = impersonating_company_id
            user.is_impersonating = True
        else:
            raise HTTPException(status_code=403, detail="Token de impersonación inválido o privilegios revocados.")

    return user