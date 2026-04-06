import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { AlertTriangle, LogOut, CheckCircle } from 'lucide-react'; 

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [timeoutMinutes, setTimeoutMinutes] = useState(15);
  
  const lastActivityRef = useRef(Date.now());
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  const navigate = useNavigate();
  const location = useLocation();

  const login = async (email, password, mfaCode = null) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', email.trim());
      formData.append('password', password);
      
      if (mfaCode) {
        formData.append('mfa_code', mfaCode);
      }

      const response = await api.post('/api/v1/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      localStorage.setItem('token', response.data.access_token);
      
      const userRes = await api.get('/api/v1/users/me');
      setUser(userRes.data);
      
      lastActivityRef.current = Date.now();
      setShowTimeoutWarning(false);
      
      navigate('/dashboard', { replace: true });
      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.detail 
        ? err.response.data.detail 
        : 'Error de conexión con el servidor. Intenta más tarde.';
        
      if (errorMessage === "MFA_REQUIRED") {
        return { success: false, requiresMfa: true };
      }
      if (errorMessage === "MFA_SETUP_REQUIRED") {
        return { success: false, requiresMfaSetup: true };
      }
        
      return { success: false, error: errorMessage };
    }
  };

  const logout = useCallback(async (reason = 'manual') => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (error) {
      console.warn("No se pudo notificar al servidor el cierre de sesión:", error);
    }

    localStorage.removeItem('token');
    setUser(null);
    setShowTimeoutWarning(false);
    
    if (reason === 'timeout') {
      window.location.href = `/login?expired=true&minutes=${timeoutMinutes}`; 
    } else {
      window.location.href = '/login'; 
    }
  }, [timeoutMinutes]);

  useEffect(() => {
    if (user) {
      api.get('/api/v1/auth/session-config')
        .then(res => {
          if (res.data?.inactivity_timeout_minutes) {
            setTimeoutMinutes(res.data.inactivity_timeout_minutes);
          }
        })
        .catch(() => console.warn("Usando tiempo de inactividad por defecto (15 min)"));
    }
  }, [user]);

  // =======================================================
  // 🔥 GUARDIÁN DE SESIÓN (ISO 27001) - LÓGICA DINÁMICA 🔥
  // =======================================================
  
  const updateActivity = useCallback(() => {
    if (!showTimeoutWarning) {
      lastActivityRef.current = Date.now();
    }
  }, [showTimeoutWarning]);

  useEffect(() => {
    if (!user) return; 

    let throttleTimer;
    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => { throttleTimer = null; }, 1000);
      updateActivity();
    };
    
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      events.forEach(e => document.removeEventListener(e, handleActivity));
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [updateActivity, user]);

  useEffect(() => {
    if (!user) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;
      const maxInactiveTime = timeoutMinutes * 60 * 1000;
      
      // 🔥 FIX: CÁLCULO DINÁMICO DEL TIEMPO DE ADVERTENCIA 🔥
      let warningDurationInMs = 60 * 1000; // Por defecto 60 segundos
      if (timeoutMinutes <= 1) {
        warningDurationInMs = 15 * 1000; // Si es de 1 min, avisa a los 15 seg
      } else if (timeoutMinutes <= 2) {
        warningDurationInMs = 30 * 1000; // Si es de 2 min, avisa a los 30 seg
      }

      const warningTime = maxInactiveTime - warningDurationInMs;

      if (inactiveTime >= maxInactiveTime) {
        logout('timeout'); 
      } else if (inactiveTime >= warningTime && !showTimeoutWarning) {
        setShowTimeoutWarning(true); 
        setCountdown(Math.ceil((maxInactiveTime - inactiveTime) / 1000));
      } else if (showTimeoutWarning) {
        setCountdown(Math.ceil((maxInactiveTime - inactiveTime) / 1000));
      }
    }, 1000); 

    return () => clearInterval(checkInterval);
  }, [user, timeoutMinutes, showTimeoutWarning, logout]);

  const stayLoggedIn = () => {
    lastActivityRef.current = Date.now();
    setShowTimeoutWarning(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/api/v1/users/me');
        setUser(res.data);
        lastActivityRef.current = Date.now(); 
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}

      {showTimeoutWarning && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-500/30">
            <div className="bg-red-500 p-6 flex flex-col items-center text-center">
              <div className="bg-white/20 p-3 rounded-full mb-3 animate-pulse">
                <AlertTriangle size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Tu sesión está a punto de expirar</h2>
              <p className="text-red-100 text-sm">Por políticas de seguridad, cerraremos tu sesión por inactividad en:</p>
              
              <div className="mt-4 text-5xl font-black text-white tabular-nums tracking-tighter">
                {countdown} <span className="text-xl font-medium text-red-200">seg</span>
              </div>
            </div>
            
            <div className="p-6 bg-white dark:bg-gray-900 flex flex-col gap-3">
              <button 
                onClick={stayLoggedIn}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <CheckCircle size={20} />
                Seguir Conectado
              </button>
              
              <button 
                onClick={() => logout('manual')}
                className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut size={20} />
                Cerrar Sesión Ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);