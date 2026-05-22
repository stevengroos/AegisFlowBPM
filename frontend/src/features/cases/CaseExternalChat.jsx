import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, User, MessageSquare } from 'lucide-react';
import api from '../../api/axios';

const CaseExternalChat = ({ caseId, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  // 🔥 SOLUCIÓN DOBLE MENSAJE: Usamos un ref para rastrear IDs y evitar duplicados
  const processedMessageIds = useRef(new Set()); 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true; // Para limpiar correctamente en StrictMode

    const initChat = async () => {
      try {
        // 1. Cargar historial
        const res = await api.get(`/api/v1/mobile/cases/${caseId}/chat`);
        
        // 🔥 SOLUCIÓN DEFINITIVA: Si React ya desmontó este componente fantasma, abortamos antes de abrir el WebSocket
        if (!isMounted) return; 

        setMessages(res.data);
        // Llenar nuestro registro de IDs
        res.data.forEach(msg => processedMessageIds.current.add(msg.id));
        setIsLoading(false);

        // 2. Conectar WebSocket solo si no está conectado
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            // Usa 127.0.0.1 o localhost según como tengas tu api.js
            const wsUrl = `ws://localhost:8000/api/v1/mobile/ws/chat/${caseId}?user_id=${currentUser.id}`;
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onmessage = (event) => {
              if (!isMounted) return;
              const incomingMessage = JSON.parse(event.data);
              
              // 🔥 FILTRO ANTI-DUPLICADOS 🔥
              if (!processedMessageIds.current.has(incomingMessage.id)) {
                  processedMessageIds.current.add(incomingMessage.id);
                  setMessages((prev) => [...prev, incomingMessage]);
              }
            };

            wsRef.current.onerror = (err) => {
              console.error('WebSocket Error:', err);
              if (isMounted) setError('Error de conexión en tiempo real.');
            };
        }

      } catch (err) {
        console.error('Error loading chat history:', err);
        if (isMounted) {
            setError('No se pudo cargar el historial del chat.');
            setIsLoading(false);
        }
      }
    };

    if (currentUser && caseId) {
      initChat();
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [caseId, currentUser]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // 🔥 MODIFICACIÓN CLAVE: Enviamos JSON con la fuente explícita 'staff' 🔥
    const payload = JSON.stringify({
      content: inputText.trim(),
      source: 'staff' // Indispensable para que el backend sepa quién habla
    });
    
    wsRef.current.send(payload);
    setInputText('');
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 bg-red-50 rounded-lg">{error}</div>;
  }

  return (
    <div className="flex flex-col h-[600px] bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* HEADER */}
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center shrink-0">
          <User size={20} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">Chat B2C: Soporte al Cliente</h3>
          <p className="text-xs text-green-500 flex items-center gap-1 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Conectado en tiempo real
          </p>
        </div>
      </div>

      {/* ÁREA DE MENSAJES */}
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="font-medium text-gray-500 dark:text-gray-400">No hay mensajes en esta operación.</p>
            <p className="text-sm">Envía el primer mensaje para iniciar la conversación.</p>
          </div>
        ) : (
          messages.map((msg) => {
            // 🔥 LÓGICA DE UI MEJORADA 🔥
            // is_from_client: True = Vino de Flutter. False = Lo enviamos nosotros desde Backoffice
            const isMe = msg.is_from_client === false;
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                
                {/* Nombre de quien envía (Solo mostramos si NO soy yo) */}
                {!isMe && (
                   <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 ml-1 uppercase tracking-wider">
                     {msg.sender_name} (CLIENTE)
                   </span>
                )}
                
                <div 
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 shadow-sm ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm'
                  }`}
                >
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                
                {/* Fecha y Hora (y mi nombre si soy empleado) */}
                <span className={`text-[10px] text-gray-400 mt-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
                  {isMe && <span className="font-bold mr-1">{msg.sender_name} • </span>}
                  {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Responder al cliente..."
            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm outline-none dark:text-white transition-all font-medium"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white p-2 w-12 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:bg-gray-300 shadow-sm"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CaseExternalChat;