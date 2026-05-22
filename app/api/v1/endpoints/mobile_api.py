from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import models
from app.api import deps
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import make_transient
from app.core import security_utils
from sqlalchemy.orm.attributes import flag_modified # 🔥 IMPORTACIÓN CLAVE

router = APIRouter()

# ==========================================
# ESQUEMAS DE ENTRADA / SALIDA
# ==========================================
class MobileRegisterRequest(BaseModel):
    email: str
    password: str
    company_id: int 
    profile_data: dict = {}

class MobileCaseResponse(BaseModel):
    id: int
    module_id: int
    form_id: int
    status_id: Optional[int]
    data: dict
    created_at: datetime

# ==========================================
# 🔥 0.8 CONFIGURACIÓN GLOBAL DE LA APP (SETTINGS) 🔥
# ==========================================
class MobileAppConfigSchema(BaseModel):
    is_b2c_enabled: bool = False
    onboarding_module_id: Optional[int] = None
    onboarding_form_id: Optional[int] = None
    
    # 🔥 NUEVOS CAMPOS DE MAPEO DE NOMBRE 🔥
    onboarding_firstname_field: Optional[str] = None
    onboarding_lastname_field: Optional[str] = None
    
    # --- FLUJO NORMAL (Vendedor Oferta -> Comprador Compra) ---
    purchases_module_id: Optional[int] = None
    purchases_form_id: Optional[int] = None 
    purchases_volume_field: Optional[str] = None 
    purchases_price_field: Optional[str] = None  
    
    # --- FLUJO INVERSO (Comprador Demanda -> Vendedor Cubre) ---
    demands_module_id: Optional[int] = None # Dónde el comprador publica qué necesita
    demands_form_id: Optional[int] = None
    
    fulfillment_module_id: Optional[int] = None # Dónde se guardan las ofertas de los vendedores
    fulfillment_form_id: Optional[int] = None
    fulfillment_volume_field: Optional[str] = None
    fulfillment_price_field: Optional[str] = None
    
    require_manual_approval: bool = True
    theme_color: str = "#000000"
    hide_prices_from_guests: bool = False

@router.get("/settings/mobile", response_model=MobileAppConfigSchema)
def get_mobile_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Devuelve la configuración global de la App Móvil para la empresa actual."""
    # 🔥 Eliminamos el bloqueo de SuperAdmin AQUÍ para que la App pueda leer el color
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")
        
    return company.mobile_app_config or {}

@router.put("/settings/mobile")
def update_mobile_settings(
    req: MobileAppConfigSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Actualiza la configuración global de la App Móvil."""
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar esta configuración.")
        
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    # Actualizamos el JSON completo
    company.mobile_app_config = req.dict()
    
    # Le avisamos a SQLAlchemy que el JSON cambió
    flag_modified(company, "mobile_app_config")
    
    db.commit()
    return {"message": "Configuración de la App Móvil actualizada correctamente."}

# ==========================================
# 🔥 0. CONFIGURACIÓN DEL REGISTRO DINÁMICO 🔥
# ==========================================
@router.get("/config/registration")
def get_registration_config(company_id: int, db: Session = Depends(get_db)):
    """
    La App Móvil llama a esto apenas se abre para saber qué campos debe preguntarle al usuario.
    Ahora lee exactamente el formulario configurado desde el Backoffice B2C.
    """
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    # Extraemos la configuración dinámica
    config = company.mobile_app_config or {}
    form_id = config.get("onboarding_form_id")

    form = None
    if form_id:
        form = db.query(models.Form).filter(models.Form.id == form_id, models.Form.is_active == True).first()

    # Si no lo han configurado o no existe, devolvemos el Mock de emergencia
    if not form:
        return [
            {
                "title": "Datos Personales",
                "fields": [
                    {"api_name": "first_name", "label": "Nombre", "type": "text", "required": True},
                    {"api_name": "last_name", "label": "Apellido", "type": "text", "required": True},
                    {"api_name": "phone", "label": "Teléfono", "type": "number", "required": True},
                ]
            },
            {
                "title": "Datos de Operación",
                "fields": [
                    {"api_name": "user_profile", "label": "Perfil de Operación", "type": "select", "options": ["Productor", "Comprador"], "required": True},
                    {"api_name": "company_name", "label": "Empresa / Finca", "type": "text", "required": False},
                ]
            }
        ]

    # Si lo encontraron, extraemos la estructura real
    sections = db.query(models.FormSection).filter(models.FormSection.form_id == form.id).order_by(models.FormSection.order).all()
    fields = db.query(models.FormField).filter(
        models.FormField.form_id == form.id, models.FormField.is_active == True, models.FormField.show_in_create == True
    ).order_by(models.FormField.order).all()

    wizard_config = []
    orphaned_fields = [f for f in fields if not f.section_id]
    if orphaned_fields:
         wizard_config.append({"title": "Información General", "fields": _format_fields_for_mobile(orphaned_fields)})

    for sec in sections:
        sec_fields = [f for f in fields if f.section_id == sec.id]
        if sec_fields:
            wizard_config.append({"title": sec.title, "fields": _format_fields_for_mobile(sec_fields)})

    return wizard_config

