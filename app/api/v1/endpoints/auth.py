from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import models
from app.core import security, initial_data 
from app.schemas import user as user_schema
from app.api import deps 
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel 
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import ipaddress 
from jose import jwt 
from app.core.config import settings 
from slowapi import Limiter
from slowapi.util import get_remote_address
import pyotp 
from app.core.global_audit import log_global_event
import requests
from geopy.distance import geodesic
from sqlalchemy import desc
from fastapi import BackgroundTasks # <-- IMPORTANTE
from app.core.emails import send_security_alert_async # <-- NUESTRO NUEVO MOTOR
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from fastapi.responses import RedirectResponse
import os


router = APIRouter()
router = APIRouter()
limiter = Limiter(key_func=get_remote_address) # 🔥 Instancia local para el router

class UserListResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_id: Optional[int] = None
    profile_id: Optional[int] = None
    is_superadmin: bool = False 
    is_active: bool = True 
    is_mfa_enabled: bool = False
    class Config:
        from_attributes = True

class UserUpdateMe(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str
    
# =========================================================
#  CONFIGURACIÓN OAUTH2 (CLIENTES SSO) 
# =========================================================
# Obtenemos las credenciales. Si no existen (ej. en desarrollo), 
# se inicializa con dummy para no romper el backend al arrancar.
starlette_config = Config(environ={
    "GOOGLE_CLIENT_ID": os.environ.get("GOOGLE_CLIENT_ID", "dummy_id"),
    "GOOGLE_CLIENT_SECRET": os.environ.get("GOOGLE_CLIENT_SECRET", "dummy_secret"),
    "MICROSOFT_CLIENT_ID": os.environ.get("MICROSOFT_CLIENT_ID", "dummy_id"),
    "MICROSOFT_CLIENT_SECRET": os.environ.get("MICROSOFT_CLIENT_SECRET", "dummy_secret")
})

oauth = OAuth(starlette_config)
oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile',
        'verify': False  # FIX PENTEST: Ignorar el proxy corporativo/VPN local
    }
)

# 2.  Registro de Microsoft 365 
oauth.register(
    name='microsoft',
    server_metadata_url='https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile', 
        'verify': False # Mantenemos el bypass del proxy corporativo para pruebas
    }
)

# =========================================================
# 🔥 CEREBRO DE POLÍTICAS GRANULARES (CASCADE EVALUATION)
# =========================================================
def get_user_policy(db: Session, user: models.User):
    if user.role_id:
        role_policy = db.query(models.SecurityPolicy).filter(
            models.SecurityPolicy.company_id == user.company_id,
            models.SecurityPolicy.role_id == user.role_id
        ).first()
        if role_policy: return role_policy
    
    if user.profile_id:
        profile_policy = db.query(models.SecurityPolicy).filter(
            models.SecurityPolicy.company_id == user.company_id,
            models.SecurityPolicy.profile_id == user.profile_id
        ).first()
        if profile_policy: return profile_policy
        
    global_policy = db.query(models.SecurityPolicy).filter(
        models.SecurityPolicy.company_id == user.company_id,
        models.SecurityPolicy.role_id == None,
        models.SecurityPolicy.profile_id == None
    ).first()
    
    return global_policy

# =========================================================
# 🔥 RADAR DE VIAJE IMPOSIBLE (GEOLOCALIZACIÓN) 🔥
# =========================================================
def get_ip_location(ip: str):
    """Obtiene la latitud y longitud de una IP pública."""
    if ip in ["127.0.0.1", "::1", "localhost", "0.0.0.0"]:
        return None 
    try:
        # Usamos una API pública gratuita para el MVP
        res = requests.get(f"http://ip-api.com/json/{ip}", timeout=3)
        data = res.json()
        if data.get("status") == "success":
            return (data["lat"], data["lon"])
    except:
        pass
    return None

