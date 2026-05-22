import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import { Zap, Save, X, Code, Play, Filter, ArrowRight, Database, Plus, Trash2, ArrowLeft, Loader2, BellRing, User, Copy, Edit2, Globe, MessageSquare } from 'lucide-react'; // 🔥 Añadidos Globe y MessageSquare
import { useNotification } from '../../context/NotificationContext';
import Select from 'react-select';
import CodeEditorModalGlobal from "../../components/modals/CodeEditorModalGlobal";

const AutomationForm = ({ moduleId, initialRule, fields, companyUsers, allModules, allForms, companyRoles, companyProfiles, moduleSections, onSave, onCancel, setHasUnsavedChanges }) => {
  const { notify, confirm } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [targetModuleFields, setTargetModuleFields] = useState([]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 🔥 Estilos consistentes para React-Select 🔥
  const customSingleSelectStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.75rem', padding: '0.1rem', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black', '&:hover': { borderColor: isDarkMode ? '#4b5563' : '#9ca3af' } }),
    singleValue: (provided) => ({ ...provided, color: isDarkMode ? '#f9fafb' : '#111827' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', zIndex: 99999 }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
  };

  const customMultiSelectStyles = {
    control: (provided) => ({ 
      ...provided, 
      borderColor: isDarkMode ? '#374151' : '#e5e7eb', 
      backgroundColor: isDarkMode ? '#111827' : 'white', 
      borderRadius: '0.75rem', 
      padding: '0.1rem', 
      fontSize: '0.875rem', 
      boxShadow: 'none', 
      color: isDarkMode ? 'white' : 'black'
    }),
    // 🔥 FIX: Limitamos la altura del contenedor de los chips seleccionados 🔥
    valueContainer: (provided) => ({
      ...provided,
      maxHeight: '70px', // Límite de altura (aprox. 3 filas de usuarios)
      overflowY: 'auto'   // Scroll interno si se pasa de esa altura
    }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', zIndex: 999999 }),
    menuPortal: base => ({ ...base, zIndex: 999999 }), 
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
    multiValue: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#374151' : '#eff6ff', borderRadius: '0.5rem' }),
    multiValueLabel: (provided) => ({ ...provided, color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontWeight: 'bold' }),
    multiValueRemove: (provided) => ({ ...provided, color: isDarkMode ? '#9ca3af' : '#6b7280', ':hover': { backgroundColor: isDarkMode ? '#ef4444' : '#fee2e2', color: isDarkMode ? 'white' : '#ef4444' } }),
  };

  // 🔥 Helper para el Multicast: Generar opciones para el Select 🔥
  const notificationOptions = [
    { label: 'Usuarios Específicos', options: (companyUsers||[]).map(u => ({ value: `user_${u.id}`, label: `👤 ${u.first_name ? u.first_name + ' ' + (u.last_name || '') : u.email}` })) },
    { label: 'Roles (Jerarquía)', options: (companyRoles||[]).map(r => ({ value: `role_${r.id}`, label: `🏢 Rol: ${r.name}` })) },
    { label: 'Perfiles (Permisos)', options: (companyProfiles||[]).map(p => ({ value: `profile_${p.id}`, label: `🛡️ Perfil: ${p.name}` })) }
  ];

  const getSelectedNotificationTargets = () => {
     const cfg = rule.action_config || {};
     let selected = [];
     if(cfg.notify_users) selected = [...selected, ...cfg.notify_users.map(id => notificationOptions[0].options.find(o => o.value === `user_${id}`))];
     if(cfg.notify_roles) selected = [...selected, ...cfg.notify_roles.map(id => notificationOptions[1].options.find(o => o.value === `role_${id}`))];
     if(cfg.notify_profiles) selected = [...selected, ...cfg.notify_profiles.map(id => notificationOptions[2].options.find(o => o.value === `profile_${id}`))];
     return selected.filter(Boolean);
  };

  const handleNotificationTargetsChange = (selectedOptions) => {
     const cfg = { notify_users: [], notify_roles: [], notify_profiles: [] };
     selectedOptions.forEach(opt => {
        const [type, id] = opt.value.split('_');
        if(type === 'user') cfg.notify_users.push(parseInt(id));
        if(type === 'role') cfg.notify_roles.push(parseInt(id));
        if(type === 'profile') cfg.notify_profiles.push(parseInt(id));
     });
     updateRule({ action_config: cfg });
  };

  // 🔥 INICIALIZACIÓN BLINDADA CONTRA CRASHEOS 🔥
  const [rule, setRule] = useState(() => {
    if (!initialRule) {
      return {
        name: '', event_type: 'ON_UPDATE', trigger_field: '', condition_field: '',
        condition_operator: '==', condition_value: '', action_type: 'UPDATE_FIELD',
        target_field: '', action_value: '', function_code: '', action_config: { mapping: {} }
      };
    }

    let safeConfig = { mapping: {} };
    if (typeof initialRule.action_config === 'string') {
      try { safeConfig = JSON.parse(initialRule.action_config); } catch (e) { }
    } else if (typeof initialRule.action_config === 'object' && initialRule.action_config !== null) {
      safeConfig = { ...initialRule.action_config };
    }
    if (!safeConfig.mapping) safeConfig.mapping = {};

    return {
      name: initialRule.name || '',
      event_type: initialRule.event_type || 'ON_UPDATE',
      trigger_field: initialRule.trigger_field || '',
      condition_field: initialRule.condition_field || '',
      condition_operator: initialRule.condition_operator || '==',
      condition_value: initialRule.condition_value || '',
      action_type: initialRule.action_type || 'UPDATE_FIELD',
      target_field: initialRule.target_field || '',
      action_value: initialRule.action_value || '',
      function_code: initialRule.function_code || '',
      action_config: safeConfig
    };
  });

  const updateRule = (updates) => {
    setRule(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
    if (setHasUnsavedChanges) setHasUnsavedChanges(true);
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  useEffect(() => {
     const controller = new AbortController();
     if (rule.action_type === 'CREATE_RECORD' && rule.action_config?.module_id) {
         api.get(`/api/v1/fields/?module_id=${rule.action_config.module_id}`, { signal: controller.signal })
            .then(res => setTargetModuleFields(res.data?.filter(f => f.is_active) || []))
            .catch(err => { if (err.name !== 'CanceledError') console.error(err); });
     } else {
         setTargetModuleFields([]);
     }
     return () => controller.abort();
  }, [rule.action_config?.module_id, rule.action_type]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!rule.name.trim()) return notify.warning("El nombre de la regla es obligatorio.");

    setIsSaving(true);
    try {
      const payload = { ...rule, module_id: moduleId };
      if (payload.action_type === 'CHANGE_OWNER') payload.target_field = 'assigned_to';
      // Limpieza de Action Configs no usados
      if (!['CREATE_RECORD', 'SEND_NOTIFICATION'].includes(payload.action_type)) {
         payload.action_config = {}; 
      }

      if (initialRule?.id) {
        await api.put(`/api/v1/automations/${initialRule.id}`, payload);
        notify.success("Regla actualizada con éxito.");
      } else {
        await api.post('/api/v1/automations/', payload);
        notify.success("Regla creada con éxito.");
      }
      
      setHasChanges(false);
      if (setHasUnsavedChanges) setHasUnsavedChanges(false);
      onSave(); 
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al guardar la automatización.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseAttempt = async () => {
    if (hasChanges) {
      const isConfirmed = await confirm({
        title: 'Cambios sin guardar',
        message: '¿Estás seguro de que deseas descartar los cambios y salir?',
        confirmText: 'Descartar y salir',
        variant: 'danger'
      });
      if (!isConfirmed) return;
    }
    setHasChanges(false);
    if (setHasUnsavedChanges) setHasUnsavedChanges(false);
    onCancel();
  };

  // Funciones de Mapeo
  const handleAddMappingRow = () => {
      const currentConfig = { ...(rule.action_config || { mapping: {} }) }; 
      if (!currentConfig.mapping) currentConfig.mapping = {};
      const mappedKeys = Object.keys(currentConfig.mapping);
      const availableTarget = targetModuleFields.find(f => !mappedKeys.includes(f.api_name || f.label));
      
      if(availableTarget) {
         currentConfig.mapping[availableTarget.api_name || availableTarget.label] = { type: 'static', value: '' };
         updateRule({ action_config: currentConfig });
      } else {
         notify.info("Ya mapeaste todos los campos disponibles.");
      }
  };

  const handleUpdateMappingRow = (oldTargetKey, newTargetKey, type, value) => {
      const currentConfig = { ...(rule.action_config || { mapping: {} }) };
      const map = { ...(currentConfig.mapping || {}) };
      if (oldTargetKey !== newTargetKey) delete map[oldTargetKey];
      map[newTargetKey] = { type: type || 'static', value: value || '' };
      currentConfig.mapping = map;
      updateRule({ action_config: currentConfig });
  };

  const handleRemoveMappingRow = (targetKey) => {
      const currentConfig = { ...(rule.action_config || { mapping: {} }) };
      const map = { ...(currentConfig.mapping || {}) };
      delete map[targetKey];
      currentConfig.mapping = map;
      updateRule({ action_config: currentConfig });
  };

  const selectedConditionField = fields.find(f => (f.api_name || f.label) === rule.condition_field);

  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 max-w-4xl mx-auto my-6 flex flex-col max-h-[85vh]">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/80 dark:bg-gray-900/80">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
          <button onClick={handleCloseAttempt} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mr-1"><ArrowLeft size={16}/></button>
          {initialRule ? 'Editar Automatización' : 'Nueva Automatización'}
        </h2>
        <button onClick={handleCloseAttempt} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 p-1.5 rounded-lg transition-colors"><X size={18} /></button>
      </div>

      <form onSubmit={handleSave} className="p-6 md:p-8 space-y-10 overflow-y-auto custom-scrollbar">
        <div>
          <input 
            type="text" required placeholder="Nombra esta automatización..."
            value={rule.name} onChange={e => updateRule({ name: e.target.value })}
            className="w-full bg-transparent text-2xl font-bold text-gray-900 dark:text-white border-b-2 border-transparent hover:border-gray-200 dark:hover:border-gray-800 focus:border-blue-500 outline-none transition-colors pb-2 placeholder:text-gray-300 dark:placeholder:text-gray-700"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-start relative">
            <div className="space-y-8">
                {/* 1. CUÁNDO */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Play size={14} className="text-gray-900 dark:text-white"/> 1. Cuándo ocurre esto</h3>
                  <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                     <select value={rule.event_type} onChange={e => updateRule({ event_type: e.target.value })} className="w-full bg-transparent font-medium text-gray-900 dark:text-white outline-none cursor-pointer">
                        <option value="ON_CREATE">Al crear un registro nuevo</option>
                        <option value="ON_UPDATE">Al guardar/actualizar un registro</option>
                        <option value="ON_FIELD_CHANGE">Cuando un campo específico cambia</option>
                        <option value="ON_SLA_BREACH">Cuando el tiempo límite (SLA) se agota</option>
                     </select>
                     {rule.event_type === 'ON_FIELD_CHANGE' && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 animate-in fade-in">
                           <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Selecciona el campo detonante</label>
                           <Select 
                              options={fields.map(f => ({ value: f.api_name || f.label, label: f.display_label }))}
                              value={rule.trigger_field ? { value: rule.trigger_field, label: fields.find(f => (f.api_name || f.label) === rule.trigger_field)?.display_label || rule.trigger_field } : null}
                              onChange={(opt) => updateRule({ trigger_field: opt.value })}
                              placeholder="Buscar campo..."
                              styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                           />
                        </div>
                     )}
                  </div>
                </div>

                {/* 2. SI (Condiciones) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Filter size={14} className="text-gray-900 dark:text-white"/> 2. Y se cumple que (Opcional)</h3>
                  <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                     <Select 
                        options={[{value: '', label: 'Aplicar siempre (Sin condición)'}, ...fields.map(f => ({ value: f.api_name || f.label, label: f.display_label }))]}
                        value={{ value: rule.condition_field || '', label: rule.condition_field ? (fields.find(f => (f.api_name || f.label) === rule.condition_field)?.display_label || rule.condition_field) : 'Aplicar siempre (Sin condición)' }}
                        onChange={(opt) => {
                           const val = opt.value;
                           const field = fields.find(f => (f.api_name || f.label) === val);
                           let newOperator = '=='; let newValue = '';
                           if (field) {
                              if (field.field_type === 'file' || field.field_type === 'image') { newOperator = '!='; newValue = ''; } 
                              else if (field.field_type === 'checkbox') { newValue = 'true'; }
                           }
                           updateRule({ condition_field: val, condition_operator: newOperator, condition_value: newValue });
                        }}
                        placeholder="Condición basada en campo..."
                        styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                     />
                     
                     {rule.condition_field && selectedConditionField && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1 animate-in fade-in">
                           <select value={rule.condition_operator || '=='} onChange={e => updateRule({ condition_operator: e.target.value })} className="w-full sm:w-1/2 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none text-sm text-gray-900 dark:text-white focus:border-blue-500">
                              {(selectedConditionField.field_type === 'file' || selectedConditionField.field_type === 'image') ? (
                                 <><option value="!=">No está vacío</option><option value="==">Está vacío</option></>
                              ) : (
                                 <><option value="==">Es igual a</option><option value="!=">Diferente de</option><option value=">">Mayor a</option><option value="<">Menor a</option><option value="CONTAINS">Contiene</option></>
                              )}
                           </select>
                           <input type="text" placeholder="Valor..." required value={rule.condition_value || ''} onChange={e => updateRule({ condition_value: e.target.value })} className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none text-sm text-gray-900 dark:text-white focus:border-blue-500" />
                        </div>
                     )}
                  </div>
                </div>
            </div>

            <div className="hidden md:flex flex-col items-center justify-center h-full pt-10 text-gray-300 dark:text-gray-700"><ArrowRight size={24} strokeWidth={1.5} /></div>

            {/* 3. ENTONCES */}
            <div className="space-y-3">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-blue-500 fill-blue-500"/> 3. Entonces hacer</h3>
               <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 shadow-sm shadow-blue-500/5">
                  <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">Acción a Ejecutar</label>
                  <select value={rule.action_type} onChange={e => updateRule({ action_type: e.target.value, target_field: '', action_value: '', action_config: { mapping: {} } })} className="w-full mb-5 pb-2 bg-transparent text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 outline-none cursor-pointer">
                     <optgroup label="Súper Acciones"><option value="CHANGE_OWNER">Cambiar Propietario</option><option value="COPY_FIELD">Copiar Valor de Campo</option><option value="CREATE_RECORD">Crear Registro en otro Módulo</option></optgroup>
                     <optgroup label="Motor Inteligente">
                         <option value="DATA_MATCHING">Matching de Oferta/Demanda (Cruce de Datos)</option>
                     </optgroup>
                     <optgroup label="Integraciones (iPaaS)"><option value="WEBHOOK_OUT">Llamar Webhook (API Externa)</option><option value="SEND_SLACK">Enviar mensaje a Slack/Teams</option></optgroup>
                     <optgroup label="Datos y Lógica"><option value="UPDATE_FIELD">Sobrescribir Valor Fijo</option><option value="CUSTOM_FUNCTION">Script Low-Code (Python)</option><option value="SEND_NOTIFICATION">Disparar Alerta (Multicast)</option></optgroup>
                     <optgroup label="Interfaz (UI)"><option value="SET_REQUIRED">Hacer Obligatorio</option><option value="SET_OPTIONAL">Quitar Obligatoriedad</option><option value="SET_READONLY">Bloquear (Solo Lectura)</option><option value="SET_EDITABLE">Desbloquear</option><option value="SET_HIDDEN">Ocultar Campo o Sección</option><option value="SET_VISIBLE">Mostrar Campo o Sección</option></optgroup>
                  </select>

                  <div className="animate-in fade-in duration-200">
                     
                     {/* 🔥 ROUND ROBIN Y ASIGNACIONES 🔥 */}
                     {rule.action_type === 'CHANGE_OWNER' && (
                        <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-5 rounded-xl">
                           <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-2 flex items-center gap-1.5"><User size={14}/> Destino de Asignación</label>
                           <Select 
                              options={[
                                 { label: 'Usuarios Específicos', options: (companyUsers||[]).map(u => ({ value: u.id.toString(), label: `👤 ${u.first_name ? u.first_name + ' ' + (u.last_name || '') : u.email}` })) },
                                 { label: 'Roles (Round Robin)', options: (companyRoles||[]).map(r => ({ value: `role_${r.id}`, label: `🏢 Rol: ${r.name}` })) },
                                 { label: 'Perfiles (Round Robin)', options: (companyProfiles||[]).map(p => ({ value: `profile_${p.id}`, label: `🛡️ Perfil: ${p.name}` })) }
                              ]}
                              value={rule.action_value ? { value: rule.action_value, label: rule.action_value.startsWith('role_') ? `🏢 Rol` : rule.action_value.startsWith('profile_') ? `🛡️ Perfil` : `👤 Usuario` } : null}
                              onChange={(opt) => updateRule({ action_value: opt.value })}
                              placeholder="Buscar destinatario..."
                              styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                           />
                           <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-2 italic">Si eliges Rol o Perfil, el sistema asignará los casos equitativamente uno a uno a los miembros del grupo.</p>
                        </div>
                     )}

                     {/* 🔥 NOTIFICACIONES MULTICAST 🔥 */}
                     {rule.action_type === 'SEND_NOTIFICATION' && (
                        <div className="space-y-4">
                           <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-5 rounded-xl">
                              <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-2 flex items-center gap-1.5"><BellRing size={14}/> Destinatarios (Multicast)</label>
                              <Select 
                                 isMulti 
                                 options={notificationOptions} 
                                 value={getSelectedNotificationTargets()} 
                                 onChange={handleNotificationTargetsChange} 
                                 placeholder="Selecciona usuarios, roles o perfiles..." 
                                 styles={customMultiSelectStyles} 
                                 menuPortalTarget={document.body} 
                                 menuPosition={'fixed'} 
                                 menuShouldScrollIntoView={false}
                              />
                              <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 mt-2 italic">Si no seleccionas a nadie, se notificará únicamente al creador del registro.</p>
                           </div>
                           
                           {/* 🔥 NUEVO: Botón para abrir el Modal de Plantilla 🔥 */}
                           <button 
                              type="button" 
                              onClick={() => setIsEmailModalOpen(true)}
                              className="w-full bg-white dark:bg-gray-900 border border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                           >
                              <Edit2 size={16} /> Configurar Plantilla y Correo
                           </button>
                        </div>
                     )}

                     {/* 🔥 CONTROL DE UI (INCLUYE SECCIONES) 🔥 */}
                     {['UPDATE_FIELD', 'SET_REQUIRED', 'SET_OPTIONAL', 'SET_READONLY', 'SET_EDITABLE', 'SET_HIDDEN', 'SET_VISIBLE'].includes(rule.action_type) && (
                        <div>
                           <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">¿A qué elemento de este registro aplica?</label>
                           <Select 
                              options={(() => {
                                 let opts = [];
                                 if (['SET_HIDDEN', 'SET_VISIBLE'].includes(rule.action_type) && (moduleSections||[]).length > 0) {
                                    opts.push({ label: 'Secciones Completas', options: moduleSections.map(s => ({ value: `section_${s.id}`, label: `🗂️ Sección: ${s.title}` })) });
                                 }
                                 opts.push({ label: 'Campos Individuales', options: fields.map(f => ({ value: f.api_name || f.label, label: `📝 Campo: ${f.display_label}` })) });
                                 return opts;
                              })()}
                              value={rule.target_field ? { value: rule.target_field, label: rule.target_field.startsWith('section_') ? `Sección ID ${rule.target_field.split('_')[1]}` : fields.find(f => (f.api_name || f.label) === rule.target_field)?.display_label || rule.target_field } : null}
                              onChange={(opt) => updateRule({ target_field: opt.value })}
                              placeholder="Buscar campo o sección..."
                              styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                           />
                        </div>
                     )}

                     {rule.action_type === 'UPDATE_FIELD' && (
                        <div className="mt-4">
                           <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Nuevo Valor</label>
                           <input type="text" placeholder="Ej: Aprobado" required value={rule.action_value || ''} onChange={e => updateRule({ action_value: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm text-gray-900 dark:text-white" />
                        </div>
                     )}

                     {/* COPY FIELD */}
                     {rule.action_type === 'COPY_FIELD' && (
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                           <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Copiar Desde (Origen)</label>
                              <Select 
                                 options={fields.map(f => ({ value: f.api_name || f.label, label: f.display_label }))}
                                 value={rule.action_value ? { value: rule.action_value, label: fields.find(f => (f.api_name || f.label) === rule.action_value)?.display_label || rule.action_value } : null}
                                 onChange={(opt) => updateRule({ action_value: opt.value })}
                                 placeholder="Buscar Origen..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                              />
                           </div>
                           <div className="flex justify-center text-gray-400 mt-6 sm:mt-0"><ArrowRight size={24} className="rotate-90 sm:rotate-0"/></div>
                           <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Pegar En (Destino)</label>
                              <Select 
                                 options={fields.map(f => ({ value: f.api_name || f.label, label: f.display_label }))}
                                 value={rule.target_field ? { value: rule.target_field, label: fields.find(f => (f.api_name || f.label) === rule.target_field)?.display_label || rule.target_field } : null}
                                 onChange={(opt) => updateRule({ target_field: opt.value })}
                                 placeholder="Buscar Destino..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                              />
                           </div>
                        </div>
                     )}

                     {/* CREATE RECORD */}
                     {rule.action_type === 'CREATE_RECORD' && (
                        <div className="space-y-4">
                           <div>
                              <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase mb-1.5"><Database size={14} className="inline mr-1"/>Módulo Destino</label>
                              <Select 
                                 options={allModules.filter(m => m.id !== moduleId).map(m => ({ value: m.id, label: m.name }))}
                                 value={rule.action_config?.module_id ? { value: rule.action_config.module_id, label: allModules.find(m => m.id === parseInt(rule.action_config.module_id))?.name } : null}
                                 onChange={(opt) => updateRule({ action_config: { module_id: opt.value, form_id: '', mapping: {} } })}
                                 placeholder="Buscar módulo..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                              />
                           </div>
                           {rule.action_config?.module_id && (
                              <div>
                                 <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Formulario a usar</label>
                                 <Select 
                                    options={allForms.filter(f => f.module_id == rule.action_config.module_id).map(form => ({ value: form.id, label: form.name }))}
                                    value={rule.action_config?.form_id ? { value: rule.action_config.form_id, label: allForms.find(f => f.id === parseInt(rule.action_config.form_id))?.name } : null}
                                    onChange={(opt) => updateRule({ action_config: { ...rule.action_config, form_id: opt.value } })}
                                    placeholder="Buscar Formulario..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                                 />
                              </div>
                           )}
                           {rule.action_config?.form_id && targetModuleFields.length > 0 && (
                              <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                                 <div className="flex justify-between items-center mb-3">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Mapeo de Datos</label>
                                    <button type="button" onClick={handleAddMappingRow} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"><Plus size={10}/> Añadir</button>
                                 </div>
                                 <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {Object.entries(rule.action_config?.mapping || {}).map(([targetKey, configData]) => (
                                       <div key={targetKey} className="flex flex-col gap-1.5 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                          <div className="flex items-center gap-2">
                                             <select value={targetKey} onChange={e => handleUpdateMappingRow(targetKey, e.target.value, configData?.type || 'static', configData?.value || '')} className="flex-1 text-[10px] font-bold bg-transparent border-b border-gray-300 dark:border-gray-600 outline-none text-gray-900 dark:text-white pb-0.5">
                                                {targetModuleFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.display_label}</option>)}
                                             </select>
                                             <button type="button" onClick={() => handleRemoveMappingRow(targetKey)} className="text-gray-400 hover:text-red-500"><X size={12}/></button>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                             <select value={configData?.type || 'static'} onChange={e => handleUpdateMappingRow(targetKey, targetKey, e.target.value, '')} className="w-20 text-[10px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-1 py-1 outline-none text-gray-600 dark:text-gray-300">
                                                <option value="static">Fijo</option>
                                                <option value="dynamic">Dinámico</option>
                                             </select>
                                             {configData?.type === 'static' ? (
                                                <input type="text" placeholder="Valor..." value={configData?.value || ''} onChange={e => handleUpdateMappingRow(targetKey, targetKey, 'static', e.target.value)} className="flex-1 text-[10px] px-2 py-1 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 outline-none text-gray-900 dark:text-white" />
                                             ) : (
                                                <select value={configData?.value || ''} onChange={e => handleUpdateMappingRow(targetKey, targetKey, 'dynamic', e.target.value)} className="flex-1 text-[10px] px-2 py-1 rounded bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 outline-none text-gray-900 dark:text-white">
                                                   <option value="">Campo actual...</option>
                                                   {fields.map(f => <option key={`map-src-${f.id}`} value={f.api_name || f.label}>{f.display_label}</option>)}
                                                </select>
                                             )}
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>
                     )}

                     {/* 🔥 FASE 2: MOTOR DE MATCHING (GRAPP) 🔥 */}
                     {rule.action_type === 'DATA_MATCHING' && (
                        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-5 mt-4 space-y-4">
                           <div className="flex items-center gap-2 mb-2">
                               <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                               </div>
                               <div>
                                  <h4 className="font-bold text-indigo-800 dark:text-indigo-300">Motor de Inteligencia de Mercado</h4>
                                  <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70">Buscará coincidencias exactas en otro módulo y alertará a ambas partes.</p>
                               </div>
                           </div>

                           <div>
                              <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Database size={14}/> ¿En qué módulo buscará coincidencias?</label>
                              <Select 
                                 options={allModules.filter(m => m.id !== parseInt(moduleId)).map(m => ({ value: m.id, label: m.name }))}
                                 value={rule.action_config?.target_module_id ? { value: rule.action_config.target_module_id, label: allModules.find(m => m.id === parseInt(rule.action_config.target_module_id))?.name } : null}
                                 onChange={(opt) => updateRule({ action_config: { target_module_id: opt.value, match_criteria: [] } })}
                                 placeholder="Selecciona el Módulo Destino..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                              />
                           </div>

                           {rule.action_config?.target_module_id && (
                              <div className="space-y-3 pt-3 border-t border-indigo-100 dark:border-indigo-800/30 animate-in fade-in">
                                 <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reglas de Coincidencia (Match)</label>
                                    <button 
                                       type="button" 
                                       onClick={() => {
                                          const currentCriteria = rule.action_config?.match_criteria || [];
                                          updateRule({ action_config: { ...rule.action_config, match_criteria: [...currentCriteria, { source_field: '', target_field: '', operator: '==' }] } });
                                       }}
                                       className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors flex items-center gap-1"
                                    >
                                       <Plus size={10}/> Añadir Condición
                                    </button>
                                 </div>

                                 <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {(rule.action_config?.match_criteria || []).map((crit, idx) => (
                                       <div key={idx} className="flex flex-col gap-1.5 bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                                          <div className="flex items-center gap-2">
                                             <select 
                                                required
                                                value={crit.source_field} 
                                                onChange={e => {
                                                   const newCriteria = [...rule.action_config.match_criteria];
                                                   newCriteria[idx].source_field = e.target.value;
                                                   updateRule({ action_config: { ...rule.action_config, match_criteria: newCriteria } });
                                                }}
                                                className="flex-1 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none text-gray-700 dark:text-gray-200"
                                             >
                                                <option value="">Campo actual...</option>
                                                {fields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.display_label}</option>)}
                                             </select>
                                             
                                             <select 
                                                value={crit.operator} 
                                                onChange={e => {
                                                   const newCriteria = [...rule.action_config.match_criteria];
                                                   newCriteria[idx].operator = e.target.value;
                                                   updateRule({ action_config: { ...rule.action_config, match_criteria: newCriteria } });
                                                }}
                                                className="w-16 px-1 py-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded outline-none text-center font-mono font-bold"
                                             >
                                                <option value="==">==</option>
                                                <option value=">">&gt;</option>
                                                <option value="<">&lt;</option>
                                             </select>

                                             <button 
                                                type="button" 
                                                onClick={() => {
                                                   const newCriteria = [...rule.action_config.match_criteria];
                                                   newCriteria.splice(idx, 1);
                                                   updateRule({ action_config: { ...rule.action_config, match_criteria: newCriteria } });
                                                }} 
                                                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                             >
                                                <X size={14}/>
                                             </button>
                                          </div>
                                          
                                          <input 
                                             type="text" 
                                             required
                                             placeholder="API Name del campo en módulo destino (Ej: grano_buscado)"
                                             value={crit.target_field} 
                                             onChange={e => {
                                                const newCriteria = [...rule.action_config.match_criteria];
                                                newCriteria[idx].target_field = e.target.value;
                                                updateRule({ action_config: { ...rule.action_config, match_criteria: newCriteria } });
                                             }}
                                             className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded outline-none font-mono text-gray-700 dark:text-gray-200 focus:border-indigo-500"
                                          />
                                       </div>
                                    ))}
                                    {(!rule.action_config?.match_criteria || rule.action_config.match_criteria.length === 0) && (
                                       <p className="text-[10px] text-gray-400 italic text-center py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">No hay reglas definidas. Añade una para empezar el cruce.</p>
                                    )}
                                 </div>
                              </div>
                           )}
                        </div>
                     )}

                     {rule.action_type === 'CUSTOM_FUNCTION' && (
                        <div className="mt-4 animate-in fade-in space-y-3">
                           <label className="block text-xs font-bold text-green-600 dark:text-green-500 uppercase mb-2 flex items-center gap-1.5">
                             <Code size={14}/> Lógica Programable (Low-Code)
                           </label>
                           
                           <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-inner group">
                              <div className="flex items-center justify-between mb-4">
                                 <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-mono text-green-500/80 tracking-widest uppercase">Entorno Python 3.11</span>
                                 </div>
                                 <button 
                                    type="button"
                                    onClick={() => setIsCodeEditorOpen(true)}
                                    className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                                 >
                                    <Edit2 size={14}/> Abrir Editor Avanzado
                                 </button>
                              </div>
                              <pre className="text-xs text-gray-400 font-mono bg-black/30 p-4 rounded-lg border border-gray-800 max-h-[100px] overflow-hidden opacity-60">
                                 {rule.function_code || "# No hay código definido aún..."}
                              </pre>
                           </div>

                           <CodeEditorModalGlobal 
                              isOpen={isCodeEditorOpen}
                              onClose={() => setIsCodeEditorOpen(false)}
                              initialCode={rule.function_code}
                              mockDataInitial={null} 
                              onSave={(updatedCode) => {
                                 updateRule({ function_code: updatedCode });
                                 setIsCodeEditorOpen(false);
                              }}
                           />
                        </div>
                     )}
                     {/* 🔥 FASE 3: BOTÓN PARA ABRIR MODAL DE WEBHOOK/SLACK 🔥 */}
                     {(rule.action_type === 'WEBHOOK_OUT' || rule.action_type === 'SEND_SLACK') && (
                        <div className="space-y-4 mt-4">
                           <div className={`p-5 rounded-xl border ${rule.action_type === 'WEBHOOK_OUT' ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' : 'bg-indigo-50/30 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                 {rule.action_type === 'WEBHOOK_OUT' ? <Globe className="text-blue-500" size={16}/> : <MessageSquare className="text-indigo-500" size={16}/>}
                                 <h4 className={`text-xs font-bold uppercase ${rule.action_type === 'WEBHOOK_OUT' ? 'text-blue-700 dark:text-blue-400' : 'text-indigo-700 dark:text-indigo-400'}`}>
                                    {rule.action_type === 'WEBHOOK_OUT' ? 'Llamada a API Externa' : 'Webhook de Slack / Teams'}
                                 </h4>
                              </div>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-4">
                                 Haz clic en el botón de abajo para configurar la URL de destino y el contenido que se enviará.
                              </p>
                              <button 
                                 type="button" 
                                 onClick={() => setIsWebhookModalOpen(true)}
                                 className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm border border-dashed ${rule.action_type === 'WEBHOOK_OUT' ? 'bg-white dark:bg-gray-900 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20' : 'bg-white dark:bg-gray-900 border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20'}`}
                              >
                                 <Edit2 size={16} /> Configurar Integración
                              </button>
                           </div>
                        </div>
                     )}

                  </div>
               </div>
            </div>
        </div>

        <div className="flex gap-3 justify-end pt-6 border-t border-gray-100 dark:border-gray-800 mt-8">
          <button type="button" onClick={handleCloseAttempt} className="px-5 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            Descartar
          </button>
          <button type="submit" disabled={isSaving} className="px-6 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            {initialRule ? 'Guardar Cambios' : 'Activar Regla'}
          </button>
        </div>
      </form>
      {/* 🔥 MODAL FLOTANTE DE PLANTILLA DE CORREO 🔥 */}
      {isEmailModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BellRing size={18} className="text-amber-500" /> Plantilla de Alerta
              </h3>
              <button type="button" onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors">
                <X size={18}/>
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar max-h-[70vh]">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Título de la Alerta (Asunto del Correo)</label>
                <input type="text" placeholder="Ej: Registro Actualizado" required value={rule.target_field} onChange={e => updateRule({ target_field: e.target.value })} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mensaje / Cuerpo del Correo</label>
                <textarea rows={4} placeholder="Ej: Se han aplicado nuevas reglas automáticas." value={rule.action_value} onChange={e => updateRule({ action_value: e.target.value })} className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm resize-none custom-scrollbar" />
              </div>
              
              <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <input
                  type="checkbox"
                  id="send_email_check_modal"
                  checked={rule.action_config?.send_email || false}
                  onChange={e => {
                    const currentConfig = rule.action_config || {};
                    updateRule({ action_config: { ...currentConfig, send_email: e.target.checked } });
                  }}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="send_email_check_modal" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                  ✉️ Enviar también copia por correo electrónico
                </label>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
              <button type="button" onClick={() => setIsEmailModalOpen(false)} className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95">
                Confirmar Plantilla
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* 🔥 MODAL FLOTANTE DE WEBHOOKS Y SLACK 🔥 */}
      {isWebhookModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {rule.action_type === 'WEBHOOK_OUT' ? <Globe size={18} className="text-blue-500" /> : <MessageSquare size={18} className="text-indigo-500" />} 
                {rule.action_type === 'WEBHOOK_OUT' ? 'Configurar Webhook' : 'Configurar Slack / Teams'}
              </h3>
              <button type="button" onClick={() => setIsWebhookModalOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors">
                <X size={18}/>
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar max-h-[70vh]">
               {rule.action_type === 'WEBHOOK_OUT' ? (
                  <>
                     <div className="flex gap-2">
                        <select 
                           value={rule.action_config?.method || 'POST'} 
                           onChange={e => updateRule({ action_config: { ...rule.action_config, method: e.target.value } })}
                           className="w-24 text-sm font-bold bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-2 outline-none text-blue-600 dark:text-blue-400"
                        >
                           <option value="POST">POST</option>
                           <option value="GET">GET</option>
                           <option value="PUT">PUT</option>
                        </select>
                        <input 
                           type="url" required placeholder="https://api.tu-sistema.com/webhook" 
                           value={rule.target_field || ''} 
                           onChange={e => updateRule({ target_field: e.target.value })} 
                           className="flex-1 px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm text-gray-900 dark:text-white focus:border-blue-500 font-mono" 
                        />
                     </div>
                     <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Payload (Cuerpo en JSON)</label>
                          <span className="text-[9px] text-gray-400">Usa {'{case_data}'} para inyectar todo</span>
                        </div>
                        <textarea 
                           rows={6} required placeholder='{ "id": "{case_id}", "status": "{status_name}", "data": "{case_data}" }' 
                           value={rule.action_value || ''} 
                           onChange={e => updateRule({ action_value: e.target.value })} 
                           className="w-full px-3 py-3 bg-gray-900 text-green-400 border border-gray-800 rounded-lg outline-none text-xs font-mono focus:border-blue-500 custom-scrollbar resize-y" 
                        />
                     </div>
                  </>
               ) : (
                  <>
                     <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">URL del Webhook (Incoming Webhook)</label>
                        <input 
                           type="url" required placeholder="https://hooks.slack.com/services/T0000/B0000/XXXXX" 
                           value={rule.target_field || ''} 
                           onChange={e => updateRule({ target_field: e.target.value })} 
                           className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm text-gray-900 dark:text-white focus:border-indigo-500 font-mono" 
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Mensaje a Enviar</label>
                        <textarea 
                           rows={4} required placeholder='Ej: ¡Atención! Se ha escalado el caso #{case_id}' 
                           value={rule.action_value || ''} 
                           onChange={e => updateRule({ action_value: e.target.value })} 
                           className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm text-gray-900 dark:text-white focus:border-indigo-500 custom-scrollbar resize-y" 
                        />
                     </div>
                  </>
               )}
            </div>
            
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
              <button type="button" onClick={() => setIsWebhookModalOpen(false)} className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95">
                Confirmar Configuración
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AutomationForm;