import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios'; // Ajusta la ruta a tu instancia de Axios
import { useAuth } from './AuthContext'; // Para saber quién está logueado

const SupportChatContext = createContext();

export const useSupportChat = () => useContext(SupportChatContext);

export const SupportChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null); 
  const [isResolved, setIsResolved] = useState(false); // 🔥 NUEVO: Estado para saber si el chat terminó
  
  const ws = useRef(null); 

  const loadHistory = async (sid) => {
    try {
      const response = await api.get(`/api/v1/chat/history/${sid}`); 
      setMessages(response.data);
    } catch (error) {
      console.error("Error cargando historial del chat:", error);
    }
  };

  const connectWebSocket = useCallback((sid) => {
    if (ws.current) ws.current.close(); 

    const wsUrl = `ws://localhost:8000/api/v1/chat/ws/support/${sid}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => console.log("Túnel de chat abierto 🟢");
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // 🔥 NUEVO: Detectar si el backend envía la señal de que el chat se cerró
      if (data.type === "SYSTEM_EVENT" && data.event === "SESSION_RESOLVED") {
        setIsResolved(true);
        if (ws.current) ws.current.close(); // Cerramos el túnel del lado del cliente
      } else {
        setMessages((prev) => [...prev, data]);
      }
    };

    ws.current.onclose = () => console.log("Túnel de chat cerrado 🔴");
  }, []);

  const startChat = async () => {
    try {
      setIsResolved(false); // 🔥 NUEVO: Reiniciamos el estado por si abre un chat nuevo
      
      const response = await api.post('/api/v1/chat/session', {
        company_id: user.company_id,
        client_user_id: user.id
      });
      
      const sid = response.data.session_id; 
      setSessionId(sid);
      
      await loadHistory(sid);
      connectWebSocket(sid);
      setIsOpen(true);
    } catch (error) {
      console.error("Error al iniciar el chat:", error);
    }
  };

  const sendMessage = (text) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const payload = {
        sender_id: user?.id,
        message: text,
        is_internal_note: false 
      };
      ws.current.send(JSON.stringify(payload));
    }
  };

  return (
    <SupportChatContext.Provider value={{ 
      isOpen, setIsOpen, messages, startChat, sendMessage, sessionId,
      isResolved, setSessionId, setMessages // 🔥 NUEVO: Exportamos las nuevas herramientas
    }}>
      {children}
    </SupportChatContext.Provider>
  );
};