def _format_fields_for_mobile(fields_list):
    """
    Función auxiliar para limpiar los datos de los campos 
    y dejarlos listos para el consumo de Flutter.
    """
    formatted = []
    for f in fields_list:
        # Convertimos las opciones a lista de strings
        opts = []
        if f.options:
            if isinstance(f.options, list):
                opts = [str(o) for o in f.options]
            elif isinstance(f.options, str):
                opts = [o.strip() for o in f.options.split(",")]

        # Mapeamos los tipos de AegisFlow a los tipos que Flutter entiende
        flutter_type = "text"
        if f.field_type in ["number", "decimal", "currency"]: flutter_type = "number"
        elif f.field_type == "select": flutter_type = "select"
        elif f.field_type == "date": flutter_type = "date"
        elif f.field_type == "checkbox": flutter_type = "checkbox"
        # Soportamos archivos/imágenes
        elif f.field_type in ["file", "image", "photo", "picture"]: flutter_type = "file"
        elif f.field_type == "map": flutter_type = "map"

        formatted.append({
            "api_name": f.api_name or f.label.lower().replace(" ", "_"),
            "label": f.label,
            "type": flutter_type,
            "required": f.required,
            "options": opts if opts else None
        })
        
    # 🔥 AHORA SÍ ESTÁ AFUERA DEL BUCLE FOR 🔥
    return formatted

