from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.core.audit import log_event 

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