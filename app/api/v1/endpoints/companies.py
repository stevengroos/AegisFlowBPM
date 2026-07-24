from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models import models
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse
# 🔥 IMPORTACIÓN CORREGIDA: Traemos get_db desde deps
from app.api.deps import get_current_user, get_db 
from app.core.global_audit import log_global_event

router = APIRouter()

def verify_superadmin(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requieren privilegios de Súper Administrador."
        )
    return current_user

@router.get("/", response_model=List[CompanyResponse])
def get_companies(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db), # 🔥 CAMBIO AQUÍ 🔥
    current_user: models.User = Depends(verify_superadmin)
):
    query = db.query(models.Company)
    if search:
        query = query.filter(models.Company.name.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()

@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    company_in: CompanyCreate,
    db: Session = Depends(get_db), # 🔥 CAMBIO AQUÍ 🔥
    current_user: models.User = Depends(verify_superadmin)
):
    existing = db.query(models.Company).filter(models.Company.name == company_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese nombre.")
    
    db_company = models.Company(
        name=company_in.name,
        is_active=company_in.is_active,
        use_custom_smtp=company_in.use_custom_smtp,
        smtp_host=company_in.smtp_host,
        smtp_port=company_in.smtp_port,
        smtp_user=company_in.smtp_user,
        smtp_password=company_in.smtp_password,
        smtp_from_email=company_in.smtp_from_email,
        is_system_company=False
    )
    db.add(db_company)
    db.commit()
    db.refresh(db_company)

    log_global_event(
        db=db,
        company_id=db_company.id,
        user_id=current_user.id,
        entity_type="Company",
        action="CREATE",
        new_value={"name": db_company.name}
    )
    return db_company

@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    company_in: CompanyUpdate,
    db: Session = Depends(get_db), # 🔥 CAMBIO AQUÍ 🔥
    current_user: models.User = Depends(verify_superadmin)
):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    update_data = company_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_company, field, value)

    db.commit()
    db.refresh(db_company)

    log_global_event(
        db=db,
        company_id=db_company.id,
        user_id=current_user.id,
        entity_type="Company",
        action="UPDATE",
        new_value=update_data
    )
    return db_company