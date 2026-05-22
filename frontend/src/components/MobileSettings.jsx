import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Save, Loader2, Smartphone, Users, ShoppingBag, Palette, Store, EyeOff, ShieldCheck, LinkIcon, Handshake, ArrowDownToLine } from 'lucide-react'; 
import { useNotification } from '../context/NotificationContext';

const DEFAULT_CONFIG = {
  is_b2c_enabled: false,
  onboarding_module_id: '',
  onboarding_form_id: '',
  onboarding_firstname_field: '', // 🔥 NUEVO
  onboarding_lastname_field: '',  // 🔥 NUEVO
  
  // Flujo Normal (Ofertas -> Compras)
  purchases_module_id: '',
  purchases_form_id: '', 
  purchases_volume_field: '', 
  purchases_price_field: '',  
  
  // Flujo Inverso (Demandas -> Coberturas)
  demands_module_id: '',
  demands_form_id: '',
  fulfillment_module_id: '',
  fulfillment_form_id: '',
  fulfillment_volume_field: '',
  fulfillment_price_field: '',
  
  require_manual_approval: true,
  theme_color: '#000000',
  hide_prices_from_guests: false
};

const MobileSettings = () => {
  const { notify } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_CONFIG);
  
  const [modules, setModules] = useState([]);
  const [forms, setForms] = useState([]);
  
  // Estados para los campos dinámicos
  const [onboardingFields, setOnboardingFields] = useState([]); // 🔥 NUEVO
  const [purchasesFields, setPurchasesFields] = useState([]); 
  const [fulfillmentFields, setFulfillmentFields] = useState([]);

  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [settingsRes, modulesRes, formsRes] = await Promise.all([
        api.get('/api/v1/mobile/settings/mobile', { signal }),
        api.get('/api/v1/modules/', { signal }),
        api.get('/api/v1/forms/', { signal }).catch(() => ({ data: [] })) 
      ]);
      
      if (settingsRes.data) {
        const cleanData = { ...DEFAULT_CONFIG, ...settingsRes.data };
        setFormData({
          ...cleanData,
          onboarding_module_id: cleanData.onboarding_module_id || '',
          onboarding_form_id: cleanData.onboarding_form_id || '',
          onboarding_firstname_field: cleanData.onboarding_firstname_field || '', // 🔥 NUEVO
          onboarding_lastname_field: cleanData.onboarding_lastname_field || '',   // 🔥 NUEVO
          
          purchases_module_id: cleanData.purchases_module_id || '',
          purchases_form_id: cleanData.purchases_form_id || '',
          purchases_volume_field: cleanData.purchases_volume_field || '',
          purchases_price_field: cleanData.purchases_price_field || '',
          
          demands_module_id: cleanData.demands_module_id || '',
          demands_form_id: cleanData.demands_form_id || '',
          fulfillment_module_id: cleanData.fulfillment_module_id || '',
          fulfillment_form_id: cleanData.fulfillment_form_id || '',
          fulfillment_volume_field: cleanData.fulfillment_volume_field || '',
          fulfillment_price_field: cleanData.fulfillment_price_field || '',
        });
      }
      
      setModules(modulesRes.data || []);
      setForms(formsRes.data || []);
    } catch (error) {
      if (error.name !== 'CanceledError') notify.error("Error al cargar la configuración móvil.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // 🔥 NUEVO: Cargar campos de texto cuando cambia el Módulo de Onboarding 🔥
  useEffect(() => {
    if (formData.onboarding_module_id) {
      api.get(`/api/v1/fields/?module_id=${formData.onboarding_module_id}`)
         .then(res => setOnboardingFields(res.data.filter(f => f.is_active && ['text', 'email', 'phone'].includes(f.field_type))))
         .catch(err => console.error(err));
    } else {
      setOnboardingFields([]);
    }
  }, [formData.onboarding_module_id]);

  // Cargar campos numéricos cuando cambia el Módulo de Compras
  useEffect(() => {
    if (formData.purchases_module_id) {
      api.get(`/api/v1/fields/?module_id=${formData.purchases_module_id}`)
         .then(res => setPurchasesFields(res.data.filter(f => f.is_active && ['number', 'decimal', 'currency'].includes(f.field_type))))
         .catch(err => console.error(err));
    } else {
      setPurchasesFields([]);
    }
  }, [formData.purchases_module_id]);

  // Cargar campos numéricos cuando cambia el Módulo de Coberturas
  useEffect(() => {
    if (formData.fulfillment_module_id) {
      api.get(`/api/v1/fields/?module_id=${formData.fulfillment_module_id}`)
         .then(res => setFulfillmentFields(res.data.filter(f => f.is_active && ['number', 'decimal', 'currency'].includes(f.field_type))))
         .catch(err => console.error(err));
    } else {
      setFulfillmentFields([]);
    }
  }, [formData.fulfillment_module_id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        onboarding_module_id: formData.onboarding_module_id ? parseInt(formData.onboarding_module_id) : null,
        onboarding_form_id: formData.onboarding_form_id ? parseInt(formData.onboarding_form_id) : null,
        
        purchases_module_id: formData.purchases_module_id ? parseInt(formData.purchases_module_id) : null,
        purchases_form_id: formData.purchases_form_id ? parseInt(formData.purchases_form_id) : null,
        
        demands_module_id: formData.demands_module_id ? parseInt(formData.demands_module_id) : null,
        demands_form_id: formData.demands_form_id ? parseInt(formData.demands_form_id) : null,
        
        fulfillment_module_id: formData.fulfillment_module_id ? parseInt(formData.fulfillment_module_id) : null,
        fulfillment_form_id: formData.fulfillment_form_id ? parseInt(formData.fulfillment_form_id) : null,
      };
      await api.put('/api/v1/mobile/settings/mobile', payload);
      notify.success("Configuración de App Móvil guardada con éxito.");
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al guardar la configuración.");
    } finally {
      setIsSaving(false);
    }
  };

  const ToggleSwitch = ({ checked, onChange, name }) => (
    <button type="button" onClick={() => onChange({ target: { name, type: 'checkbox', checked: !checked } })} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-fuchsia-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-fuchsia-500" size={32}/></div>;

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">App Móvil y Catálogo B2C</h2>
          <p className="text-sm text-gray-500 mt-1">Configura cómo interactúan los clientes externos con tu plataforma a través de la App.</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-70">
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar Cambios
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* MASTER SWITCH */}
        <div className="bg-gradient-to-r from-fuchsia-50 to-purple-50 dark:from-fuchsia-900/10 dark:to-purple-900/10 rounded-2xl border border-fuchsia-100 dark:border-fuchsia-800/30 shadow-sm p-6 lg:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
           <div>
              <h3 className="font-bold text-lg text-fuchsia-900 dark:text-fuchsia-400 flex items-center gap-2"><Store size={22}/> Habilitar E-Commerce / App Móvil</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Activa o desactiva por completo el acceso público a los catálogos y el registro desde la app móvil.</p>
           </div>
           <ToggleSwitch checked={formData.is_b2c_enabled} onChange={handleChange} name="is_b2c_enabled" />
        </div>

        {/* BLOQUE: ONBOARDING */}
        <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:col-span-2 transition-all ${!formData.is_b2c_enabled && 'opacity-50 pointer-events-none grayscale'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400"><Users size={20}/></div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Registro de Usuarios</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Módulo Destino (Donde se guardan)</label>
              <select name="onboarding_module_id" value={formData.onboarding_module_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-fuchsia-500/50">
                 <option value="">Seleccione el módulo...</option>
                 {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Formulario a mostrar en la App</label>
              <select name="onboarding_form_id" value={formData.onboarding_form_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-fuchsia-500/50">
                 <option value="">Seleccione el formulario...</option>
                 {forms.filter(f => !formData.onboarding_module_id || String(f.module_id) === String(formData.onboarding_module_id)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>

          {/* 🔥 NUEVO BLOQUE: MAPEO DE NOMBRE Y APELLIDO 🔥 */}
          {formData.onboarding_module_id && (
             <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                <h4 className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2 mb-2 text-sm"><LinkIcon size={16}/> Mapeo del Perfil (Opcional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Campo: Nombre</label>
                      <select name="onboarding_firstname_field" value={formData.onboarding_firstname_field} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none">
                         <option value="">Por defecto (nombre)</option>
                         {onboardingFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Campo: Apellido</label>
                      <select name="onboarding_lastname_field" value={formData.onboarding_lastname_field} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none">
                         <option value="">Por defecto (apellido)</option>
                         {onboardingFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                      </select>
                   </div>
                </div>
             </div>
          )}

          <div className="h-px bg-gray-100 dark:bg-gray-800 w-full my-6" />
          
          <div className="flex items-center justify-between">
            <div>
               <p className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5"><ShieldCheck size={16}/> Aprobación Manual</p>
               <p className="text-xs text-gray-500">Un admin debe verificar la cuenta antes de que operen.</p>
            </div>
            <ToggleSwitch checked={formData.require_manual_approval} onChange={handleChange} name="require_manual_approval" />
          </div>
        </div>

        {/* BLOQUE: FLUJO NORMAL (OFERTAS -> COMPRAS) */}
        <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 transition-all ${!formData.is_b2c_enabled && 'opacity-50 pointer-events-none grayscale'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg text-emerald-600 dark:text-emerald-400"><ShoppingBag size={20}/></div>
            <div>
               <h3 className="font-bold text-lg text-gray-900 dark:text-white">Flujo: Compras</h3>
               <p className="text-xs text-gray-500">Vendedor Pública ➔ Comprador Adquiere</p>
            </div>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Módulo de Compras / Contratos</label>
              <select name="purchases_module_id" value={formData.purchases_module_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 border-l-4 border-l-emerald-500">
                 <option value="">Seleccione a dónde van los pedidos...</option>
                 {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Formulario de Checkout en la App</label>
              <select name="purchases_form_id" value={formData.purchases_form_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-fuchsia-500/50">
                 <option value="">Ninguno (Opcional)...</option>
                 {forms.filter(f => !formData.purchases_module_id || String(f.module_id) === String(formData.purchases_module_id)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {formData.purchases_module_id && (
               <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-400 flex items-center gap-2 mb-2 text-sm"><LinkIcon size={16}/> Mapeo de Transacción</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Destino: Volumen</label>
                        <select name="purchases_volume_field" value={formData.purchases_volume_field} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none">
                           <option value="">Automático...</option>
                           {purchasesFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Destino: Precio</label>
                        <select name="purchases_price_field" value={formData.purchases_price_field} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none">
                           <option value="">Automático...</option>
                           {purchasesFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                        </select>
                     </div>
                  </div>
               </div>
            )}
          </div>
        </div>

        {/* BLOQUE: FLUJO INVERSO (DEMANDAS -> COBERTURAS) */}
        <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 transition-all ${!formData.is_b2c_enabled && 'opacity-50 pointer-events-none grayscale'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400"><Handshake size={20}/></div>
            <div>
               <h3 className="font-bold text-lg text-gray-900 dark:text-white">Flujo: Pizarra de Demandas</h3>
               <p className="text-xs text-gray-500">Comprador Pide ➔ Vendedor Cubre</p>
            </div>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Módulo de Demandas Públicas</label>
              <select name="demands_module_id" value={formData.demands_module_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50">
                 <option value="">Seleccione dónde se publican los pedidos...</option>
                 {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Formulario de Publicación de Demanda</label>
              <select name="demands_form_id" value={formData.demands_form_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50">
                 <option value="">Ninguno (Opcional)...</option>
                 {forms.filter(f => !formData.demands_module_id || String(f.module_id) === String(formData.demands_module_id)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ArrowDownToLine size={14}/> Módulo de Coberturas (Dónde se cubre)</label>
              <select name="fulfillment_module_id" value={formData.fulfillment_module_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 border-l-4 border-l-indigo-500">
                 <option value="">Seleccione a dónde van las coberturas...</option>
                 {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Formulario de Cobertura en la App</label>
              <select name="fulfillment_form_id" value={formData.fulfillment_form_id} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50">
                 <option value="">Ninguno (Opcional)...</option>
                 {forms.filter(f => !formData.fulfillment_module_id || String(f.module_id) === String(formData.fulfillment_module_id)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {formData.fulfillment_module_id && (
               <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                  <h4 className="font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-2 mb-2 text-sm"><LinkIcon size={16}/> Mapeo de Transacción</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Destino: Volumen</label>
                        <select name="fulfillment_volume_field" value={formData.fulfillment_volume_field} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none">
                           <option value="">Automático...</option>
                           {fulfillmentFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Destino: Precio</label>
                        <select name="fulfillment_price_field" value={formData.fulfillment_price_field} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none">
                           <option value="">Automático...</option>
                           {fulfillmentFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                        </select>
                     </div>
                  </div>
               </div>
            )}
          </div>
        </div>

        {/* BLOQUE: APARIENCIA */}
        <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:col-span-2 transition-all ${!formData.is_b2c_enabled && 'opacity-50 pointer-events-none grayscale'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg text-amber-600 dark:text-amber-400"><Palette size={20}/></div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Apariencia y Privacidad</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Color Principal de la App (Hex)</label>
                <div className="flex gap-3">
                   <div className="w-10 h-10 rounded-lg border border-gray-200 shadow-inner shrink-0" style={{ backgroundColor: formData.theme_color }} />
                   <input type="text" name="theme_color" value={formData.theme_color} onChange={handleChange} placeholder="#000000" className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-fuchsia-500/50 uppercase font-mono" />
                </div>
             </div>

             <div className="flex items-center justify-between border-l-0 md:border-l border-gray-100 dark:border-gray-800 md:pl-8">
                <div>
                   <p className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5"><EyeOff size={16}/> Ocultar precios a visitantes</p>
                   <p className="text-xs text-gray-500">Solo usuarios logueados verán los valores.</p>
                </div>
                <ToggleSwitch checked={formData.hide_prices_from_guests} onChange={handleChange} name="hide_prices_from_guests" />
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MobileSettings;