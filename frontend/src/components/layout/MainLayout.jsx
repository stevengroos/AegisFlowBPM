import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans transition-colors duration-300">
      
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

    </div>
  );
};

export default MainLayout;