import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Mail, Server, Save, Loader2 } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const SmtpSettings = () => {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    use_custom_smtp: false, smtp_host: '', smtp_port: 587,
    smtp_user: '', smtp_password: '', smtp_from_email: '', smtp_from_name: ''
  });

  useEffect(() => {
    const fetchSmtp = async () => {
      try {
        const res = await api.get('/api/v1/security/smtp-settings');
        setFormData(res.data);
      } catch (error) {
        notify.error("Error al cargar la configuración de correo.");
      } finally {
        setLoading(false);
      }
    };
    fetchSmtp();
  }, [notify]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev, [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/api/v1/security/smtp-settings', formData);
      notify.success("Configuración de correo actualizada. Las alertas usarán este servidor.");
    } catch (error) {
      notify.error("Error al guardar la configuración SMTP.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
    try {
      // Primero guardamos para asegurar que pruebe con los datos más recientes
      await api.put('/api/v1/security/smtp-settings', formData);
      // Luego disparamos la prueba
      await api.post('/api/v1/security/smtp-settings/test');
      notify.success("¡Correo de prueba enviado! Revisa tu bandeja de entrada.");
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al intentar enviar el correo de prueba.");
    } finally {
      setIsTesting(false);
    }
  };

  const ToggleSwitch = ({ checked, onChange, name }) => (
    <button type="button" onClick={() => onChange({ target: { name, type: 'checkbox', checked: !checked } })} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={24}/></div>;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 mt-6 animate-in fade-in">
      <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Mail size={20}/>
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Servidor de Correos (Marca Blanca)</h3>
            <p className="text-xs text-gray-500 mt-0.5">Envía las alertas de seguridad desde el dominio corporativo de tu empresa.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Usar SMTP Propio</span>
          <ToggleSwitch checked={formData.use_custom_smtp} onChange={handleChange} name="use_custom_smtp" />
        </div>
      </div>

      <div className={`transition-all duration-300 ${!formData.use_custom_smtp ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Server size={12}/> Servidor SMTP (Host)</label>
            <input type="text" name="smtp_host" placeholder="Ej. smtp.gmail.com" value={formData.smtp_host || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Puerto</label>
            <input type="number" name="smtp_port" placeholder="587" value={formData.smtp_port || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Usuario SMTP / Email</label>
            <input type="text" name="smtp_user" placeholder="alertas@miempresa.com" value={formData.smtp_user || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Contraseña SMTP</label>
            <input type="password" name="smtp_password" placeholder="••••••••••••" value={formData.smtp_password || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 pt-5 border-t border-gray-100 dark:border-gray-800">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Remitente: Nombre a Mostrar</label>
            <input type="text" name="smtp_from_name" placeholder="Ej. Seguridad MiEmpresa" value={formData.smtp_from_name || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Remitente: Email (From)</label>
            <input type="email" name="smtp_from_email" placeholder="no-reply@miempresa.com" value={formData.smtp_from_email || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button 
            onClick={handleTestEmail} 
            disabled={isSaving || isTesting} 
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-70"
          >
            {isTesting ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
            Probar Conexión
          </button>

          <button 
            onClick={handleSave} 
            disabled={isSaving || isTesting} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-70"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar SMTP
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmtpSettings;