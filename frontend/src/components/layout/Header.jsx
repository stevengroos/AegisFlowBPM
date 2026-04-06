import React from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import NotificationBell from './NotificationBell';
import DarkModeToggle from '../DarkModeToggle'; 
import { useAuth } from '../../context/AuthContext';

const Header = ({ isSidebarOpen, toggleSidebar }) => {
  const { user: userData } = useAuth();

  return (
    // 🔥 PENTEST & UX FIX: Subimos a z-[60] para que siempre esté por encima de cualquier componente
    // Y añadimos print:hidden para evitar que ensucie los reportes PDF
    <header className="print:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shrink-0 relative z-[60]">
      
      <button 
        onClick={toggleSidebar} 
        aria-label={isSidebarOpen ? "Contraer menú" : "Expandir menú"}
        aria-expanded={isSidebarOpen}
        className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Menu size={24} aria-hidden="true" />
      </button>

      <div className="flex items-center space-x-2 sm:space-x-4">
        
        <NotificationBell />
        <DarkModeToggle />
        
        <NavLink 
          to="/profile" 
          aria-label="Ver mi perfil"
          className="flex items-center space-x-3 border-l border-gray-200 dark:border-gray-800 pl-2 sm:pl-4 hover:opacity-80 transition-opacity cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors" aria-hidden="true">
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
  );
};

export default Header;