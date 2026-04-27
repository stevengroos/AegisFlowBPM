import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import DarkModeToggle from '../../components/DarkModeToggle'; 
import { useAuth } from '../../context/AuthContext'; 
import { QRCodeSVG } from 'qrcode.react'; 
import api from '../../api/axios'; 
import { ShieldAlert, ShieldCheck, Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const { login, user } = useAuth(); 
  const navigate = useNavigate();
  const location = useLocation(); // 🔥 NUEVO: Para leer los parámetros de la URL
  
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [status, setStatus] = useState({ loading: false, error: '', info: '' });
  const [showPassword, setShowPassword] = useState(false);

  // ESTADOS PARA MULTIFACTOR (MFA)
  const [mfaStep, setMfaStep] = useState('LOGIN'); // 'LOGIN' | 'MFA_INPUT' | 'MFA_SETUP'
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSetupData, setMfaSetupData] = useState({ secret: '', qrUrl: '' });
  const [setupLoading, setSetupLoading] = useState(false);

  // =======================================================
  // 🔥 CAZADOR DE URL: Atrapa los eventos de SSO 🔥
  // =======================================================
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const ssoMfa = params.get('sso_mfa_required');
    const ssoEmail = params.get('email');
    const tempToken = params.get('temp_token');

    // Caso A: Error en el SSO
    if (error) {
      const errorMsgs = {
        sso_failed: "Inicio de sesión con proveedor externo cancelado o fallido.",
        sso_no_email: "No se pudo obtener el correo del proveedor de identidad.",
        sso_user_not_found: "Este correo no está registrado en la empresa. Pide al administrador que te invite primero.",
        account_disabled: "Tu cuenta está inactiva o bloqueada."
      };
      setStatus({ loading: false, error: errorMsgs[error] || "Error en inicio de sesión SSO.", info: '' });
      // Limpiar URL
      window.history.replaceState({}, document.title, "/login");
    }

    // Caso B: SSO Exitoso, pero la Empresa EXIGE MFA Nativo
    if (ssoMfa === 'true' && tempToken && ssoEmail) {
      localStorage.setItem('token', tempToken); // Guardamos el token provisional
      setCredentials(prev => ({ ...prev, email: ssoEmail }));
      setMfaStep('MFA_INPUT');
      setStatus({ loading: false, error: '', info: 'Google verificó tu identidad, pero las políticas de tu empresa requieren doble factor.' });
      window.history.replaceState({}, document.title, "/login");
    }
  }, [location]);

  // 🔥 GUARDIÁN: Redirigir al dashboard SOLO si está logueado y no está en medio del MFA
  useEffect(() => {
    if (user && mfaStep === 'LOGIN') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate, mfaStep]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleMfaChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setMfaCode(value);
  };

  // 1. EL LOGIN LOCAL INICIAL
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!credentials.email.includes('@') || credentials.password.length < 4) {
      setStatus({ loading: false, error: 'Credenciales inválidas.', info: '' });
      return;
    }
    setStatus({ loading: true, error: '', info: '' }); 
    
    const result = await login(credentials.email, credentials.password);
    
    if (result.requiresMfa) {
      setMfaStep('MFA_INPUT'); 
      setStatus({ loading: false, error: '', info: '' }); 
    } else if (result.requiresMfaSetup) {
      setStatus({ loading: false, error: '', info: '' }); 
      fetchMfaSetupData(); 
    } else if (!result.success) {
      setStatus({ loading: false, error: result.error, info: '' }); 
    }
  };

  useEffect(() => {
    if (mfaStep !== 'LOGIN') {
      const timer = setTimeout(() => {
        const input = document.querySelector('input[placeholder="000000"]');
        if (input) input.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mfaStep]);
  
  // 2. OBTENER CÓDIGO QR 
  const fetchMfaSetupData = async () => {
    try {
      setSetupLoading(true);
      const formData = new URLSearchParams();
      formData.append('username', credentials.email.trim());
      formData.append('password', credentials.password);
      formData.append('request_mfa_setup_token', 'true'); 

      const loginRes = await api.post('/api/v1/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      localStorage.setItem('token', loginRes.data.access_token);

      const qrRes = await api.post('/api/v1/auth/mfa/setup');
      setMfaSetupData({ secret: qrRes.data.secret, qrUrl: qrRes.data.qr_code_url });
      setMfaStep('MFA_SETUP');
    } catch (err) {
      setStatus({ loading: false, error: 'No se pudo generar el código QR. Intenta de nuevo.', info: '' });
      localStorage.removeItem('token');
    } finally {
      setSetupLoading(false);
    }
  };

  // 3. ENVIAR EL CÓDIGO DE 6 DÍGITOS
  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    if (mfaCode.length !== 6) {
      setStatus({ loading: false, error: 'El código debe tener 6 dígitos.', info: '' });
      return;
    }
    
    setStatus({ loading: true, error: '', info: '' });
    
    if (mfaStep === 'MFA_SETUP') {
      try {
        await api.post('/api/v1/auth/mfa/verify', { code: mfaCode });
        // Aquí pasamos una clave vacía temporalmente si venimos por SSO
        const pass = credentials.password || "sso_dummy_pass";
        const result = await login(credentials.email, pass, mfaCode);
        if (!result.success) setStatus({ loading: false, error: result.error, info: '' });
      } catch (err) {
        setStatus({ loading: false, error: err.response?.data?.detail || 'Código incorrecto.', info: '' });
      }
    } else {
        const pass = credentials.password || "sso_dummy_pass";
        const result = await login(credentials.email, pass, mfaCode);
        if (!result.success) setStatus({ loading: false, error: result.error, info: '' });
    }
  };

  const goBack = () => {
    setMfaStep('LOGIN');
    setMfaCode('');
    setStatus({ loading: false, error: '', info: '' });
    localStorage.removeItem('token'); 
  };

  // 🔥 Función para redireccionar al backend para iniciar el SSO
  const handleSSO = (provider) => {
    // Apuntamos directo a tu backend FastAPI
    window.location.href = `http://localhost:8000/api/v1/auth/sso/${provider}/login`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors duration-300 relative p-4 font-sans">
      <div className="absolute top-6 right-6">
        <DarkModeToggle />
      </div>

      <div className="bg-white dark:bg-gray-900 p-10 rounded-2xl shadow-2xl dark:shadow-black/40 w-full max-w-md border border-gray-100 dark:border-gray-800 transition-colors duration-300 relative">
        
        {/* ========================================= */}
        {/* PANTALLA 1: LOGIN NORMAL Y BOTONES SSO */}
        {/* ========================================= */}
        {mfaStep === 'LOGIN' && (
          <div className="animate-in fade-in duration-500">
            <h1 className="text-3xl font-extrabold text-center text-blue-600 dark:text-blue-500 mb-2 tracking-tight">
              AegisFlow
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-6 text-sm">
              Accede a tu espacio de trabajo
            </p>
            
            {status.error && (
              <div role="alert" className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 p-3 mb-6 text-sm rounded flex items-start gap-2">
                <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                <span>{status.error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} noValidate>
              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email</label>
                <input 
                  name="email" type="email" autoComplete="username" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="tu@email.com" value={credentials.email} onChange={handleChange} disabled={status.loading || setupLoading} required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Contraseña</label>
                <div className="relative">
                  <input 
                    name="password" 
                    // 🔥 Aquí cambiamos dinámicamente entre text y password
                    type={showPassword ? "text" : "password"} 
                    autoComplete="current-password" 
                    // 🔥 Le agregamos 'pr-12' para que el texto no se monte encima del ícono
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="••••••••" 
                    value={credentials.password} 
                    onChange={handleChange} 
                    disabled={status.loading || setupLoading} 
                    required
                  />
                  
                  {/* 🔥 EL BOTÓN DEL OJITO 🔥 */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={status.loading || setupLoading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" disabled={status.loading || setupLoading} 
                className={`w-full flex justify-center items-center py-3 rounded-xl font-bold text-white transition-all shadow-md ${status.loading || setupLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
              >
                {status.loading || setupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Iniciar Sesión'}
              </button>
            </form>

            {/* 🔥 SECCIÓN SINGLE SIGN-ON (SSO) 🔥 */}
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white dark:bg-gray-900 text-gray-500 text-xs font-bold uppercase tracking-widest">
                    O continuar con
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSSO('google')}
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors shadow-sm"
                >
                  {/* Ícono SVG nativo de Google */}
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
                </button>

                <button
                  type="button"
                  onClick={() => handleSSO('microsoft')}
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors shadow-sm"
                >
                  {/* Ícono SVG nativo de Microsoft */}
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                  Microsoft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* PANTALLA 2: PEDIR CÓDIGO (O ESCANEAR QR) */}
        {/* ========================================= */}
        {mfaStep !== 'LOGIN' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <button onClick={goBack} disabled={status.loading} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors mb-4 flex items-center gap-1 text-sm font-medium">
              <ArrowLeft size={16} /> Cancelar y Volver
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 border border-blue-100 dark:border-blue-800/50">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Doble Factor de Seguridad</h2>
              
              {status.info && (
                 <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2 px-2 bg-amber-50 dark:bg-amber-900/20 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50">
                    {status.info}
                 </p>
              )}

              {mfaStep === 'MFA_SETUP' ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Escanea este código QR con tu aplicación autenticadora (Google Authenticator, Authy) para vincular tu dispositivo.</p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Abre tu aplicación de autenticación y escribe el código de seguridad de 6 dígitos.</p>
              )}
            </div>

            {status.error && (
              <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 p-3 mb-6 text-sm rounded-lg text-center font-medium">
                {status.error}
              </div>
            )}

            <form onSubmit={handleVerifyMfa}>
              {mfaStep === 'MFA_SETUP' && mfaSetupData.qrUrl && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-center mb-6 max-w-[200px] mx-auto transition-transform hover:scale-105">
                  <QRCodeSVG value={mfaSetupData.qrUrl} size={150} level="M" />
                </div>
              )}

              <div className="mb-8">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength="6"
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-white text-center text-3xl tracking-[0.4em] font-mono outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 shadow-inner"
                    placeholder="000000" value={mfaCode} onChange={handleMfaChange} disabled={status.loading} autoFocus required
                  />
                </div>
              </div>

              <button 
                type="submit" disabled={status.loading || mfaCode.length !== 6} 
                className={`w-full flex justify-center items-center py-3.5 rounded-xl font-bold text-white transition-all shadow-md ${status.loading || mfaCode.length !== 6 ? 'bg-blue-400 dark:bg-blue-900/50 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
              >
                {status.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mfaStep === 'MFA_SETUP' ? 'Verificar y Entrar' : 'Autorizar Ingreso')}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default Login;