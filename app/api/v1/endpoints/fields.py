from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Union, Any, Dict
from pydantic import BaseModel, Field # 🔥 Importamos Field
import unicodedata
import re
import json

from app.db.session import get_db
from app.models import models
from app.api import deps
from app.schemas import form_field as schema
from app.core.security_utils import check_settings_permission
from app.core.global_audit import log_global_event

router = APIRouter()

# ==========================================
# UTILIDADES
# ==========================================
def generate_unique_api_name(label: str, db: Session, company_id: int, form_id: int) -> str:
    nfkd_form = unicodedata.normalize('NFKD', label)
    only_ascii = nfkd_form.encode('ASCII', 'ignore').decode('utf-8')
    base_api_name = re.sub(r'[^a-z0-9]', '_', only_ascii.lower())
    base_api_name = re.sub(r'_+', '_', base_api_name).strip('_')
    if not base_api_name: base_api_name = "campo_personalizado"

    api_name = base_api_name
    counter = 1
    while db.query(models.FormField).filter(
        models.FormField.company_id == company_id,
        models.FormField.form_id == form_id,
        models.FormField.api_name == api_name
    ).first():
        api_name = f"{base_api_name}_{counter}"
        counter += 1
    return api_name


# ==========================================
# SCHEMAS PARA GUARDADO MASIVO Y EXPORTACIÓN
# ==========================================
class BatchSection(BaseModel):
    id: Union[int, str] 
    title: str = Field(..., min_length=1, max_length=150) # 🔥 PENTEST FIX: Límites
    order: int
    columns: int = Field(1, ge=1, le=3)

class BatchField(BaseModel):
    id: Union[int, str]
    section_id: Optional[Union[int, str]] = None
    label: str = Field(..., min_length=1, max_length=150) # 🔥 PENTEST FIX: Límites
    field_type: str = Field(..., max_length=50)
    required: bool = False
    options: Optional[Union[List[str], dict, Any]] = None
    show_in_create: bool = True
    is_primary: bool = False
    subform_config: Optional[Union[List[dict], Any]] = []
    order: int = 0
    api_name: Optional[str] = Field(None, max_length=150)

class BatchSavePayload(BaseModel):
    form_id: int
    sections: List[BatchSection]
    fields: List[BatchField]
    deleted_section_ids: List[int]
    deleted_field_ids: List[int]


# ==========================================
# SCHEMAS PARA IMPORTACIÓN
# ==========================================
class ImportSection(BaseModel):
    temp_id: str
    title: str = Field(..., min_length=1, max_length=150)
    order: int
    columns: int = Field(1, ge=1, le=3)

class ImportField(BaseModel):
    temp_section_id: Optional[str] = None
    label: str = Field(..., min_length=1, max_length=150)
    api_name: str = Field(..., max_length=150)
    field_type: str = Field(..., max_length=50)
    required: bool = False
    options: Optional[Union[List[str], dict, Any]] = None
    show_in_create: bool = True
    is_primary: bool = False
    subform_config: Optional[Union[List[dict], Any]] = []
    order: int = 0

class ImportLayoutPayload(BaseModel):
    sections: List[ImportSection]
    fields: List[ImportField]


