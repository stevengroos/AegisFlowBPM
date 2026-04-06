import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SsoSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  useEffect(() => {
    // 1. Extraemos el token de la URL: /sso-success?token=eyJhbGci...
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      // 2. Lo guardamos en la bóveda fuerte del navegador
      localStorage.setItem('token', token);
      
      // 3. Forzamos una recarga limpia para que el AuthContext global lea el nuevo token 
      // y configure los escudos de ISO 27001 (Inactividad).
      window.location.href = '/dashboard';
    } else {
      // Si alguien entra a esta URL sin token por error, lo devolvemos al login
      navigate('/login');
    }
  }, [location, navigate, setUser]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
      <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Autenticando con Proveedor...</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Validando credenciales seguras. Por favor espera.</p>
    </div>
  );
};

export default SsoSuccess;