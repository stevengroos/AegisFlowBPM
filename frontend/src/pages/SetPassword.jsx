import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Lock, CheckCircle, Loader2, ShieldCheck, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
import DarkModeToggle from '../components/DarkModeToggle'; // Ajusta la ruta si es necesario

const SetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useNotification();
  
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 🔥 NUEVO: Estado del ojito
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirigir si no hay token (Intento de acceso directo)
  useEffect(() => {
    if (!token) {
      notify.error("Enlace de invitación inválido o ausente.");
      navigate('/login');
    }
  }, [token, navigate, notify]);

  // 🔥 Lógica UX: Comprobar si coinciden en tiempo real
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const isFormValid = passwordsMatch && password.length >= 6; // Asumimos mínimo 6 caracteres

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordsMatch) {
      return notify.warning("Las contraseñas no coinciden.");
    }

    setLoading(true);
    try {
      await api.post('/api/v1/auth/set-password', { 
        token: token,
        new_password: password 
      });
      
      setSuccess(true);
      notify.success("Contraseña establecida correctamente.");
      
      setTimeout(() => navigate('/login'), 3000);
      
    } catch (error) {
      const msg = error.response?.data?.detail || "El enlace ha expirado o es inválido.";
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 relative">
        <div className="absolute top-6 right-6"><DarkModeToggle /></div>
        <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl max-w-sm w-full text-center animate-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">¡Todo listo!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Tu cuenta ha sido activada. Redirigiéndote al inicio de sesión...</p>
          <Loader2 className="animate-spin mx-auto text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 relative">
      {/* 🔥 BOTÓN DE MODO OSCURO 🔥 */}
      <div className="absolute top-6 right-6">
         <DarkModeToggle />
      </div>

      <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activa tu cuenta</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Ingresa tu nueva contraseña para comenzar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nueva Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white"
              />
              {/* 🔥 BOTÓN DEL OJITO 🔥 */}
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Confirmar Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onPaste={(e) => e.preventDefault()} 
                className={`w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-gray-800 border rounded-xl outline-none transition-all text-gray-900 dark:text-white focus:ring-2 ${confirmPassword.length > 0 ? (passwordsMatch ? 'border-emerald-500 focus:ring-emerald-500' : 'border-red-400 focus:ring-red-400') : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500'}`}
              />
              {/* 🔥 FEEDBACK VISUAL VERDE SI COINCIDEN 🔥 */}
              {passwordsMatch && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 animate-in zoom-in">
                  <Check size={18} />
                </div>
              )}
            </div>
            
            {/* Mensaje de validación debajo del input */}
            {confirmPassword.length > 0 && (
               <p className={`text-xs mt-2 font-medium ${passwordsMatch ? 'text-emerald-500' : 'text-red-500'}`}>
                 {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
               </p>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl flex gap-3 items-start">
            <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              Asegúrate de que tu contraseña sea difícil de adivinar. Una combinación de letras, números y símbolos es ideal.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={loading || !isFormValid} // 🔥 UX: Bloqueado hasta que todo esté bien
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Activar mi cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetPassword;