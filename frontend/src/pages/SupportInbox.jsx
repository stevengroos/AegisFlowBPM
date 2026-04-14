import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext'; 
import { Send, User, Clock, ShieldAlert, FileText, MessageSquare, Building, Star, History, Check } from 'lucide-react';

const SupportInbox = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  
  // 🔥 NUEVO: Estado para manejar qué pestaña estamos viendo (activos o resueltos)
  const [activeTab, setActiveTab] = useState('ACTIVE'); 
  
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Cargar las sesiones desde el backend
  const fetchSessions = async () => {
    try {
      const response = await api.get('/api/v1/chat/sessions');
      // Filtramos las sesiones dependiendo de la pestaña activa
      if (activeTab === 'ACTIVE') {
        setSessions(response.data.filter(s => s.status !== 'RESOLVED'));
      } else {
        setSessions(response.data.filter(s => s.status === 'RESOLVED'));
      }
    } catch (error) {
      console.error("Error al cargar sesiones:", error);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [activeTab]); // 🔥 NUEVO: Recargar si cambiamos de pestaña

  useEffect(() => {
    // 1. Buscamos si la URL trae "?session=X"
    const searchParams = new URLSearchParams(location.search);
    const sessionIdParam = searchParams.get('session');

    // 2. Si hay un ID en la URL y ya cargaron los chats a la izquierda
    if (sessionIdParam && sessions.length > 0) {
      const targetId = parseInt(sessionIdParam);
      
      // 3. Buscamos ese chat en la lista
      const foundSession = sessions.find(s => s.id === targetId);

      // 4. Si lo encontramos y no está ya abierto, lo abrimos simulando un clic
      if (foundSession && activeSession?.id !== targetId) {
        handleSelectSession(foundSession);
        
        // 5. Limpiamos la URL (borramos el ?session=15) para que no se quede pegado 
        // y el usuario pueda navegar normalmente después.
        navigate('/support-inbox', { replace: true });
      }
    }
  }, [location.search, sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 2. Al hacer clic en un chat de la lista
  const handleSelectSession = async (session) => {
    setActiveSession(session);
    try {
      const res = await api.get(`/api/v1/chat/history/${session.id}`);
      setMessages(res.data);
    } catch (error) {
      console.error("Error cargando historial:", error);
    }

    // Si el chat ya está resuelto, NO conectamos el WebSocket (solo modo lectura)
    if (session.status === 'RESOLVED') {
       if (ws.current) ws.current.close();
       return;
    }

    if (ws.current) ws.current.close();
    const wsUrl = `ws://localhost:8000/api/v1/chat/ws/support/${session.id}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const newMsg = JSON.parse(event.data);
      setMessages((prev) => [...prev, newMsg]);
    };
  };

  // 3. Enviar mensaje
  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() || !ws.current) return;

    const payload = {
      sender_id: user.id,
      message: text,
      is_internal_note: isInternal
    };
    
    ws.current.send(JSON.stringify(payload));
    setText('');
    setIsInternal(false); 
  };

  // 4. Cerrar el chat (Resolver)
  const handleResolveSession = async () => {
    if (!activeSession) return;
    try {
      await api.put(`/api/v1/chat/resolve/${activeSession.id}`, { agent_id: user.id });
      setActiveSession(prev => ({ ...prev, status: 'RESOLVED' }));
      fetchSessions();
    } catch (error) {
      console.error("Error al resolver el chat:", error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      
      {/* ========================================== */}
      {/* COLUMNA IZQUIERDA: LISTA DE CHATS Y TABS */}
      {/* ========================================== */}
      <div className="w-1/3 min-w-[300px] border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-950">
        
        <div className="p-4 bg-indigo-600 text-white shadow-md z-10">
          <h2 className="font-bold flex items-center gap-2 mb-3">
            <ShieldAlert size={20} /> Comando HQ
          </h2>
          {/* 🔥 NUEVO: Selector de Pestañas */}
          <div className="flex bg-indigo-800/50 rounded-lg p-1">
            <button 
              onClick={() => { setActiveTab('ACTIVE'); setActiveSession(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md flex justify-center items-center gap-1 transition-colors ${activeTab === 'ACTIVE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:text-white'}`}
            >
              <MessageSquare size={14} /> Activos
            </button>
            <button 
              onClick={() => { setActiveTab('RESOLVED'); setActiveSession(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md flex justify-center items-center gap-1 transition-colors ${activeTab === 'RESOLVED' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-100 hover:text-white'}`}
            >
              <History size={14} /> Historial
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {sessions.length === 0 ? (
            <div className="text-center text-gray-500 mt-10 text-sm flex flex-col items-center gap-2">
              <MessageSquare size={32} className="opacity-20" />
              <p>No hay chats en esta bandeja.</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div 
                key={session.id}
                onClick={() => handleSelectSession(session)}
                className={`p-3 mb-2 rounded-xl cursor-pointer border transition-all hover:shadow-md ${
                  activeSession?.id === session.id 
                    ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-600' 
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    {/* 🔥 NUEVO: Mostramos el nombre real del cliente */}
                    <span className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[150px]">
                      {session.client_name}
                    </span>
                    {/* 🔥 NUEVO: Mostramos la empresa */}
                    <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
                      <Building size={10} /> {session.company_name}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    <Clock size={10} /> {new Date(session.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                
                {activeTab === 'RESOLVED' && session.csat_score && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1 text-[11px] text-gray-500">
                    <Star size={12} className="text-yellow-400 fill-current" />
                    Calificación: <span className="font-bold text-gray-700 dark:text-gray-300">{session.csat_score}/5</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* COLUMNA DERECHA: VENTANA DE CHAT */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 relative">
        {!activeSession ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-4">
            <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2 shadow-inner">
               <MessageSquare size={40} className="text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Selecciona una conversación</h3>
            <p className="text-sm">Elige un chat de la lista para ver los detalles.</p>
          </div>
        ) : (
          <>
            {/* Cabecera del Chat Activo */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  {activeSession.client_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{activeSession.client_name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Building size={12}/> {activeSession.company_name} | {activeSession.client_email}
                  </p>
                </div>
              </div>
              
              {activeSession.status !== 'RESOLVED' ? (
                <button 
                  onClick={handleResolveSession}
                  className="text-sm bg-green-50 text-green-700 border border-green-200 px-4 py-1.5 rounded-lg font-medium hover:bg-green-100 transition-colors shadow-sm"
                >
                  Marcar como Resuelto
                </button>
              ) : (
                <div className="flex flex-col items-end">
                  <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-3 py-1 rounded-full font-medium border border-gray-200 dark:border-gray-700">
                    Chat Cerrado
                  </span>
                  {activeSession.csat_score && (
                    <span className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                      Calificación: <Star size={10} className="text-yellow-400 fill-current" /> {activeSession.csat_score}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Historial de Mensajes */}
            <div className="flex-1 p-6 overflow-y-auto bg-[#F0F2F5] dark:bg-gray-950 custom-scrollbar">
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user.id;
                
                // Si el mensaje anterior es de la misma persona, no repetimos el nombre
                const showHeader = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;

                return (
                  <div key={idx} className={`mb-3 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    
                    {/* 🔥 NUEVO: Nombre de quién envió el mensaje */}
                    {showHeader && !msg.is_internal_note && (
                      <span className="text-[10px] text-gray-500 font-medium mb-1 px-1">
                        {isMe ? 'Tú (AegisFlow HQ)' : msg.sender_name}
                      </span>
                    )}

                    <div className={`px-4 py-2 rounded-2xl max-w-[70%] text-sm shadow-sm relative ${
                      msg.is_internal_note 
                        ? 'bg-yellow-100 text-yellow-900 border border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700/50 rounded-br-2xl rounded-bl-2xl' 
                        : isMe 
                          ? 'bg-indigo-600 text-white rounded-br-sm' 
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-700'
                    }`}>
                      {msg.is_internal_note && (
                        <div className="flex items-center gap-1 text-[10px] font-bold mb-1 opacity-70 border-b border-yellow-300/50 pb-1">
                          <FileText size={10} /> NOTA INTERNA DE HQ (Oculta al cliente)
                        </div>
                      )}
                      
                      <div className="leading-relaxed whitespace-pre-wrap">{msg.message}</div>
                      
                      <div className={`text-[9px] mt-1 text-right opacity-60 ${isMe && !msg.is_internal_note ? 'text-indigo-100' : 'text-gray-500'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensaje */}
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-10">
              {activeSession.status !== 'RESOLVED' ? (
                <form onSubmit={handleSend} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isInternal ? 'bg-yellow-500 border-yellow-500' : 'border-gray-300 dark:border-gray-600 group-hover:border-yellow-400'}`}>
                        {isInternal && <Check size={12} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="hidden"
                      />
                      <span className={`text-xs font-medium transition-colors ${isInternal ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>
                        Enviar como Nota Interna (Privada)
                      </span>
                    </label>
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={isInternal ? "Escribe una nota para tu equipo..." : "Escribe una respuesta para el cliente..."}
                      className={`flex-1 px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all ${
                        isInternal 
                          ? 'border-yellow-300 focus:ring-yellow-500 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-700/50 dark:text-yellow-100 placeholder-yellow-600/50' 
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900'
                      }`}
                    />
                    <button 
                      type="submit" 
                      disabled={!text.trim()} 
                      className={`px-5 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:shadow-none flex items-center justify-center ${
                        isInternal ? 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                      }`}
                    >
                      <Send size={18} className={text.trim() ? "translate-x-0.5" : ""} />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="py-3 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-center text-sm text-gray-500 dark:text-gray-400 italic border border-gray-100 dark:border-gray-800">
                  <span className="flex items-center justify-center gap-2">
                    <ShieldAlert size={16} className="text-gray-400" />
                    Este caso de soporte ha sido cerrado y archivado en el historial.
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupportInbox;