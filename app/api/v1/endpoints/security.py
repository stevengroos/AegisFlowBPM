from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_ # 🔥 NUEVO: Para poder usar "O esto O aquello" en las búsquedas
from typing import List
from fastapi import BackgroundTasks
from app.core.security import validate_password_complexity, get_password_hash, create_invite_token
from app.core.emails import send_user_invite_async
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core import security as auth_security

from app.core.security_utils import check_settings_permission
from app.core.global_audit import log_global_event

from app.schemas.security import (
    RoleBase, RoleResponse, 
    ProfileBase, ProfileResponse, 
    UserAccessUpdate, UserInvite,
    SecurityPolicyUpdate, SecurityPolicyResponse
)

router = APIRouter()
# Esquema para validar los datos que llegan de React
class SmtpUpdate(BaseModel):
    use_custom_smtp: bool
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    
# ==========================================
# 🔥 POLÍTICAS DE SEGURIDAD (GLOBALES) 🔥
# ==========================================
@router.get("/policies", response_model=SecurityPolicyResponse)
def get_security_policies(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    policy = db.query(models.SecurityPolicy).filter(
        models.SecurityPolicy.company_id == current_user.company_id,
        models.SecurityPolicy.role_id == None,
        models.SecurityPolicy.profile_id == None
    ).first()
    
    if not policy:
        policy = models.SecurityPolicy(company_id=current_user.company_id, name="Política Global")
        db.add(policy)
        db.commit()
        db.refresh(policy)
    else:
        needs_healing = False
        if policy.max_concurrent_sessions is None: policy.max_concurrent_sessions = 3; needs_healing = True
        if policy.password_complexity_active is None:
            policy.password_complexity_active = False; policy.pwd_min_length = 8; policy.pwd_max_length = 128
            policy.pwd_require_uppercase = True; policy.pwd_require_lowercase = True
            policy.pwd_require_numbers = True; policy.pwd_require_special = True; needs_healing = True
        if policy.name is None: policy.name = "Política Global"; needs_healing = True
        if policy.mfa_active is None: policy.mfa_active = False; needs_healing = True
        if policy.mfa_required is None: policy.mfa_required = False; needs_healing = True
            
        if needs_healing:
            db.commit(); db.refresh(policy)
    return policy

@router.put("/policies", response_model=SecurityPolicyResponse)
def update_security_policies(policy_in: SecurityPolicyUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    policy = db.query(models.SecurityPolicy).filter(models.SecurityPolicy.company_id == current_user.company_id, models.SecurityPolicy.role_id == None, models.SecurityPolicy.profile_id == None).first()
    if not policy:
        policy = models.SecurityPolicy(company_id=current_user.company_id, name="Política Global")
        db.add(policy)
    
    old_data = {c.name: getattr(policy, c.name) for c in policy.__table__.columns if c.name not in ['id', 'company_id', 'updated_at']}
    update_data = policy_in.dict()
    for field, value in update_data.items(): setattr(policy, field, value)
        
    db.commit()
    db.refresh(policy)
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="SECURITY_POLICY", action="UPDATE", entity_id=policy.id, details="Modificó las políticas de seguridad globales de la empresa", old_value=old_data, new_value=update_data, request=request)
    return policy


# ==========================================
# 🔥 NUEVO: POLÍTICAS GRANULARES (POR GRUPOS) 🔥
# ==========================================
@router.get("/policies/granular", response_model=List[SecurityPolicyResponse])
def get_granular_policies(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    # Trae todas las políticas de la empresa que NO sean la global (tienen rol o perfil)
    return db.query(models.SecurityPolicy).filter(
        models.SecurityPolicy.company_id == current_user.company_id,
        or_(models.SecurityPolicy.role_id != None, models.SecurityPolicy.profile_id != None)
    ).all()

@router.post("/policies/granular", response_model=SecurityPolicyResponse)
def create_granular_policy(policy_in: SecurityPolicyUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    
    if not policy_in.role_id and not policy_in.profile_id:
        raise HTTPException(status_code=400, detail="Una política granular debe tener asignado un Rol o un Perfil.")

    # Verificamos que no exista ya una política para este grupo
    existing = db.query(models.SecurityPolicy).filter(
        models.SecurityPolicy.company_id == current_user.company_id,
        models.SecurityPolicy.role_id == policy_in.role_id,
        models.SecurityPolicy.profile_id == policy_in.profile_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una política de seguridad para este grupo específico.")

    new_policy = models.SecurityPolicy(**policy_in.dict(), company_id=current_user.company_id)
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="SECURITY_POLICY", action="CREATE_GRANULAR", entity_id=new_policy.id, details=f"Creó política de seguridad granular '{new_policy.name}'", request=request)
    return new_policy

@router.put("/policies/granular/{policy_id}", response_model=SecurityPolicyResponse)
def update_granular_policy(policy_id: int, policy_in: SecurityPolicyUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    policy = db.query(models.SecurityPolicy).filter(models.SecurityPolicy.id == policy_id, models.SecurityPolicy.company_id == current_user.company_id).first()
    if not policy: raise HTTPException(status_code=404, detail="Política no encontrada.")

    old_data = {c.name: getattr(policy, c.name) for c in policy.__table__.columns if c.name not in ['id', 'company_id', 'updated_at']}
    update_data = policy_in.dict()
    for field, value in update_data.items(): setattr(policy, field, value)
        
    db.commit()
    db.refresh(policy)
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="SECURITY_POLICY", action="UPDATE_GRANULAR", entity_id=policy.id, details=f"Editó la política granular '{policy.name}'", old_value=old_data, new_value=update_data, request=request)
    return policy

@router.delete("/policies/granular/{policy_id}")
def delete_granular_policy(policy_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    policy = db.query(models.SecurityPolicy).filter(models.SecurityPolicy.id == policy_id, models.SecurityPolicy.company_id == current_user.company_id).first()
    if not policy: raise HTTPException(status_code=404, detail="Política no encontrada.")
    
    policy_name = policy.name
    db.delete(policy)
    db.commit()
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="SECURITY_POLICY", action="DELETE_GRANULAR", entity_id=policy_id, details=f"Eliminó la política granular '{policy_name}'", request=request)
    return {"message": "Política de seguridad eliminada."}


# ==========================================
# ROLES, PERFILES Y USUARIOS
# (Se mantienen exactamente igual tus funciones anteriores)
# ==========================================
@router.get("/roles", response_model=List[RoleResponse])
def get_roles(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    return db.query(models.Role).filter(models.Role.company_id == current_user.company_id).all()

@router.post("/roles", response_model=RoleResponse)
def create_role(role_in: RoleBase, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_roles")
    if role_in.parent_id:
        parent = db.query(models.Role).filter(models.Role.id == role_in.parent_id, models.Role.company_id == current_user.company_id).first()
        if not parent: raise HTTPException(status_code=403, detail="El Rol superior especificado no existe o no pertenece a tu empresa.")
    new_role = models.Role(name=role_in.name, parent_id=role_in.parent_id, company_id=current_user.company_id, rank=role_in.rank)
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="ROLE", action="CREATE", entity_id=new_role.id, details=f"Creó el rol '{new_role.name}'", request=request)
    return new_role

@router.delete("/roles/{role_id}")
def delete_role(role_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_roles")
    role = db.query(models.Role).filter(models.Role.id == role_id, models.Role.company_id == current_user.company_id).first()
    if not role: raise HTTPException(404, "Rol no encontrado")
    role_name = role.name
    db.query(models.User).filter(models.User.role_id == role_id).update({"role_id": None})
    db.query(models.Role).filter(models.Role.parent_id == role_id).update({"parent_id": None})
    db.delete(role)
    db.commit()
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="ROLE", action="DELETE", entity_id=role_id, details=f"Eliminó el rol '{role_name}'", request=request)
    return {"message": "Rol eliminado"}

@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(role_id: int, role_in: RoleBase, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_roles")
    role = db.query(models.Role).filter(models.Role.id == role_id, models.Role.company_id == current_user.company_id).first()
    if not role: raise HTTPException(404, "Rol no encontrado")
    if role_in.parent_id == role_id: raise HTTPException(400, "Un rol no puede reportarse a sí mismo.")
    if role_in.parent_id and role_in.parent_id != role.parent_id:
        parent = db.query(models.Role).filter(models.Role.id == role_in.parent_id, models.Role.company_id == current_user.company_id).first()
        if not parent: raise HTTPException(status_code=403, detail="El Rol superior especificado no existe o no pertenece a tu empresa.")
    old_data = {"name": role.name, "parent_id": role.parent_id}
    role.name = role_in.name
    role.parent_id = role_in.parent_id
    role.rank = role_in.rank
    db.commit()
    db.refresh(role)
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="ROLE", action="UPDATE", entity_id=role.id, details=f"Editó el rol '{role.name}'", old_value=old_data, new_value={"name": role.name, "parent_id": role.parent_id}, request=request)
    return role

@router.get("/profiles", response_model=List[ProfileResponse])
def get_profiles(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    return db.query(models.Profile).filter(models.Profile.company_id == current_user.company_id).all()

@router.post("/profiles", response_model=ProfileResponse)
def create_profile(profile_in: ProfileBase, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_roles")
    
    new_profile = models.Profile(
        name=profile_in.name,
        permissions=profile_in.permissions,
        is_external=profile_in.is_external, # 🔥 ESTA LÍNEA ES LA CLAVE
        company_id=current_user.company_id
    )
    
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="PROFILE", action="CREATE", entity_id=new_profile.id, details=f"Creó el perfil '{new_profile.name}'", request=request)
    return new_profile

@router.put("/profiles/{profile_id}", response_model=ProfileResponse)
def update_profile(profile_id: int, profile_in: ProfileBase, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_roles")
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id, models.Profile.company_id == current_user.company_id).first()
    if not profile: raise HTTPException(404, "Perfil no encontrado")
    old_data = {"name": profile.name, "permissions": dict(profile.permissions)}
    profile.name = profile_in.name
    profile.permissions = profile_in.permissions
    profile.is_external = profile_in.is_external
    db.commit()
    db.refresh(profile)
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="PROFILE", action="UPDATE", entity_id=profile.id, details=f"Editó el perfil '{profile.name}'", old_value=old_data, new_value={"name": profile.name, "permissions": dict(profile.permissions)}, request=request)
    return profile

@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_roles")
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id, models.Profile.company_id == current_user.company_id).first()
    if not profile: raise HTTPException(404, "Perfil no encontrado")
    profile_name = profile.name
    db.query(models.User).filter(models.User.profile_id == profile_id).update({"profile_id": None})
    db.delete(profile)
    db.commit()
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="PROFILE", action="DELETE", entity_id=profile_id, details=f"Eliminó el perfil '{profile_name}'", request=request)
    return {"message": "Perfil eliminado"}

@router.post("/users/invite")
def invite_user(
    user_in: UserInvite, 
    request: Request, 
    background_tasks: BackgroundTasks, # 🔥 NUEVO: Para enviar correos sin trabar la app
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_users")
    
    if db.query(models.User).filter(models.User.email == user_in.email).first(): 
        raise HTTPException(400, "El email ya está en uso")
        
    if user_in.role_id and not db.query(models.Role).filter(models.Role.id == user_in.role_id, models.Role.company_id == current_user.company_id).first(): 
        raise HTTPException(403, "Rol inválido")
        
    if user_in.profile_id and not db.query(models.Profile).filter(models.Profile.id == user_in.profile_id, models.Profile.company_id == current_user.company_id).first(): 
        raise HTTPException(403, "Perfil inválido")

    # 1. Buscamos la política global de la empresa
    policy = db.query(models.SecurityPolicy).filter(
        models.SecurityPolicy.company_id == current_user.company_id,
        models.SecurityPolicy.role_id == None,
        models.SecurityPolicy.profile_id == None
    ).first()

    # 2. Lógica Híbrida: ¿Invitación o Contraseña Manual?
    if user_in.send_invite:
        # El usuario definirá su contraseña luego. Por ahora nace "en blanco".
        hashed_pwd = None
        mensaje_respuesta = f"Invitación enviada al correo {user_in.email}"
    else:
        # El administrador decidió ponerle una contraseña manual
        # Validamos que cumpla con las políticas de la empresa
        errors = validate_password_complexity(user_in.password, policy)
        if errors:
            raise HTTPException(status_code=400, detail=" | ".join(errors))
        
        hashed_pwd = get_password_hash(user_in.password)
        mensaje_respuesta = f"Usuario creado exitosamente (Contraseña configurada manualmente)"

    # 3. Creamos el usuario en la BD
    new_user = models.User(
        email=user_in.email, 
        first_name=user_in.first_name, 
        last_name=user_in.last_name, 
        hashed_password=hashed_pwd, 
        company_id=current_user.company_id, 
        role_id=user_in.role_id, 
        profile_id=user_in.profile_id,
        is_external=user_in.is_external
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 4. 🔥 Disparamos el correo en segundo plano si aplica
    if user_in.send_invite:
        invite_token = create_invite_token(email=new_user.email)
        background_tasks.add_task(
            send_user_invite_async,
            db=db,
            company_id=new_user.company_id,
            email_to=new_user.email,
            name=new_user.first_name,
            invite_token=invite_token
        )

    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id, 
        entity_type="USER", action="CREATE", entity_id=new_user.id, 
        details=f"Dio de alta al usuario '{new_user.email}' (Vía {'Invitación Email' if user_in.send_invite else 'Contraseña Manual'})", 
        request=request
    )
    
    # IMPORTANTE: Ya no devolvemos la contraseña en la respuesta. ¡Es más seguro!
    return {"message": mensaje_respuesta}

@router.put("/users/{user_id}/access")
def update_user_access(user_id: int, access_in: UserAccessUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_users")
    user = db.query(models.User).filter(models.User.id == user_id, models.User.company_id == current_user.company_id).first()
    if not user: raise HTTPException(404, "Usuario no encontrado")
    old_data = {"role_id": user.role_id, "profile_id": user.profile_id}
    user.role_id = access_in.role_id
    user.profile_id = access_in.profile_id
    if access_in.first_name is not None: user.first_name = access_in.first_name
    if access_in.last_name is not None: user.last_name = access_in.last_name
    if access_in.password: user.hashed_password = auth_security.get_password_hash(access_in.password)
    db.commit()
    details = f"Editó accesos/información del usuario '{user.email}'"
    if access_in.password: details += " (Se cambió la contraseña)"
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="USER", action="UPDATE", entity_id=user.id, details=details, old_value=old_data, new_value={"role_id": user.role_id, "profile_id": user.profile_id}, request=request)
    return {"message": "Usuario actualizado correctamente"}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_users")
    user_to_delete = db.query(models.User).filter(models.User.id == user_id, models.User.company_id == current_user.company_id).first()
    if not user_to_delete: raise HTTPException(404, "Usuario no encontrado")
    if user_to_delete.is_superadmin: raise HTTPException(403, "No puedes eliminar a un Súper Administrador")
    user_email = user_to_delete.email
    db.delete(user_to_delete)
    db.commit()
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="USER", action="DELETE", entity_id=user_id, details=f"Dio de baja permanentemente al usuario '{user_email}'", request=request)
    return {"message": "Usuario dado de baja exitosamente"}

@router.put("/users/{user_id}/toggle-status")
def toggle_user_status(user_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_users")
    user = db.query(models.User).filter(models.User.id == user_id, models.User.company_id == current_user.company_id).first()
    if not user: raise HTTPException(404, "Usuario no encontrado")
    if user.id == current_user.id: raise HTTPException(400, "No puedes inactivarte a ti mismo")
    if user.is_superadmin: raise HTTPException(403, "No puedes alterar el estado de un Súper Administrador")
    user.is_active = not user.is_active
    if not user.is_active: user.session_version += 1
    db.commit()
    estado_texto = "Activó" if user.is_active else "Inactivó (y revocó sesiones)"
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="USER", action="TOGGLE_STATUS", entity_id=user.id, details=f"{estado_texto} al usuario '{user.email}'", request=request)
    return {"message": f"Usuario {'activado' if user.is_active else 'inactivado'} correctamente"}

@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions(user_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_users")
    user = db.query(models.User).filter(models.User.id == user_id, models.User.company_id == current_user.company_id).first()
    if not user: raise HTTPException(404, "Usuario no encontrado")
    user.session_version += 1
    db.commit()
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="USER", action="REVOKE_SESSIONS", entity_id=user.id, details=f"Cerró forzosamente todas las sesiones activas del usuario '{user.email}'", request=request)
    return {"message": "Todas las sesiones de este usuario han sido cerradas"}

# ==========================================
# 🔥 NUEVO: REVOCAR MFA (BOTÓN DE PÁNICO) 🔥
# ==========================================
@router.post("/users/{user_id}/revoke-mfa")
def revoke_user_mfa(user_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_users")
    user = db.query(models.User).filter(models.User.id == user_id, models.User.company_id == current_user.company_id).first()
    if not user: raise HTTPException(404, "Usuario no encontrado")
    
    # Destruimos la llave y le permitimos vincular uno nuevo en su próximo inicio de sesión
    user.mfa_secret = None
    user.is_mfa_enabled = False
    
    # Por seguridad, si reseteamos el MFA, también le revocamos las sesiones activas
    user.session_version += 1
    db.commit()
    
    log_global_event(db=db, user_id=current_user.id, company_id=current_user.company_id, entity_type="SECURITY", action="REVOKE_MFA", entity_id=user.id, details=f"Revocó el Doble Factor (MFA) del usuario '{user.email}'", request=request)
    return {"message": "MFA revocado exitosamente. El usuario deberá escanear un nuevo código QR."}

@router.get("/smtp-settings")
def get_smtp_settings(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    return {
        "use_custom_smtp": company.use_custom_smtp,
        "smtp_host": company.smtp_host, "smtp_port": company.smtp_port,
        "smtp_user": company.smtp_user, "smtp_password": company.smtp_password,
        "smtp_from_email": company.smtp_from_email, "smtp_from_name": company.smtp_from_name
    }

@router.put("/smtp-settings")
def update_smtp_settings(settings_in: SmtpUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    for key, value in settings_in.dict().items():
        setattr(company, key, value)
        
    db.commit()
    return {"message": "Configuración SMTP actualizada correctamente."}

# ==========================================
# 🔥 CONFIGURACIÓN ENTERPRISE SSO (FASE 6) 🔥
# ==========================================
class SsoSettingsUpdate(BaseModel):
    sso_force_native_mfa: bool

@router.get("/sso-settings")
def get_sso_settings(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    return {
        "sso_force_native_mfa": company.sso_force_native_mfa
    }

@router.put("/sso-settings")
def update_sso_settings(settings_in: SsoSettingsUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_security")
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    old_value = company.sso_force_native_mfa
    company.sso_force_native_mfa = settings_in.sso_force_native_mfa
    db.commit()
    
    # Auditamos este cambio crítico
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id, 
        entity_type="SECURITY", action="UPDATE_SSO_SETTINGS", entity_id=company.id, 
        details=f"Cambió la política de SSO MFA Forzado de {old_value} a {settings_in.sso_force_native_mfa}", 
        request=request
    )
    
    return {"message": "Configuración de SSO actualizada correctamente."}

from app.core.emails import send_security_alert_async # Ajusta la ruta de importación según tu estructura

@router.post("/smtp-settings/test")
async def test_smtp_configuration(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    try:
        # Intentará enviar un correo al usuario que está logueado haciendo la prueba
        await send_security_alert_async(
            db=db,
            company_id=current_user.company_id,
            email_to=current_user.email,
            subject="✅ Prueba de Conexión SMTP - AegisFlow",
            body_html="<h3>¡Conexión Exitosa!</h3><p>Si estás leyendo esto, tu configuración de servidor de correos está funcionando perfectamente.</p>"
        )
        return {"message": "Correo de prueba enviado. Revisa tu bandeja de entrada."}
    except Exception as e:
        # Si falla, le mandamos el error exacto al frontend para diagnosticar
        raise HTTPException(status_code=500, detail=f"Error conectando al SMTP: {str(e)}")
    
class AiSettingsUpdate(BaseModel):
    active_provider: Optional[str] = None
    api_key: Optional[str] = None

@router.get("/ai-settings")
def get_ai_settings(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden ver esto.")
        
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    return {
        "active_provider": company.ai_active_provider,
        "api_key": company.ai_api_key
    }

@router.put("/ai-settings")
def update_ai_settings(
    settings: AiSettingsUpdate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden hacer esto.")
        
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    company.ai_active_provider = settings.active_provider
    
    # Solo actualizamos el API KEY si enviaron uno nuevo (para evitar borrarlo si mandan un string vacío por error)
    if settings.api_key is not None:
        company.ai_api_key = settings.api_key
        
    db.commit()
    
    # Auditamos el cambio
    from app.core.global_audit import log_global_event
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="AI_SETTINGS", action="UPDATE", entity_id=company.id,
        details=f"Actualizó la configuración de IA. Proveedor activo: {company.ai_active_provider}",
        request=request
    )
    
    return {"message": "Configuración de IA actualizada exitosamente"}

class UserApproveRequest(BaseModel):
    profile_id: int
    role_id: Optional[int] = None

@router.put("/users/{user_id}/approve")
def approve_external_user(
    user_id: int, 
    req: UserApproveRequest, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Aprueba a un usuario externo que se registró por la App.
    Lo pasa a estado Activo y le asigna su Perfil definitivo.
    """
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="No tienes permisos para aprobar usuarios.")

    target_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.company_id == current_user.company_id
    ).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if target_user.is_active:
        raise HTTPException(status_code=400, detail="Este usuario ya está activo.")

    target_user.is_active = True
    target_user.profile_id = req.profile_id
    if req.role_id:
        target_user.role_id = req.role_id

    db.commit()

    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id, 
        entity_type="USER_MANAGEMENT", action="USER_APPROVED", entity_id=target_user.id, 
        details=f"Usuario {target_user.email} aprobado y activado.", request=request
    )

    return {"message": "Usuario aprobado exitosamente."}