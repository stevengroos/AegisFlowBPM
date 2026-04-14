from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, aliased # 🔥 NUEVO: aliased para cruzar tablas
from app.db.session import get_db
from app.models import models
from app.core.websockets import manager
import json
from typing import List
from app.schemas import chat as chat_schemas # 🔥 Usamos los esquemas importados
from app.api import deps
from datetime import datetime, timezone
import asyncio # 🔥 NUEVO: Importamos asyncio para tareas en segundo plano
from app.core.emails import send_support_notification_async # 🔥 NUEVO: Nuestro cartero

router = APIRouter()

# ==========================================
# ENDPOINT HTTP: Crear o recuperar sesión
# ==========================================
@router.post("/session")
def create_or_get_session(
    data: chat_schemas.SessionCreate, # 🔥 FIX: Usamos el esquema limpio
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if current_user.id != data.client_user_id:
        raise HTTPException(status_code=403, detail="No puedes crear un chat para otro usuario.")

    session = db.query(models.SupportSession).filter(
        models.SupportSession.client_user_id == data.client_user_id,
        models.SupportSession.status != "RESOLVED"
    ).first()

    if not session:
        session = models.SupportSession(
            company_id=data.company_id,
            client_user_id=data.client_user_id,
            status="WAITING"
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    
    return {"session_id": session.id}

# ==========================================
# ENDPOINT HTTP: Listar sesiones activas e historial (Para el Agente)
# ==========================================
@router.get("/sessions", response_model=List[chat_schemas.SupportSessionResponse])
def get_active_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    if not current_user.is_superadmin or not company.is_system_company:
        raise HTTPException(status_code=403, detail="Acceso denegado: Área exclusiva de AegisFlow HQ.")

    ClientUser = aliased(models.User)
    AgentUser = aliased(models.User)

    results = db.query(
        models.SupportSession,
        models.Company.name.label("company_name"),
        ClientUser.first_name.label("client_first"),
        ClientUser.last_name.label("client_last"),
        ClientUser.email.label("client_email"),
        AgentUser.first_name.label("agent_first"),
        AgentUser.last_name.label("agent_last")
    ).join(
        models.Company, models.SupportSession.company_id == models.Company.id
    ).join(
        ClientUser, models.SupportSession.client_user_id == ClientUser.id
    ).outerjoin(
        AgentUser, models.SupportSession.agent_user_id == AgentUser.id
    ).order_by(   # 🔥 FIX: Aquí está la corrección clave (order_by en lugar de filter)
        models.SupportSession.started_at.desc()
    ).limit(100).all()

    response = []
    for session, comp_name, c_first, c_last, c_email, a_first, a_last in results:
        c_name = f"{c_first or ''} {c_last or ''}".strip() or "Usuario"
        a_name = f"{a_first or ''} {a_last or ''}".strip() if a_first else None
        
        response.append({
            "id": session.id,
            "company_id": session.company_id,
            "company_name": comp_name,
            "client_user_id": session.client_user_id,
            "client_name": c_name,
            "client_email": c_email,
            "agent_user_id": session.agent_user_id,
            "agent_name": a_name,
            "status": session.status,
            "started_at": session.started_at,
            "resolved_at": session.resolved_at,
            "csat_score": session.csat_score,
            "csat_comment": session.csat_comment
        })
    
    return response

# ==========================================
# ENDPOINT HTTP: Traer el historial del chat
# ==========================================
@router.get("/history/{session_id}", response_model=List[chat_schemas.ChatMessageResponse])
def get_chat_history(
    session_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    session = db.query(models.SupportSession).filter(models.SupportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    # 🔥 FIX OMNIPRESENCIA: Usamos la identidad original
    original_company_id = getattr(current_user, 'real_company_id', current_user.company_id)
    company = db.query(models.Company).filter(models.Company.id == original_company_id).first()
    is_hq_agent = current_user.is_superadmin and company.is_system_company
    
    if not is_hq_agent and session.client_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para leer este chat.")

    # 🔥 FIX JOINS: Traer el nombre del remitente en el historial
    query = db.query(
        models.ChatMessage,
        models.User.first_name,
        models.User.last_name
    ).outerjoin(
        models.User, models.ChatMessage.sender_id == models.User.id
    ).filter(
        models.ChatMessage.session_id == session_id
    )
    
    if not is_hq_agent:
        query = query.filter(models.ChatMessage.is_internal_note == False)
        
    messages = query.order_by(models.ChatMessage.created_at.asc()).all()
    
    response = []
    for msg, f_name, l_name in messages:
        sender_name = f"{f_name or ''} {l_name or ''}".strip() if f_name else "Sistema"
        response.append({
            "id": msg.id,
            "session_id": msg.session_id,
            "sender_id": msg.sender_id,
            "sender_name": sender_name,
            "message": msg.message,
            "is_internal_note": msg.is_internal_note,
            "created_at": msg.created_at
        })
        
    return response

@router.websocket("/ws/support/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: int, db: Session = Depends(get_db)):
    support_session = db.query(models.SupportSession).filter(models.SupportSession.id == session_id).first()
    if not support_session:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, session_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            sender_id = message_data.get("sender_id")
            text_content = message_data.get("message")
            is_internal = message_data.get("is_internal_note", False)

            # 1. Guardar mensaje en DB
            new_message = models.ChatMessage(
                session_id=session_id,
                sender_id=sender_id,
                message=text_content,
                is_internal_note=is_internal
            )
            db.add(new_message)
            db.commit()
            db.refresh(new_message)

            # Buscamos quién envió para ponerle nombre en el chat
            sender = db.query(models.User).filter(models.User.id == sender_id).first()
            sender_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip() if sender else "Sistema"

            # 2. Empujar mensaje por WebSocket
            await manager.broadcast_to_session({
                "id": new_message.id,
                "session_id": session_id,
                "sender_id": sender_id,
                "sender_name": sender_name, 
                "message": text_content,
                "is_internal_note": is_internal,
                "created_at": new_message.created_at.isoformat()
            }, session_id)

            # =========================================================
            # 🔥 MAGIA OMNICANAL: NOTIFICACIONES (CAMPANITA Y CORREO) 🔥
            # =========================================================
            # Solo notificamos si el que escribió fue el cliente (no queremos que el agente se notifique a sí mismo)
            if sender_id == support_session.client_user_id:
                agents_to_notify = []
                
                # A) Si el chat ya tiene agente asignado, solo le avisamos a él
                if support_session.agent_user_id:
                    agent = db.query(models.User).filter(models.User.id == support_session.agent_user_id).first()
                    if agent: 
                        agents_to_notify.append(agent)
                # B) Si es un chat nuevo sin asignar, le avisamos a TODOS los SuperAdmins de HQ
                else:
                    system_company = db.query(models.Company).filter(models.Company.is_system_company == True).first()
                    if system_company:
                        agents_to_notify = db.query(models.User).filter(
                            models.User.company_id == system_company.id,
                            models.User.is_superadmin == True
                        ).all()

                for agent in agents_to_notify:
                    # -- 1. CREAR NOTIFICACIÓN PARA LA CAMPANITA --
                    resumen_msg = f"{text_content[:40]}..." if len(text_content) > 40 else text_content
                    notification = models.Notification(
                        company_id=agent.company_id,
                        user_id=agent.id,
                        title=f"Soporte: {sender_name}",
                        message=f"Caso #{session_id}: {resumen_msg}"
                    )
                    db.add(notification)

                    # -- 2. DISPARAR CORREO EN SEGUNDO PLANO --
                    html_email = f"""
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white;">
                            <h2 style="margin: 0;">💬 Nuevo Mensaje de Soporte</h2>
                        </div>
                        <div style="padding: 20px;">
                            <p>Hola <b>{agent.first_name or 'Equipo'}</b>,</p>
                            <p>El cliente <b>{sender_name}</b> ha enviado un nuevo mensaje en el caso <b>#{session_id}</b>:</p>
                            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-left: 4px solid #4f46e5; border-radius: 4px; font-style: italic;">
                                {text_content}
                            </div>
                            <p style="margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center;">Accede a la plataforma para responder.</p>
                        </div>
                    </div>
                    """
                    # Usamos asyncio.create_task para que no se congele el chat mientras se envía el correo
                    asyncio.create_task(
                        send_support_notification_async(
                            db, agent.company_id, agent.email, 
                            f"Nuevo mensaje en caso #{session_id}", html_email
                        )
                    )
                
                # Guardamos las notificaciones de la campanita en la BD
                db.commit()

    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
        
# ==========================================
# ENDPOINT HTTP: Resolver el Chat (SOLO PARA HQ)
# ==========================================
@router.put("/resolve/{session_id}")
async def resolve_session(
    session_id: int,
    data: chat_schemas.SessionResolve,
    background_tasks: BackgroundTasks, # 🔥 NUEVO: Recibimos tareas de fondo
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # 🔥 FIX OMNIPRESENCIA: Usamos la identidad original
    original_company_id = getattr(current_user, 'real_company_id', current_user.company_id)
    company = db.query(models.Company).filter(models.Company.id == original_company_id).first()
    
    if not current_user.is_superadmin or not company.is_system_company:
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    session = db.query(models.SupportSession).filter(models.SupportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    session.status = "RESOLVED"
    session.agent_user_id = data.agent_id
    session.resolved_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # ==========================================
    # 🔥 MAGIA: GENERAR Y ENVIAR TRANSCRIPT 🔥
    # ==========================================
    try:
        # 1. Traemos los usuarios involucrados
        client = db.query(models.User).filter(models.User.id == session.client_user_id).first()
        agent = db.query(models.User).filter(models.User.id == data.agent_id).first()
        
        # 2. Traemos todos los mensajes (SIN incluir notas internas)
        messages = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == session_id,
            models.ChatMessage.is_internal_note == False
        ).order_by(models.ChatMessage.created_at.asc()).all()
        
        # 3. Armamos el HTML iterando los mensajes
        chat_html = ""
        for msg in messages:
            is_client = msg.sender_id == client.id
            sender_name = client.first_name if is_client else "Soporte AegisFlow"
            
            # Estilos tipo "burbuja"
            color = "#4f46e5" if not is_client else "#374151"
            bg_color = "#e0e7ff" if not is_client else "#f3f4f6"
            align = "left" if not is_client else "right"
            
            # Limpiamos la etiqueta de shadowing (para que no salga feo en el correo)
            text = msg.message
            if is_client and "[📍 Pantalla actual:" in text:
                text = text.split(']\n')[1] if ']\n' in text else text
                
            chat_html += f"""
            <div style="margin-bottom: 10px; padding: 12px; background-color: {bg_color}; border-radius: 8px; text-align: left;">
                <strong style="color: {color}; font-size: 12px;">{sender_name}</strong>
                <div style="margin-top: 4px; font-size: 14px; color: #111827; white-space: pre-wrap;">{text}</div>
            </div>
            """
        
        # 4. Plantilla de correo corporativa
        full_html = f"""
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white;">
                <h2 style="margin: 0;">💬 Resumen de tu Chat de Soporte</h2>
            </div>
            <div style="padding: 20px;">
                <p>Hola <b>{client.first_name or 'Usuario'}</b>,</p>
                <p>Tu sesión de soporte <b>#{session_id}</b> ha sido resuelta y cerrada por <b>{agent.first_name or 'nuestro equipo'}</b>. Aquí tienes una copia de la conversación para tus registros:</p>
                
                <div style="margin-top: 20px; border-left: 3px solid #e5e7eb; padding-left: 10px;">
                    {chat_html}
                </div>
                
                <p style="margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center;">Si necesitas más ayuda, puedes abrir un nuevo chat en la plataforma.</p>
            </div>
        </div>
        """
        
        # 5. Enviamos la tarea en segundo plano sin bloquear el cierre del chat
        from app.core.emails import send_support_transcript_async
        background_tasks.add_task(
            send_support_transcript_async,
            db, session.company_id, client.email, agent.email, session_id, full_html
        )
    except Exception as e:
        print("Error al generar transcript:", e)

    # ==========================================
    # Avisamos al WebSocket del cliente
    try:
        await manager.broadcast_to_session({
            "type": "SYSTEM_EVENT",
            "event": "SESSION_RESOLVED"
        }, session_id)
    except Exception as e:
        print("No se pudo notificar cierre por websocket", e)

    return {"message": "Chat resuelto exitosamente"}

# ==========================================
# ENDPOINT HTTP: Calificación del Cliente (CSAT)
# ==========================================
@router.put("/session/{session_id}/csat")
def submit_csat(
    session_id: int,
    data: chat_schemas.CSATSubmit, # 🔥 FIX: Usamos el esquema
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    session = db.query(models.SupportSession).filter(models.SupportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
    if session.client_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el cliente de este chat puede calificarlo.")
        
    if data.score < 1 or data.score > 5:
        raise HTTPException(status_code=400, detail="La calificación debe ser del 1 al 5.")

    session.csat_score = data.score
    session.csat_comment = data.comment
    db.commit()
    
    return {"message": "¡Gracias por tu feedback!"}