def check_impossible_travel(db: Session, user: models.User, current_ip: str) -> bool:
    """Calcula si es físicamente posible viajar entre el último login y el actual."""
    if current_ip in ["127.0.0.1", "::1", "localhost", "0.0.0.0"]: 
        return False
        
    # 1. Buscar el último login exitoso con una IP diferente
    last_log = db.query(models.GlobalAuditLog).filter(
        models.GlobalAuditLog.user_id == user.id,
        models.GlobalAuditLog.action == "LOGIN_SUCCESS",
        models.GlobalAuditLog.ip_address != current_ip,
        models.GlobalAuditLog.ip_address != "127.0.0.1"
    ).order_by(desc(models.GlobalAuditLog.created_at)).first()

    if not last_log or not last_log.ip_address: 
        return False

    # 2. Calcular el tiempo transcurrido en horas
    now = datetime.now(timezone.utc)
    last_time = last_log.created_at
    if last_time.tzinfo is None: 
        last_time = last_time.replace(tzinfo=timezone.utc)
        
    time_diff_hours = (now - last_time).total_seconds() / 3600.0
    
    # Si han pasado más de 24 horas, ya es posible llegar a casi cualquier parte del mundo
    if time_diff_hours > 24 or time_diff_hours <= 0: 
        return False

    # 3. Obtener coordenadas
    loc_current = get_ip_location(current_ip)
    loc_last = get_ip_location(last_log.ip_address)

    if loc_current and loc_last:
        # 4. Calcular distancia y velocidad
        distance_km = geodesic(loc_last, loc_current).kilometers
        speed_kmh = distance_km / time_diff_hours
        
        # Si la velocidad necesaria supera los 1000 km/h (Vuelo comercial) -> ES UN HACKER 🚨
        if speed_kmh > 1000:
            return True
            
    return False

