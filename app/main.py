import os
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.scheduler import check_sla_breaches
from contextlib import asynccontextmanager
from app.db.base_class import Base
from app.db.session import engine, get_db
from app.models import models 
from app.api.v1.endpoints import auth, cases, fields, statuses, transitions, blueprints, forms, modules, automations, uploads, notifications, security, global_audit, dashboards, webhooks, ai, chat, templates, workflow
from app.api import deps
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles 
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.sessions import SessionMiddleware
from app.core.config import settings
# 🔥 IMPORTAMOS LA CONFIGURACIÓN CENTRALIZADA 🔥
from app.core.config import settings

if not os.path.exists("uploads"):
    os.makedirs("uploads")

# =======================================================
# 🔥 CICLO DE VIDA DEL SERVIDOR (LIFESPAN) 🔥
# =======================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- AL ENCENDER EL SERVIDOR ---
    print("🤖 Iniciando robot de fondo (Cronjobs)...")
    scheduler = BackgroundScheduler()
    
    # Revisará los SLAs cada 5 minutos
    scheduler.add_job(check_sla_breaches, 'interval', minutes=5)
    
    scheduler.start()
    yield # Aquí corre la aplicación FastAPI
    
    # --- AL APAGAR EL SERVIDOR ---
    print("🛑 Apagando robot de fondo...")
    scheduler.shutdown()

app = FastAPI(title="BPM Documentation API", lifespan=lifespan)
# 🔥 NECESARIO PARA EL SSO (FASE 6): Memoria temporal para Authlib
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)
# 🔥 NUEVO: ESCUDO ANTI-BOTS (Rate Limiting) 🔥
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 🔥 PENTEST FIX: Usamos la lista de orígenes validada desde config.py 🔥
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(cases.router, prefix="/api/v1/cases", tags=["Cases"])
app.include_router(fields.router, prefix="/api/v1/fields", tags=["Fields"])
app.include_router(statuses.router, prefix="/api/v1/statuses", tags=["Statuses"])
app.include_router(transitions.router, prefix="/api/v1/transitions", tags=["Transitions"])
app.include_router(blueprints.router, prefix="/api/v1/blueprints", tags=["Blueprints"])
app.include_router(forms.router, prefix="/api/v1/forms", tags=["Forms"])
app.include_router(modules.router, prefix="/api/v1/modules", tags=["Modules"])
app.include_router(automations.router, prefix="/api/v1/automations", tags=["Automations"])
app.include_router(uploads.router, prefix="/api/v1/uploads", tags=["Uploads"]) 
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(security.router, prefix="/api/v1/security", tags=["Security"])
app.include_router(global_audit.router, prefix="/api/v1/global_audit", tags=["Global Audit"])
app.include_router(dashboards.router, prefix="/api/v1/dashboards", tags=["Dashboards"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["Artificial Intelligence"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["Templates"])
app.include_router(workflow.router, prefix="/api/v1/workflow", tags=["Workflow"])

Base.metadata.create_all(bind=engine)

@app.get("/")
def read_root():
    return {"message": "Tablas creadas y DB conectada"}


# =======================================================
# 🔥 PENTEST FIX: ESQUEMA SEGURO PARA EL PERFIL ACTUAL 🔥
# =======================================================
class UserMeResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_id: int
    is_superadmin: bool
    role_name: str
    profile_name: str
    permissions: Dict[str, Any]
    is_mfa_enabled: bool = False
    is_system_company: bool = False
    language: str = "es"

    class Config:
        from_attributes = True

@app.get("/api/v1/users/me", response_model=UserMeResponse)
def read_user_me(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    profile = db.query(models.Profile).filter(models.Profile.id == current_user.profile_id).first() if current_user.profile_id else None
    role = db.query(models.Role).filter(models.Role.id == current_user.role_id).first() if current_user.role_id else None
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    return {
        "id": current_user.id, 
        "email": current_user.email,
        "first_name": current_user.first_name, 
        "last_name": current_user.last_name, 
        "company_id": current_user.company_id,
        "is_superadmin": current_user.is_superadmin,
        "role_name": role.name if role else "Sin rol asignado", 
        "profile_name": profile.name if profile else "Sin perfil asignado", 
        "permissions": profile.permissions if profile else {},
        
        # 🔥 FIX: Si la BD devuelve NULL (None), forzamos a que sea False 🔥
        "is_mfa_enabled": current_user.is_mfa_enabled or False,
        "is_system_company": company.is_system_company == True if company else False,
        
        # 🔥 DEVOLVEMOS EL IDIOMA GUARDADO EN LA BD 🔥
        "language": getattr(current_user, 'language', 'es') or "es"
    }