import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react'; 

const DarkModeToggle = () => {
  // Al cargar, revisamos si el usuario ya eligió un tema antes
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'light'
  );

  useEffect(() => {
    const root = window.document.documentElement; // Selecciona el tag <html>
    
    if (theme === 'dark') {
      root.classList.add('dark'); // Activa las clases dark: de Tailwind
    } else {
      root.classList.remove('dark'); // Las desactiva
    }
    
    // Guardamos la preferencia para que no se pierda al recargar
    localStorage.setItem('theme', theme); 
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <button 
      onClick={toggleTheme}
      className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
      title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
    >
      {theme === 'light' ? (
        <Moon size={18} className="text-gray-500 fill-gray-100" />
      ) : (
        <Sun size={18} className="text-yellow-400 fill-yellow-200" />
      )}
    </button>
  );
};

export default DarkModeToggle;