@router.post("/signup", response_model=user_schema.Token)
def signup(obj_in: user_schema.UserCreate, request: Request, db: Session = Depends(get_db)):
    user_exists = db.query(models.User).filter(models.User.email == obj_in.email).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    new_company = models.Company(name=obj_in.company_name)
    db.add(new_company)
    db.commit()
    db.refresh(new_company)

    initial_data.setup_basic_workflow(db, new_company.id)
    
    new_policy = models.SecurityPolicy(company_id=new_company.id, name="Política Global")
    db.add(new_policy)

    new_user = models.User(
        email=obj_in.email,
        hashed_password=security.get_password_hash(obj_in.password),
        company_id=new_company.id,
        is_superadmin=True,
        first_name="Admin",
        session_version=1,
        failed_login_attempts=0,
        temp_lockouts_count=0,
        password_changed_at=datetime.now(timezone.utc),
        is_mfa_enabled=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_global_event(
        db=db, user_id=new_user.id, company_id=new_company.id,
        entity_type="SYSTEM", action="TENANT_CREATED", entity_id=new_company.id,
        details=f"Nueva empresa '{new_company.name}' registrada", request=request
    )

    token_data = security.create_access_token(subject=new_user.email, session_version=new_user.session_version)
    return {"access_token": token_data["access_token"], "token_type": "bearer"}


@router.post("/login", response_model=user_schema.Token)
@limiter.limit("10/minute") # 🔥 ESCUDO ACTIVO: Máximo 10 intentos por minuto por IP 🔥
async def login(
    request: Request, 
    background_tasks: BackgroundTasks, # 🔥 NUEVO: Recibe tareas en segundo plano
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
    ):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    # 🔥 FIX FASE 6: Validación Extra
    # Si el usuario no existe, o si existe pero NO tiene contraseña (porque vino de Google)
    # bloqueamos el login tradicional para obligarlo a usar el botón de Google.
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Email o contraseña incorrectos. Si creaste tu cuenta con Google/Microsoft, utiliza los botones correspondientes.", 
            headers={"WWW-Authenticate": "Bearer"}
        )

    policy = get_user_policy(db, user)
    now = datetime.now(timezone.utc)

    # 1. LISTA BLANCA DE IPs
    if policy and policy.ip_whitelist_active and policy.allowed_ips:
        client_ip = request.client.host
        is_allowed = False
        for allowed_ip in policy.allowed_ips:
            try:
                if ipaddress.ip_address(client_ip) in ipaddress.ip_network(allowed_ip, strict=False):
                    is_allowed = True
                    break
            except ValueError: continue 
                
        if not is_allowed:
            raise HTTPException(status_code=403, detail="Acceso denegado. Tu red actual no está autorizada.")

    # 2. BLOQUEO PERMANENTE Y TEMPORAL
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tu cuenta está inactiva o bloqueada permanentemente.")
    if user.locked_until and user.locked_until.replace(tzinfo=timezone.utc) > now:
        mins = int((user.locked_until.replace(tzinfo=timezone.utc) - now).total_seconds() / 60) + 1
        raise HTTPException(status_code=403, detail=f"Cuenta bloqueada temporalmente. Intenta en {mins} minutos.")

    # 3. VERIFICACIÓN DE CONTRASEÑA Y FUERZA BRUTA
    if not security.verify_password(form_data.password, user.hashed_password):
        if policy:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= policy.max_login_attempts:
                user.temp_lockouts_count = (user.temp_lockouts_count or 0) + 1
                user.failed_login_attempts = 0 
                
                # Definir tipo de castigo
                if user.temp_lockouts_count >= policy.max_temp_lockouts:
                    user.is_active = False
                    user.locked_until = None
                    bloqueo_tipo = "Permanente"
                    mensaje_bloqueo = "Tu cuenta ha sido bloqueada indefinidamente por superar el límite máximo de bloqueos temporales permitidos."
                else:
                    user.locked_until = now + timedelta(minutes=policy.temp_lockout_minutes)
                    bloqueo_tipo = f"Temporal ({policy.temp_lockout_minutes} min)"
                    mensaje_bloqueo = f"Tu cuenta ha sido bloqueada por {policy.temp_lockout_minutes} minutos debido a múltiples intentos fallidos de contraseña."
                
                # 🔥 DISPARAR CORREO DE FUERZA BRUTA EN SEGUNDO PLANO 🔥
                html_brute_force = f"""
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #f59e0b; padding: 20px; text-align: center; color: white;">
                        <h2 style="margin: 0;">⚠️ Alerta de Seguridad: Múltiples Intentos Fallidos</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Hola <b>{user.first_name or 'Usuario'}</b>,</p>
                        <p>Hemos detectado múltiples intentos fallidos de inicio de sesión en tu cuenta desde la IP <b>{request.client.host}</b>.</p>
                        <p>Como medida de protección, hemos aplicado un bloqueo preventivo:</p>
                        <ul>
                            <li><b>Tipo de Bloqueo:</b> {bloqueo_tipo}</li>
                            <li><b>Motivo:</b> Superado el límite de intentos de contraseña.</li>
                        </ul>
                        <p>{mensaje_bloqueo}</p>
                        <p>Si no fuiste tú quien intentó acceder, te recomendamos cambiar tu contraseña inmediatamente cuando recuperes el acceso.</p>
                    </div>
                </div>
                """
                background_tasks.add_task(
                    send_security_alert_async, 
                    db, user.company_id, user.email, f"⚠️ BLOQUEO {bloqueo_tipo.upper()}: Intentos fallidos", html_brute_force
                )

            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos", headers={"WWW-Authenticate": "Bearer"})

    # 4. EXPIRACIÓN DE CONTRASEÑA
    if policy and policy.password_expiration_active and user.password_changed_at:
        days = (now - user.password_changed_at.replace(tzinfo=timezone.utc)).days
        if days >= policy.password_expiration_days:
            raise HTTPException(status_code=403, detail="Tu contraseña ha expirado. Contacta al administrador.")
        
        
    # 🚨 DETECCIÓN DE VIAJE IMPOSIBLE (GEORADAR) 🚨
    client_ip = request.client.host
    if check_impossible_travel(db, user, client_ip):
        user.is_active = False
        user.session_version += 1 
        db.commit()
        
        log_global_event(
            db=db, user_id=user.id, company_id=user.company_id, 
            entity_type="SECURITY", action="IMPOSSIBLE_TRAVEL_DETECTED", entity_id=user.id, 
            details=f"Cuenta bloqueada preventivamente: Inicio de sesión físicamente imposible detectado desde la IP {client_ip}.", 
            request=request
        )

        # 🔥 NUEVO: DISPARAR CORREO EN SEGUNDO PLANO 🔥
        html_content = f"""
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #ef4444; padding: 20px; text-align: center; color: white;">
                <h2 style="margin: 0;">🚨 Alerta Crítica de Seguridad</h2>
            </div>
            <div style="padding: 20px;">
                <p>Hola <b>{user.first_name or 'Usuario'}</b>,</p>
                <p>Hemos detectado un intento de inicio de sesión que resulta <b>físicamente imposible</b> debido a la distancia y el tiempo transcurrido desde tu última conexión.</p>
                <p><b>📍 Nueva IP Detectada:</b> {client_ip}</p>
                <p style="color: #ef4444; font-weight: bold;">Por precaución, hemos bloqueado temporalmente tu cuenta y cerrado todas tus sesiones activas.</p>
                <p>Si consideras que esto es un error o estabas usando una VPN, por favor contacta inmediatamente al administrador de sistemas de tu empresa.</p>
            </div>
        </div>
        """
        background_tasks.add_task(
            send_security_alert_async, 
            db, user.company_id, user.email, "🚨 BLOQUEO DE CUENTA: Actividad Inusual Detectada", html_content
        )

        raise HTTPException(
            status_code=403, 
            detail="Actividad inusual detectada. Tu cuenta ha sido bloqueada preventivamente por seguridad. Contacta al administrador."
        )
        
    # 🛡️ VERIFICACIÓN MULTIFACTOR (MFA)
    raw_form = await request.form()
    mfa_code = raw_form.get("mfa_code")
    setup_token_requested = raw_form.get("request_mfa_setup_token") == "true"
    
    if policy and policy.mfa_required and not user.is_mfa_enabled:
        if setup_token_requested:
            token_data = security.create_access_token(subject=user.email, session_version=user.session_version)
            log_global_event(db=db, user_id=user.id, company_id=user.company_id, entity_type="AUTH", action="MFA_SETUP_TOKEN_ISSUED", entity_id=user.id, details="Emitido token provisional para configuración de MFA", request=request)
            return {"access_token": token_data["access_token"], "token_type": "bearer"}
        raise HTTPException(status_code=403, detail="MFA_SETUP_REQUIRED")
        
    if user.is_mfa_enabled:
        if not mfa_code:
            raise HTTPException(status_code=401, detail="MFA_REQUIRED")
            
        totp = pyotp.TOTP(user.mfa_secret)
        if not totp.verify(mfa_code):
            log_global_event(db=db, user_id=user.id, company_id=user.company_id, entity_type="SECURITY", action="MFA_FAILED", entity_id=user.id, details="Código MFA incorrecto", request=request)
            raise HTTPException(status_code=401, detail="Código de seguridad incorrecto.")
        
    # 5. SESIONES CONCURRENTES
    if policy:
        db.query(models.ActiveSession).filter(models.ActiveSession.expires_at <= now).delete()
        db.commit()
        active_count = db.query(models.ActiveSession).filter(models.ActiveSession.user_id == user.id).count()
        max_sessions = policy.max_concurrent_sessions if policy.max_concurrent_sessions is not None else 3
        if active_count >= max_sessions:
            raise HTTPException(status_code=403, detail=f"Has alcanzado el límite de {max_sessions} dispositivos conectados simultáneamente.")

    user.failed_login_attempts = 0
    user.temp_lockouts_count = 0
    user.locked_until = None
    db.commit()

    log_global_event(db=db, user_id=user.id, company_id=user.company_id, entity_type="AUTH", action="LOGIN_SUCCESS", entity_id=user.id, details="Inicio de sesión exitoso", request=request)
    
    token_data = security.create_access_token(subject=user.email, session_version=user.session_version)
    
    new_session = models.ActiveSession(
        company_id=user.company_id, user_id=user.id, token_jti=token_data["jti"],
        ip_address=request.client.host, user_agent=request.headers.get("user-agent", "Desconocido"),
        expires_at=token_data["expire"]
    )
    db.add(new_session)
    db.commit()

    return {"access_token": token_data["access_token"], "token_type": "bearer"}

