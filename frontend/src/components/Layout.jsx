import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Settings, LogOut, Menu, Trash2, 
  Box, Users, Building2, Folder, FileText, Target, Briefcase,
  Bell, Eye, EyeOff, Check, AlertCircle, BarChart2
} from 'lucide-react';
import api from '../api/axios';
import DarkModeToggle from './DarkModeToggle'; 

// 🔥 IMPORTAMOS EL CONTEXTO GLOBAL 🔥
import { useAuth } from '../context/AuthContext';

const ICON_MAP = {
  box: Box, users: Users, building: Building2, folder: Folder,
  fileText: FileText, target: Target, briefcase: Briefcase
};

const SIDEBAR_AUTO_CLOSE_TIME = 5000; 

const Layout = ({ children }) => {
  const navigate = useNavigate();
  
  // Extraemos el usuario y la función de logout del Contexto Global
  const { user: userData, logout } = useAuth();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false); 
  const [dynamicModules, setDynamicModules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [showRead, setShowRead] = useState(false); 
  const bellRef = useRef(null);

  const fetchSidebarModules = async () => {
    try {
      const res = await api.get('/api/v1/modules/');
      setDynamicModules(res.data);
    } catch (error) { console.error("Error cargando módulos", error); }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/v1/notifications/');
      setNotifications(res.data);
    } catch (error) { console.error("Error cargando notificaciones", error); }
  };

  useEffect(() => {
    fetchSidebarModules();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) setIsBellOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let timeoutId;
    if (isSidebarOpen && !isHoveringSidebar) {
      timeoutId = setTimeout(() => setIsSidebarOpen(false), SIDEBAR_AUTO_CLOSE_TIME);
    }
    return () => clearTimeout(timeoutId);
  }, [isSidebarOpen, isHoveringSidebar]);

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
    if (notif.case_id) navigate(`/cases/${notif.case_id}`);
  };

  // ==========================================
  // 🔥 LÓGICA DE PERMISOS (ZERO TRUST) 🔥
  // ==========================================
  const isSuperAdmin = userData?.is_superadmin;
  const settingsPerms = userData?.permissions?.settings || {};
  const modulesPerms = userData?.permissions?.modules || {};

  const canViewDashboards = isSuperAdmin || settingsPerms.manage_dashboards === true;
  const canSeeBin = isSuperAdmin || settingsPerms.view_recycle_bin === true;
  const hasAnySettingsPerms = isSuperAdmin || Object.values(settingsPerms).some(val => val === true);

  const allowedModules = dynamicModules.filter(mod => {
    if (isSuperAdmin) return true;
    return modulesPerms[mod.id]?.view === true;
  });

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans transition-colors duration-300">
      
      <aside 
        onMouseEnter={() => setIsHoveringSidebar(true)}
        onMouseLeave={() => setIsHoveringSidebar(false)}
        className={`bg-gray-950 text-gray-300 flex flex-col border-r border-gray-800 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} z-50`}
      >
        <div className={`p-6 flex items-center ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
          <h2 className="text-2xl font-bold tracking-tight text-white">{isSidebarOpen ? "BPM" : "B"}</h2>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <NavLink to="/dashboard" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
            <LayoutDashboard size={20} className="shrink-0" />
            {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Inicio</span>}
          </NavLink>

          {canViewDashboards && (
            <NavLink to="/dashboards" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              <BarChart2 size={20} className="shrink-0" />
              {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Analítica</span>}
            </NavLink>
          )}

          {allowedModules.length > 0 && isSidebarOpen && (
            <div className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase text-gray-500 tracking-widest whitespace-nowrap">Módulos</div>
          )}
          
          {allowedModules.map((mod) => {
            const Icon = ICON_MAP[mod.icon] || Box;
            return (
              <NavLink 
                key={mod.id} 
                to={`/modules/${mod.id}`}
                className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800/50'}`}
              >
                <Icon size={20} className="shrink-0" />
                {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">{mod.name}</span>}
              </NavLink>
            );
          })}

          {(hasAnySettingsPerms || canSeeBin) && <div className="border-t border-gray-800 my-4"></div>}

          {hasAnySettingsPerms && (
            <NavLink to="/settings" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              <Settings size={20} className="shrink-0" />
              {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Configuración</span>}
            </NavLink>
          )}
          
          {canSeeBin && (
            <NavLink to="/recycle-bin" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              <Trash2 size={20} className="shrink-0" />
              {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Papelera</span>}
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button onClick={() => logout('manual')} className="flex items-center w-full p-3 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors text-gray-400">
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shrink-0 relative z-40">
          
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <Menu size={24} />
          </button>

          <div className="flex items-center space-x-2 sm:space-x-4">
            
            <div className="relative" ref={bellRef}>
              <button 
                onClick={() => setIsBellOpen(!isBellOpen)}
                className="relative p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse"></span>
                )}
              </button>

              {isBellOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Notificaciones</h3>
                    <button 
                      onClick={() => setShowRead(!showRead)}
                      className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-1.5 text-xs font-medium transition-colors"
                      title={showRead ? "Ocultar leídas" : "Mostrar leídas"}
                    >
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
                          <div 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors flex gap-3 ${!notif.is_read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                          >
                            <div className="mt-1 shrink-0">
                              {!notif.is_read ? (
                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                              ) : (
                                <Check size={14} className="text-gray-400 mt-1" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-sm truncate ${!notif.is_read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                                {notif.title}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                {notif.message}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                  {new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                {!notif.is_read && (
                                  <button 
                                    onClick={(e) => handleMarkAsRead(e, notif.id)}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                  >
                                    Marcar leída
                                  </button>
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

            <DarkModeToggle />
            
            <NavLink 
              to="/profile" 
              className="flex items-center space-x-3 border-l border-gray-200 dark:border-gray-800 pl-2 sm:pl-4 hover:opacity-80 transition-opacity cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                {userData?.first_name?.charAt(0).toUpperCase() || userData?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-sm font-bold text-gray-900 dark:text-white block leading-tight">
                  {userData?.first_name ? `${userData.first_name} ${userData.last_name || ''}` : (userData?.email?.split('@')[0] || 'Usuario')}
                </span>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block leading-tight mt-0.5">
                  Mi Perfil
                </span>
              </div>
            </NavLink>
          </div>
        </header>
        
        <div className="p-8 flex-1 overflow-y-auto text-gray-900 dark:text-gray-100 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;