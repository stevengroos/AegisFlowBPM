from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_system_company = Column(Boolean, default=False) # True solo para AegisFlow HQ
    # =========================================================
    # 🔥 NUEVO: CONFIGURACIÓN MULTI-TENANT SMTP (MARCA BLANCA) 🔥
    # =========================================================
    use_custom_smtp = Column(Boolean, default=False) # ¿Usa su propio correo?
    smtp_host = Column(String, nullable=True)        # Ej: smtp.gmail.com o smtp.sendgrid.net
    smtp_port = Column(Integer, nullable=True)       # Ej: 587 (TLS) o 465 (SSL)
    smtp_user = Column(String, nullable=True)        # Ej: alertas@miempresa.com o apikey
    smtp_password = Column(String, nullable=True)    # Contraseña o App Password
    smtp_from_email = Column(String, nullable=True)  # Ej: no-reply@miempresa.com
    smtp_from_name = Column(String, nullable=True)   # Ej: Centro de Seguridad MiEmpresa
    
    sso_force_native_mfa = Column(Boolean, default=False) # ¿Exigir MFA de AegisFlow incluso con SSO?
    # =========================================================
    # 🔥 FASE 3: CONFIGURACIÓN DE IA MULTI-TENANT 🔥
    # =========================================================
    ai_active_provider = Column(String, nullable=True) # Ej: 'openai', 'anthropic', 'gemini'
    ai_api_key = Column(String, nullable=True)         # El API Key secreto de la empresa

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name = Column(String) 
    permissions = Column(JSON) 

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name = Column(String) 
    parent_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    rank = Column(Integer, default=1)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False) 
    # 🔥 FIX FASE 6: Ahora permite NULL porque los usuarios de SSO no tienen contraseña en nuestra BD
    hashed_password = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False)
    
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    session_version = Column(Integer, default=1)
    failed_login_attempts = Column(Integer, default=0) # Cuenta intentos fallidos
    temp_lockouts_count = Column(Integer, default=0) # Cuántas veces se ha bloqueado temporalmente
    locked_until = Column(DateTime(timezone=True), nullable=True) # Hasta cuándo dura el castigo temporal
    password_changed_at = Column(DateTime(timezone=True), server_default=func.now()) # Para calcular expiración
    mfa_secret = Column(String, nullable=True) # La llave secreta de Google Authenticator
    is_mfa_enabled = Column(Boolean, default=False) # ¿El usuario ya escaneó el QR?
    # =========================================================
    # 🔥 NUEVO: IDENTIDAD DE ORIGEN (FASE 6) 🔥
    # =========================================================
    auth_provider = Column(String, default="local") # Puede ser: "local", "google", "microsoft"

class ImportBatch(Base):
    __tablename__ = "import_batches"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL")) 
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE")) 
    
    filename = Column(String, nullable=False) 
    record_count = Column(Integer, default=0) 
    status = Column(String, default="COMPLETED") 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ModuleCategory(Base):
    __tablename__ = "module_categories"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name = Column(String, nullable=False)
    icon = Column(String, default="folder") 
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    modules = relationship("Module", back_populates="category")

class Module(Base):
    __tablename__ = "modules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    icon = Column(String, default="box") 
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    order = Column(Integer, default=0)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    # 🔥 NUEVA COLUMNA Y RELACIÓN PARA LAS CARPETAS 🔥
    category_id = Column(Integer, ForeignKey("module_categories.id", ondelete="SET NULL"), nullable=True)
    category = relationship("ModuleCategory", back_populates="modules")
    
    forms = relationship("Form", back_populates="module")
    blueprints = relationship("Blueprint", back_populates="module")
    cases = relationship("Case", back_populates="module")
    
    __table_args__ = (
        UniqueConstraint('company_id', 'name', name='uix_company_module_name'),
    )

class Form(Base):
    __tablename__ = "forms"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name = Column(String, nullable=False) 
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="SET NULL"), nullable=True) 
    module = relationship("Module", back_populates="forms")

class FormSection(Base):
    __tablename__ = "form_sections"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    
    title = Column(String, nullable=False) 
    order = Column(Integer, default=0) 
    columns = Column(Integer, default=1) 

class FormField(Base):
    __tablename__ = "form_fields"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), index=True, nullable=True)
    section_id = Column(Integer, ForeignKey("form_sections.id", ondelete="SET NULL"), nullable=True)
    label = Column(String, nullable=False) 
    api_name = Column(String, index=True, nullable=True)
    field_type = Column(String, nullable=False) 
    required = Column(Boolean, default=False)
    order = Column(Integer, default=0) 
    options = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    show_in_create = Column(Boolean, default=True)
    is_primary = Column(Boolean, default=False)
    subform_config = Column(JSON, nullable=True, default=[]) 
    

