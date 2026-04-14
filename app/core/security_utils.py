from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models import models

def check_settings_permission(db: Session, user: models.User, perm_key: str):
    if user.is_superadmin: return True
    if not user.profile_id: raise HTTPException(status_code=403, detail="No tienes perfil asignado.")
    
    # 🔥 PENTEST FIX: Defensa en Profundidad (Candado Multi-Tenant) 🔥
    profile = db.query(models.Profile).filter(
        models.Profile.id == user.profile_id,
        models.Profile.company_id == user.company_id
    ).first()
    
    if not profile or not profile.permissions: raise HTTPException(status_code=403, detail="Perfil sin permisos.")
    if not profile.permissions.get("settings", {}).get(perm_key):
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción.")
    return True

def get_user_rank(db: Session, user_id: int, company_id: int):
    # 🔥 PENTEST FIX: Asegurar que el usuario y el rol consultados pertenezcan a la empresa 🔥
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.company_id == company_id
    ).first()
    
    if not user or not user.role_id: return None
    
    role = db.query(models.Role).filter(
        models.Role.id == user.role_id,
        models.Role.company_id == company_id
    ).first()
    
    return role.rank if role else None

def check_module_permission(db: Session, user: models.User, module_id: int, action: str):
    if user.is_superadmin: return True
    if not user.profile_id: raise HTTPException(status_code=403, detail="No tienes perfil asignado.")
    
    # 🔥 PENTEST FIX: Candado Multi-Tenant 🔥
    profile = db.query(models.Profile).filter(
        models.Profile.id == user.profile_id,
        models.Profile.company_id == user.company_id
    ).first()
    
    if not profile or not profile.permissions: raise HTTPException(status_code=403, detail="Perfil inválido o sin permisos.")

    mod_perms = profile.permissions.get("modules", {}).get(str(module_id))
    if not mod_perms: raise HTTPException(status_code=403, detail="Sin permisos para este módulo.")

    if action == 'create' and not mod_perms.get('create'):
        raise HTTPException(status_code=403, detail="No tienes permiso para crear registros en este módulo.")
        
    if action == 'view' and not (mod_perms.get('view') or mod_perms.get('view_same_rank')):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este módulo.")

    return True

def check_record_permission(db: Session, user: models.User, record: models.Case, action: str):
    if user.is_superadmin: return True
    if not user.profile_id: raise HTTPException(status_code=403, detail="No tienes perfil asignado.")
    
    # 🔥 PENTEST FIX: Candado Multi-Tenant 🔥
    profile = db.query(models.Profile).filter(
        models.Profile.id == user.profile_id,
        models.Profile.company_id == user.company_id
    ).first()
    
    if not profile or not profile.permissions: raise HTTPException(status_code=403, detail="Perfil sin permisos.")

    mod_perms = profile.permissions.get("modules", {}).get(str(record.module_id))
    if not mod_perms: raise HTTPException(status_code=403, detail="Sin permisos para este módulo.")

    # El dueño es el asignado, o en su defecto el creador
    target_user_id = record.assigned_to if record.assigned_to else record.created_by
    is_owner = (user.id == record.created_by) or (user.id == record.assigned_to)
    
    # Pasamos el company_id para evitar consultas cruzadas
    my_rank = get_user_rank(db, user.id, user.company_id)
    target_rank = get_user_rank(db, target_user_id, user.company_id) if target_user_id else None

    is_same_rank = False
    is_subordinate = False

    if my_rank is not None and target_rank is not None:
        if my_rank == target_rank and not is_owner:
            is_same_rank = True
        elif my_rank < target_rank: # Ej: 1 (CEO) < 2 (Gerente) -> Es subordinado
            is_subordinate = True

    if action == "view":
        if is_owner and mod_perms.get("view"): return True
        if is_same_rank and mod_perms.get("view_same_rank"): return True
        if is_subordinate and mod_perms.get("view"): return True 
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este registro.")

    if action == "edit":
        if is_owner and mod_perms.get("edit_own"): return True
        if is_same_rank and mod_perms.get("edit_same_rank"): return True
        if is_subordinate and mod_perms.get("edit_subordinates"): return True
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este registro.")

    if action == "delete":
        if is_owner and mod_perms.get("delete_own"): return True
        if is_same_rank and mod_perms.get("delete_same_rank"): return True
        if is_subordinate and mod_perms.get("delete_subordinates"): return True
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este registro.")

    raise HTTPException(status_code=403, detail="Acción no permitida.")

def get_visible_users(db: Session, active_user: models.User, mod_perms: dict = None):
    # 🔥 BUG FIX: Súper Administrador lo ve todo siempre 🔥
    if active_user.is_superadmin:
        all_company_users = db.query(models.User.id).filter(models.User.company_id == active_user.company_id).all()
        return [user_id[0] for user_id in all_company_users]

    visible_ids = [active_user.id]
    if not active_user.role_id: return visible_ids
    
    # 🔥 PENTEST FIX: Candado Multi-Tenant 🔥
    active_role = db.query(models.Role).filter(
        models.Role.id == active_user.role_id,
        models.Role.company_id == active_user.company_id
    ).first()
    
    if not active_role: return visible_ids

    # 1. Siempre obtenemos a los subordinados (rangos numéricamente mayores)
    subordinates = db.query(models.User).join(models.Role).filter(
        models.User.company_id == active_user.company_id,
        models.Role.rank > active_role.rank
    ).all()
    visible_ids.extend([u.id for u in subordinates])

    # 2. Si el perfil dice que puede ver los de su "Mismo Rango", los buscamos
    if mod_perms and mod_perms.get("view_same_rank"):
        same_rank_users = db.query(models.User).join(models.Role).filter(
            models.User.company_id == active_user.company_id,
            models.Role.rank == active_role.rank
        ).all()
        visible_ids.extend([u.id for u in same_rank_users])

    return list(set(visible_ids))

# =========================================================
# 🔥 FASE SOPORTE: OMNIPRESENCIA PARA AEGISFLOW HQ 🔥
# =========================================================

def is_system_admin(db: Session, user: models.User) -> bool:
    """
    Verifica si el usuario pertenece a la Empresa Maestra (System Company)
    y tiene privilegios de Súper Administrador.
    """
    if not user.is_superadmin:
        return False
        
    company = db.query(models.Company).filter(
        models.Company.id == user.company_id
    ).first()
    
    return company is not None and company.is_system_company

def check_support_access(db: Session, user: models.User, target_company_id: int):
    """
    Permite el acceso a una sesión de chat si el usuario es de esa misma empresa
    O si es un agente de soporte omnipresente de AegisFlow HQ.
    """
    # 1. Si el usuario es de la misma empresa que el chat (el cliente), pasa.
    if user.company_id == target_company_id:
        return True
        
    # 2. Si NO es de la misma empresa, verificamos si es un Agente de AegisFlow HQ
    if is_system_admin(db, user):
        return True
        
    # Si no cumple ninguna, lo bloqueamos (Intento de espionaje entre clientes)
    raise HTTPException(
        status_code=403, 
        detail="Acceso denegado. No tienes permisos para ver o interactuar en esta sesión de soporte."
    )