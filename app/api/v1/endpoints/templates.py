from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.schemas import template as template_schema
import os
from datetime import datetime
from fastapi.responses import FileResponse
from app.core.pdf_engine import document_engine # 🔥 Importamos nuestro nuevo motor

router = APIRouter()

@router.post("/", response_model=template_schema.TemplateResponse)
def create_template(
    template_in: template_schema.TemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Crea una nueva plantilla y registra su Versión 1 automáticamente.
    """
    # 1. Validar que el módulo pertenezca a la empresa del usuario
    module = db.query(models.Module).filter(
        models.Module.id == template_in.module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if not module:
        raise HTTPException(status_code=404, detail="El módulo seleccionado no existe o no tienes acceso.")

    # 2. Crear la cabecera de la plantilla
    db_template = models.DocumentTemplate(
        company_id=current_user.company_id,
        module_id=template_in.module_id,
        name=template_in.name,
        description=template_in.description,
        is_active=template_in.is_active
    )
    db.add(db_template)
    db.flush() # Guarda temporalmente para generar el ID de la plantilla

    # 3. Guardar la Versión 1
    db_version = models.DocumentTemplateVersion(
        template_id=db_template.id,
        version_number=1,
        content_html=template_in.initial_version.content_html,
        content_state=template_in.initial_version.content_state,
        editor_type=template_in.initial_version.editor_type,
        created_by=current_user.id
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_template)

    return db_template

@router.get("/module/{module_id}", response_model=List[template_schema.TemplateResponse])
def get_templates_by_module(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Lista todas las plantillas disponibles para un módulo específico.
    """
    templates = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.company_id == current_user.company_id,
        models.DocumentTemplate.module_id == module_id
    ).order_by(models.DocumentTemplate.name.asc()).all()
    
    return templates

@router.post("/{template_id}/versions", response_model=template_schema.VersionResponse)
def add_new_version(
    template_id: int,
    version_in: template_schema.VersionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Guarda una nueva versión de la plantilla (Evitando perder historial).
    """
    template = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.id == template_id,
        models.DocumentTemplate.company_id == current_user.company_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")

    # Calcular el siguiente número de versión
    last_version = db.query(models.DocumentTemplateVersion).filter(
        models.DocumentTemplateVersion.template_id == template_id
    ).order_by(models.DocumentTemplateVersion.version_number.desc()).first()
    
    next_version_num = (last_version.version_number + 1) if last_version else 1

    new_version = models.DocumentTemplateVersion(
        template_id=template_id,
        version_number=next_version_num,
        content_html=version_in.content_html,
        content_state=version_in.content_state,
        editor_type=version_in.editor_type,
        created_by=current_user.id
    )
    
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    return new_version

# =========================================================
# 🔥 ENDPOINT DE GENERACIÓN DE PDF Y AUDITORÍA 🔥
# =========================================================

@router.post("/{template_id}/generate/{record_id}")
def generate_document_pdf(
    template_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Genera un PDF final inyectando los datos del Caso en la plantilla.
    """
    # 1. Validar la plantilla y acceso
    template = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.id == template_id,
        models.DocumentTemplate.company_id == current_user.company_id,
        models.DocumentTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada o está inactiva.")

    # 2. Traer la ÚLTIMA versión de esa plantilla
    latest_version = db.query(models.DocumentTemplateVersion).filter(
        models.DocumentTemplateVersion.template_id == template.id
    ).order_by(models.DocumentTemplateVersion.version_number.desc()).first()

    if not latest_version:
        raise HTTPException(status_code=400, detail="La plantilla no tiene versiones.")

    # 3. Obtener los datos del registro (Tu modelo 'Case')
    case_record = db.query(models.Case).filter(
        models.Case.id == record_id,
        models.Case.company_id == current_user.company_id
    ).first()

    if not case_record:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")

    # 4. 🔥 MAPEO DE VARIABLES JINJA2 🔥
    # Empezamos con las variables de sistema
    data_to_inject = {
        "caso_id": case_record.id,
        "fecha_creacion": case_record.created_at.strftime("%Y-%m-%d %H:%M") if case_record.created_at else "",
    }

    # 🔥 LA MAGIA: Inyectamos TODOS los campos dinámicos de tu formulario
    # Esto permite que si el usuario escribió {{ solicitante }}, Jinja2 lo encuentre en case_record.data
    if case_record.data:
        for key, value in case_record.data.items():
            data_to_inject[key] = value

    # 5. Inyectar los datos en el HTML usando nuestro Motor WeasyPrint
    rendered_html = document_engine.render_html(latest_version.content_html, data_to_inject)

    # 6. Preparar directorio seguro en el servidor para guardar PDFs
    os.makedirs("generated_pdfs", exist_ok=True)
    file_name = f"T{template.id}_V{latest_version.version_number}_R{case_record.id}_{int(datetime.now().timestamp())}.pdf"
    file_path = os.path.join("generated_pdfs", file_name)

    # 7. Convertir a PDF estricto y sacar la Huella Digital
    pdf_hash = document_engine.generate_pdf(rendered_html, file_path)

    # 8. GUARDAR EN AUDITORÍA HISTÓRICA
    generated_doc = models.GeneratedDocument(
        template_id=template.id,
        version_id=latest_version.id,
        record_id=case_record.id,
        file_path=file_path,
        sha256_hash=pdf_hash
    )
    db.add(generated_doc)
    db.commit()

    # 9. Retornar el archivo físico para descarga directa
    safe_download_name = f"{template.name.replace(' ', '_')}_{case_record.id}.pdf"
    
    return FileResponse(
        path=file_path, 
        filename=safe_download_name, 
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_download_name}"'} 
    )
    
# =========================================================
# 🔥 ENDPOINTS FALTANTES: ACTUALIZAR Y ELIMINAR 🔥
# =========================================================

@router.put("/{template_id}", response_model=template_schema.TemplateResponse)
def update_template(
    template_id: int,
    template_in: template_schema.TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Actualiza el nombre, descripción o el estado (Activo/Inactivo) de una plantilla.
    """
    template = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.id == template_id,
        models.DocumentTemplate.company_id == current_user.company_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
        
    # Extraemos solo los campos que el Frontend envió para no borrar los demás
    update_data = template_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
        
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Elimina una plantilla y todas sus versiones de forma permanente.
    """
    template = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.id == template_id,
        models.DocumentTemplate.company_id == current_user.company_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
        
    db.delete(template)
    db.commit()
    return {"message": "Plantilla eliminada exitosamente"}