class Blueprint(Base):
    __tablename__ = "blueprints"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name = Column(String, nullable=False) 
    trigger_field = Column(String, nullable=True) 
    trigger_value = Column(String, nullable=True) 
    is_active = Column(Boolean, default=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=True)
    module = relationship("Module", back_populates="blueprints")
    # =========================================================
    # 🔥 FASE 1: VERSIONADO DE BLUEPRINTS 🔥
    # =========================================================
    version = Column(Integer, default=1) # Empieza en la V1
    is_draft = Column(Boolean, default=False) # Si es un borrador que aún no se publica
    parent_blueprint_id = Column(Integer, ForeignKey("blueprints.id", ondelete="SET NULL"), nullable=True) # Para saber de qué versión anterior viene

class Status(Base):
    __tablename__ = "statuses"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    # 🔥 FIX: Cascada para limpiar estados si se borra el Blueprint
    blueprint_id = Column(Integer, ForeignKey("blueprints.id", ondelete="CASCADE"), index=True, nullable=True) 
    
    name = Column(String, nullable=False) 
    is_initial = Column(Boolean, default=False) 
    sla_hours = Column(Integer, nullable=True) # Tiempo máximo permitido en horas (Null = Sin límite)
    bpmn_shape = Column(String, default="task") # Valores: 'start', 'task', 'gateway', 'end'
    position_x = Column(Integer, default=50)
    position_y = Column(Integer, default=50)
    
class Transition(Base):
    __tablename__ = "transitions"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    # 🔥 FIX: Cascada para limpiar transiciones si se borra el Blueprint
    blueprint_id = Column(Integer, ForeignKey("blueprints.id", ondelete="CASCADE"), index=True, nullable=True)
    
    name = Column(String) 
    from_status_id = Column(Integer, ForeignKey("statuses.id", ondelete="CASCADE"))
    to_status_id = Column(Integer, ForeignKey("statuses.id", ondelete="CASCADE"))
    actions = relationship("TransitionAction", backref="transition", cascade="all, delete-orphan")
    # 🔥 NUEVA LÍNEA 🔥
    validations = relationship("TransitionValidation", backref="transition", cascade="all, delete-orphan")

class Case(Base):
    __tablename__ = "cases"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    status_id = Column(Integer, ForeignKey("statuses.id", ondelete="SET NULL"), nullable=True)
    
    entered_status_at = Column(DateTime(timezone=True), server_default=func.now()) # Marca de tiempo exacta del último cambio de estado
    
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="SET NULL"), nullable=True)
    data = Column(JSON, nullable=False, default={})
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), index=True, nullable=True)
    module = relationship("Module", back_populates="cases")
    ui_rules = Column(JSON, nullable=True, default={})
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    import_batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    
    action = Column(String) 
    old_value = Column(JSON, nullable=True) 
    new_value = Column(JSON, nullable=True) 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class GlobalAuditLog(Base):
    __tablename__ = "global_audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True) 
    
    entity_type = Column(String, nullable=False, index=True) 
    entity_id = Column(Integer, nullable=True) 
    action = Column(String, nullable=False) 
    
    details = Column(String, nullable=True) 
    old_value = Column(JSON, nullable=True) 
    new_value = Column(JSON, nullable=True) 
    
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class TransitionAction(Base):
    __tablename__ = "transition_actions"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    transition_id = Column(Integer, ForeignKey("transitions.id", ondelete="CASCADE"), index=True)
    
    action_type = Column(String, nullable=False) 
    target_field = Column(String, nullable=True) 
    action_value = Column(String, nullable=True)
    function_code = Column(String, nullable=True)
    action_config = Column(JSON, nullable=True, default={})

