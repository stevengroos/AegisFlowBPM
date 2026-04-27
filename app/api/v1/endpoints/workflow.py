from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.audit import log_event 
from fastapi.responses import HTMLResponse
from sqlalchemy.sql import func
from app.core.security import verify_action_token

# 🔥 IMPORTAMOS EL ESPÍA GLOBAL Y EL GUARDIA DE SEGURIDAD 🔥
from app.core.security_utils import check_record_permission
from app.core.global_audit import log_global_event

router = APIRouter()

@router.post("/move/{case_id}/{target_status_id}")
def move_case(
    case_id: int, 
    target_status_id: int, 
    request: Request, # 🔥 Añadimos request para extraer la IP 🔥
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # 1. Buscar el caso
    case = db.query(models.Case).filter(
        models.Case.id == case_id, 
        models.Case.company_id == current_user.company_id
    ).first()
    
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")

    # 🔥 PENTEST FIX: Validar jerarquía y permisos de edición sobre este caso específico 🔥
    check_record_permission(db, current_user, case, "edit")

    old_status_id = case.status_id

    # 2. Verificar si existe una transición legal
    transition = db.query(models.Transition).filter(
        models.Transition.from_status_id == case.status_id,
        models.Transition.to_status_id == target_status_id,
        models.Transition.company_id == current_user.company_id
    ).first()

    if not transition:
        raise HTTPException(status_code=400, detail="Este movimiento no está permitido en el Blueprint")

    # 3. Ejecutar el cambio
    case.status_id = target_status_id
    
    # 4. Registrar el evento de auditoría local (Línea de tiempo del caso)
    log_event(
        db, 
        user_id=current_user.id, 
        company_id=current_user.company_id,
        case_id=case.id,
        action="STATUS_CHANGE",
        old_v={"status_id": old_status_id},
        new_v={"status_id": target_status_id}
    )
    
    db.commit()
    
    # 5. 🔥 PENTEST FIX: Auditoría Global (Requisito ISO 27001) 🔥
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="WORKFLOW", action="MOVE_CASE", entity_id=case.id,
        details=f"Movió el registro #{case.id} de estado (ID: {old_status_id} -> {target_status_id}) vía '{transition.name}'", 
        request=request
    )
    
    return {
        "message": f"Caso movido exitosamente a través de: {transition.name}",
        "case_id": case.id,
        "new_status_id": case.status_id
    }
    
@router.get("/email-action", response_class=HTMLResponse)
def process_email_action(
    token: str, 
    request: Request, 
    db: Session = Depends(get_db)
):
    """Recibe el clic desde el correo, valida el token y mueve el caso mágicamente."""
    
    # 1. Desencriptar y validar el token
    payload = verify_action_token(token)
    if not payload:
        return "<html><body style='font-family: sans-serif; text-align: center; padding: 50px; background-color: #f9fafb;'><h1 style='color: #ef4444;'>❌ Enlace inválido o expirado.</h1><p style='color: #374151;'>Por seguridad, los enlaces de aprobación caducan después de 7 días o si han sido manipulados.</p></body></html>"

    case_id = payload["case_id"]
    transition_id = payload["transition_id"]
    user_id = payload["user_id"]

    # 2. Buscar las entidades en la BD
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    user = db.query(models.User).filter(models.User.id == user_id).first()
    transition = db.query(models.Transition).filter(models.Transition.id == transition_id).first()

    # 3. Validar que el caso exista y no haya sido movido ya por alguien más
    if not case or not transition or case.status_id != transition.from_status_id:
        return "<html><body style='font-family: sans-serif; text-align: center; padding: 50px; background-color: #f9fafb;'><h1 style='color: #f59e0b;'>⚠️ Caso ya procesado.</h1><p style='color: #374151;'>Este registro ya no se encuentra en el estado original. Es posible que otro usuario ya haya tomado una decisión.</p></body></html>"

    # 4. ¡HACER LA MAGIA! Mover el caso
    old_status_id = case.status_id
    case.status_id = transition.to_status_id
    case.entered_status_at = func.now()
    
    # 5. Auditoría (Registramos quién lo hizo desde el correo)
    log_event(
        db, user_id=user.id, company_id=case.company_id, case_id=case.id,
        action="EMAIL_APPROVAL", old_v={"status_id": old_status_id}, new_v={"status_id": case.status_id}
    )
    
    log_global_event(
        db=db, user_id=user.id, company_id=case.company_id,
        entity_type="WORKFLOW", action="EMAIL_APPROVAL", entity_id=case.id,
        details=f"Aprobó desde el correo el caso #{case.id} vía '{transition.name}'", 
        request=request
    )
    
    db.commit()

    # 6. Pantalla de Éxito HTML
    return f"""
    <html>
    <body style='font-family: sans-serif; text-align: center; padding: 50px; background-color: #f9fafb;'>
        <div style='max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'>
            <h1 style='color: #10b981; font-size: 28px; margin-bottom: 10px;'>✅ ¡Acción Procesada!</h1>
            <p style='color: #374151; font-size: 16px;'>Gracias <b>{user.first_name or user.email}</b>.</p>
            <p style='color: #374151; font-size: 16px;'>El caso ha avanzado exitosamente a través de la transición: <b>"{transition.name}"</b>.</p>
            <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;'>
                <p style='color: #6b7280; font-size: 14px;'>Ya puedes cerrar esta ventana y volver a tu correo.</p>
            </div>
        </div>
    </body>
    </html>
    """