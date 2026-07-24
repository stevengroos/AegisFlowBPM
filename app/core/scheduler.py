import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import SessionLocal
from app.models import models

# Importamos la lógica que ya creaste para evaluar y enviar notificaciones
from app.api.v1.endpoints.cases import process_global_rules

logger = logging.getLogger(__name__)

def check_sla_breaches():
    """
    Función que el Cronjob ejecuta cada X minutos.
    Busca los casos vencidos y dispara las automatizaciones ON_SLA_BREACH.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # =================================================================
        # 🔥 MEGA OPTIMIZACIÓN: 1 Sola Consulta SQL (JOIN)
        # =================================================================
        # Unimos Case y Status. Solo traemos los casos que no estén borrados 
        # Y cuyo estado tenga un límite de SLA configurado en la base de datos.
        query_results = db.query(models.Case, models.Status).join(
            models.Status, models.Case.status_id == models.Status.id
        ).filter(
            models.Case.deleted_at.is_(None),
            models.Status.sla_hours.isnot(None) # Filtramos la basura desde SQL
        ).all()

        # Ahora iteramos desempaquetando ambos objetos (Case y Status) juntos
        for case, status in query_results:
            
            # ❌ ELIMINADO: La consulta N+1 a la tabla Status ya no existe.
                
            # 1. Calcular si ya venció
            start_time = case.entered_status_at or case.created_at
            
            # Asegurar que start_time sea aware (timezone)
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
                
            time_in_status_hours = (now - start_time).total_seconds() / 3600
            
            # 🔥 SI SE ROMPIÓ EL SLA 🔥
            if time_in_status_hours >= status.sla_hours:
                
                # Para evitar que dispare la regla CADA 5 MINUTOS infinitamente
                ui_rules = case.ui_rules or {}
                if ui_rules.get(f"sla_breached_{case.status_id}"):
                    continue # Ya disparamos la regla. Saltamos.
                
                logger.warning(f"🚨 [SLA ROTO] Caso #{case.id} venció en el estado '{status.name}'")
                
                # 2. Disparar el motor de reglas globales (ON_SLA_BREACH)
                system_user_id = case.assigned_to or case.created_by or 0
                
                process_global_rules(
                    db=db, 
                    case=case, 
                    user_id=system_user_id, 
                    event_type="ON_SLA_BREACH"
                )
                
                # 3. Marcar el caso para no volver a disparar la alarma
                ui_rules[f"sla_breached_{case.status_id}"] = True
                
                # SQLAlchemy necesita saber que el diccionario JSON mutó
                from sqlalchemy.orm.attributes import flag_modified
                case.ui_rules = ui_rules
                flag_modified(case, "ui_rules") 
                
                db.commit()

    except Exception as e:
        logger.error(f"❌ Error en el Cronjob de SLA: {str(e)}")
        db.rollback()
    finally:
        db.close()