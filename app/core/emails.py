import logging
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from sqlalchemy.orm import Session
from app.models.models import Company
from app.core.config import settings

# Configurar logs para ver si los correos salen o fallan
logger = logging.getLogger(__name__)

def get_email_config(db: Session, company_id: int) -> ConnectionConfig:
    """
    Busca la configuración SMTP. Prioriza la de la empresa (Marca Blanca).
    Si la empresa no tiene, usa la global del sistema (.env).
    """
    company = db.query(Company).filter(Company.id == company_id).first()

    # 1. ¿El cliente configuró su propio correo corporativo?
    if company and company.use_custom_smtp and company.smtp_host and company.smtp_user and company.smtp_password:
        return ConnectionConfig(
            MAIL_USERNAME=company.smtp_user,
            MAIL_PASSWORD=company.smtp_password,
            MAIL_FROM=company.smtp_from_email or company.smtp_user,
            MAIL_PORT=company.smtp_port or 587,
            MAIL_SERVER=company.smtp_host,
            MAIL_FROM_NAME=company.smtp_from_name or company.name,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=False
        )

    # 2. Configuración Global (Respaldo) - Típicamente un Gmail o SendGrid tuyo
    return ConnectionConfig(
        MAIL_USERNAME=getattr(settings, "SMTP_USER", "alertas@tusaas.com"),
        MAIL_PASSWORD=getattr(settings, "SMTP_PASSWORD", "tu_password_seguro"),
        MAIL_FROM=getattr(settings, "SMTP_FROM_EMAIL", "noreply@tusaas.com"),
        MAIL_PORT=getattr(settings, "SMTP_PORT", 587),
        MAIL_SERVER=getattr(settings, "SMTP_HOST", "smtp.gmail.com"),
        MAIL_FROM_NAME=getattr(settings, "SMTP_FROM_NAME", "Security AegisFlow"),
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=False
    )

async def send_security_alert_async(db: Session, company_id: int, email_to: str, subject: str, body_html: str):
    """
    Envía un correo asíncrono. Ideal para BackgroundTasks.
    """
    try:
        config = get_email_config(db, company_id)
        
        message = MessageSchema(
            subject=subject,
            recipients=[email_to],
            body=body_html,
            subtype=MessageType.html
        )
        
        fm = FastMail(config)
        await fm.send_message(message)
        logger.info(f"📧 ALERTA ENVIADA EXITOSAMENTE a {email_to}")
        
    except Exception as e:
        logger.error(f"❌ Error enviando correo a {email_to}: {str(e)}")
        
# === AGREGA ESTO AL FINAL DE TU ARCHIVO emails.py ===

async def send_support_transcript_async(
    db: Session, 
    company_id: int, 
    client_email: str, 
    agent_email: str, 
    session_id: int, 
    body_html: str
):
    """
    Envía la transcripción del chat al cliente con copia al agente de soporte.
    """
    try:
        config = get_email_config(db, company_id)
        
        message = MessageSchema(
            subject=f"Resumen de tu caso de soporte #{session_id}",
            recipients=[client_email],
            cc=[agent_email] if agent_email else [],
            body=body_html,
            subtype=MessageType.html
        )
        
        fm = FastMail(config)
        await fm.send_message(message)
        logger.info(f"📧 TRANSCRIPT ENVIADO EXITOSAMENTE a {client_email}")
        
    except Exception as e:
        logger.error(f"❌ Error enviando transcript a {client_email}: {str(e)}")
        
        

async def send_support_notification_async(db: Session, company_id: int, email_to: str, subject: str, body_html: str):
    """
    Envía una alerta cuando llega un nuevo mensaje de soporte.
    """
    try:
        config = get_email_config(db, company_id)
        
        message = MessageSchema(
            subject=subject,
            recipients=[email_to],
            body=body_html,
            subtype=MessageType.html
        )
        
        fm = FastMail(config)
        await fm.send_message(message)
        logger.info(f"📧 ALERTA DE NUEVO MENSAJE ENVIADA a {email_to}")
        
    except Exception as e:
        logger.error(f"❌ Error enviando alerta de mensaje a {email_to}: {str(e)}")