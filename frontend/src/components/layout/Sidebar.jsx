import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, LogOut, Trash2, Box, Users, Building2, Folder, FileText, Target, Briefcase, BarChart2, ChevronDown, ChevronRight, FolderOpen, Shield } from 'lucide-react'; // 🔥 Agregamos Shield
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const ICON_MAP = { box: Box, users: Users, building: Building2, folder: Folder, folderOpen: FolderOpen, fileText: FileText, target: Target, briefcase: Briefcase };
const SIDEBAR_AUTO_CLOSE_TIME = 5000;

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const { user: userData, logout } = useAuth();
  
  const [modules, setModules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expandedCats, setExpandedCats] = useState({});
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchSidebarData = async () => {
      try {
        const [catsRes, modsRes] = await Promise.all([
          api.get('/api/v1/modules/categories/', { signal: controller.signal }),
          api.get('/api/v1/modules/', { signal: controller.signal })
        ]);
        setCategories(catsRes.data);
        setModules(modsRes.data);
      } catch (error) {
        if (error.name !== 'CanceledError') console.error("Error cargando datos del sidebar", error);
      }
    };
    fetchSidebarData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let timeoutId;
    if (isSidebarOpen && !isHoveringSidebar) {
      timeoutId = setTimeout(() => setIsSidebarOpen(false), SIDEBAR_AUTO_CLOSE_TIME);
    }
    return () => clearTimeout(timeoutId);
  }, [isSidebarOpen, isHoveringSidebar, setIsSidebarOpen]);

  const toggleCategory = (catId) => {
    if (!isSidebarOpen) setIsSidebarOpen(true);
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // 🔥 Lógica de Permisos (Zero Trust) 🔥
  const isSuperAdmin = userData?.is_superadmin;
  const settingsPerms = userData?.permissions?.settings || {};
  const modulesPerms = userData?.permissions?.modules || {};

  const canViewDashboards = isSuperAdmin || settingsPerms.manage_dashboards === true;
  const canSeeBin = isSuperAdmin || settingsPerms.view_recycle_bin === true;
  const canManageSecurity = isSuperAdmin || settingsPerms.manage_security === true; // 🔥 Nuevo permiso validado
  const hasAnySettingsPerms = isSuperAdmin || Object.values(settingsPerms).some(val => val === true);

  const allowedModules = modules.filter(mod => isSuperAdmin || modulesPerms[mod.id]?.view === true);
  
  const looseModules = allowedModules.filter(mod => !mod.category_id);
  const catsWithModules = categories.map(cat => ({
    ...cat,
    modules: allowedModules.filter(mod => mod.category_id === cat.id)
  })).filter(cat => cat.modules.length > 0);

  return (
    <aside 
      onMouseEnter={() => setIsHoveringSidebar(true)}
      onMouseLeave={() => setIsHoveringSidebar(false)}
      aria-label="Menú lateral de navegación"
      className={`bg-gray-950 text-gray-300 flex flex-col border-r border-gray-800 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} z-50`}
    >
      <div className={`p-6 flex items-center ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
        <h2 className="text-2xl font-bold tracking-tight text-white">{isSidebarOpen ? "BPM" : "B"}</h2>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <NavLink to="/dashboard" aria-label="Ir al inicio" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
          <LayoutDashboard size={20} className="shrink-0" aria-hidden="true" />
          {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Inicio</span>}
        </NavLink>

        {canViewDashboards && (
          <NavLink to="/dashboards" aria-label="Ir a Analítica" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
            <BarChart2 size={20} className="shrink-0" aria-hidden="true" />
            {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Analítica</span>}
          </NavLink>
        )}

        {/* 🔥 NUEVO BOTÓN: Inteligencia de Seguridad 🔥 */}
        {canManageSecurity && (
          <NavLink to="/security-dashboard" aria-label="Ir a Inteligencia de Seguridad" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isActive ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
            <Shield size={20} className="shrink-0" aria-hidden="true" />
            {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Seguridad</span>}
          </NavLink>
        )}

        {allowedModules.length > 0 && isSidebarOpen && (
          <div className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase text-gray-500 tracking-widest whitespace-nowrap">Módulos Operativos</div>
        )}
        
        {catsWithModules.map(cat => {
            const CatIcon = ICON_MAP[cat.icon] || Folder;
            const isExpanded = expandedCats[cat.id];
            
            return (
                <div key={`cat-${cat.id}`} className="mb-1">
                    <button
                        onClick={() => toggleCategory(cat.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-400 hover:bg-gray-800/50 ${isExpanded && isSidebarOpen ? 'bg-gray-900' : ''}`}
                    >
                        <div className="flex items-center">
                            <CatIcon size={20} className="shrink-0" />
                            {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">{cat.name}</span>}
                        </div>
                        {isSidebarOpen && (
                            isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />
                        )}
                    </button>
                    
                    {isExpanded && isSidebarOpen && (
                        <div className="mt-1 ml-4 pl-3 border-l border-gray-800 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                            {cat.modules.map(mod => {
                                const ModIcon = ICON_MAP[mod.icon] || Box;
                                return (
                                    <NavLink key={mod.id} to={`/modules/${mod.id}`} aria-label={`Ir a ${mod.name}`} className={({ isActive }) => `flex items-center p-2.5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
                                        <ModIcon size={18} className="shrink-0" />
                                        <span className="ml-3 text-sm font-medium whitespace-nowrap truncate">{mod.name}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    )}
                </div>
            )
        })}

        {looseModules.map((mod) => {
          const Icon = ICON_MAP[mod.icon] || Box;
          return (
            <NavLink key={mod.id} to={`/modules/${mod.id}`} aria-label={`Ir al módulo ${mod.name}`} className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap truncate">{mod.name}</span>}
            </NavLink>
          );
        })}

        {(hasAnySettingsPerms || canSeeBin) && <div className="border-t border-gray-800 my-4" aria-hidden="true"></div>}

        {hasAnySettingsPerms && (
          <NavLink to="/settings" aria-label="Ir a Configuración" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
            <Settings size={20} className="shrink-0" aria-hidden="true" />
            {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Configuración</span>}
          </NavLink>
        )}
        
        {canSeeBin && (
          <NavLink to="/recycle-bin" aria-label="Ir a la Papelera" className={({ isActive }) => `flex items-center p-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
            <Trash2 size={20} className="shrink-0" aria-hidden="true" />
            {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Papelera</span>}
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button onClick={() => logout('manual')} aria-label="Cerrar sesión" className="flex items-center w-full p-3 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500">
          <LogOut size={20} className="shrink-0" aria-hidden="true" />
          {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;