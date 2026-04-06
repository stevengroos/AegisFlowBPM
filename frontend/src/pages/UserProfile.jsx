import React, { useState, useEffect } from 'react';
import api from '../api/axios'; // 🔥 Verifica que esta ruta sea la correcta en tu proyecto
import { User, Mail, Shield, Key, Lock, Save, Loader2, CheckCircle2, Smartphone, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'; // 🔥 Importamos el generador de QR
import { useNotification } from '../context/NotificationContext';

const UserProfile = () => {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  
  // Estados para Datos Personales
  const [profileData, setProfileData] = useState({ 
    first_name: '', last_name: '', email: '', role_name: '', profile_name: '', is_mfa_enabled: false 
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Estados para Contraseña
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // 🔥 Estados para MFA 🔥
  const [mfaStatus, setMfaStatus] = useState('IDLE'); // 'IDLE' | 'LOADING' | 'SETUP'
  const [mfaQrData, setMfaQrData] = useState({ secret: '', qrUrl: '' });
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const fetchUserData = async () => {
      try {
        const res = await api.get('/api/v1/users/me', { signal: controller.signal });
        setProfileData({
          first_name: res.data.first_name || '',
          last_name: res.data.last_name || '',
          email: res.data.email || '',
          role_name: res.data.role_name || 'Sin rol',
          profile_name: res.data.profile_name || 'Sin perfil',
          is_mfa_enabled: res.data.is_mfa_enabled || false // Asumimos que el backend lo envía
        });
      } catch (error) {
        if (error.name !== 'CanceledError') {
          notify.error("Error al cargar la información de tu perfil.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchUserData();

    return () => controller.abort();
  }, [notify]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileData.first_name.trim() || !profileData.last_name.trim()) {
       return notify.warning("El nombre y apellido son obligatorios.");
    }

    setSavingProfile(true);
    setProfileSuccess(false);
    try {
      await api.put('/api/v1/auth/users/me', {
        first_name: profileData.first_name,
        last_name: profileData.last_name
      });
      setProfileSuccess(true);
      notify.success("Datos personales actualizados.");
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error) {
      notify.error("Error al actualizar tu perfil. Inténtalo de nuevo.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      notify.warning("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (passwords.new_password.length < 6) {
      notify.warning("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setSavingPassword(true);
    setPasswordSuccess(false);
    try {
      await api.put('/api/v1/auth/users/me/password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password
      });
      setPasswordSuccess(true);
      notify.success("¡Contraseña cambiada exitosamente!");
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al actualizar la contraseña. Verifica tu contraseña actual.");
    } finally {
      setSavingPassword(false);
    }
  };

  // ==========================================
  // 🔥 LÓGICA DE MFA (ACTIVAR/DESACTIVAR) 🔥
  // ==========================================
  const handleStartMfaSetup = async () => {
    setMfaStatus('LOADING');
    try {
      const res = await api.post('/api/v1/auth/mfa/setup');
      setMfaQrData({ secret: res.data.secret, qrUrl: res.data.qr_code_url });
      setMfaStatus('SETUP');
    } catch (error) {
      notify.error(error.response?.data?.detail || "No se pudo generar el código QR.");
      setMfaStatus('IDLE');
    }
  };

  const handleVerifyMfaSetup = async (e) => {
    e.preventDefault();
    if (mfaCode.length !== 6) {
      notify.warning("El código debe tener exactamente 6 dígitos.");
      return;
    }
    setMfaStatus('LOADING');
    try {
      await api.post('/api/v1/auth/mfa/verify', { code: mfaCode });
      setProfileData(prev => ({ ...prev, is_mfa_enabled: true }));
      setMfaStatus('IDLE');
      setMfaCode('');
      notify.success("¡Doble Factor de Seguridad activado exitosamente!");
    } catch (error) {
      notify.error(error.response?.data?.detail || "Código incorrecto. Intenta de nuevo.");
      setMfaStatus('SETUP'); // Lo devolvemos al setup para que intente de nuevo
    }
  };

  const handleDisableMfa = async () => {
    if (!window.confirm("¿Estás seguro de que deseas desactivar el Doble Factor de seguridad? Esto disminuirá la protección de tu cuenta.")) {
      return;
    }
    setMfaStatus('LOADING');
    try {
      await api.post('/api/v1/auth/mfa/disable');
      setProfileData(prev => ({ ...prev, is_mfa_enabled: false }));
      notify.success("Doble Factor de Seguridad desactivado.");
    } catch (error) {
      // Aquí atrapamos el error si la política de la empresa dice que es obligatorio
      notify.error(error.response?.data?.detail || "Error al desactivar el MFA.");
    } finally {
      setMfaStatus('IDLE');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const initials = (profileData.first_name?.charAt(0) || profileData.email?.charAt(0) || 'U').toUpperCase();

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 p-4 md:p-8">
      
      {/* ENCABEZADO */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left w-full md:w-auto">
           <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 text-white flex items-center justify-center text-4xl font-bold shadow-lg shrink-0">
             {initials}
           </div>
           <div>
             <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
               {profileData.first_name ? `${profileData.first_name} ${profileData.last_name}` : 'Configura tu nombre'}
             </h1>
             <p className="text-gray-500 dark:text-gray-400 flex items-center justify-center md:justify-start gap-1.5 mt-1 font-medium">
               <Mail size={16} /> {profileData.email}
             </p>
           </div>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto mt-4 md:mt-0 bg-gray-50/80 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800/80 shrink-0">
          <div className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <Shield size={18} className="text-blue-500" /> 
            <span><span className="font-bold uppercase tracking-wider text-xs text-gray-400 dark:text-gray-500 mr-2">Rol:</span> {profileData.role_name}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <Key size={18} className="text-amber-500" /> 
            <span><span className="font-bold uppercase tracking-wider text-xs text-gray-400 dark:text-gray-500 mr-2">Perfil:</span> {profileData.profile_name}</span>
          </div>
        </div>
      </div>

      {/* TARJETAS DE FORMULARIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* TARJETA 1: DATOS PERSONALES */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
            <div>
               <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <User className="text-blue-500" /> Datos Personales
               </h2>
               <p className="text-xs text-gray-500 mt-1">Actualiza cómo te ven tus compañeros.</p>
            </div>
          </div>
          <form onSubmit={handleUpdateProfile} className="p-6 flex-1 flex flex-col">
            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nombre</label>
                <input type="text" required autoComplete="given-name" value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-gray-900 dark:text-white text-sm transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Apellido</label>
                <input type="text" required autoComplete="family-name" value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-gray-900 dark:text-white text-sm transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">Email <Lock size={10}/></label>
                <input type="email" disabled autoComplete="email" value={profileData.email} className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-500 dark:text-gray-500 text-sm cursor-not-allowed" title="Contacta al administrador para cambiar tu correo" />
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              {profileSuccess ? (
                <span className="text-sm font-bold text-emerald-500 flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2"><CheckCircle2 size={16}/> Cambios guardados</span>
              ) : <span></span>}
              <button type="submit" disabled={savingProfile} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 shadow-sm">
                {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar Cambios
              </button>
            </div>
          </form>
        </div>

        {/* TARJETA 2: SEGURIDAD Y CONTRASEÑA */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
             <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Lock className="text-amber-500" /> Cambiar Contraseña
                </h2>
                <p className="text-xs text-gray-500 mt-1">Protege el acceso a tu cuenta.</p>
             </div>
          </div>
          <form onSubmit={handleUpdatePassword} className="p-6 flex-1 flex flex-col">
            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Contraseña Actual</label>
                <input type="password" required autoComplete="current-password" value={passwords.current_password} onChange={e => setPasswords({...passwords, current_password: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-gray-900 dark:text-white text-sm font-mono transition-all" placeholder="••••••••" />
              </div>
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nueva Contraseña</label>
                <input type="password" required minLength="6" autoComplete="new-password" value={passwords.new_password} onChange={e => setPasswords({...passwords, new_password: e.target.value})} className="w-full px-4 py-2.5 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-gray-900 dark:text-white text-sm font-mono transition-all" placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Confirmar Nueva Contraseña</label>
                <input type="password" required minLength="6" autoComplete="new-password" onPaste={(e) => e.preventDefault()} value={passwords.confirm_password} onChange={e => setPasswords({...passwords, confirm_password: e.target.value})} className="w-full px-4 py-2.5 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-gray-900 dark:text-white text-sm font-mono transition-all" placeholder="Repite tu nueva contraseña" />
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              {passwordSuccess ? (
                <span className="text-sm font-bold text-emerald-500 flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2"><CheckCircle2 size={16}/> Actualizada</span>
              ) : <span></span>}
              <button type="submit" disabled={savingPassword} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 shadow-sm">
                {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />} Actualizar Contraseña
              </button>
            </div>
          </form>
        </div>

        {/* 🔥 NUEVA TARJETA: DOBLE FACTOR DE AUTENTICACIÓN (MFA) 🔥 */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
             <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="text-purple-500" /> Doble Factor de Seguridad (MFA)
                </h2>
                <p className="text-xs text-gray-500 mt-1">Añade una capa extra de protección a tu cuenta vinculando tu celular.</p>
             </div>
          </div>
          
          <div className="p-6">
            {profileData.is_mfa_enabled ? (
              // ESTADO 1: MFA ACTIVADO
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-400">Tu cuenta está protegida</h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">El inicio de sesión requiere contraseña y un código de tu aplicación autenticadora.</p>
                  </div>
                </div>
                <button 
                  onClick={handleDisableMfa} disabled={mfaStatus === 'LOADING'}
                  className="px-5 py-2.5 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold rounded-xl text-sm transition-colors flex items-center gap-2 shrink-0"
                >
                  {mfaStatus === 'LOADING' ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                  Desactivar MFA
                </button>
              </div>
            ) : mfaStatus === 'SETUP' ? (
              // ESTADO 2: CONFIGURANDO MFA
              <div className="animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start bg-gray-50 dark:bg-gray-800/30 p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 shrink-0">
                    <QRCodeSVG value={mfaQrData.qrUrl} size={160} level="M" />
                  </div>
                  <div className="flex-1 w-full text-center md:text-left">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Escanea este código QR</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Abre Google Authenticator o Authy en tu celular, escanea el código y escribe los 6 dígitos que aparezcan para confirmar la vinculación.</p>
                    
                    <form onSubmit={handleVerifyMfaSetup} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto md:mx-0">
                      <input 
                        type="text" maxLength="6" inputMode="numeric" pattern="[0-9]*" placeholder="000000"
                        value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                        className="px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-center text-xl tracking-[0.5em] font-mono outline-none focus:border-purple-500 transition-colors w-full sm:w-auto"
                        required autoFocus
                      />
                      <button type="submit" disabled={mfaCode.length !== 6 || mfaStatus === 'LOADING'} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        Verificar
                      </button>
                      <button type="button" onClick={() => { setMfaStatus('IDLE'); setMfaCode(''); }} className="px-4 py-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-colors">
                        <X size={20} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              // ESTADO 3: MFA DESACTIVADO
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/30 p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Doble Factor Desactivado</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Actívalo para requerir un código de tu celular cada vez que inicies sesión.</p>
                  </div>
                </div>
                <button 
                  onClick={handleStartMfaSetup} disabled={mfaStatus === 'LOADING'}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2 shrink-0"
                >
                  {mfaStatus === 'LOADING' ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                  Activar Doble Factor
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default UserProfile;