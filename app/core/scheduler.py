import logging
import asyncio
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
        
        # 1. Buscar todos los casos activos (no borrados y con un estado asignado)
        active_cases = db.query(models.Case).filter(
            models.Case.deleted_at == None,
            models.Case.status_id != None
        ).all()

        for case in active_cases:
            # 2. Obtener el límite del estado actual
            status = db.query(models.Status).filter(models.Status.id == case.status_id).first()
            if not status or not status.sla_hours:
                continue # Este estado no tiene límite de tiempo
                
            # 3. Calcular si ya venció
            start_time = case.entered_status_at or case.created_at
            
            # Asegurar que start_time sea aware (timezone)
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
                
            time_in_status_hours = (now - start_time).total_seconds() / 3600
            
            # 🔥 SI SE ROMPIÓ EL SLA 🔥
            if time_in_status_hours >= status.sla_hours:
                
                # Para evitar que dispare la regla CADA 5 MINUTOS infinitamente, 
                # vamos a inyectarle una "bandera" silenciosa al JSON del caso.
                ui_rules = case.ui_rules or {}
                if ui_rules.get(f"sla_breached_{case.status_id}"):
                    continue # Ya disparamos la regla para este caso en este estado. Saltamos.
                
                logger.warning(f"🚨 [SLA ROTO] Caso #{case.id} venció en el estado '{status.name}'")
                
                # 4. Disparar el motor de reglas globales (ON_SLA_BREACH)
                # Le pasamos user_id=0 (o el del creador) porque lo ejecuta el sistema
                system_user_id = case.assigned_to or case.created_by or 0
                
                # Usamos asyncio.run solo si process_global_rules usa async, pero como es síncrono, lo llamamos directo.
                # Nota: background_tasks es None aquí. Si la regla envía correos, en un script cron es mejor que el envío
                # no dependa de BackgroundTasks de FastAPI, sino que se envíe directo o usemos la sesión actual.
                process_global_rules(
                    db=db, 
                    case=case, 
                    user_id=system_user_id, 
                    event_type="ON_SLA_BREACH"
                )
                
                # 5. Marcar el caso para no volver a disparar la alarma en este mismo estado
                ui_rules[f"sla_breached_{case.status_id}"] = True
                case.ui_rules = ui_rules
                db.commit()

    except Exception as e:
        logger.error(f"❌ Error en el Cronjob de SLA: {str(e)}")
        db.rollback()
    finally:
        db.close()