# =========================================================
# 🔥 RUTAS DE SINGLE SIGN-ON (SSO) FASE 6 🔥
# =========================================================

@router.get("/sso/{provider}/login")
async def sso_login(provider: str, request: Request):
    """Paso 1: Redirige al usuario a la pantalla de Google/Microsoft."""
    if provider not in ["google", "microsoft"]: # Más adelante podemos agregar 'microsoft'
        raise HTTPException(status_code=400, detail="Proveedor de identidad no soportado.")
    
    redirect_uri = request.url_for('sso_callback', provider=provider)
    
    # En producción (si no es localhost), la URL de callback DEBE ser HTTPS por seguridad
    if "localhost" not in str(redirect_uri) and "127.0.0.1" not in str(redirect_uri):
        redirect_uri = str(redirect_uri).replace("http://", "https://")
        
    client = oauth.create_client(provider)
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/sso/{provider}/callback")
async def sso_callback(provider: str, request: Request, db: Session = Depends(get_db)):
    """Paso 2: Google/Microsoft nos devuelve al usuario con su Token de Identidad."""
    # Encontramos la URL del frontend (React) para poder devolver al usuario allá
    frontend_url = getattr(settings, "CORS_ORIGINS", "http://localhost:5173").split(',')[0].strip()
    client = oauth.create_client(provider)
    
    try:
        # Intercambiamos el código por un Token Real
        token = await client.authorize_access_token(request)
    except Exception as e:
        # El usuario canceló o hubo error en Google
        return RedirectResponse(url=f"{frontend_url}/login?error=sso_failed")
        
    user_info = token.get('userinfo')
    
    # 🔥 FIX MICROSOFT: A veces MS usa 'preferred_username' en lugar de 'email'
    email = None
    if user_info:
        email = user_info.get("email") or user_info.get("preferred_username")
        
    if not email:
        return RedirectResponse(url=f"{frontend_url}/login?error=sso_no_email")
    
    # Búsqueda en nuestra Base de Datos local
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        # 🛡️ SEGURIDAD B2B: No permitimos que CUALQUIER persona con un Gmail se registre automáticamente.
        # El Administrador de la empresa DEBE haber creado el correo en AegisFlow primero.
        return RedirectResponse(url=f"{frontend_url}/login?error=sso_user_not_found")
        
    if not user.is_active:
        return RedirectResponse(url=f"{frontend_url}/login?error=account_disabled")

    # Actualizar "Sello de Identidad" para reportes de auditoría
    if getattr(user, 'auth_provider', 'local') != provider:
        user.auth_provider = provider
        db.commit()

    company = db.query(models.Company).filter(models.Company.id == user.company_id).first()
    policy = get_user_policy(db, user)
    
    # =======================================================
    # 🔥 LÓGICA DE DELEGACIÓN O IMPOSICIÓN DE MFA 🔥
    # =======================================================
    requires_mfa_step = False
    
    # 1. ¿El Administrador activó el Botón Rojo en AegisFlow?
    if company.sso_force_native_mfa:
        # Si el usuario tiene MFA configurado, se lo exigimos
        if user.is_mfa_enabled:
            requires_mfa_step = True
        # Si no lo ha configurado, pero la política se lo exige, lo frenamos
        elif policy and policy.mfa_required:
            requires_mfa_step = True
            
    # Limpiamos bloqueos previos (si logró entrar a Google, confiamos que es él)
    user.failed_login_attempts = 0
    user.temp_lockouts_count = 0
    user.locked_until = None
    db.commit()

    # Generamos el JWT de nuestra plataforma (AegisFlow)
    token_data = security.create_access_token(subject=user.email, session_version=user.session_version)
    
    # =======================================================
    # 🔥 REDIRECCIÓN DE VUELTA AL FRONTEND (REACT) 🔥
    # =======================================================
    if requires_mfa_step:
        # LO MANDAMOS AL FRONTEND PERO NO AL DASHBOARD. 
        # Lo enviamos a la pantalla de validación de MFA con un token provisional en la URL.
        log_global_event(db, user.id, user.company_id, "AUTH", "SSO_PARTIAL_LOGIN", user.id, f"SSO {provider} superado. Retenido por regla de MFA Nativo Forzado.", request)
        return RedirectResponse(url=f"{frontend_url}/login?sso_mfa_required=true&email={email}&temp_token={token_data['access_token']}")

    # LOGIN 100% EXITOSO Y DIRECTO
    log_global_event(db, user.id, user.company_id, "AUTH", "LOGIN_SUCCESS", user.id, f"Inicio de sesión exitoso vía SSO ({provider})", request)
    
    new_session = models.ActiveSession(
        company_id=user.company_id, user_id=user.id, token_jti=token_data["jti"],
        ip_address=request.client.host, user_agent=request.headers.get("user-agent", "Desconocido"),
        expires_at=token_data["expire"]
    )
    db.add(new_session)
    db.commit()

    # Lo enviamos al frontend. Crearemos la ruta /sso-success en React para que procese esto.
    return RedirectResponse(url=f"{frontend_url}/sso-success?token={token_data['access_token']}")

