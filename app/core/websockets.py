from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        # Un diccionario que guarda el ID de la sesión de soporte y una lista de conexiones activas (Cliente y Agente)
        # Ejemplo: { 5: [WebSocketCliente, WebSocketAgente] }
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: int):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: int):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_to_session(self, message: dict, session_id: int):
        """
        Envía un mensaje JSON a todos los conectados en esa sesión específica.
        """
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_json(message)

# Instancia global del manager para usarla en toda la app
manager = ConnectionManager()