class AutomationRule(Base):
    __tablename__ = "automation_rules"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), index=True)
    
    name = Column(String, nullable=False) 
    event_type = Column(String, nullable=False) 
    trigger_field = Column(String, nullable=True) 
    condition_field = Column(String, nullable=True)
    condition_operator = Column(String, nullable=True) 
    condition_value = Column(String, nullable=True)
    
    action_type = Column(String, nullable=False) 
    target_field = Column(String, nullable=True) 
    action_value = Column(String, nullable=True) 
    function_code = Column(String, nullable=True) 
    action_config = Column(JSON, nullable=True, default={})
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True) 
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), index=True, nullable=True) 
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=True) 
    
    title = Column(String, nullable=False) 
    message = Column(String, nullable=False) 
    
    is_read = Column(Boolean, default=False) 
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
class Dashboard(Base):
    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name = Column(String, nullable=False) 
    description = Column(String, nullable=True)
    icon = Column(String, default="bar-chart-2") 
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    reports = relationship("Report", back_populates="dashboard", cascade="all, delete-orphan")

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id", ondelete="CASCADE"), index=True)
    
    name = Column(String, nullable=False) 
    chart_type = Column(String, nullable=False) 
    function_code = Column(String, nullable=False) 
    config = Column(JSON, nullable=True, default={}) 
    grid_layout = Column(JSON, nullable=True, default={"w": 6, "h": 4, "x": 0, "y": 0})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    dashboard = relationship("Dashboard", back_populates="reports")
    
class RoundRobinTracker(Base):
    """
    Guarda el último usuario asignado dentro de un grupo (Rol o Perfil) 
    para poder asignar el siguiente caso al usuario que sigue en la lista.
    """
    __tablename__ = "round_robin_trackers"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    # Identificador del grupo (ej: "role_5" o "profile_2")
    group_type = Column(String, nullable=False) 
    group_id = Column(Integer, nullable=False)
    
    # El último usuario que recibió un caso de este grupo
    last_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    
    # Asegura que solo haya un tracker por grupo por empresa
    __table_args__ = (
        UniqueConstraint('company_id', 'group_type', 'group_id', name='uix_company_group_tracker'),
    )
    
class TransitionValidation(Base):
    """
    Reglas que deben cumplirse estrictamente ANTES de que un registro 
    pueda avanzar por esta transición.
    """
    __tablename__ = "transition_validations"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    transition_id = Column(Integer, ForeignKey("transitions.id", ondelete="CASCADE"), index=True)
    
    # Campo a evaluar (ej: 'prioridad', 'documento_adjunto')
    target_field = Column(String, nullable=False)
    
    # Operador lógico ('==', '!=', 'IS_EMPTY', 'NOT_EMPTY', '>', '<', 'CONTAINS')
    operator = Column(String, nullable=False)
    
    # Valor contra el cual comparar (puede ser nulo si el operador es IS_EMPTY)
    validation_value = Column(String, nullable=True)
    
    # Mensaje de error personalizado si la validación falla
    error_message = Column(String, nullable=True)
    
class SecurityPolicy(Base):
    """
    Políticas de seguridad configurables por empresa y por grupos.
    """
    __tablename__ = "security_policies"
    id = Column(Integer, primary_key=True, index=True)
    
    # 🔥 FIX: Quitamos unique=True para permitir múltiples políticas por empresa
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    # 🔥 NUEVO: Granularidad (Estilo Zoho One)
    # Si profile_id y role_id son NULL, significa que es la Política GLOBAL de la empresa.
    name = Column(String, default="Política Global") 
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # 🛡️ Protección contra Fuerza Bruta
    max_login_attempts = Column(Integer, default=5)
    temp_lockout_minutes = Column(Integer, default=15)
    max_temp_lockouts = Column(Integer, default=3)
    
    # 🔑 Expiración de Contraseña
    password_expiration_active = Column(Boolean, default=False)
    password_expiration_days = Column(Integer, default=90)
    
    # 📜 Historial de Contraseñas
    password_history_active = Column(Boolean, default=False)
    password_history_count = Column(Integer, default=3)
    
    # ⏱️ Sesión e Inactividad
    inactivity_timeout_minutes = Column(Integer, default=15)
    max_concurrent_sessions = Column(Integer, default=3)
    
    # 🧩 Complejidad de Contraseña
    password_complexity_active = Column(Boolean, default=False)
    pwd_min_length = Column(Integer, default=8)
    pwd_max_length = Column(Integer, default=128)
    pwd_require_uppercase = Column(Boolean, default=True)
    pwd_require_lowercase = Column(Boolean, default=True)
    pwd_require_numbers = Column(Boolean, default=True)
    pwd_require_special = Column(Boolean, default=True)
    
    # 🌍 Restricción de Red (IP Whitelisting)
    ip_whitelist_active = Column(Boolean, default=False)
    allowed_ips = Column(JSON, default=[])
    
    # 🔥 NUEVO: MFA (Google Authenticator) 🔥
    mfa_active = Column(Boolean, default=False) # Activa el uso de MFA para este grupo/empresa
    mfa_required = Column(Boolean, default=False) # Si es True, los obliga a usarlo sí o sí
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
class PasswordHistory(Base):
    """
    Guarda las contraseñas anteriores para evitar que los usuarios las repitan.
    """
    __tablename__ = "password_history"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
