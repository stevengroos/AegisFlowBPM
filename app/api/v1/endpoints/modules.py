from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy.exc import IntegrityError
from app.db.session import get_db
from app.models import models
import requests
from app.core.encryption import encrypt_secret, decrypt_secret
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
# 🔥 IMPORTAMOS LOS NUEVOS SCHEMAS DE CATEGORÍAS 🔥
from app.schemas.module import (
    ModuleCreate, ModuleUpdate, ModuleResponse,
    ModuleCategoryCreate, ModuleCategoryUpdate, ModuleCategoryResponse
)
from app.api import deps
import os
from app.core.security_utils import check_settings_permission
from app.core.global_audit import log_global_event

router = APIRouter()

# ==========================================
# 🔥 ENDPOINTS PARA CATEGORÍAS (CARPETAS) 🔥
# ==========================================

@router.get("/categories/", response_model=List[ModuleCategoryResponse])
def get_categories(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    categories = db.query(models.ModuleCategory).filter(
        models.ModuleCategory.company_id == current_user.company_id
    ).order_by(models.ModuleCategory.order.asc(), models.ModuleCategory.id.asc()).all()
    return categories

@router.post("/categories/", response_model=ModuleCategoryResponse)
def create_category(
    category: ModuleCategoryCreate, 
    request: Request, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_category = models.ModuleCategory(**category.dict(), company_id=current_user.company_id) 
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE_CATEGORY", action="CREATE", entity_id=db_category.id,
        details=f"Creó la categoría de módulos '{db_category.name}'", request=request
    )
    return db_category

@router.put("/categories/reorder")
def reorder_categories(
    order_data: Dict[str, int], 
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    for cat_id_str, new_order in order_data.items():
        cat_id = int(cat_id_str)
        category = db.query(models.ModuleCategory).filter(
            models.ModuleCategory.id == cat_id,
            models.ModuleCategory.company_id == current_user.company_id
        ).first()
        if category:
            category.order = new_order
            
    db.commit()
    return {"message": "Orden de categorías actualizado"}

@router.put("/categories/{category_id}", response_model=ModuleCategoryResponse)
def update_category(
    category_id: int, 
    category_data: ModuleCategoryUpdate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_category = db.query(models.ModuleCategory).filter(
        models.ModuleCategory.id == category_id,
        models.ModuleCategory.company_id == current_user.company_id
    ).first()
    
    if not db_category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    update_data = category_data.dict(exclude_unset=True) 
    for key, value in update_data.items():
        setattr(db_category, key, value)
        
    db.commit()
    db.refresh(db_category)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE_CATEGORY", action="UPDATE", entity_id=db_category.id,
        details=f"Editó la categoría '{db_category.name}'", request=request
    )
    return db_category

@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_category = db.query(models.ModuleCategory).filter(
        models.ModuleCategory.id == category_id,
        models.ModuleCategory.company_id == current_user.company_id
    ).first()
    
    if not db_category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    cat_name = db_category.name 
    db.delete(db_category) # Los módulos no se borran, solo se salen de la carpeta gracias a ondelete="SET NULL"
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE_CATEGORY", action="DELETE", entity_id=category_id,
        details=f"Eliminó la categoría '{cat_name}'. Los módulos internos ahora están sueltos.", request=request
    )
    return {"message": "Categoría eliminada exitosamente"}

# ==========================================
# 🔥 ENDPOINTS CLÁSICOS DE MÓDULOS 🔥
# ==========================================

@router.post("/", response_model=ModuleResponse)
def create_module(
    module: ModuleCreate, 
    request: Request, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_module = models.Module(**module.dict(), company_id=current_user.company_id) 
    db.add(db_module)
    
    try:
        db.commit()
        db.refresh(db_module)
    except IntegrityError:
        db.rollback() 
        raise HTTPException(
            status_code=400, 
            detail=f"El módulo '{module.name}' ya existe en tu empresa."
        )
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE", action="CREATE", entity_id=db_module.id,
        details=f"Creó el módulo '{db_module.name}'", request=request
    )
    
    return db_module

@router.get("/", response_model=List[ModuleResponse])
def get_modules(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    all_modules = db.query(models.Module).filter(
        models.Module.company_id == current_user.company_id
    ).order_by(models.Module.order.asc()).offset(skip).limit(limit).all()
    
    if current_user.is_superadmin:
        return all_modules
        
    if not current_user.profile_id:
        return []
        
    profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
    if not profile or not profile.permissions:
        return []
        
    allowed_modules = []
    for mod in all_modules:
        mod_perms = profile.permissions.get("modules", {}).get(str(mod.id), {})
        if mod_perms.get("view"):
            allowed_modules.append(mod)
            
    return allowed_modules

@router.put("/reorder")
def reorder_modules(
    order_data: Dict[str, int], 
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    for module_id_str, new_order in order_data.items():
        module_id = int(module_id_str)
        module = db.query(models.Module).filter(
            models.Module.id == module_id,
            models.Module.company_id == current_user.company_id
        ).first()
        if module:
            module.order = new_order
            
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE", action="REORDER",
        details="Reordenó la posición de los módulos en el menú principal", request=request
    )
    
    return {"message": "Orden de módulos actualizado exitosamente"}


@router.get("/{module_id}", response_model=ModuleResponse)
def get_module(
    module_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    db_module = db.query(models.Module).filter(
        models.Module.id == module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if db_module is None:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
        
    if not current_user.is_superadmin:
        profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
        if not profile or not profile.permissions: 
            raise HTTPException(status_code=403, detail="Acceso denegado")
            
        if not profile.permissions.get("modules", {}).get(str(module_id), {}).get("view"):
            raise HTTPException(status_code=403, detail="No tienes permiso para ver este módulo")
            
    return db_module

@router.put("/{module_id}", response_model=ModuleResponse)
def update_module(
    module_id: int, 
    module_data: ModuleUpdate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_module = db.query(models.Module).filter(
        models.Module.id == module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if not db_module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    
    old_data = {"name": db_module.name, "description": db_module.description, "icon": db_module.icon}
    
    update_data = module_data.dict(exclude_unset=True) 
    for key, value in update_data.items():
        setattr(db_module, key, value)
        
    db.commit()
    db.refresh(db_module)
    
    new_data = {"name": db_module.name, "description": db_module.description, "icon": db_module.icon}
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE", action="UPDATE", entity_id=db_module.id,
        details=f"Editó el módulo '{db_module.name}'",
        old_value=old_data, new_value=new_data, request=request
    )
    
    return db_module

@router.delete("/{module_id}")
def delete_module(
    module_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")
    
    db_module = db.query(models.Module).filter(
        models.Module.id == module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if not db_module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    
    module_name = db_module.name 
    
    db.delete(db_module)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MODULE", action="DELETE", entity_id=module_id,
        details=f"Eliminó por completo el módulo '{module_name}'", request=request
    )
    
    return {"message": "Módulo eliminado exitosamente"}

# ==========================================
# 🔥 ENDPOINTS PARA INTEGRACIONES (SIGNATURIT) 🔥
# ==========================================

class IntegrationUpdate(BaseModel):
    environment: str # 'sandbox' o 'production'
    token: Optional[str] = None # Es opcional porque el usuario podría querer solo apagar el interruptor sin reescribir el token
    is_active: bool

class IntegrationResponse(BaseModel):
    provider_name: str
    environment: str
    is_active: bool
    has_token: bool # Le dice al frontend: "Sí, ya hay un token guardado"

@router.get("/{module_id}/integrations/{provider_name}", response_model=IntegrationResponse)
def get_module_integration(
    module_id: int,
    provider_name: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")

    integration = db.query(models.ModuleIntegration).filter(
        models.ModuleIntegration.company_id == current_user.company_id,
        models.ModuleIntegration.module_id == module_id,
        models.ModuleIntegration.provider_name == provider_name
    ).first()

    # Si la empresa nunca ha configurado esta integración, devolvemos valores por defecto
    if not integration:
        return {
            "provider_name": provider_name,
            "environment": "sandbox",
            "is_active": False,
            "has_token": False
        }

    return {
        "provider_name": integration.provider_name,
        "environment": integration.environment,
        "is_active": integration.is_active,
        "has_token": bool(integration.encrypted_token) # Ocultamos el token por seguridad
    }

@router.put("/{module_id}/integrations/{provider_name}", response_model=IntegrationResponse)
def update_module_integration(
    module_id: int,
    provider_name: str,
    data: IntegrationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_modules")

    # 🔥 NUEVA REGLA: VERIFICAR QUE EL API KEY NO SE REPITA EN OTROS MÓDULOS 🔥
    if data.token:
        otras_integraciones = db.query(models.ModuleIntegration).filter(
            models.ModuleIntegration.company_id == current_user.company_id,
            models.ModuleIntegration.provider_name == provider_name,
            models.ModuleIntegration.module_id != module_id # Excluimos el módulo actual
        ).all()
        
        for integ in otras_integraciones:
            if integ.encrypted_token:
                token_desencriptado = decrypt_secret(integ.encrypted_token).strip()
                if token_desencriptado == data.token.strip():
                    raise HTTPException(
                        status_code=400, 
                        detail="Este API Key ya está siendo utilizado en otro módulo. Por seguridad y aislamiento de datos, cada módulo debe tener su propia cuenta de integración."
                    )

    integration = db.query(models.ModuleIntegration).filter(
        models.ModuleIntegration.company_id == current_user.company_id,
        models.ModuleIntegration.module_id == module_id,
        models.ModuleIntegration.provider_name == provider_name
    ).first()

    if not integration:
        # Si no existía, la creamos y encriptamos el token
        integration = models.ModuleIntegration(
            company_id=current_user.company_id,
            module_id=module_id,
            provider_name=provider_name,
            environment=data.environment,
            is_active=data.is_active,
            encrypted_token=encrypt_secret(data.token) if data.token else ""
        )
        db.add(integration)
    else:
        # Si ya existía, la actualizamos
        integration.environment = data.environment
        integration.is_active = data.is_active
        if data.token: 
            integration.encrypted_token = encrypt_secret(data.token)

    db.commit()

    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="INTEGRATION", action="UPDATE", entity_id=module_id,
        details=f"Actualizó la integración de {provider_name} (Entorno: {data.environment})", request=request
    )

    return {
        "provider_name": integration.provider_name,
        "environment": integration.environment,
        "is_active": integration.is_active,
        "has_token": bool(integration.encrypted_token)
    }

@router.get("/{module_id}/integrations/signaturit/templates")
def get_signaturit_templates(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Paso 1: Trae la lista completa de plantillas usando V3 (Soporta hasta 100 de golpe)"""
    check_settings_permission(db, current_user, "manage_modules")
    
    integration = db.query(models.ModuleIntegration).filter(
        models.ModuleIntegration.company_id == current_user.company_id,
        models.ModuleIntegration.module_id == module_id,
        models.ModuleIntegration.provider_name == "signaturit"
    ).first()
    
    if not integration or not integration.is_active or not integration.encrypted_token:
        raise HTTPException(status_code=400, detail="La integración no está configurada.")
        
    token = decrypt_secret(integration.encrypted_token).strip()
    base_url = "https://api.sandbox.signaturit.com" if integration.environment == "sandbox" else "https://api.signaturit.com"
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        # 🔥 Usamos V3 con limit=100 para traer toda la lista
        response = requests.get(f"{base_url}/v3/templates.json?limit=100", headers=headers, timeout=10, verify=False)
        
        if not response.ok:
            raise HTTPException(status_code=400, detail=f"Signaturit dice: {response.text}")
            
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Fallo de red: {str(e)}")


@router.get("/{module_id}/integrations/signaturit/templates/{template_id}")
def get_signaturit_template_details(
    module_id: int,
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Paso 2: Trae los widgets buscando la plantilla en la paginación de V4"""
    check_settings_permission(db, current_user, "manage_modules")
    
    integration = db.query(models.ModuleIntegration).filter(
        models.ModuleIntegration.company_id == current_user.company_id,
        models.ModuleIntegration.module_id == module_id,
        models.ModuleIntegration.provider_name == "signaturit"
    ).first()
    
    token = decrypt_secret(integration.encrypted_token).strip()
    base_url = "https://api.sandbox.signaturit.com" if integration.environment == "sandbox" else "https://api.signaturit.com"
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # 🔥 EL BUSCADOR INTELIGENTE (Paginación V4)
        # Hojemos el "libro" de plantillas de 10 en 10 hasta encontrar la que el usuario clickeó.
        page = 1
        while True:
            response = requests.get(f"{base_url}/v4/templates?limit=10&page={page}", headers=headers, timeout=10, verify=False)
            
            if not response.ok:
                raise HTTPException(status_code=400, detail="Error al conectar con Signaturit v4.")
            
            templates_page = response.json()
            
            # Si la página viene vacía, ya revisamos todas y no la encontramos
            if not templates_page:
                raise HTTPException(status_code=404, detail="Plantilla no encontrada en Signaturit.")
                
            # Buscamos la plantilla en esta página específica
            for t in templates_page:
                if t.get('id') == template_id:
                    return t # ¡Bingo! La encontramos y ya trae los "widgets" adentro
                    
            # Si no estaba aquí, pasamos a la siguiente página (Signaturit permite max 10 por página)
            page += 1
            
            # Cortafuegos de seguridad: Si llega a la página 30 (300 plantillas), detenemos para evitar bucles infinitos
            if page > 30:
                raise HTTPException(status_code=400, detail="Límite de búsqueda excedido.")
                
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Fallo de red: {str(e)}")
    
# 1. Creamos el esquema para recibir la URL desde el frontend
class WebhookSetupPayload(BaseModel):
    app_url: str

# 2. Actualizamos el endpoint
@router.post("/{module_id}/integrations/signaturit/webhook/setup")
def setup_signaturit_webhook(
    module_id: int,
    payload: WebhookSetupPayload, # 🔥 Recibimos la URL por aquí
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Configura automáticamente el Webhook usando la URL provista por el frontend."""
    check_settings_permission(db, current_user, "manage_modules")
    
    integration = db.query(models.ModuleIntegration).filter(
        models.ModuleIntegration.company_id == current_user.company_id,
        models.ModuleIntegration.module_id == module_id,
        models.ModuleIntegration.provider_name == "signaturit"
    ).first()
    
    if not integration or not integration.encrypted_token:
        raise HTTPException(status_code=400, detail="Primero debes configurar y guardar el Token.")
        
    token = decrypt_secret(integration.encrypted_token).strip()
    base_url = "https://api.sandbox.signaturit.com" if integration.environment == "sandbox" else "https://api.signaturit.com"
    
    # 🔥 Limpiamos la URL por si el usuario le puso una barra al final y armamos el destino
    clean_url = payload.app_url.strip().rstrip("/")
    webhook_target = f"{clean_url}/api/v1/webhooks/signaturit"
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        subs_res = requests.get(f"{base_url}/v3/subscriptions.json", headers=headers, verify=False)
        existing_subs = subs_res.json() if subs_res.ok else []
        
        for sub in existing_subs:
            if sub.get('url') == webhook_target:
                return {"message": "El webhook ya estaba configurado para esta URL.", "url": webhook_target}

        webhook_payload = {
            "url": webhook_target,
            "events[0]": "*"
        }
        
        response = requests.post(f"{base_url}/v3/subscriptions.json", data=webhook_payload, headers=headers, verify=False)
        
        if not response.ok:
            raise HTTPException(status_code=400, detail=f"Signaturit rechazó la suscripción: {response.text}")
            
        return {"message": "¡Webhook configurado con éxito!", "url": webhook_target}
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Fallo de red conectando con Signaturit: {str(e)}")
    
@router.put("/{module_id}/mobile_config")
def update_mobile_config(
    module_id: int,
    config: Dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Actualiza la configuración de publicación B2C (Headless) del módulo.
    """
    # Verificamos que sea administrador (ajusta esto si usas security_utils)
    if not current_user.is_superadmin:
        profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
        if not profile or not profile.permissions.get("settings", {}).get("manage_modules"):
            raise HTTPException(status_code=403, detail="No tienes permisos para modificar módulos.")

    module = db.query(models.Module).filter(
        models.Module.id == module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")

    module.mobile_config = config
    db.commit()
    
    return {"message": "Configuración móvil guardada exitosamente", "mobile_config": module.mobile_config}