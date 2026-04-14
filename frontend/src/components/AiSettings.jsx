import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Sparkles, Save, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const AiSettings = () => {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [formData, setFormData] = useState({
    active_provider: '', // 'openai', 'anthropic', 'gemini'
    api_key: ''
  });

  // Cargamos la configuración actual al montar el componente
  useEffect(() => {
    const fetchAiSettings = async () => {
      try {
        // Asumimos un endpoint dedicado para estas configuraciones
        const res = await api.get('/api/v1/security/ai-settings');
        if (res.data) {
          setFormData({
            active_provider: res.data.active_provider || '',
            api_key: res.data.api_key || ''
          });
        }
      } catch (error) {
        // Si da 404 significa que aún no hay configuración, lo cual es normal la primera vez
        if (error.response?.status !== 404) {
           console.error("Error cargando configuración de IA:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAiSettings();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectProvider = (provider) => {
    setFormData({ ...formData, active_provider: provider });
  };

  const handleSave = async () => {
    if (formData.active_provider && !formData.api_key.trim()) {
       return notify.warning("Si seleccionas un proveedor, debes ingresar su API Key.");
    }

    setIsSaving(true);
    try {
      await api.put('/api/v1/security/ai-settings', formData);
      notify.success("Configuración de Inteligencia Artificial guardada.");
    } catch (error) {
      notify.error("Error al guardar la configuración de IA.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 mt-6 flex justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={24} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 mt-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Asistente de Inteligencia Artificial</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Configura el "cerebro" para el generador automático de formularios.</p>
          </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-70 active:scale-95 whitespace-nowrap"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
          Guardar IA
        </button>
      </div>

      {/* PROVEEDORES DE IA */}
      <div className="space-y-6">
         <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Proveedor Activo</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* OPENAI */}
               <div 
                  onClick={() => selectProvider('openai')}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative overflow-hidden ${formData.active_provider === 'openai' ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-900'}`}
               >
                  {formData.active_provider === 'openai' && <div className="absolute top-3 right-3 text-indigo-500"><CheckCircle2 size={18}/></div>}
                  <div className="font-bold text-gray-900 dark:text-white text-base mb-1">OpenAI</div>
                  <div className="text-xs text-gray-500">Modelos GPT-4o y GPT-4o-mini. Excelente para JSON estructurado.</div>
               </div>

               {/* ANTHROPIC */}
               <div 
                  onClick={() => selectProvider('anthropic')}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative overflow-hidden ${formData.active_provider === 'anthropic' ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-900'}`}
               >
                  {formData.active_provider === 'anthropic' && <div className="absolute top-3 right-3 text-indigo-500"><CheckCircle2 size={18}/></div>}
                  <div className="font-bold text-gray-900 dark:text-white text-base mb-1">Anthropic</div>
                  <div className="text-xs text-gray-500">Familia Claude 3.5 Sonnet. Alta capacidad de razonamiento.</div>
               </div>

               {/* GEMINI */}
               <div 
                  onClick={() => selectProvider('gemini')}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative overflow-hidden ${formData.active_provider === 'gemini' ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-900'}`}
               >
                  {formData.active_provider === 'gemini' && <div className="absolute top-3 right-3 text-indigo-500"><CheckCircle2 size={18}/></div>}
                  <div className="font-bold text-gray-900 dark:text-white text-base mb-1">Google Gemini</div>
                  <div className="text-xs text-gray-500">Gemini 1.5 Pro. Rápido y con gran ventana de contexto.</div>
               </div>
            </div>
            
            {/* BOTÓN DE APAGADO */}
            <div className="mt-3 flex justify-end">
               <button onClick={() => selectProvider('')} className="text-xs text-red-500 hover:underline font-bold">Desactivar IA por completo</button>
            </div>
         </div>

         {/* API KEY INPUT */}
         {formData.active_provider && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 border-t border-gray-100 dark:border-gray-800 pt-6">
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Clave de API (API Key) para {formData.active_provider === 'openai' ? 'OpenAI' : formData.active_provider === 'anthropic' ? 'Anthropic' : 'Google Gemini'}
               </label>
               <div className="relative max-w-2xl">
                  <input 
                     type={showKey ? "text" : "password"} 
                     name="api_key" 
                     value={formData.api_key} 
                     onChange={handleChange} 
                     placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx..."
                     className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 text-gray-900 dark:text-white font-mono" 
                  />
                  <button 
                     type="button" 
                     onClick={() => setShowKey(!showKey)} 
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors p-1"
                  >
                     {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
               </div>
               <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1.5">
                  <span className="text-amber-500">⚠️</span> Esta clave se encriptará en la base de datos y se usará para todas las peticiones de esta empresa.
               </p>
            </div>
         )}
      </div>

    </div>
  );
};

export default AiSettings;