class ActiveSession(Base):
    """
    Rastrea las sesiones activas de un usuario para limitar la concurrencia.
    """
    __tablename__ = "active_sessions"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    
    token_jti = Column(String, unique=True, index=True, nullable=False) # ID único del JWT
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True) # Para saber si es Chrome, Safari, etc.
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False) # Cuándo muere el token
    
# =========================================================
# 🔥 FASE 1: COLABORACIÓN Y CHAT CONTEXTUAL 🔥
# =========================================================
class CaseComment(Base):
    """
    Tabla para manejar los comentarios y el chat interno dentro de un caso específico.
    Soporta menciones a otros usuarios (ej. @juan).
    """
    __tablename__ = "case_comments"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True) # El autor del comentario
    
    content = Column(String, nullable=False) # El mensaje en sí
    is_system_message = Column(Boolean, default=False) # Si es True, el mensaje lo generó un robot (ej: "Juan rompió el SLA")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # (Opcional) Si quieres permitir edición de comentarios en el futuro:
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    is_deleted = Column(Boolean, default=False) # Soft delete para comentarios
    
# =======================================================
# 🔥 FASE 3: WEBHOOKS DE ENTRADA (iPaaS) 🔥
# =======================================================
class WebhookEndpoint(Base):
    """
    Endpoints generados para que sistemas externos inyecten datos a AegisFlow.
    """
    __tablename__ = "webhook_endpoints"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    name = Column(String, nullable=False) # Ej: "Conexión con SAP" o "Formulario Web"
    token = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4())) # El token secreto en la URL
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
# =======================================================
# 🔥 FASE SOPORTE: CHAT EN TIEMPO REAL Y TICKETS 🔥
# =======================================================

class SupportSession(Base):
    """
    Sesiones de chat/soporte entre clientes y los Súper Administradores del Sistema.
    """
    __tablename__ = "support_sessions"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True) # Empresa del cliente
    client_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True) # Usuario que pide ayuda
    agent_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True) # Súper Admin que atiende
    
    status = Column(String, default="WAITING") # WAITING, ACTIVE, RESOLVED
    started_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    csat_score = Column(Integer, nullable=True) # Calificación del 1 al 5
    csat_comment = Column(String, nullable=True)

class ChatMessage(Base):
    """
    Mensajes individuales dentro de una sesión de soporte.
    """
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("support_sessions.id", ondelete="CASCADE"), index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    message = Column(String, nullable=False)
    is_internal_note = Column(Boolean, default=False) # Notas amarillas (solo visibles para agentes)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
class DocumentTemplate(Base):
    """
    Cabecera de la plantilla. Define el nombre y a qué módulo pertenece.
    """
    __tablename__ = "document_templates"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), index=True)
    
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True) # El interruptor para promociones
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # Relaciones
    versions = relationship("DocumentTemplateVersion", back_populates="template", cascade="all, delete-orphan")
    generated_docs = relationship("GeneratedDocument", back_populates="template")

class DocumentTemplateVersion(Base):
    """
    Contenido específico de cada versión de la plantilla.
    """
    __tablename__ = "document_template_versions"
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("document_templates.id", ondelete="CASCADE"), index=True)
    
    version_number = Column(Integer, default=1)
    content_html = Column(String, nullable=False) # Aquí va el Jinja2: {{ nombre }}
    content_state = Column(JSON, nullable=True)   # Estado del editor visual
    editor_type = Column(String, default="visual")
    
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    template = relationship("DocumentTemplate", back_populates="versions")

class GeneratedDocument(Base):
    """
    Registro histórico de cada PDF generado. (Auditoría Pura)
    """
    __tablename__ = "generated_documents"
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("document_templates.id"))
    version_id = Column(Integer, ForeignKey("document_template_versions.id"))
    record_id = Column(Integer) # ID del registro del módulo (ej: ID del Caso)
    
    file_path = Column(String) # Ruta en S3 o Google Drive
    sha256_hash = Column(String) # Huella digital del archivo para evitar alteraciones
    
    is_signed = Column(Boolean, default=False)
    signature_data = Column(JSON, nullable=True) # Datos de la firma digital
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    template = relationship("DocumentTemplate", back_populates="generated_docs")