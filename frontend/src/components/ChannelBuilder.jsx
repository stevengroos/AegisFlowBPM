import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Smartphone, Store, LinkIcon, Save, Loader2, Image, Type, Hash, Layers, Trash2, Globe, MessageCircle, Palette, AlignLeft, GripHorizontal } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const ChannelBuilder = ({ moduleId, setHasUnsavedChanges }) => {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [fields, setFields] = useState([]);
  const [forms, setForms] = useState([]);

  const [config, setConfig] = useState({
    is_published: false,
    store_title: '',
    publish_form_id: '', 
    custom_domain: '', 
    whatsapp_number: '', 
    theme_color: '#3b82f6',
    cover_image: '', 
    mapped_variants: '', 
    mapped_variants_col_name: '',  // 🔥 NUEVO
    mapped_variants_col_stock: '', // 🔥 NUEVO
    mapped_variants_col_image: '', // 🔥 NUEVO
    mapped_gallery: '',  
    mapped_gallery_col_image: '',  // 🔥 NUEVO
    mapping: { title: '', price: '', image: '', tags: '', stock: '', category: '', description: '' } 
  });

  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [modRes, fieldsRes, formsRes] = await Promise.all([
        api.get(`/api/v1/modules/${moduleId}`, { signal }),
        api.get(`/api/v1/fields/?module_id=${moduleId}`, { signal }),
        api.get(`/api/v1/forms/?module_id=${moduleId}`, { signal }).catch(() => ({ data: [] }))
      ]);
      
      const activeFields = fieldsRes.data.filter(f => f.is_active) || [];
      const uniqueFieldsMap = new Map();
      activeFields.forEach(f => {
          const key = f.api_name || f.label;
          if (!uniqueFieldsMap.has(key)) uniqueFieldsMap.set(key, f);
      });
      
      setFields(Array.from(uniqueFieldsMap.values()));
      setForms(formsRes.data || []);
      
      const savedConfig = modRes.data.mobile_config || {};
      setConfig({
        is_published: savedConfig.is_published || false,
        store_title: savedConfig.store_title || '',
        publish_form_id: savedConfig.publish_form_id || '',
        custom_domain: savedConfig.custom_domain || '',
        whatsapp_number: savedConfig.whatsapp_number || '', 
        theme_color: savedConfig.theme_color || '#3b82f6',  
        cover_image: savedConfig.cover_image || '',
        mapped_variants: savedConfig.mapped_variants || '', 
        mapped_variants_col_name: savedConfig.mapped_variants_col_name || '',   // 🔥 NUEVO
        mapped_variants_col_stock: savedConfig.mapped_variants_col_stock || '', // 🔥 NUEVO
        mapped_variants_col_image: savedConfig.mapped_variants_col_image || '', // 🔥 NUEVO
        mapped_gallery: savedConfig.mapped_gallery || '',   
        mapped_gallery_col_image: savedConfig.mapped_gallery_col_image || '',   // 🔥 NUEVO
        mapping: {
           title: savedConfig.mapping?.title || '',
           price: savedConfig.mapping?.price || '',
           image: savedConfig.mapping?.image || '',
           tags: savedConfig.mapping?.tags || '',
           stock: savedConfig.mapping?.stock || '',
           category: savedConfig.mapping?.category || '',       
           description: savedConfig.mapping?.description || ''  
        }
      });
      
    } catch (error) {
      if (error.name !== 'CanceledError') notify.error("Error al cargar la configuración móvil.");
    } finally {
      setLoading(false);
    }
  }, [moduleId, notify]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const markAsChanged = (newConfig) => {
    setConfig(newConfig);
    setHasChanges(true);
    if (setHasUnsavedChanges) setHasUnsavedChanges(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return notify.error("La imagen es muy pesada. Máximo 2MB.");
      const reader = new FileReader();
      reader.onloadend = () => { markAsChanged({ ...config, cover_image: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = { ...config, publish_form_id: config.publish_form_id ? parseInt(config.publish_form_id) : null };
      await api.put(`/api/v1/modules/${moduleId}/mobile_config`, payload);
      notify.success("Configuración guardada con éxito.");
      setHasChanges(false);
      if (setHasUnsavedChanges) setHasUnsavedChanges(false);
    } catch (error) { notify.error("Error al guardar la configuración."); } finally { setIsSaving(false); }
  };

  const isTextField = (type) => ['text', 'string', 'varchar', 'long_text', 'select'].includes(type?.toLowerCase());
  const isNumberField = (type) => ['number', 'decimal', 'currency', 'formula', 'int'].includes(type?.toLowerCase());
  const isImageField = (type) => ['image', 'file'].includes(type?.toLowerCase());
  const isLongTextField = (type) => ['textarea', 'long_text', 'rich_text', 'text', 'string'].includes(type?.toLowerCase());
  const isSubformField = (type) => type?.toLowerCase() === 'subform';

  // 🔥 OBTENEMOS LAS COLUMNAS DE LAS TABLAS SELECCIONADAS 🔥
  const selectedVariantsField = fields.find(f => (f.api_name || f.label) === config.mapped_variants);
  const variantsColumns = selectedVariantsField?.subform_config || [];

  const selectedGalleryField = fields.find(f => (f.api_name || f.label) === config.mapped_gallery);
  const galleryColumns = selectedGalleryField?.subform_config || [];

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-fuchsia-500" size={32} /></div>;

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300 max-w-4xl mx-auto pb-32">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Store className="text-fuchsia-500" size={24}/> Catálogo Web (Headless)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configura cómo se publicarán los registros de este módulo hacia tu tienda online B2C.</p>
        </div>
        <button onClick={handleSave} disabled={!hasChanges || isSaving} className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 ${hasChanges ? 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
          {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Guardar Cambios
        </button>
      </div>

      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
           <div className="flex items-center justify-between mb-4">
               <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Publicar Módulo</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Si está activo, este módulo se expondrá mediante la API Pública para conectar tu tienda web.</p>
               </div>
               <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${config.is_published ? 'text-emerald-500' : 'text-gray-400'}`}>{config.is_published ? 'ONLINE' : 'OFFLINE'}</span>
                  <button onClick={() => markAsChanged({ ...config, is_published: !config.is_published })} className={`w-14 h-7 rounded-full transition-colors relative focus:outline-none ${config.is_published ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                     <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform shadow-sm ${config.is_published ? 'translate-x-7' : 'translate-x-0'}`} />
                  </button>
               </div>
           </div>

           {config.is_published && (
              <div className="pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in duration-300 space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 p-4 rounded-xl">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-2"><LinkIcon size={14}/> Enlace Público del Catálogo</label>
                      <div className="flex gap-2">
                          <input type="text" readOnly value={`${window.location.origin}/c/${moduleId}`} className="flex-1 px-4 py-2 bg-white dark:bg-gray-950 border border-blue-200 dark:border-blue-800 rounded-lg outline-none text-sm font-mono select-all" />
                          <button type="button" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/c/${moduleId}`); notify.success("¡Enlace copiado!"); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm">Copiar</button>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3"><Type size={14}/> Nombre de la Tienda Web</label>
                          <input type="text" placeholder="Ej: Mi Súper Tienda" value={config.store_title} onChange={(e) => markAsChanged({...config, store_title: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-fuchsia-500 text-sm" />
                      </div>
                      <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3"><MessageCircle size={14}/> Número de WhatsApp (Ventas)</label>
                          <input type="tel" placeholder="Ej: 595983464526" value={config.whatsapp_number} onChange={(e) => markAsChanged({...config, whatsapp_number: e.target.value.replace(/\D/g, '')})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-fuchsia-500 text-sm" />
                      </div>
                      <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3"><Globe size={14}/> Dominio Propio (Opcional)</label>
                          <input type="url" placeholder="Ej: https://mitienda.com" value={config.custom_domain} onChange={(e) => markAsChanged({...config, custom_domain: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-fuchsia-500 text-sm font-mono" />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-end pt-2">
                      <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3"><Palette size={14}/> Color del Tema</label>
                          <div className="flex items-center gap-3">
                              <input type="color" value={config.theme_color} onChange={(e) => markAsChanged({...config, theme_color: e.target.value})} className="w-12 h-12 p-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer" />
                              <span className="text-sm font-mono text-gray-500">{config.theme_color.toUpperCase()}</span>
                          </div>
                      </div>
                      <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3"><Image size={14}/> Logo / Portada del Catálogo</label>
                          <div className="flex items-center gap-4">
                              {config.cover_image ? (
                                  <div className="relative group">
                                      <img src={config.cover_image} alt="Portada" className="w-24 h-12 object-contain rounded-lg border border-gray-200 bg-white" />
                                      <button onClick={() => markAsChanged({ ...config, cover_image: '' })} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                  </div>
                              ) : (
                                  <div className="w-24 h-12 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center"><Image className="text-gray-400" size={20}/></div>
                              )}
                              <label className="cursor-pointer bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                                  Subir Logo <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                              </label>
                          </div>
                      </div>
                  </div>
              </div>
           )}
        </div>

        {config.is_published && (
           <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-8 animate-in fade-in duration-500">
              
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-fuchsia-200 dark:border-fuchsia-900/50 shadow-sm p-6 space-y-8">
                 <div>
                    <h3 className="font-bold text-fuchsia-900 dark:text-fuchsia-400 flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-3">
                        <LinkIcon size={18}/> Mapeo de Elementos Visuales
                    </h3>
                    
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2"><Type size={14}/> Título del Producto</label>
                               <select value={config.mapping.title} onChange={e => markAsChanged({ ...config, mapping: { ...config.mapping, title: e.target.value } })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-fuchsia-500">
                                  <option value="">Selecciona el campo...</option>
                                  {fields.filter(f => isTextField(f.field_type)).map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                               </select>
                            </div>
                            <div>
                               <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2"><Layers size={14}/> Categoría / Marca</label>
                               <select value={config.mapping.category} onChange={e => markAsChanged({ ...config, mapping: { ...config.mapping, category: e.target.value } })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-fuchsia-500">
                                  <option value="">Ninguna...</option>
                                  {fields.filter(f => isTextField(f.field_type)).map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                               </select>
                            </div>
                        </div>

                        <div>
                           <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2"><AlignLeft size={14}/> Descripción Larga</label>
                           <select value={config.mapping.description} onChange={e => markAsChanged({ ...config, mapping: { ...config.mapping, description: e.target.value } })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-fuchsia-500">
                              <option value="">Sin descripción...</option>
                              {fields.filter(f => isLongTextField(f.field_type)).map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2"><Image size={14}/> Imagen de Portada</label>
                           <select value={config.mapping.image} onChange={e => markAsChanged({ ...config, mapping: { ...config.mapping, image: e.target.value } })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-fuchsia-500">
                              <option value="">Ninguna imagen...</option>
                              {fields.filter(f => isImageField(f.field_type)).map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                           </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2"><Hash size={14}/> Precio de Venta</label>
                              <select value={config.mapping.price} onChange={e => markAsChanged({ ...config, mapping: { ...config.mapping, price: e.target.value } })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-fuchsia-500">
                                 <option value="">Ninguno...</option>
                                 {fields.filter(f => isNumberField(f.field_type)).map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2"><Layers size={14}/> Inventario (Stock)</label>
                              <select value={config.mapping.stock} onChange={e => markAsChanged({ ...config, mapping: { ...config.mapping, stock: e.target.value } })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-fuchsia-500">
                                 <option value="">No controlar stock...</option>
                                 {fields.filter(f => isNumberField(f.field_type)).map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                              </select>
                           </div>
                        </div>

                        {/* 🔥 MAPEO PROFUNDO DE TABLAS (VARIANTES Y GALERÍA) 🔥 */}
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-5">
                           <h4 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><GripHorizontal size={16}/> Configuración de Tablas Múltiples</h4>
                           
                           <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 border border-indigo-100 dark:border-indigo-800/50 rounded-xl space-y-4">
                               <div>
                                   <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-2"><Layers size={14}/> Tabla de Variantes (Colores/Tallas)</label>
                                   <select value={config.mapped_variants || ''} onChange={(e) => markAsChanged({...config, mapped_variants: e.target.value, mapped_variants_col_name: '', mapped_variants_col_stock: '', mapped_variants_col_image: ''})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-indigo-200 dark:border-indigo-700 rounded-xl outline-none focus:border-fuchsia-500 text-sm">
                                      <option value="">-- No usar variantes --</option>
                                      {fields.filter(f => isSubformField(f.field_type)).map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                                   </select>
                               </div>
                               
                               {/* COLUMNAS DE LA VARIANTE */}
                               {config.mapped_variants && variantsColumns.length > 0 && (
                                   <div className="grid grid-cols-3 gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                      <div>
                                         <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Columna: Nombre</label>
                                         <select value={config.mapped_variants_col_name || ''} onChange={e => markAsChanged({...config, mapped_variants_col_name: e.target.value})} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-xs outline-none">
                                            <option value="">(Automático)</option>
                                            {variantsColumns.filter(c => isTextField(c.type)).map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                                         </select>
                                      </div>
                                      <div>
                                         <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Columna: Stock</label>
                                         <select value={config.mapped_variants_col_stock || ''} onChange={e => markAsChanged({...config, mapped_variants_col_stock: e.target.value})} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-xs outline-none">
                                            <option value="">(Automático)</option>
                                            {variantsColumns.filter(c => isNumberField(c.type)).map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                                         </select>
                                      </div>
                                      <div>
                                         <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Columna: Imagen</label>
                                         <select value={config.mapped_variants_col_image || ''} onChange={e => markAsChanged({...config, mapped_variants_col_image: e.target.value})} className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-xs outline-none">
                                            <option value="">(Automático)</option>
                                            {variantsColumns.filter(c => isImageField(c.type)).map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                                         </select>
                                      </div>
                                   </div>
                               )}
                           </div>

                           <div className="bg-teal-50/50 dark:bg-teal-900/10 p-4 border border-teal-100 dark:border-teal-800/50 rounded-xl space-y-4">
                               <div>
                                   <label className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest mb-2"><Image size={14}/> Tabla de Galería Extra</label>
                                   <select value={config.mapped_gallery || ''} onChange={(e) => markAsChanged({...config, mapped_gallery: e.target.value, mapped_gallery_col_image: ''})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-teal-200 dark:border-teal-700 rounded-xl outline-none focus:border-fuchsia-500 text-sm">
                                      <option value="">-- No usar galería extra --</option>
                                      {fields.filter(f => isSubformField(f.field_type)).map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                                   </select>
                               </div>

                               {config.mapped_gallery && galleryColumns.length > 0 && (
                                   <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-teal-100 dark:border-teal-800">
                                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Columna que contiene la foto:</label>
                                      <select value={config.mapped_gallery_col_image || ''} onChange={e => markAsChanged({...config, mapped_gallery_col_image: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-xs outline-none">
                                         <option value="">(Automático)</option>
                                         {galleryColumns.filter(c => isImageField(c.type)).map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                                      </select>
                                   </div>
                               )}
                           </div>
                        </div>

                    </div>
                 </div>
              </div>

              {/* WIREFRAME (Derecha) */}
              <div className="hidden md:block">
                 <div className="sticky top-8">
                    <h3 className="font-bold text-gray-500 uppercase tracking-widest text-[10px] mb-3 text-center">Así se verá en la Web</h3>
                    <div className="w-64 mx-auto bg-gray-50 dark:bg-gray-950 rounded-[2rem] border-[6px] border-gray-800 dark:border-gray-700 h-[450px] shadow-2xl relative overflow-hidden flex flex-col">
                       <div className="absolute top-0 inset-x-0 h-5 bg-gray-800 dark:bg-gray-700 rounded-b-xl mx-auto w-1/3 z-20"></div>
                       
                       <div className="h-14 w-full flex items-center justify-center shadow-sm relative z-10" style={{ backgroundColor: config.theme_color }}>
                          {config.cover_image ? (
                             <img src={config.cover_image} alt="Logo" className="max-h-6 object-contain" />
                          ) : (
                             <span className="text-white font-bold text-xs">Mi Tienda</span>
                          )}
                       </div>

                       <div className="p-4 pt-6 flex-1 bg-white dark:bg-gray-900">
                          <div className="rounded-2xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
                             <div className="h-32 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                                {config.mapping.image ? <Image size={24}/> : <span className="text-[10px]">Sin Imagen</span>}
                             </div>
                             <div className="p-3 space-y-2 relative">
                                <div className="text-[8px] font-bold text-gray-400 uppercase">{config.mapping.category ? "Categoría" : ""}</div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full mt-2"></div>
                                
                                <div className="mt-3 flex justify-between items-end pt-2">
                                   {config.mapping.stock ? <span className="text-[9px] font-bold text-gray-400 uppercase">Stock OK</span> : <span/>}
                                   {config.mapping.price && <span className="px-2 py-1 rounded text-[10px] font-bold text-white" style={{ backgroundColor: config.theme_color }}>$$ Dato</span>}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

           </div>
        )}
      </div>
    </div>
  );
};

export default ChannelBuilder;