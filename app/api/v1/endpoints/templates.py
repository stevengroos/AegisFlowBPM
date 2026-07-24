from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models import models
from app.api import deps
from app.schemas import template as template_schema
from datetime import datetime

# 🔥 Importamos nuestro motor y el conector a Supabase 🔥
from app.core.pdf_engine import document_engine
from app.core.storage import upload_file_to_supabase

router = APIRouter()

@router.post("/", response_model=template_schema.TemplateResponse)
def create_template(
    template_in: template_schema.TemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    module = db.query(models.Module).filter(
        models.Module.id == template_in.module_id,
        models.Module.company_id == current_user.company_id
    ).first()
    
    if not module:
        raise HTTPException(status_code=404, detail="El módulo seleccionado no existe o no tienes acceso.")

    db_template = models.DocumentTemplate(
        company_id=current_user.company_id,
        module_id=template_in.module_id,
        name=template_in.name,
        description=template_in.description,
        is_active=template_in.is_active
    )
    db.add(db_template)
    db.flush() 

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
    template = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.id == template_id,
        models.DocumentTemplate.company_id == current_user.company_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")

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
# 🔥 ENDPOINT DE GENERACIÓN DE PDF DIRECTO A LA NUBE 🔥
# =========================================================

@router.post("/{template_id}/generate/{record_id}")
def generate_document_pdf(
    template_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    template = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.id == template_id,
        models.DocumentTemplate.company_id == current_user.company_id,
        models.DocumentTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada o está inactiva.")

    latest_version = db.query(models.DocumentTemplateVersion).filter(
        models.DocumentTemplateVersion.template_id == template.id
    ).order_by(models.DocumentTemplateVersion.version_number.desc()).first()

    if not latest_version:
        raise HTTPException(status_code=400, detail="La plantilla no tiene versiones.")

    case_record = db.query(models.Case).filter(
        models.Case.id == record_id,
        models.Case.company_id == current_user.company_id
    ).first()

    if not case_record:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")

    data_to_inject = {
        "caso_id": case_record.id,
        "fecha_creacion": case_record.created_at.strftime("%Y-%m-%d %H:%M") if case_record.created_at else "",
    }

    if case_record.data:
        for key, value in case_record.data.items():
            data_to_inject[key] = value

    # 1. Inyectar datos en el HTML
    rendered_html = document_engine.render_html(latest_version.content_html, data_to_inject)

    # 2. Obtener el PDF en memoria (Bytes) y su Huella Digital
    pdf_bytes, pdf_hash = document_engine.generate_pdf_bytes(rendered_html)

    # 3. Subir los Bytes directamente a Supabase
    file_name = f"T{template.id}_V{latest_version.version_number}_R{case_record.id}_{int(datetime.now().timestamp())}.pdf"
    
    file_url = upload_file_to_supabase(
        bucket_name="generated_pdfs",
        file_name=file_name,
        file_bytes=pdf_bytes,
        content_type="application/pdf"
    )

    # 4. Guardar la URL pública en la tabla de Auditoría
    generated_doc = models.GeneratedDocument(
        template_id=template.id,
        version_id=latest_version.id,
        record_id=case_record.id,
        file_path=file_url,  # 🔥 Ahora guardamos la URL de la nube, no la ruta local
        sha256_hash=pdf_hash
    )
    db.add(generated_doc)
    db.commit()

    # 5. Devolvemos la URL al Frontend para que el usuario pueda ver o descargar el PDF
    safe_download_name = f"{template.name.replace(' ', '_')}_{case_record.id}.pdf"
    
    return {
        "url": file_url,
        "filename": safe_download_name,
        "hash": pdf_hash,
        "message": "Documento generado exitosamente en la nube."
    }
    
@router.put("/{template_id}", response_model=template_schema.TemplateResponse)
def update_template(
    template_id: int,
    template_in: template_schema.TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    template = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.id == template_id,
        models.DocumentTemplate.company_id == current_user.company_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
        
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
    template = db.query(models.DocumentTemplate).filter(
        models.DocumentTemplate.id == template_id,
        models.DocumentTemplate.company_id == current_user.company_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
        
    db.delete(template)
    db.commit()
    return {"message": "Plantilla eliminada exitosamente"}