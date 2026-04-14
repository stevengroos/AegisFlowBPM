import React, { useState, useRef, useEffect } from 'react';
import { useSupportChat } from '../context/SupportChatContext';
import { useAuth } from '../context/AuthContext';
import { MessageCircle, X, Send, Star, CheckCircle, MapPin } from 'lucide-react'; 
import api from '../api/axios'; 

const SupportWidget = () => {
  const { isOpen, setIsOpen, messages, startChat, sendMessage, sessionId, isResolved, setSessionId, setMessages } = useSupportChat();
  const { user } = useAuth();
  
  // 🔥 FIX FRAUDE: Ocultar si es de HQ o si está impersonando
  const isImpersonating = !!sessionStorage.getItem('impersonating_name');
  if (user?.is_system_company || isImpersonating) return null;

  const [text, setText] = useState('');
  const [rating, setRating] = useState(0); 
  const [csatComment, setCsatComment] = useState(''); 
  const [hasVoted, setHasVoted] = useState(false); 
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    // 🔥 MAGIA DE SHADOWING: Si es el primer mensaje, adjuntamos la URL actual silenciosamente
    const isFirstMessage = messages.length === 0;
    let finalMessage = text;
    
    if (isFirstMessage) {
      const currentPath = window.location.pathname;
      finalMessage = `[📍 Pantalla actual: ${currentPath}]\n${text}`;
    }

    sendMessage(finalMessage);
    setText('');
  };

  const handleCSATSubmit = async () => {
    if (rating === 0) return;
    try {
      await api.put(`/api/v1/chat/session/${sessionId}/csat`, {
        score: rating,
        comment: csatComment
      });
      setHasVoted(true);
      
      setTimeout(() => {
        setIsOpen(false);
        setSessionId(null);
        setMessages([]);
        setHasVoted(false);
        setRating(0);
        setCsatComment('');
      }, 3000);
      
    } catch (error) {
      console.error("Error enviando CSAT", error);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-4 w-80 h-96 bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-800 overflow-hidden animate-in slide-in-from-bottom-10">
          
          {/* Cabecera */}
          <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shadow-md z-10">
            <div>
              <h3 className="font-semibold leading-tight">Soporte AegisFlow</h3>
              <p className="text-[10px] text-indigo-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> En línea
              </p>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:text-gray-200 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 p-4 overflow-y-auto bg-[#F0F2F5] dark:bg-gray-950 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm mt-10 flex flex-col items-center gap-2">
                <MessageCircle size={32} className="opacity-20 text-indigo-600" />
                <p>Envíanos un mensaje y te responderemos pronto.</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                // 🛡️ FIX: Doble candado para no mostrar notas internas al cliente
                if (msg.is_internal_note) return null; 
                
                const isMe = msg.sender_id === user?.id;
                
                // Saber si debemos mostrar el nombre (si el mensaje anterior es de otra persona)
                const showHeader = index === 0 || messages[index - 1].sender_id !== msg.sender_id;

                return (
                  <div key={index} className={`mb-3 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    
                    {/* 🔥 NUEVO: Mostramos el nombre del Agente que responde */}
                    {!isMe && showHeader && (
                      <span className="text-[10px] text-gray-500 font-medium mb-1 px-1">
                        {msg.sender_name || 'Agente de Soporte'}
                      </span>
                    )}

                    <div className={`px-3 py-2.5 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-br-sm' 
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-700'
                    }`}>
                      {/* Limpiamos la etiqueta de Shadowing para que el cliente no la vea si refresca, 
                          pero el agente sí la verá en su Inbox */}
                      <div className="leading-relaxed whitespace-pre-wrap">
                         {isMe && msg.message.includes('[📍 Pantalla actual:') 
                            ? msg.message.split(']\n')[1] || msg.message 
                            : msg.message}
                      </div>
                      
                      <div className={`text-[9px] mt-1 text-right opacity-60 ${isMe ? 'text-indigo-100' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario / Calificación */}
          {!isResolved ? (
            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex items-center gap-2 z-10">
              <input 
                type="text" 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe un mensaje..." 
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button 
                type="submit" 
                disabled={!text.trim()} 
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Send size={16} className={text.trim() ? "translate-x-0.5" : ""} />
              </button>
            </form>
          ) : (
            <div className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex flex-col items-center justify-center animate-in slide-in-from-bottom-2 z-10">
              {!hasVoted ? (
                <>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">¿Cómo calificas la ayuda recibida?</p>
                  <div className="flex gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button 
                        key={star} 
                        onClick={() => setRating(star)}
                        className={`p-1 transform transition-all hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700 hover:text-yellow-200'}`}
                      >
                        <Star size={28} fill={rating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <div className="w-full flex flex-col gap-2 animate-in fade-in duration-300">
                      <input 
                        type="text" 
                        placeholder="Opcional: Déjanos un comentario..." 
                        value={csatComment}
                        onChange={(e) => setCsatComment(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button 
                        onClick={handleCSATSubmit} 
                        className="w-full py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        Enviar Calificación
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center text-green-500 py-4 animate-in zoom-in duration-300">
                  <CheckCircle size={36} className="mb-2" />
                  <p className="font-medium text-sm text-gray-700 dark:text-gray-300">¡Gracias por tu feedback!</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Botón Flotante */}
      {!isOpen && (
        <button 
          onClick={sessionId ? () => setIsOpen(true) : startChat} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-xl transform transition-all hover:scale-110 flex items-center justify-center relative group"
        >
          <MessageCircle size={28} />
          {/* Tooltip chiquito */}
          <span className="absolute -top-10 right-0 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
            ¿Necesitas ayuda?
          </span>
        </button>
      )}
    </div>
  );
};

export default SupportWidget;