# ==========================================
# ENDPOINT: IMPORTAR DISEÑO (JSON)
# ==========================================
@router.post("/import_layout/{form_id}")
def import_form_layout(
    form_id: int,
    payload: ImportLayoutPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_forms")
    company_id = current_user.company_id

    form = db.query(models.Form).filter(models.Form.id == form_id, models.Form.company_id == company_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Formulario no encontrado o no pertenece a tu empresa.")

    stats = {"sections_created": 0, "fields_created": 0, "fields_updated": 0, "fields_archived": 0}

    current_fields = db.query(models.FormField).filter(models.FormField.form_id == form_id, models.FormField.is_active == True).all()
    current_api_names = {f.api_name: f for f in current_fields if f.api_name}
    imported_api_names = [f.api_name for f in payload.fields if f.api_name]

    db.query(models.FormSection).filter(models.FormSection.form_id == form_id).delete(synchronize_session=False)

    section_id_map = {}
    for sec in payload.sections:
        new_sec = models.FormSection(
            company_id=company_id,
            form_id=form_id,
            title=sec.title,
            order=sec.order,
            columns=sec.columns
        )
        db.add(new_sec)
        db.flush()
        section_id_map[sec.temp_id] = new_sec.id
        stats["sections_created"] += 1

    for imp_field in payload.fields:
        real_section_id = section_id_map.get(imp_field.temp_section_id)

        if imp_field.api_name in current_api_names:
            db_f = current_api_names[imp_field.api_name]
            db_f.label = imp_field.label
            db_f.field_type = imp_field.field_type
            db_f.required = imp_field.required
            db_f.options = imp_field.options
            db_f.show_in_create = imp_field.show_in_create
            db_f.is_primary = imp_field.is_primary
            db_f.subform_config = imp_field.subform_config
            db_f.order = imp_field.order
            db_f.section_id = real_section_id
            stats["fields_updated"] += 1
        else:
            new_f = models.FormField(
                company_id=company_id,
                form_id=form_id,
                section_id=real_section_id,
                label=imp_field.label,
                api_name=imp_field.api_name or generate_unique_api_name(imp_field.label, db, company_id, form_id),
                field_type=imp_field.field_type,
                required=imp_field.required,
                order=imp_field.order,
                options=imp_field.options,
                show_in_create=imp_field.show_in_create,
                is_primary=imp_field.is_primary,
                subform_config=imp_field.subform_config
            )
            db.add(new_f)
            stats["fields_created"] += 1

    for current_f in current_fields:
        if current_f.api_name not in imported_api_names:
            current_f.is_active = False
            current_f.section_id = None 
            stats["fields_archived"] += 1

    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=company_id,
        entity_type="FIELD_LAYOUT", action="IMPORT_LAYOUT", entity_id=form_id,
        details=f"Importó diseño para el formulario ID {form_id}: {stats['fields_created']} creados, {stats['fields_updated']} actualizados.",
        new_value=payload.dict(), 
        request=request
    )
    
    return {
        "message": "Diseño importado con éxito",
        "summary": stats
    }


# ==========================================
# ENDPOINT ESTRELLA: GUARDADO MASIVO (BATCH SAVE)
# ==========================================
@router.post("/batch_save")
def batch_save_form(
    payload: BatchSavePayload, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(deps.get_current_user)
):
    check_settings_permission(db, current_user, "manage_forms")
    company_id = current_user.company_id
    form_id = payload.form_id

    # 🔥 PENTEST FIX: Verificar que el formulario destino pertenece a la empresa 🔥
    form = db.query(models.Form).filter(models.Form.id == form_id, models.Form.company_id == company_id).first()
    if not form:
        raise HTTPException(status_code=403, detail="El formulario especificado no existe o no pertenece a tu empresa.")

    if payload.deleted_field_ids:
        db.query(models.FormField).filter(models.FormField.id.in_(payload.deleted_field_ids), models.FormField.company_id == company_id).update({"is_active": False}, synchronize_session=False)

    if payload.deleted_section_ids:
        db.query(models.FormSection).filter(models.FormSection.id.in_(payload.deleted_section_ids), models.FormSection.company_id == company_id).delete(synchronize_session=False)

    section_id_map = {} 
    for sec in payload.sections:
        if isinstance(sec.id, int) and sec.id > 0: 
            db_sec = db.query(models.FormSection).filter(models.FormSection.id == sec.id, models.FormSection.company_id == company_id).first()
            if db_sec:
                db_sec.title = sec.title
                db_sec.order = sec.order
                db_sec.columns = sec.columns
                section_id_map[sec.id] = db_sec.id
        else: 
            new_sec = models.FormSection(company_id=company_id, form_id=form_id, title=sec.title, order=sec.order, columns=sec.columns)
            db.add(new_sec)
            db.flush() 
            section_id_map[sec.id] = new_sec.id

    primary_field_updated = False
    new_primary_field_id = None

    for f in payload.fields:
        real_section_id = section_id_map.get(f.section_id) if f.section_id else None

        final_options = f.options
        if f.field_type == 'select' and isinstance(f.options, str):
            final_options = [opt.strip() for opt in f.options.split(',') if opt.strip()]

        if isinstance(f.id, int) and f.id > 0: 
            db_field = db.query(models.FormField).filter(models.FormField.id == f.id, models.FormField.company_id == company_id).first()
            if db_field:
                db_field.label = f.label
                db_field.field_type = f.field_type
                db_field.required = f.required
                db_field.options = final_options
                db_field.show_in_create = f.show_in_create
                db_field.is_primary = f.is_primary
                db_field.subform_config = f.subform_config
                db_field.order = f.order
                db_field.section_id = real_section_id

                if f.is_primary:
                    primary_field_updated = True
                    new_primary_field_id = db_field.id
        else: 
            api_name = generate_unique_api_name(f.label, db, company_id, form_id)
            new_f = models.FormField(
                company_id=company_id, form_id=form_id, section_id=real_section_id,
                label=f.label, api_name=api_name, field_type=f.field_type,
                required=f.required, order=f.order, options=final_options,
                show_in_create=f.show_in_create, is_primary=f.is_primary, subform_config=f.subform_config
            )
            db.add(new_f)
            db.flush()
            if f.is_primary:
                primary_field_updated = True
                new_primary_field_id = new_f.id

    if primary_field_updated and new_primary_field_id:
        if form and form.module_id:
            forms_in_module = [fm.id for fm in db.query(models.Form.id).filter(models.Form.module_id == form.module_id).all()]
            db.query(models.FormField).filter(models.FormField.company_id == company_id, models.FormField.form_id.in_(forms_in_module), models.FormField.id != new_primary_field_id).update({"is_primary": False}, synchronize_session=False)

    db.commit() 
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=company_id,
        entity_type="FIELD_LAYOUT", action="BATCH_SAVE", entity_id=form_id,
        details=f"Actualizó el diseño completo del formulario ID {form_id} (Guardado Masivo)",
        new_value=payload.dict(), 
        request=request
    )
    
    return {"message": "Diseño guardado exitosamente"}


