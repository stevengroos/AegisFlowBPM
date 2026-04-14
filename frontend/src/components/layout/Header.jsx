import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, ShieldAlert, LogOut, Building, Search, ChevronDown, Loader2 } from 'lucide-react';
import NotificationBell from './NotificationBell';
import DarkModeToggle from '../DarkModeToggle'; 
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios'; 

// =========================================================
// 🔥 COMPONENTE SELECT2 CUSTOM (Buscador + Paginación) 🔥
// =========================================================
const CompanySelect2 = ({ onImpersonate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const limit = 10; // Paginado de a 10

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Función para buscar en el backend
  const fetchCompanies = async (currentSearch, currentPage, isNewSearch = false) => {
    setLoading(true);
    try {
      const skip = currentPage * limit;
      const url = `/api/v1/auth/companies?limit=${limit}&skip=${skip}${currentSearch ? `&search=${currentSearch}` : ''}`;
      const res = await api.get(url);
      
      const newData = res.data;
      if (isNewSearch) {
        setCompanies(newData);
      } else {
        setCompanies(prev => [...prev, ...newData]);
      }
      
      setHasMore(newData.length === limit); // Si trajo 10, asumimos que hay más
    } catch (error) {
      console.error("Error cargando empresas", error);
    } finally {
      setLoading(false);
    }
  };

  // Efecto cuando se abre el select o se escribe en el buscador
  // Efecto cuando se abre el select o se escribe en el buscador
  useEffect(() => {
    if (isOpen) {
      // 🔥 DEBOUNCE: Esperamos 300ms después de que deje de escribir para buscar
      const delay = setTimeout(() => {
        setPage(0);
        fetchCompanies(search, 0, true);
      }, 300);
      
      // Si el usuario escribe otra letra antes de los 300ms, borramos el temporizador anterior
      return () => clearTimeout(delay);
    }
  }, [search, isOpen]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCompanies(search, nextPage, false);
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      {/* Botón Principal (Imita un select) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-64 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm rounded-lg hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
      >
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 overflow-hidden">
          <Building size={14} className="shrink-0" />
          <span className="truncate whitespace-nowrap">Asumir identidad...</span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menú Desplegable */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* ========================================== */}
          {/* 🔥 BUSCADOR INTEGRADO CON FIX DE MODO OSCURO 🔥 */}
          {/* ========================================== */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // 🔥 FIX APLICADO AQUÍ 👇
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors
                         text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              autoFocus
            />
          </div>

          {/* Lista de Resultados */}
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {companies.length === 0 && !loading && (
              // 🔥 PEQUEÑO FIX DE CONTRASTE AQUÍ TAMBIÉN 👇
              <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">No se encontraron empresas.</div>
            )}
            
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => { setIsOpen(false); onImpersonate(c.id); }}
                // 🔥 FIX DE CONTRASTE DE TEXTO AQUÍ 👇
                className="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between group
                           text-gray-900 dark:text-gray-100 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <span className="truncate">{c.name}</span>
                {/* 🔥 FIX DE CONTRASTE DE TEXTO ID AQUÍ 👇 */}
                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">ID: {c.id}</span>
              </button>
            ))}
           

            {loading && (
              <div className="p-3 flex justify-center">
                <Loader2 size={16} className="animate-spin text-indigo-500" />
              </div>
            )}

            {/* Botón Cargar Más */}
            {hasMore && !loading && companies.length >= limit && (
              <div className="p-1 mt-1 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={loadMore}
                  className="w-full py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-md transition-colors"
                >
                  Cargar más resultados
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================
// 🔥 HEADER PRINCIPAL 🔥
// =========================================================
const Header = ({ isSidebarOpen, toggleSidebar }) => {
  const { user: userData } = useAuth();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedName, setImpersonatedName] = useState('');

  useEffect(() => {
    // 🔥 FIX: Leemos solo la memoria de esta pestaña
    const impName = sessionStorage.getItem('impersonating_name');
    if (impName) {
      setIsImpersonating(true);
      setImpersonatedName(impName);
    }
  }, []);

  const handleImpersonate = async (companyId) => {
    try {
      const res = await api.post(`/api/v1/auth/impersonate/${companyId}`);
      // 🔥 FIX: Guardamos la máscara SOLO en esta pestaña
      sessionStorage.setItem('impersonation_token', res.data.access_token);
      sessionStorage.setItem('impersonating_name', res.data.impersonating);
      window.location.href = '/dashboard'; 
    } catch (error) {
      console.error("Error asumiendo identidad", error);
      alert("No se pudo asumir la identidad. Verifica que la empresa esté activa.");
    }
  };

  const stopImpersonating = async () => {
    try {
      // Le avisamos al backend para el log de auditoría
      await api.post(`/api/v1/auth/impersonate/stop`);
      
      // 🔥 FIX: Destruimos la máscara de esta pestaña
      sessionStorage.removeItem('impersonation_token');
      sessionStorage.removeItem('impersonating_name');
      window.location.href = '/dashboard';
    } catch (error) {
      console.error("Error deteniendo impersonation", error);
      // Por si el backend falla, forzamos la salida localmente
      sessionStorage.removeItem('impersonation_token');
      sessionStorage.removeItem('impersonating_name');
      window.location.href = '/dashboard';
    }
  };

  return (
    <header className={`print:hidden border-b p-4 flex justify-between items-center shrink-0 relative z-[60] transition-colors duration-300 ${
      isImpersonating ? 'bg-orange-500 border-orange-600 dark:bg-orange-600 dark:border-orange-700' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
    }`}>
      
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className={`p-2 rounded-md focus:outline-none transition-colors ${
            isImpersonating ? 'text-white hover:bg-orange-600 dark:hover:bg-orange-700' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
        >
          <Menu size={24} />
        </button>

        {isImpersonating && (
          <div className="hidden md:flex items-center gap-3 bg-white/20 px-4 py-1.5 rounded-full border border-white/30 text-white animate-in fade-in zoom-in duration-300">
            <ShieldAlert size={18} className="animate-pulse" />
            <span className="text-sm font-bold tracking-wide">NAVEGANDO COMO: {impersonatedName}</span>
            <button onClick={stopImpersonating} className="ml-2 flex items-center gap-1 bg-white text-orange-600 px-3 py-1 rounded-full text-xs font-black shadow-sm hover:bg-orange-50 transition-transform hover:scale-105">
              <LogOut size={14} /> SALIR
            </button>
          </div>
        )}

        {/* 🔥 AQUÍ INYECTAMOS EL NUEVO SELECT2 */}
        {/* 🛡️ FIX: Validamos que sea SuperAdmin Y que pertenezca a la empresa del Sistema */}
        {!isImpersonating && userData?.is_superadmin && userData?.is_system_company && (
          <div className="hidden md:flex items-center gap-2">
            <CompanySelect2 onImpersonate={handleImpersonate} />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        <NotificationBell />
        <DarkModeToggle />
        
        <NavLink to="/profile" className={`flex items-center space-x-3 border-l pl-2 sm:pl-4 hover:opacity-80 transition-opacity cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
            isImpersonating ? 'border-orange-400/50' : 'border-gray-200 dark:border-gray-800'
          }`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm transition-colors ${
            isImpersonating ? 'bg-white text-orange-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white'
          }`}>
            {userData?.first_name?.charAt(0).toUpperCase() || userData?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <span className={`text-sm font-bold block leading-tight ${isImpersonating ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              {userData?.first_name ? `${userData.first_name} ${userData.last_name || ''}` : (userData?.email?.split('@')[0] || 'Usuario')}
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wider block leading-tight mt-0.5 ${isImpersonating ? 'text-orange-200' : 'text-gray-500 dark:text-gray-400'}`}>
              {isImpersonating ? 'Agente Oculto' : 'Mi Perfil'}
            </span>
          </div>
        </NavLink>
      </div>
    </header>
  );
};

export default Header;