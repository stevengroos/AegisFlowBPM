from sqlalchemy.orm import Session
from app.models import models

def setup_basic_workflow(db: Session, company_id: int):
    # 🔥 FIX ARQUITECTURA: 1. Crear el Blueprint (Flujo Maestro) primero 🔥
    default_blueprint = models.Blueprint(
        name="Flujo Principal",
        is_active=True,
        company_id=company_id
    )
    db.add(default_blueprint)
    db.commit()
    db.refresh(default_blueprint)
    
    # 2. Crear Estados Básicos (Anclados al Blueprint)
    new_status = models.Status(
        name="Nuevo", 
        company_id=company_id, 
        blueprint_id=default_blueprint.id, # 🔥 Enlace crucial
        is_initial=True
    )
    in_progress = models.Status(
        name="En Proceso", 
        company_id=company_id,
        blueprint_id=default_blueprint.id  # 🔥 Enlace crucial
    )
    done = models.Status(
        name="Finalizado", 
        company_id=company_id,
        blueprint_id=default_blueprint.id  # 🔥 Enlace crucial
    )
    
    db.add_all([new_status, in_progress, done])
    db.commit()
    
    # Refrescamos para obtener los IDs generados
    db.refresh(new_status)
    db.refresh(in_progress)
    db.refresh(done)
    
    # 3. Crear Transiciones (El camino del Blueprint)
    t1 = models.Transition(
        name="Comenzar trabajo",
        from_status_id=new_status.id,
        to_status_id=in_progress.id,
        blueprint_id=default_blueprint.id, # 🔥 Enlace crucial
        company_id=company_id
    )
    t2 = models.Transition(
        name="Completar",
        from_status_id=in_progress.id,
        to_status_id=done.id,
        blueprint_id=default_blueprint.id, # 🔥 Enlace crucial
        company_id=company_id
    )
    
    db.add_all([t1, t2])
    db.commit()
    print(f"Workflow inicial (Blueprint ID: {default_blueprint.id}) creado para la empresa {company_id}")