# =========================================================
# 🔥 RUTAS DE CONFIGURACIÓN DE MFA 🔥
# =========================================================
@router.post("/mfa/setup", response_model=user_schema.MfaSetupResponse)
def setup_mfa(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if db_user.is_mfa_enabled:
        raise HTTPException(status_code=400, detail="El sistema de doble factor ya está activado en tu cuenta.")

    secret = pyotp.random_base32()
    db_user.mfa_secret = secret
    db.commit()
    db.refresh(db_user)

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=db_user.email, issuer_name="AegisFlow")
    return {"secret": secret, "qr_code_url": uri}

@router.post("/mfa/verify")
def verify_mfa(request: Request, body: user_schema.MfaVerifyRequest, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not db_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Debes solicitar la configuración del QR primero.")

    totp = pyotp.TOTP(db_user.mfa_secret)
    if not totp.verify(body.code):
        raise HTTPException(status_code=400, detail="El código es incorrecto o ha expirado. Intenta de nuevo.")

    db_user.is_mfa_enabled = True
    db.commit()

    log_global_event(db=db, user_id=db_user.id, company_id=db_user.company_id, entity_type="SECURITY", action="MFA_ACTIVATED", entity_id=db_user.id, details="MFA activado exitosamente", request=request)
    return {"message": "Doble Factor de Autenticación (MFA) activado correctamente."}

# 🔥 LA RUTA QUE FALTABA: DESACTIVAR MFA VOLUNTARIAMENTE 🔥
@router.post("/mfa/disable")
def disable_mfa(request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    """Permite al usuario desactivar su MFA voluntariamente, si la política se lo permite."""
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    
    if not db_user.is_mfa_enabled:
        raise HTTPException(status_code=400, detail="El MFA no está activado en tu cuenta.")
        
    policy = get_user_policy(db, db_user)
    if policy and policy.mfa_required:
        raise HTTPException(status_code=403, detail="Por políticas de la empresa, el uso de MFA es obligatorio y no puedes desactivarlo.")
        
    db_user.mfa_secret = None
    db_user.is_mfa_enabled = False
    db.commit()
    
    log_global_event(db=db, user_id=db_user.id, company_id=db_user.company_id, entity_type="SECURITY", action="MFA_DISABLED", entity_id=db_user.id, details="El usuario desactivó voluntariamente su Doble Factor (MFA)", request=request)
    
    return {"message": "El Doble Factor de Autenticación ha sido desactivado."}

# =========================================================
# RUTAS RESTANTES (Logout, Get Users, Update Profile...)
# =========================================================
@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if payload.get("jti"):
                db.query(models.ActiveSession).filter(models.ActiveSession.token_jti == payload.get("jti")).delete()
                db.commit()
        except Exception: pass 
    return {"message": "Sesión cerrada y liberada exitosamente"}

@router.get("/users", response_model=List[UserListResponse])
def get_company_users(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    users = db.query(models.User).filter(models.User.company_id == current_user.company_id).all()
    
    # 🔥 FIX: Forzamos a que el MFA no sea NULL para usuarios antiguos 🔥
    for u in users:
        if u.is_mfa_enabled is None:
            u.is_mfa_enabled = False
            
    return users

@router.put("/users/me")
def update_user_me(user_in: UserUpdateMe, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if user_in.first_name is not None: db_user.first_name = user_in.first_name
    if user_in.last_name is not None: db_user.last_name = user_in.last_name
    db.commit()
    return {"message": "Perfil actualizado correctamente", "first_name": db_user.first_name, "last_name": db_user.last_name}

@router.put("/users/me/password")
def update_password_me(passwords_in: UserPasswordUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    db_user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not security.verify_password(passwords_in.current_password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
        
    policy = get_user_policy(db, db_user)

    complexity_errors = security.validate_password_complexity(passwords_in.new_password, policy)
    if complexity_errors:
        raise HTTPException(status_code=400, detail=" | ".join(complexity_errors))

    if policy and policy.password_history_active:
        historial_previo = db.query(models.PasswordHistory).filter(models.PasswordHistory.user_id == db_user.id).order_by(models.PasswordHistory.created_at.desc()).limit(policy.password_history_count).all()
        for clave_antigua in historial_previo:
            if security.verify_password(passwords_in.new_password, clave_antigua.hashed_password):
                raise HTTPException(status_code=400, detail=f"No puedes reutilizar tus últimas {policy.password_history_count} contraseñas.")

    nuevo_hash = security.get_password_hash(passwords_in.new_password)
    db_user.hashed_password = nuevo_hash
    db_user.session_version += 1 
    db_user.password_changed_at = datetime.now(timezone.utc)
    
    if policy and policy.password_history_active:
        db.add(models.PasswordHistory(company_id=db_user.company_id, user_id=db_user.id, hashed_password=nuevo_hash))
        
    db.query(models.ActiveSession).filter(models.ActiveSession.user_id == db_user.id).delete()
    db.commit()
    return {"message": "Contraseña actualizada exitosamente. Vuelve a iniciar sesión."}

@router.get("/session-config")
def get_session_config(db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    policy = get_user_policy(db, current_user)
    timeout = policy.inactivity_timeout_minutes if policy and policy.inactivity_timeout_minutes else 15
    return {"inactivity_timeout_minutes": timeout}