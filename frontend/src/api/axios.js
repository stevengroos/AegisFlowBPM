import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000', // Tu servidor FastAPI
});

// 🔥 INTERCEPTOR DE PETICIONES (Seguridad Anti-Caché y Token)
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('impersonation_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Práctica de Pentest: Evitar que el navegador almacene datos sensibles en caché
  config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  config.headers['Pragma'] = 'no-cache';
  config.headers['Expires'] = '0';
  
  return config;
});

// 🔥 INTERCEPTOR DE RESPUESTAS (El Guardia Expulsor)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el backend dice 401 (No autorizado) o el token expiró/fue alterado
    if (error.response && error.response.status === 401) {
      console.warn("🛡️ Sesión expirada o inválida. Ejecutando expulsión de seguridad...");
      localStorage.removeItem('token');
      // Usamos window.location para forzar una recarga limpia y borrar la memoria de React
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';  
      }
    }
    return Promise.reject(error);
  }
);

export default api;