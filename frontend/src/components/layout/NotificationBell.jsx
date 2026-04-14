import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import api from '../../api/axios'; // Ajusta la ruta a tu API

const NotificationBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [showRead, setShowRead] = useState(false); 
  const bellRef = useRef(null);

  const fetchNotifications = async (signal) => {
    try {
      const res = await api.get('/api/v1/notifications/', { signal });
      setNotifications(res.data);
    } catch (error) {
      if (error.name !== 'CanceledError') console.error("Error cargando notificaciones", error);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchNotifications(controller.signal);
    const interval = setInterval(() => fetchNotifications(controller.signal), 60000);
    
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) setIsBellOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifications = notifications.filter(n => showRead ? true : !n.is_read);

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation(); 
    try {
      await api.put(`/api/v1/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {}
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.put(`/api/v1/notifications/${notif.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (error) {}
    }
    setIsBellOpen(false);
    
    // =========================================================
    // 🔥 MAGIA DE DEEP LINKING (ENLACE PROFUNDO) 🔥
    // =========================================================
    if (notif.title.startsWith("Soporte:")) {
      // 1. Extraemos el ID del texto (ej. "Caso #15: ...") usando Regex
      const match = notif.message.match(/Caso #(\d+):/);
      if (match && match[1]) {
        // 2. Lo mandamos al Inbox con el ID en la URL
        navigate(`/support-inbox?session=${match[1]}`);
      } else {
        navigate('/support-inbox');
      }
    } 
    // Si es una notificación normal de un caso operativo
    else if (notif.case_id) {
      navigate(`/cases/${notif.case_id}`);
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      <button 
        onClick={() => setIsBellOpen(!isBellOpen)}
        aria-label="Abrir panel de notificaciones"
        aria-expanded={isBellOpen}
        className="relative p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse"></span>
        )}
      </button>

      {isBellOpen && (
        <div role="menu" aria-label="Lista de notificaciones" className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Notificaciones</h3>
            <button onClick={() => setShowRead(!showRead)} className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-1.5 text-xs font-medium transition-colors">
              {showRead ? <><EyeOff size={14}/> Ocultar Leídas</> : <><Eye size={14}/> Mostrar Historial</>}
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
                <AlertCircle size={24} className="text-gray-300 dark:text-gray-600" />
                No tienes {showRead ? 'notificaciones' : 'nuevas notificaciones'}.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredNotifications.map(notif => (
                  <div key={notif.id} role="menuitem" tabIndex={0} onClick={() => handleNotificationClick(notif)} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors flex gap-3 ${!notif.is_read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                    <div className="mt-1 shrink-0">
                      {!notif.is_read ? <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div> : <Check size={14} className="text-gray-400 mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm truncate ${!notif.is_read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{notif.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{new Date(notif.created_at).toLocaleDateString()}</span>
                        {!notif.is_read && (
                          <button onClick={(e) => handleMarkAsRead(e, notif.id)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 focus:outline-none">Marcar leída</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;