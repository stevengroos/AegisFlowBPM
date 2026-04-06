import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { ShieldAlert, Save, Loader2 } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const SsoSettings = () => {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [forceMfa, setForceMfa] = useState(false);

  useEffect(() => {
    const fetchSsoConfig = async () => {
      try {
        const res = await api.get('/api/v1/security/sso-settings');
        setForceMfa(res.data.sso_force_native_mfa);
      } catch (error) {
        console.error("Error al cargar configuración SSO");
      } finally {
        setLoading(false);
      }
    };
    fetchSsoConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/api/v1/security/sso-settings', { sso_force_native_mfa: forceMfa });
      notify.success("Política de Single Sign-On actualizada correctamente.");
    } catch (error) {
      notify.error("Error al guardar la configuración.");
    } finally {
      setIsSaving(false);
    }
  };

  const ToggleSwitch = ({ checked, onChange }) => (
    <button type="button" onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  if (loading) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 mt-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-lg text-rose-600 dark:text-rose-400 mt-1">
            <ShieldAlert size={20}/>
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Seguridad Estricta SSO (Single Sign-On)</h3>
            <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
              Por defecto, si un usuario inicia sesión con Google o Microsoft, delegamos la seguridad a esos proveedores. Al encender esta opción, obligarás a los usuarios a usar el Doble Factor (MFA) nativo de AegisFlow <b>además</b> de su inicio de sesión externo.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
            {forceMfa ? 'MFA Forzado (Activo)' : 'Delegado (Inactivo)'}
          </span>
          <ToggleSwitch checked={forceMfa} onChange={setForceMfa} />
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-100 dark:border-gray-800 pt-4">
        <button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-70">
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Guardar Política SSO
        </button>
      </div>
    </div>
  );
};

export default SsoSettings;