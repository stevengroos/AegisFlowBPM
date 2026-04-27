import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import '../../i18n';
// 🔥 NUEVO: IMPORTAMOS EL WIDGET DEL CHAT 🔥
import SupportWidget from '../SupportWidget'; 

// 🔥 NUEVAS IMPORTACIONES PARA EL IDIOMA 🔥
import { useTranslation } from 'react-i18next';
import api from '../../api/axios'; // Verifica que la ruta de axios sea correcta

const MainLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { i18n } = useTranslation(); // 🔥 Instanciamos el motor

  // 🔥 EFECTO PARA CARGAR EL IDIOMA AL INICIAR LA APP 🔥
  useEffect(() => {
    const fetchUserLanguage = async () => {
      try {
        const res = await api.get('/api/v1/users/me');
        if (res.data && res.data.language) {
          i18n.changeLanguage(res.data.language);
        }
      } catch (error) {
        console.error("Error al sincronizar el idioma del sistema", error);
      }
    };
    fetchUserLanguage();
  }, [i18n]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans transition-colors duration-300 relative">
      
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        <Header 
          isSidebarOpen={isSidebarOpen} 
          toggleSidebar={toggleSidebar} 
        />
        
        <div className="p-8 flex-1 overflow-y-auto text-gray-900 dark:text-gray-100 custom-scrollbar">
          {/* Aquí es donde React inyecta tu Dashboard, Settings, etc. */}
          {children}
        </div>
      </main>

      {/* 🔥 NUEVO: LA BURBUJA FLOTANTE DEL CHAT 🔥 */}
      <SupportWidget />

    </div>
  );
};

export default MainLayout;