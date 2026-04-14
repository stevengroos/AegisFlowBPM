from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import List

from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.global_audit import log_global_event

# Importamos tu motor de reglas para que se disparen cuando el webhook cree un caso
from app.api.v1.endpoints.cases import process_global_rules

router = APIRouter()

# ==========================
# ESQUEMAS
# ==========================
class WebhookCreate(BaseModel):
    name: str
    module_id: int
    form_id: int

class WebhookResponse(BaseModel):
    id: int
    name: str
    token: str
    module_id: int
    form_id: int
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True

# =======================================================
# 🔥 1. EL PORTERO PÚBLICO (INBOUND WEBHOOK) 🔥
# =======================================================
@router.post("/in/{token}")
async def receive_external_data(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Ruta pública (sin autenticación tradicional). 
    Se valida únicamente con el Token secreto generado en la URL.
    """
    webhook = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.token == token,
        models.WebhookEndpoint.is_active == True
    ).first()

    if not webhook:
        raise HTTPException(status_code=401, detail="Token de webhook inválido o inactivo.")

    # 1. Leer el JSON que nos manda el sistema externo
    try:
        payload = await request.json()
    except:
        raise HTTPException(status_code=400, detail="El cuerpo de la petición debe ser un JSON válido.")

    # 2. Buscar el estado inicial del módulo para que el caso nazca correctamente
    blueprint = db.query(models.Blueprint).filter(
        models.Blueprint.company_id == webhook.company_id,
        models.Blueprint.module_id == webhook.module_id,
        models.Blueprint.is_active == True
    ).first()

    initial_status_id = None
    if blueprint:
        status = db.query(models.Status).filter(
            models.Status.blueprint_id == blueprint.id, 
            models.Status.is_initial == True
        ).first()
        if status:
            initial_status_id = status.id

    # 3. Crear el Registro (Case) con los datos inyectados
    new_case = models.Case(
        company_id=webhook.company_id,
        created_by=webhook.created_by, # Queda a nombre de quien generó el webhook
        module_id=webhook.module_id,
        form_id=webhook.form_id,
        status_id=initial_status_id,
        data=payload, # Metemos toda la data externa aquí
        ui_rules={}
    )

    # 4. 🔥 DISPARAR MAGIA: Ejecutar reglas de SLA, Asignaciones y Alertas 🔥
    # Simulamos que el creador del webhook fue quien hizo la acción
    system_user_id = webhook.created_by or 0
    process_global_rules(db, new_case, system_user_id, "ON_CREATE", background_tasks=background_tasks)

    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    return {"status": "success", "message": "Datos recibidos y registro creado.", "case_id": new_case.id}


# =======================================================
# 🔥 2. GESTIÓN INTERNA (CRUD PARA ADMINS) 🔥
# =======================================================
@router.post("/", response_model=dict)
def create_webhook(
    webhook_in: WebhookCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Genera una nueva URL secreta para recibir datos."""
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden crear Webhooks.")

    new_webhook = models.WebhookEndpoint(
        company_id=current_user.company_id,
        module_id=webhook_in.module_id,
        form_id=webhook_in.form_id,
        created_by=current_user.id,
        name=webhook_in.name
    )
    
    db.add(new_webhook)
    db.commit()
    db.refresh(new_webhook)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="WEBHOOK", action="CREATE", entity_id=new_webhook.id,
        details=f"Creó el webhook '{new_webhook.name}' para el módulo {webhook_in.module_id}", request=request
    )

    return {
        "message": "Webhook generado exitosamente",
        "webhook_url": f"/api/v1/webhooks/in/{new_webhook.token}",
        "id": new_webhook.id
    }

@router.get("/module/{module_id}", response_model=List[WebhookResponse])
def get_webhooks(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Lista todos los webhooks activos de un módulo."""
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="No tienes permisos.")

    webhooks = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.company_id == current_user.company_id,
        models.WebhookEndpoint.module_id == module_id
    ).order_by(models.WebhookEndpoint.created_at.desc()).all()
    
    # Formatear fecha para el response
    for w in webhooks:
        w.created_at = w.created_at.strftime("%Y-%m-%d %H:%M:%S") if w.created_at else ""
        
    return webhooks

@router.delete("/{webhook_id}")
def delete_webhook(
    webhook_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Elimina (desactiva) un webhook para que no reciba más datos."""
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="No tienes permisos.")

    webhook = db.query(models.WebhookEndpoint).filter(
        models.WebhookEndpoint.id == webhook_id,
        models.WebhookEndpoint.company_id == current_user.company_id
    ).first()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    db.delete(webhook)
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="WEBHOOK", action="DELETE", entity_id=webhook_id,
        details=f"Eliminó el webhook '{webhook.name}'", request=request
    )

    return {"message": "Webhook eliminado permanentemente."}