# ==========================================
# 🔥 0.5 CONFIGURACIÓN DINÁMICA DE MÓDULOS (PUBLICACIÓN) 🔥
# ==========================================
@router.get("/config/form/{module_id}")
def get_module_form_config(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Devuelve la estructura dinámica del formulario principal de un módulo.
    Incluye el form_id necesario para luego crear el registro.
    """
    form = db.query(models.Form).filter(
        models.Form.module_id == module_id,
        models.Form.company_id == current_user.company_id,
        models.Form.is_active == True
    ).first()

    if not form:
        raise HTTPException(status_code=404, detail="No hay un formulario activo para este módulo.")

    sections = db.query(models.FormSection).filter(models.FormSection.form_id == form.id).order_by(models.FormSection.order).all()
    fields = db.query(models.FormField).filter(
        models.FormField.form_id == form.id,
        models.FormField.is_active == True,
        models.FormField.show_in_create == True
    ).order_by(models.FormField.order).all()

    wizard_config = []
    
    orphaned_fields = [f for f in fields if not f.section_id]
    if orphaned_fields:
         wizard_config.append({"title": "Datos del Producto", "fields": _format_fields_for_mobile(orphaned_fields)})

    for sec in sections:
        sec_fields = [f for f in fields if f.section_id == sec.id]
        if sec_fields:
            wizard_config.append({"title": sec.title, "fields": _format_fields_for_mobile(sec_fields)})

    # Retornamos el ID del formulario y la estructura
    return {
        "form_id": form.id,
        "wizard": wizard_config
    }
    
    
    
# 🔥 NUEVO: OBTENER FORMULARIO POR SU ID EXACTO (PARA CHECKOUT Y PUBLICACIÓN) 🔥
@router.get("/config/form_by_id/{form_id}")
def get_form_config_by_id(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    form = db.query(models.Form).filter(
        models.Form.id == form_id,
        models.Form.company_id == current_user.company_id,
        models.Form.is_active == True
    ).first()

    if not form:
        raise HTTPException(status_code=404, detail="Formulario no encontrado o inactivo.")

    sections = db.query(models.FormSection).filter(models.FormSection.form_id == form.id).order_by(models.FormSection.order).all()
    fields = db.query(models.FormField).filter(
        models.FormField.form_id == form.id,
        models.FormField.is_active == True,
        models.FormField.show_in_create == True
    ).order_by(models.FormField.order).all()

    wizard_config = []
    orphaned_fields = [f for f in fields if not f.section_id]
    if orphaned_fields:
         wizard_config.append({"title": "Datos Requeridos", "fields": _format_fields_for_mobile(orphaned_fields)})

    for sec in sections:
        sec_fields = [f for f in fields if f.section_id == sec.id]
        if sec_fields:
            wizard_config.append({"title": sec.title, "fields": _format_fields_for_mobile(sec_fields)})

    return {
        "form_id": form.id,
        "wizard": wizard_config
    }
    
# ==========================================
# 🔥 1. REGISTRO EXTERNO (ONBOARDING B2C) 🔥
# ==========================================
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_mobile_user(
    req: MobileRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Endpoint público para que usuarios externos se registren.
    """
    # 1. Verificar si el usuario ya existe
    user_exists = db.query(models.User).filter(models.User.email == req.email).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="Este correo electrónico ya está registrado.")

    # 2. Verificar que la empresa (Tenant) exista
    company = db.query(models.Company).filter(models.Company.id == req.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    # 3. Buscar Perfil y Rol "Pendiente" o "Externo"
    # Extraemos qué tipo de usuario dijo que era en el paso 2 del Wizard
    user_type = req.profile_data.get("user_profile", "Productor")
    
    profile = db.query(models.Profile).filter(
        models.Profile.company_id == req.company_id,
        models.Profile.is_external == True,
        models.Profile.name.ilike(f"%{user_type}%")
    ).first()
    
    if not profile:
         profile = db.query(models.Profile).filter(
            models.Profile.company_id == req.company_id,
            models.Profile.is_external == True
         ).first()

    # Si no existe, creamos el de emergencia
    if not profile:
        profile = models.Profile(company_id=req.company_id, name="Usuario App Móvil", is_external=True, permissions={})
        db.add(profile)
        db.flush()

    from app.core.security import get_password_hash
    
    config = company.mobile_app_config or {}
    require_approval = config.get("require_manual_approval", True)

    # 🔥 LEEMOS LOS CAMPOS DINÁMICOS (O usamos los default si aún no los configuran) 🔥
    first_name_key = config.get("onboarding_firstname_field") or "nombre"
    last_name_key = config.get("onboarding_lastname_field") or "apellido"

    # 4. Crear el Usuario respetando la regla de Aprobación Manual
    new_user = models.User(
        email=req.email,
        hashed_password=get_password_hash(req.password),
        first_name=req.profile_data.get(first_name_key, ""), 
        last_name=req.profile_data.get(last_name_key, ""), 
        company_id=req.company_id,
        is_external=True,          
        is_active=not require_approval,
        profile_id=profile.id,
        profile_data=req.profile_data 
    )
    db.add(new_user)
    db.flush()

    # 🔥 5. CREAR EL REGISTRO HISTÓRICO EN EL MÓDULO CONFIGURADO 🔥
    onboarding_module_id = config.get("onboarding_module_id")
    onboarding_form_id = config.get("onboarding_form_id")

    if onboarding_module_id and onboarding_form_id:
        initial_status = db.query(models.Status).join(models.Blueprint).filter(
            models.Blueprint.module_id == onboarding_module_id,
            models.Blueprint.company_id == req.company_id,
            models.Blueprint.is_active == True,
            models.Status.is_initial == True
        ).first()

        new_case = models.Case(
            company_id=req.company_id,
            created_by=new_user.id,
            module_id=onboarding_module_id,
            form_id=onboarding_form_id,
            status_id=initial_status.id if initial_status else None,
            data=req.profile_data,
            ui_rules={}
        )
        db.add(new_case)

    db.commit()

    msg = "Registro completado. Tu cuenta está pendiente de validación por el equipo de GRAPP." if require_approval else "Registro exitoso. ¡Bienvenido a GRAPP!"
    return {"message": msg}

# ==========================================
# 🔥 1.5 OBTENER CATÁLOGOS PUBLICADOS (HOME) 🔥
# ==========================================
@router.get("/catalogs")
def get_published_catalogs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Devuelve la lista de módulos que tienen el switch "ONLINE" activado.
    """
    modules = db.query(models.Module).filter(
        models.Module.company_id == current_user.company_id,
        models.Module.is_active == True
    ).all()
    
    catalogs = []
    for m in modules:
        config = m.mobile_config or {}
        if config.get("is_published") == True:
            catalogs.append({
                "id": m.id,
                "name": m.name,
                "icon": m.icon,
                "description": m.description or f"Explora las ofertas de {m.name}",
                "mapping": config.get("mapping", {}), # Enviamos el mapeo visual a la App
                "cover_image": config.get("cover_image", "") # 🔥 Agregamos la imagen de portada
            })
            
    return catalogs


# ==========================================
# 🔥 1.6 OBTENER CATÁLOGOS PERMITIDOS PARA PUBLICAR 🔥
# ==========================================
@router.get("/catalogs/publishable")
def get_publishable_catalogs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Devuelve SOLO los módulos B2C donde este usuario específico tiene permiso 
    para PUBLICAR (crear ofertas).
    """
    modules = db.query(models.Module).filter(
        models.Module.company_id == current_user.company_id,
        models.Module.is_active == True
    ).all()
    
    # Obtenemos el perfil del usuario para chequear sus permisos
    profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
    user_perms = profile.permissions.get("modules", {}) if profile and profile.permissions else {}
    
    catalogs = []
    for m in modules:
        config = m.mobile_config or {}
        
        # 1. Verificamos si el módulo está marcado como B2C (ONLINE)
        if config.get("is_published") == True:
            
            # 2. Verificamos si el usuario tiene permiso en la matriz de AegisFlow
            mod_perms = user_perms.get(str(m.id), {})
            
            # Soportamos la llave 'publish' (externos) o 'create' (internos/staff)
            if mod_perms.get("publish") == True or mod_perms.get("create") == True or current_user.is_superadmin:
                catalogs.append({
                    "id": m.id,
                    "name": m.name,
                    "icon": m.icon,
                    "description": m.description or f"Publicar en {m.name}",
                    "cover_image": config.get("cover_image", "") # 🔥 Agregamos la imagen de portada
                })
                
    return catalogs
# ==========================================
# 🔥 2. OBTENER DATOS PERMITIDOS (CATÁLOGO / OFERTAS) 🔥
# ==========================================
@router.get("/data/{module_id}", response_model=List[MobileCaseResponse])
def get_mobile_data(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    La App Móvil llama a esto para ver sus Ofertas, Contratos, etc.
    Aplica inteligencia para saber si es un Catálogo Público B2C o datos privados.
    """
    module = db.query(models.Module).filter(
        models.Module.id == module_id,
        models.Module.company_id == current_user.company_id
    ).first()

    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado.")

    is_published_catalog = module.mobile_config and module.mobile_config.get("is_published", False)

    # ---------------------------------------------------------
    # CASO A: Es un Usuario de la App y está viendo la Vidriera B2C
    # ---------------------------------------------------------
    if current_user.is_external and is_published_catalog:
        # Buscamos el estado "Disponible" (asumiendo que es el inicial) para solo mostrar lo que se puede vender
        initial_status = db.query(models.Status).join(models.Blueprint).filter(
            models.Blueprint.module_id == module_id,
            models.Blueprint.company_id == current_user.company_id,
            models.Blueprint.is_active == True,
            models.Status.is_initial == True
        ).first()

        query = db.query(models.Case).filter(
            models.Case.company_id == current_user.company_id,
            models.Case.module_id == module_id,
            models.Case.deleted_at == None
        )
        
        # 🔥 FILTRO DINÁMICO: Si el módulo tiene un Blueprint, solo mostramos lo que está en estado Inicial ("Disponible")
        if initial_status:
            query = query.filter(models.Case.status_id == initial_status.id)
            
    # ---------------------------------------------------------
    # CASO B: Es un Empleado Interno, o es un módulo privado (Ej: Sus propios contratos)
    # ---------------------------------------------------------
    else:
        security_utils.check_module_permission(db, current_user, module_id, "view")
        profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first()
        mod_perms = profile.permissions.get("modules", {}).get(str(module_id)) if profile and profile.permissions else {}
        
        visible_user_ids = security_utils.get_visible_users(db, current_user, mod_perms)
        
        query = db.query(models.Case).filter(
            models.Case.company_id == current_user.company_id,
            models.Case.module_id == module_id,
            models.Case.deleted_at == None,
            (models.Case.created_by.in_(visible_user_ids)) | 
            (models.Case.assigned_to.in_(visible_user_ids))
        )

    cases = query.order_by(models.Case.id.desc()).all()

    # 3. Aplicar Field-Level Security y Anonimización B2B
    field_rules = security_utils.get_field_level_security(db, current_user, module_id)
    
    for c in cases:
        if field_rules:
            safe_data = {k: v for k, v in (c.data or {}).items() if field_rules.get(k) != "hidden"}
            
            # 🔥 ESCUDO DE ANONIMATO B2B: Si es el catálogo público y el usuario es externo
            if current_user.is_external and is_published_catalog:
                # Ocultamos la identidad real del vendedor reemplazando los campos típicos
                keys_to_anonymize = ['empresa', 'productor', 'vendedor', 'finca', 'nombre_empresa']
                for key in safe_data.keys():
                    if any(anon_key in key.lower() for anon_key in keys_to_anonymize):
                        safe_data[key] = "Vendido y Garantizado por GRAPP"

            make_transient(c)
            c.data = safe_data

    return cases


# ==========================================
# 🔥 3. CHECKOUT / COMPRA (EL PUENTE B2B) 🔥
# ==========================================
class MarketBuyRequest(BaseModel):
    offer_id: int              
    contract_module_id: int    
    contract_form_id: int      
    agreed_volume: float       
    agreed_price: float
    checkout_data: dict = {} # 🔥 NUEVO: Recibe los campos dinámicos     

@router.post("/market/buy", status_code=status.HTTP_201_CREATED)
def execute_market_buy(
    req: MarketBuyRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Endpoint para que la App B2C genere un contrato automáticamente.
    Al confirmar, la oferta original pasa a "Reservado" para ocultarse del catálogo.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Tu cuenta aún no está verificada para operar.")

    # 1. Buscar la Oferta original (Módulo A)
    offer = db.query(models.Case).filter(
        models.Case.id == req.offer_id,
        models.Case.company_id == current_user.company_id,
        models.Case.deleted_at == None
    ).first()
    
    if not offer:
        raise HTTPException(status_code=404, detail="La oferta ya no está disponible.")

    producer = db.query(models.User).filter(models.User.id == offer.created_by).first()

   # 2. Fabricar el Payload del Contrato (Módulo B)
    # 🔥 Leemos la configuración para forzar el módulo de destino
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    config = company.mobile_app_config or {}
    purchases_module_id = config.get("purchases_module_id")
    
    if not purchases_module_id:
        raise HTTPException(status_code=400, detail="El módulo de operaciones no está configurado en el sistema.")
        
    purchases_form = db.query(models.Form).filter(models.Form.module_id == purchases_module_id, models.Form.is_active == True).first()
    if not purchases_form:
        raise HTTPException(status_code=400, detail="El módulo de operaciones no tiene un formulario activo.")

    # 🔥 Leemos la configuración para saber adónde mapear los datos
    volume_field = config.get("purchases_volume_field") or "volumen_acordado"
    price_field = config.get("purchases_price_field") or "precio_acordado"

    contract_data = {
        "oferta_origen_id": str(offer.id),
        "vendedor_id": str(producer.id) if producer else None,
        "comprador_id": str(current_user.id),
        volume_field: req.agreed_volume,  # 🔥 Usa el campo dinámico
        price_field: req.agreed_price,    # 🔥 Usa el campo dinámico
        "producto_origen": offer.data.get("nombre_del_producto") or offer.data.get("producto") or offer.data.get("nombre") or f"Oferta #{offer.id}"
    }

    # Fusionamos los datos del formulario extra con el contrato
    if req.checkout_data:
        contract_data.update(req.checkout_data)

    initial_status_contract = db.query(models.Status).join(models.Blueprint).filter(
        models.Blueprint.module_id == purchases_module_id,
        models.Blueprint.company_id == current_user.company_id,
        models.Blueprint.is_active == True,
        models.Status.is_initial == True
    ).first()

    # 3. Crear el Caso Operativo en el Módulo Configurado Centralmente
    new_contract = models.Case(
        company_id=current_user.company_id,
        created_by=current_user.id,
        module_id=purchases_module_id,
        status_id=initial_status_contract.id if initial_status_contract else None,
        form_id=purchases_form.id,
        data=contract_data,
        ui_rules={}
    )
    
    db.add(new_contract)
    db.flush()

    # 4. 🔥 FRACCIONAMIENTO Y CONTROL DE STOCK 🔥
    # Buscamos si el administrador configuró un campo de "Stock" para este catálogo
    offer_module = db.query(models.Module).filter(models.Module.id == offer.module_id).first()
    stock_field = offer_module.mobile_config.get("mapping", {}).get("stock") if offer_module and offer_module.mobile_config else None
    
    is_sold_out = True # Por defecto asumimos que se vende todo de un golpe

    if stock_field and stock_field in offer.data:
        # Lógica de compra colaborativa/fraccionada
        try:
            current_stock = float(offer.data[stock_field])
            
            # 🔥 MAGIA: GUARDAMOS EL STOCK INICIAL ANTES DE LA PRIMERA VENTA 🔥
            initial_stock_key = f"{stock_field}_inicial"
            if initial_stock_key not in offer.data:
                offer.data[initial_stock_key] = current_stock
                
            new_stock = current_stock - req.agreed_volume
            
            if new_stock < 0:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente. Solo quedan {current_stock} disponibles.")
                
            # Actualizamos el stock en el JSON
            offer.data[stock_field] = new_stock
            flag_modified(offer, "data")
            
            # Si aún queda stock, no la ocultamos
            if new_stock > 0:
                is_sold_out = False
        except ValueError:
            pass # Si el dato no era número, sigue el flujo normal

    # Solo ocultamos/reservamos la oferta si se agotó el stock (o si no había control de stock)
    if is_sold_out:
        blueprint_offer = db.query(models.Blueprint).filter(
            models.Blueprint.module_id == offer.module_id,
            models.Blueprint.company_id == current_user.company_id,
            models.Blueprint.is_active == True
        ).first()

        if blueprint_offer:
            offer_statuses = db.query(models.Status).filter(models.Status.blueprint_id == blueprint_offer.id).order_by(models.Status.id.asc()).all()
            if len(offer_statuses) > 1:
                offer.status_id = offer_statuses[1].id
            else:
                offer.deleted_at = datetime.now()
        else:
            offer.deleted_at = datetime.now()

    # 5. Ejecutar reglas y guardar
    from app.api.v1.endpoints.cases import process_global_rules
    process_global_rules(db, new_contract, current_user.id, "ON_CREATE", background_tasks=background_tasks)
    
    db.commit()

    # 6. Auditoría para el Backoffice
    from app.core.global_audit import log_global_event
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="MARKETPLACE", action="BUY_INTENT", entity_id=new_contract.id,
        details=f"Comprador #{current_user.id} reservó {req.agreed_volume} tons de la oferta #{offer.id}",
        request=request
    )

    return {
        "message": "¡Intención de compra registrada con éxito!", 
        "contract_id": new_contract.id
    }
    
# ==========================================
# 🔥 3.5 CUBRIR DEMANDA (FLUJO INVERSO) 🔥
# ==========================================
class MarketFulfillRequest(BaseModel):
    demand_id: int              
    contract_module_id: int    
    contract_form_id: int      
    agreed_volume: float       
    agreed_price: float
    checkout_data: dict = {}

@router.post("/market/fulfill", status_code=status.HTTP_201_CREATED)
def execute_market_fulfill(
    req: MarketFulfillRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Endpoint para que un VENDEDOR cubra la necesidad de un COMPRADOR.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Tu cuenta aún no está verificada para operar.")

    # 1. Buscar la Demanda original
    demand = db.query(models.Case).filter(
        models.Case.id == req.demand_id,
        models.Case.company_id == current_user.company_id,
        models.Case.deleted_at == None
    ).first()
    
    if not demand:
        raise HTTPException(status_code=404, detail="La solicitud ya no está disponible.")

    buyer = db.query(models.User).filter(models.User.id == demand.created_by).first()

    # 2. Fabricar el Payload del Contrato de Cobertura
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    config = company.mobile_app_config or {}
    
    fulfillment_module_id = config.get("fulfillment_module_id")
    if not fulfillment_module_id:
        raise HTTPException(status_code=400, detail="El módulo de coberturas no está configurado.")
        
    fulfill_form = db.query(models.Form).filter(models.Form.module_id == fulfillment_module_id, models.Form.is_active == True).first()
    
    volume_field = config.get("fulfillment_volume_field") or "volumen_acordado"
    price_field = config.get("fulfillment_price_field") or "precio_acordado"

    # En este caso, el creador es el VENDEDOR, y el destino es el COMPRADOR
    contract_data = {
        "demanda_origen_id": str(demand.id),
        "vendedor_id": str(current_user.id),
        "comprador_id": str(buyer.id) if buyer else None,
        volume_field: req.agreed_volume,  
        price_field: req.agreed_price,    
        "producto_origen": demand.data.get("nombre_del_producto") or demand.data.get("producto") or f"Demanda #{demand.id}"
    }

    if req.checkout_data:
        contract_data.update(req.checkout_data)

    initial_status = db.query(models.Status).join(models.Blueprint).filter(
        models.Blueprint.module_id == fulfillment_module_id,
        models.Blueprint.company_id == current_user.company_id,
        models.Status.is_initial == True
    ).first()

    new_contract = models.Case(
        company_id=current_user.company_id,
        created_by=current_user.id,
        module_id=fulfillment_module_id,
        status_id=initial_status.id if initial_status else None,
        form_id=fulfill_form.id if fulfill_form else 0,
        data=contract_data,
        ui_rules={}
    )
    
    db.add(new_contract)
    db.flush()

    # 3. Lógica de Fraccionamiento (Restar a lo que necesita el comprador)
    demand_module = db.query(models.Module).filter(models.Module.id == demand.module_id).first()
    stock_field = demand_module.mobile_config.get("mapping", {}).get("stock") if demand_module and demand_module.mobile_config else None
    
    is_fulfilled = True 

    if stock_field and stock_field in demand.data:
        try:
            current_need = float(demand.data[stock_field])
            
            # 🔥 MAGIA: GUARDAMOS EL STOCK INICIAL ANTES DE LA PRIMERA COBERTURA 🔥
            initial_stock_key = f"{stock_field}_inicial"
            if initial_stock_key not in demand.data:
                demand.data[initial_stock_key] = current_need
                
            new_need = current_need - req.agreed_volume
            if new_need < 0:
                raise HTTPException(status_code=400, detail=f"El comprador solo necesita {current_need} tons.")
                
            demand.data[stock_field] = new_need
            flag_modified(demand, "data")
            if new_need > 0:
                is_fulfilled = False
        except ValueError:
            pass

    # Si se cubrió el 100% de la necesidad, ocultamos la demanda
    if is_fulfilled:
        blueprint_demand = db.query(models.Blueprint).filter(
            models.Blueprint.module_id == demand.module_id,
            models.Blueprint.is_active == True
        ).first()

        if blueprint_demand:
            demand_statuses = db.query(models.Status).filter(models.Status.blueprint_id == blueprint_demand.id).order_by(models.Status.id.asc()).all()
            if len(demand_statuses) > 1:
                demand.status_id = demand_statuses[1].id
            else:
                demand.deleted_at = datetime.now()
        else:
            demand.deleted_at = datetime.now()

    db.commit()

    return {
        "message": "¡Oferta enviada! Has cubierto esta demanda.", 
        "contract_id": new_contract.id
    }
    
# ==========================================
# 🔥 4. ACTUALIZAR PERFIL DEL USUARIO 🔥
# ==========================================
class MobileProfileUpdate(BaseModel):
    profile_data: dict

@router.put("/users/me")
def update_mobile_profile(
    req: MobileProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Permite a la app móvil actualizar sus datos de perfil y nombre."""
    
    # 1. Recuperamos los datos actuales y los fusionamos con los nuevos
    current_data = dict(current_user.profile_data) if current_user.profile_data else {}
    current_data.update(req.profile_data)
    
    # 2. Actualizamos las columnas principales si vienen en el payload
    if "first_name" in req.profile_data:
        current_user.first_name = req.profile_data["first_name"]
    if "last_name" in req.profile_data:
        current_user.last_name = req.profile_data["last_name"]
        
    # 3. Guardamos el JSON dinámico completo
    current_user.profile_data = current_data
    
    db.commit()
    return {"message": "Perfil actualizado exitosamente"}

# ==========================================
# 🔥 5. CAMBIAR CONTRASEÑA DESDE LA APP 🔥
# ==========================================
class MobilePasswordUpdate(BaseModel):
    current_password: str
    new_password: str

@router.put("/users/me/password")
def update_mobile_password(
    req: MobilePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    from app.core.security import verify_password, get_password_hash
    
    # 1. Verificamos que el usuario sepa su contraseña actual
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
        
    # 2. Hasheamos (encriptamos) y guardamos la nueva contraseña
    current_user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    
    return {"message": "Contraseña actualizada exitosamente."}

# ==========================================
# 🔥 6. WISHLIST: AGREGAR O QUITAR FAVORITOS 🔥
# ==========================================
@router.post("/users/me/favorites/{case_id}")
def toggle_favorite(
    case_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    """Agrega o quita una oferta de la lista de deseos del usuario."""
    
    # 1. Traemos los favoritos y aseguramos que todos sean números enteros
    # (A veces la BD los guarda como strings ["1"] y Python se confunde)
    raw_favs = current_user.favorite_offers or []
    favs = [int(f) for f in raw_favs]
    
    case_id_int = int(case_id)
    
    # 2. Lógica de interruptor
    if case_id_int in favs:
        favs.remove(case_id_int)
        msg = "Eliminado de favoritos"
    else:
        favs.append(case_id_int)
        msg = "Agregado a favoritos"
        
    # 🔥 3. ACTUALIZACIÓN DIRECTA (A PRUEBA DE BALAS) 🔥
    # Saltamos el caché del ORM y forzamos a la base de datos a escribir el JSON
    db.query(models.User).filter(models.User.id == current_user.id).update(
        {"favorite_offers": favs},
        synchronize_session=False
    )
    db.commit()
    
    return {"message": msg, "is_favorite": case_id_int in favs}

@router.get("/users/me/favorites", response_model=List[MobileCaseResponse])
def get_favorites(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    """Devuelve la lista de ofertas favoritas del usuario con formato de catálogo."""
    favs = current_user.favorite_offers or []
    if not favs:
        return []
        
    cases = db.query(models.Case).filter(
        models.Case.company_id == current_user.company_id,
        models.Case.id.in_(favs),
        models.Case.deleted_at == None
    ).order_by(models.Case.id.desc()).all()
    
    # Aplicar FLS y Anonimato (Igual que en el catálogo público)
    from app.core import security_utils
    
    processed_cases = []
    for c in cases:
        field_rules = security_utils.get_field_level_security(db, current_user, c.module_id)
        safe_data = {k: v for k, v in (c.data or {}).items() if field_rules.get(k) != "hidden"}
        
        # Ocultamos la identidad real del vendedor
        keys_to_anonymize = ['empresa', 'productor', 'vendedor', 'finca', 'nombre_empresa']
        for key in safe_data.keys():
            if any(anon_key in key.lower() for anon_key in keys_to_anonymize):
                safe_data[key] = "Vendido y Garantizado por GRAPP"

        make_transient(c)
        c.data = safe_data
        processed_cases.append(c)

    return processed_cases

# ==========================================
# 🔥 7. CENTRO DE OPERACIONES (MIS ACTIVIDADES) 🔥
# ==========================================
@router.get("/users/me/activity", response_model=List[MobileCaseResponse])
def get_my_activity(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Busca todas las operaciones que me pertenecen:
    1. Las ofertas que YO publiqué.
    2. Los contratos/compras donde YO soy el comprador.
    3. Los contratos/ventas donde YO soy el productor.
    """
    all_cases = db.query(models.Case).filter(
        models.Case.company_id == current_user.company_id,
        models.Case.deleted_at == None
    ).all()

    my_cases = []
    user_id_str = str(current_user.id)
    
    for c in all_cases:
        c_data = c.data or {}
        # ¿Yo lo creé? (Mis publicaciones o mis intenciones de compra)
        if c.created_by == current_user.id:
            my_cases.append(c)
            continue
            
        # ¿Me involucra un contrato aunque no lo haya creado yo? 
        # (El comprador crea el contrato, pero el vendedor debe verlo)
        if c_data.get("vendedor_id") == user_id_str or c_data.get("comprador_id") == user_id_str:
            my_cases.append(c)
            continue

    # Ordenar los más recientes primero
    my_cases.sort(key=lambda x: x.id, reverse=True)
    
    # Aquí NO aplicamos el filtro de anonimato B2B, porque en "Mis Operaciones"
    # yo sí tengo derecho a ver los datos reales de mi negocio.
    from app.core import security_utils
    for c in my_cases:
        field_rules = security_utils.get_field_level_security(db, current_user, c.module_id)
        if field_rules:
            safe_data = {k: v for k, v in (c.data or {}).items() if field_rules.get(k) != "hidden"}
            make_transient(c)
            c.data = safe_data

    return my_cases

# ==========================================
# 🔥 8. CENTRO DE NOTIFICACIONES 🔥
# ==========================================
class MobileNotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime
    case_id: Optional[int]
    module_id: Optional[int]

@router.get("/users/me/notifications", response_model=List[MobileNotificationResponse])
def get_my_notifications(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    """Obtiene las últimas 50 notificaciones del usuario."""
    notifs = db.query(models.Notification).filter(
        models.Notification.company_id == current_user.company_id,
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).limit(50).all()
    
    return notifs

@router.put("/users/me/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    """Marca una notificación específica como leída."""
    notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if notif and not notif.is_read:
        notif.is_read = True
        db.commit()
        
    return {"message": "Marcada como leída"}

# ==========================================
# 🔥 9. CHAT CONTEXTUAL B2B (WEBSOCKETS & EXTERNAL MESSAGES) 🔥
# ==========================================
from fastapi import WebSocket, WebSocketDisconnect

class ChatConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, case_id: int):
        await websocket.accept()
        if case_id not in self.active_connections:
            self.active_connections[case_id] = []
        self.active_connections[case_id].append(websocket)

    def disconnect(self, websocket: WebSocket, case_id: int):
        if case_id in self.active_connections and websocket in self.active_connections[case_id]:
            self.active_connections[case_id].remove(websocket)
            if not self.active_connections[case_id]:
                del self.active_connections[case_id]

    async def broadcast(self, message: dict, case_id: int):
        if case_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[case_id]:
                try:
                    # 🔥 Intentamos enviar el mensaje
                    await connection.send_json(message)
                except Exception:
                    # 🔥 Si la conexión está muerta, la anotamos en lugar de crashear todo
                    dead_connections.append(connection)
            
            # Limpiamos los "fantasmas" de la memoria
            for dead in dead_connections:
                self.disconnect(dead, case_id)

chat_manager = ChatConnectionManager()

class ExternalMessageResponse(BaseModel):
    id: int
    case_id: int
    user_id: Optional[int]
    sender_name: str
    content: str
    is_from_client: bool
    created_at: datetime

@router.get("/cases/{case_id}/chat", response_model=List[ExternalMessageResponse])
def get_external_chat_history(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Devuelve el historial del chat B2B con el cliente externo."""
    
    # 🔥 Leemos de la tabla NUEVA, 100% aislada de los comentarios internos
    messages = db.query(models.CaseExternalMessage).filter(
        models.CaseExternalMessage.case_id == case_id
    ).order_by(models.CaseExternalMessage.created_at.asc()).all()
    
    response = []
    for m in messages:
        sender_name = "GRAPP Soporte" if not m.is_from_client else "Usuario"
        if m.user_id:
            user = db.query(models.User).filter(models.User.id == m.user_id).first()
            if user:
                sender_name = f"{user.first_name} {user.last_name}".strip()
                    
        response.append({
            "id": m.id,
            "case_id": m.case_id,
            "user_id": m.user_id,
            "sender_name": sender_name,
            "content": m.content,
            "is_from_client": m.is_from_client,
            "created_at": m.created_at
        })
        
    return response

@router.websocket("/ws/chat/{case_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket, 
    case_id: int, 
    user_id: int, 
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    sender_name = f"{user.first_name} {user.last_name}".strip() if user else "Usuario"

    await chat_manager.connect(websocket, case_id)
    
    try:
        while True:
            # 1. Recibimos JSON
            data_json = await websocket.receive_json()
            
            content = data_json.get("content", "")
            source = data_json.get("source", "unknown") 
            
            if not content: continue 

            is_client = source == 'client'

            # 2. Guardamos en BD
            new_msg = models.CaseExternalMessage(
                company_id=user.company_id if user else 1,
                case_id=case_id,
                user_id=user_id,
                content=content, 
                is_from_client=is_client
            )
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)
            
            # 3. Notificación Push a la App (Si el mensaje es del Staff)
            if not is_client:
                target_case = db.query(models.Case).filter(models.Case.id == case_id).first()
                if target_case and target_case.created_by:
                    short_msg = content[:50] + "..." if len(content) > 50 else content
                    notif = models.Notification(
                        company_id=target_case.company_id,
                        user_id=target_case.created_by,
                        case_id=case_id,
                        module_id=target_case.module_id,
                        title="NUEVO MENSAJE DE SOPORTE",
                        message=f"GRAPP: {short_msg}",
                        is_read=False
                    )
                    db.add(notif)
                    db.commit()
            
            # 4. Empaquetamos y Retransmitimos
            message_payload = {
                "id": new_msg.id,
                "case_id": case_id,
                "user_id": user_id,
                "sender_name": sender_name,
                "content": content,
                "is_from_client": is_client,
                "created_at": new_msg.created_at.isoformat()
            }
            
            await chat_manager.broadcast(message_payload, case_id)
            
    except WebSocketDisconnect:
        chat_manager.disconnect(websocket, case_id)
    except Exception as e:
        # 🔥 FUNDAMENTAL: Capturamos cualquier error raro para que el servidor no explote
        print(f"Error WS: {e}")
        chat_manager.disconnect(websocket, case_id)
        
# ==========================================
# 🔥 10. LÍNEA DE TIEMPO B2C INTELIGENTE (STATUS TRACKING) 🔥
# ==========================================
@router.get("/cases/{case_id}/timeline")
def get_case_timeline(
    case_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Devuelve una línea de tiempo REAL basada en la auditoría de la operación:
    1. Estados por los que ya pasó (Historial).
    2. Estado actual.
    3. Próximos pasos inmediatos (Basado en transiciones).
    """
    case_record = db.query(models.Case).filter(
        models.Case.id == case_id,
        models.Case.company_id == current_user.company_id
    ).first()
    
    if not case_record:
        raise HTTPException(status_code=404, detail="Operación no encontrada.")

    # Diccionario rápido para buscar los nombres reales de los estados
    all_statuses = {s.id: s.name for s in db.query(models.Status).filter(models.Status.company_id == current_user.company_id).all()}

    timeline = []
    visited_status_ids = set()

    # ----------------------------------------------------
    # 🔙 1. EL PASADO (Basado en el historial de auditoría)
    # ----------------------------------------------------
    logs = db.query(models.AuditLog).filter(
        models.AuditLog.case_id == case_id,
        models.AuditLog.action.in_(["CREATE_CASE", "UPDATE_STATUS"])
    ).order_by(models.AuditLog.created_at.asc()).all()

    for log in logs:
        # Extraemos el status_id del JSON que guardamos en la auditoría
        if log.new_value and isinstance(log.new_value, dict):
            st_id = log.new_value.get("status_id")
            
            # Lo agregamos solo si existe, si no está repetido y si NO es el estado actual
            if st_id and st_id not in visited_status_ids and st_id != case_record.status_id:
                timeline.append({
                    "id": st_id,
                    "name": all_statuses.get(st_id, "Completado"),
                    "is_completed": True,
                    "is_current": False,
                    "description": "Paso completado."
                })
                visited_status_ids.add(st_id)

    # ----------------------------------------------------
    # 📍 2. EL PRESENTE (Estado actual)
    # ----------------------------------------------------
    if case_record.status_id:
        current_status_name = all_statuses.get(case_record.status_id, "Sin Estado")
        timeline.append({
            "id": case_record.status_id,
            "name": current_status_name,
            "is_completed": False,
            "is_current": True,
            "description": "Estado actual de la operación."
        })
        visited_status_ids.add(case_record.status_id)

    # ----------------------------------------------------
    # 🔜 3. EL FUTURO (Próximos pasos posibles)
    # ----------------------------------------------------
    future_transitions = db.query(models.Transition).filter(
        models.Transition.from_status_id == case_record.status_id
    ).all()

    for t in future_transitions:
        # Mostramos el próximo paso solo si no es un paso por el que ya retrocedió
        if t.to_status_id not in visited_status_ids:
            timeline.append({
                "id": t.to_status_id,
                "name": all_statuses.get(t.to_status_id, "Paso Futuro"),
                "is_completed": False,
                "is_current": False,
                "description": "Paso pendiente."
            })
            # Lo añadimos al set por si hay múltiples caminos que llevan al mismo lugar
            visited_status_ids.add(t.to_status_id)

    return timeline