# ==========================================
# ENDPOINTS CLÁSICOS
# ==========================================

@router.get("/sections", response_model=List[schema.FormSectionResponse])
def get_sections(form_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    return db.query(models.FormSection).filter(models.FormSection.form_id == form_id, models.FormSection.company_id == current_user.company_id).order_by(models.FormSection.order).all()

@router.post("/", response_model=schema.FormFieldResponse)
def create_field(field_in: schema.FormFieldCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_forms")
    
    # 🔥 PENTEST FIX: Verificar que el formulario destino pertenece a la empresa 🔥
    form = db.query(models.Form).filter(models.Form.id == field_in.form_id, models.Form.company_id == current_user.company_id).first()
    if not form:
        raise HTTPException(status_code=403, detail="El formulario especificado no existe o no pertenece a tu empresa.")

    final_api_name = generate_unique_api_name(field_in.label, db, current_user.company_id, field_in.form_id)
    if field_in.api_name:
        existing = db.query(models.FormField).filter(
            models.FormField.company_id == current_user.company_id, 
            models.FormField.form_id == field_in.form_id, 
            models.FormField.api_name == field_in.api_name
        ).first()
        if not existing:
            final_api_name = field_in.api_name 
            
    field_data = field_in.dict()
    field_data["api_name"] = final_api_name 
    is_primary = field_data.get("is_primary", False)

    new_field = models.FormField(**field_data, company_id=current_user.company_id)
    db.add(new_field)
    db.flush() 

    if is_primary:
        if form and form.module_id:
            forms_in_module = [f.id for f in db.query(models.Form.id).filter(models.Form.module_id == form.module_id).all()]
            db.query(models.FormField).filter(models.FormField.company_id == current_user.company_id, models.FormField.form_id.in_(forms_in_module), models.FormField.id != new_field.id).update({"is_primary": False}, synchronize_session=False)

    db.commit()
    db.refresh(new_field)
    
    field_json = {
        "label": new_field.label, "api_name": new_field.api_name, 
        "field_type": new_field.field_type, "required": new_field.required, 
        "options": new_field.options, "is_primary": new_field.is_primary
    }
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FIELD", action="CREATE", entity_id=new_field.id,
        details=f"Creó el campo '{new_field.label}' (API: {new_field.api_name})",
        new_value=field_json, 
        request=request
    )
    
    return new_field

@router.get("/", response_model=List[schema.FormFieldResponse])
def get_my_fields(form_id: Optional[int] = None, module_id: Optional[int] = None, include_inactive: bool = False, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    query = db.query(models.FormField).filter(models.FormField.company_id == current_user.company_id)
    if module_id: query = query.join(models.Form).filter(models.Form.module_id == module_id)
    if form_id: query = query.filter(models.FormField.form_id == form_id)
    if not include_inactive: query = query.filter(models.FormField.is_active == True)
    return query.order_by(models.FormField.order).all()

@router.get("/definitions")
def get_field_definitions(module_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    query = db.query(models.FormField.label, models.FormField.api_name).filter(models.FormField.company_id == current_user.company_id, models.FormField.api_name != None)
    if module_id: query = query.join(models.Form).filter(models.Form.module_id == module_id)
    distinct_fields = query.distinct(models.FormField.api_name).all()
    return [{"label": f[0], "api_name": f[1]} for f in distinct_fields]

class FieldOrderUpdate(BaseModel):
    id: int
    order: int
    
    
@router.put("/order")
def update_fields_order(orders: List[FieldOrderUpdate], request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_forms")
    for item in orders: db.query(models.FormField).filter(models.FormField.id == item.id, models.FormField.company_id == current_user.company_id).update({"order": item.order})
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FIELD", action="UPDATE_ORDER",
        details=f"Reordenó {len(orders)} campos", request=request
    )
    
    return {"message": "Orden actualizado con éxito"}

@router.put("/{field_id}", response_model=schema.FormFieldResponse)
def update_field(field_id: int, field_in: schema.FormFieldCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_forms")
    field_query = db.query(models.FormField).filter(models.FormField.id == field_id, models.FormField.company_id == current_user.company_id)
    old_db_field = field_query.first()
    
    if not old_db_field: raise HTTPException(status_code=404, detail="Campo no encontrado")
    
    old_data = {
        "label": old_db_field.label, "field_type": old_db_field.field_type, 
        "required": old_db_field.required, "options": old_db_field.options,
        "is_primary": old_db_field.is_primary
    }
    
    update_data = field_in.dict(exclude_unset=True)
    if "api_name" in update_data: del update_data["api_name"]
    
    field_query.update(update_data)
    db.flush()

    if update_data.get("is_primary"):
        updated_field = field_query.first()
        form = db.query(models.Form).filter(models.Form.id == updated_field.form_id).first()
        if form and form.module_id:
            forms_in_module = [f.id for f in db.query(models.Form.id).filter(models.Form.module_id == form.module_id).all()]
            db.query(models.FormField).filter(models.FormField.company_id == current_user.company_id, models.FormField.form_id.in_(forms_in_module), models.FormField.id != updated_field.id).update({"is_primary": False}, synchronize_session=False)

    db.commit()
    updated_field = field_query.first()
    
    new_data = {
        "label": updated_field.label, "field_type": updated_field.field_type, 
        "required": updated_field.required, "options": updated_field.options,
        "is_primary": updated_field.is_primary
    }
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FIELD", action="UPDATE", entity_id=updated_field.id,
        details=f"Editó el campo '{updated_field.label}'", 
        old_value=old_data, new_value=new_data, request=request
    )
    
    return updated_field

@router.delete("/{field_id}")
def archive_field(field_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_forms")
    field = db.query(models.FormField).filter(models.FormField.id == field_id, models.FormField.company_id == current_user.company_id).first()
    if not field: raise HTTPException(status_code=404, detail="Campo no encontrado")
    
    field_name = field.label
    field.is_active = False
    db.commit()
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FIELD", action="ARCHIVE", entity_id=field_id,
        details=f"Archivó el campo '{field_name}'", request=request
    )
    
    return {"message": "Campo movido a no utilizados"}


@router.post("/{field_id}/restore", response_model=schema.FormFieldResponse)
def restore_field(field_id: int, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(deps.get_current_user)):
    check_settings_permission(db, current_user, "manage_forms")
    field = db.query(models.FormField).filter(models.FormField.id == field_id, models.FormField.company_id == current_user.company_id).first()
    if not field: raise HTTPException(status_code=404, detail="Campo no encontrado")
    
    field.is_active = True
    db.commit()
    db.refresh(field)
    
    log_global_event(
        db=db, user_id=current_user.id, company_id=current_user.company_id,
        entity_type="FIELD", action="RESTORE", entity_id=field.id,
        details=f"Restauró el campo '{field.label}'", request=request
    )
    
    return field