import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { ArrowLeft, Save, Loader2, Plug, CheckCircle2, ShieldAlert, Key, Zap } from 'lucide-react';

// Lista maestra de integraciones disponibles en el sistema
const AVAILABLE_INTEGRATIONS = [
  {
    id: 'signaturit',
    name: 'Signaturit',
    description: 'Firmas digitales legalmente vinculantes. Envía contratos y documentos directamente desde tus flujos.',
    icon: '✍️', // Aquí podrías poner un logo PNG en el futuro
    color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400'
  }
  // En el futuro puedes añadir { id: 'slack', name: 'Slack' }, etc.
];

const IntegrationBuilder = ({ moduleId, setHasUnsavedChanges }) => {
  const { notify } = useNotification();
  const [view, setView] = useState('list'); // 'list' | 'config'
  const [selectedApp, setSelectedApp] = useState(null);
  
  // Estados para la configuración
  const [configData, setConfigData] = useState({ is_active: false, environment: 'sandbox', token: '' });
  const [hasTokenSaved, setHasTokenSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingUpWebhook, setSettingUpWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  const handleSetupWebhook = async () => {
    if (!webhookUrl.trim()) return notify.warning("Por favor ingresa la URL pública de tu servidor (ej: https://tudominio.com)");
    if (!webhookUrl.startsWith("http")) return notify.warning("La URL debe empezar con http:// o https://");

    setSettingUpWebhook(true);
    try {
      // 🔥 Mandamos la URL en el body
      const res = await api.post(`/api/v1/modules/${moduleId}/integrations/signaturit/webhook/setup`, {
         app_url: webhookUrl
      });
      notify.success(res.data.message);
    } catch (error) {
      notify.error(error.response?.data?.detail || "No se pudo configurar el webhook automáticamente.");
    } finally {
      setSettingUpWebhook(false);
    }
  };

  // Cargar datos cuando entramos a configurar una app
  useEffect(() => {
    if (view === 'config' && selectedApp) {
      setLoading(true);
      api.get(`/api/v1/modules/${moduleId}/integrations/${selectedApp.id}`)
        .then(res => {
          setConfigData({
            is_active: res.data.is_active,
            environment: res.data.environment,
            token: '' // El token nunca viene del back por seguridad
          });
          setHasTokenSaved(res.data.has_token);
        })
        .catch(err => {
          notify.error("Error al cargar la configuración de la integración.");
        })
        .finally(() => setLoading(false));
    }
  }, [view, selectedApp, moduleId]);

  const handleOpenConfig = (app) => {
    setSelectedApp(app);
    setView('config');
  };

  const handleBackToList = () => {
    if (setHasUnsavedChanges) setHasUnsavedChanges(false);
    setSelectedApp(null);
    setView('list');
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (configData.is_active && !hasTokenSaved && !configData.token.trim()) {
       return notify.warning("Debes proporcionar un API Key (Token) para activar la integración.");
    }

    setSaving(true);
    try {
      const res = await api.put(`/api/v1/modules/${moduleId}/integrations/${selectedApp.id}`, configData);
      
      setHasTokenSaved(res.data.has_token);
      setConfigData(prev => ({ ...prev, token: '' })); // Limpiamos el input por seguridad
      if (setHasUnsavedChanges) setHasUnsavedChanges(false);
      
      notify.success(`Configuración de ${selectedApp.name} guardada exitosamente.`);
    } catch (error) {
      notify.error("Error al guardar la integración. Verifica tus permisos.");
    } finally {
      setSaving(false);
    }
  };

  if (view === 'config') {
    return (
      <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-950/50 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={handleBackToList} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-2xl">{selectedApp.icon}</span> Configurar {selectedApp.name}
              </h2>
            </div>
          </div>
          <button onClick={handleSaveConfig} disabled={saving || loading} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar Conexión
          </button>
        </div>

        {loading ? (
           <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500" size={32}/></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-6">
               
               <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                     <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Estado de la Integración</h3>
                        <p className="text-sm text-gray-500">Activa o desactiva las funciones de {selectedApp.name} para este módulo.</p>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={configData.is_active} onChange={(e) => { setConfigData({...configData, is_active: e.target.checked}); if(setHasUnsavedChanges) setHasUnsavedChanges(true); }} />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                     </label>
                  </div>

                  <div className="space-y-5 border-t border-gray-100 dark:border-gray-800 pt-6">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Entorno (Environment)</label>
                        <select value={configData.environment} onChange={(e) => { setConfigData({...configData, environment: e.target.value}); if(setHasUnsavedChanges) setHasUnsavedChanges(true); }} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-emerald-500 font-medium text-sm text-gray-900 dark:text-white">
                           <option value="sandbox">🧪 Sandbox (Entorno de Pruebas Seguras)</option>
                           <option value="production">🚀 Producción (Firma con Valor Legal)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">Utiliza Sandbox mientras estás configurando tus plantillas y flujos. Cambia a Producción cuando estés listo para operar.</p>
                     </div>

                     <div>
                        <label className="flex justify-between items-center mb-2">
                           <span className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Key size={14}/> Access Token (API Key)</span>
                           {hasTokenSaved && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md flex items-center gap-1"><CheckCircle2 size={12}/> Token Configurado</span>}
                        </label>
                        <input 
                           type="password" 
                           placeholder={hasTokenSaved ? "•••••••••••••••••••••••••••••••• (Guardado y Encriptado)" : "Pega aquí tu token de Signaturit"} 
                           value={configData.token} 
                           onChange={(e) => { setConfigData({...configData, token: e.target.value}); if(setHasUnsavedChanges) setHasUnsavedChanges(true); }} 
                           className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-950 border rounded-xl outline-none text-sm font-mono transition-all ${hasTokenSaved && !configData.token ? 'border-emerald-200 dark:border-emerald-800 focus:border-emerald-500' : 'border-gray-200 dark:border-gray-700 focus:border-emerald-500'}`} 
                        />
                        <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1"><ShieldAlert size={12}/> Por seguridad ISO-27001, tu token se guarda fuertemente encriptado y nunca se muestra de vuelta.</p>
                     </div>
                     {/* 🔥 SECCIÓN DE WEBHOOK AUTOMÁTICO 🔥 */}
                     {hasTokenSaved && (
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                           <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl p-6 flex flex-col gap-4">
                              <div className="flex items-center gap-3">
                                 <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                                    <Zap size={20} />
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-emerald-900 dark:text-emerald-400">Eventos en Tiempo Real</h4>
                                    <p className="text-xs text-emerald-700/70 dark:text-emerald-500/60 mt-0.5">
                                       Ingresa la URL pública de tu servidor (tu dominio o Ngrok) para que Signaturit te notifique las firmas.
                                    </p>
                                 </div>
                              </div>
                              
                              <div className="flex flex-col md:flex-row items-stretch gap-3 mt-2">
                                 <input 
                                    type="url" 
                                    placeholder="ej: https://a1b2-34-56-78.ngrok-free.app" 
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    className="flex-1 px-4 py-2 bg-white dark:bg-gray-950 border border-emerald-200 dark:border-emerald-800/50 rounded-xl outline-none focus:border-emerald-500 text-sm font-mono text-gray-900 dark:text-white"
                                 />
                                 <button 
                                    type="button"
                                    onClick={handleSetupWebhook}
                                    disabled={settingUpWebhook}
                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                                 >
                                    {settingUpWebhook ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                    {settingUpWebhook ? 'Configurando...' : 'Activar Webhook'}
                                 </button>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  // VISTA POR DEFECTO: LISTA DE INTEGRACIONES
  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
      <div className="mb-8 border-b border-gray-100 dark:border-gray-800/60 pb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
           <Plug className="text-emerald-500" /> Mercado de Integraciones
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Conecta este módulo con plataformas externas y potencia tus automatizaciones.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {AVAILABLE_INTEGRATIONS.map(app => (
            <div key={app.id} onClick={() => handleOpenConfig(app)} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-emerald-300 dark:hover:border-emerald-700 flex flex-col h-full">
               <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl border transition-transform group-hover:scale-105 ${app.color}`}>
                     {app.icon}
                  </div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{app.name}</h3>
               </div>
               <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">{app.description}</p>
               <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500 group-hover:underline">Configurar Conexión →</span>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};

export default IntegrationBuilder;