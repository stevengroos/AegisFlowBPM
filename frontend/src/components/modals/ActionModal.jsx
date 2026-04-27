import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Zap, User, BellRing, Edit2, ArrowRight, Database, Copy, Plus, ArrowLeft, Trash2, Code, Save, X, Loader2 } from 'lucide-react';
import Select from 'react-select';
import CodeEditorModal from './CodeEditorModal';
import api from '../../api/axios'; // 👇 AÑADE ESTO

const ActionModal = ({
  isOpen,
  onClose,
  onSave,
  newAction,
  setNewAction,
  editingActionId,
  moduleFields,
  moduleSections,
  allModules,
  allForms,
  targetModuleFields,
  companyUsers,
  companyRoles,
  companyProfiles,
  moduleId,
  blueprintId,
  selectedElement
}) => {
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [transitions, setTransitions] = useState([]); 
  // 🔥 ESTADOS PARA LA ACCIÓN DE SIGNATURIT 🔥
  const [signaturitTemplates, setSignaturitTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Efecto para cargar plantillas si se elige la acción de Signaturit
  useEffect(() => {
     if (newAction.action_type === 'SEND_SIGNATURIT' && signaturitTemplates.length === 0 && moduleId) {
        setLoadingTemplates(true);
        api.get(`/api/v1/modules/${moduleId}/integrations/signaturit/templates`)
           .then(res => setSignaturitTemplates(res.data || []))
           .catch(() => console.error("No se pudieron cargar las plantillas"))
           .finally(() => setLoadingTemplates(false));
     }
  }, [newAction.action_type, moduleId, signaturitTemplates.length]);

  // 👇 AÑADE ESTE EFECTO PARA CARGAR LAS FLECHAS CUANDO SE ABRA EL MODAL
  useEffect(() => {
    // 🔥 Le agregamos el blueprint_id a la URL para filtrar 🔥
    if (isEmailModalOpen && transitions.length === 0 && blueprintId) {
      api.get(`/api/v1/transitions/?blueprint_id=${blueprintId}`)
         .then(res => setTransitions(res.data))
         .catch(err => console.error("Error cargando transiciones:", err));
    }
  }, [isEmailModalOpen, transitions.length, blueprintId]);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (!isOpen) return null;

  // =================================================================
  // 🔥 LÓGICA MOVIDA DESDE EL CANVAS A ESTE MODAL 🔥
  // =================================================================
  const handleAddMappingRow = () => {
    const currentConfig = { ...newAction.action_config };
    if (!currentConfig.mapping) currentConfig.mapping = {};
    const mappedKeys = Object.keys(currentConfig.mapping);
    const availableTarget = targetModuleFields.find(f => !mappedKeys.includes(f.api_name || f.label));
    
    if(availableTarget) {
       currentConfig.mapping[availableTarget.api_name || availableTarget.label] = { type: 'static', value: '' };
       setNewAction({ ...newAction, action_config: currentConfig });
    }
  };

  const handleUpdateMappingRow = (oldTargetKey, newTargetKey, type, value) => {
    const currentConfig = { ...newAction.action_config };
    const map = { ...currentConfig.mapping };
    if (oldTargetKey !== newTargetKey) delete map[oldTargetKey];
    map[newTargetKey] = { type, value };
    currentConfig.mapping = map;
    setNewAction({ ...newAction, action_config: currentConfig });
  };

  const handleRemoveMappingRow = (targetKey) => {
    const currentConfig = { ...newAction.action_config };
    delete currentConfig.mapping[targetKey];
    setNewAction({ ...newAction, action_config: currentConfig });
  };

  const notificationOptions = [
    { label: 'Usuarios Específicos', options: companyUsers.map(u => ({ value: `user_${u.id}`, label: `👤 ${u.first_name ? u.first_name + ' ' + (u.last_name || '') : u.email}` })) },
    { label: 'Roles (Jerarquía)', options: companyRoles.map(r => ({ value: `role_${r.id}`, label: `🏢 Rol: ${r.name}` })) },
    { label: 'Perfiles (Permisos)', options: companyProfiles.map(p => ({ value: `profile_${p.id}`, label: `🛡️ Perfil: ${p.name}` })) }
  ];

  const getSelectedNotificationTargets = () => {
     const cfg = newAction.action_config || {};
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
     setNewAction({ ...newAction, action_config: cfg });
  };

  // =================================================================
  // ESTILOS DE REACT-SELECT
  // =================================================================
  const customSingleSelectStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.75rem', padding: '0.1rem', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black', '&:hover': { borderColor: isDarkMode ? '#4b5563' : '#9ca3af' } }),
    singleValue: (provided) => ({ ...provided, color: isDarkMode ? '#f9fafb' : '#111827' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', zIndex: 99999 }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
  };

  const customMultiSelectStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.75rem', padding: '0.1rem', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black' }),
    valueContainer: (provided) => ({ ...provided, maxHeight: '70px', overflowY: 'auto' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }),
    menuPortal: base => ({ ...base, zIndex: 999999 }), 
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
    multiValue: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#374151' : '#eff6ff', borderRadius: '0.5rem' }),
    multiValueLabel: (provided) => ({ ...provided, color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontWeight: 'bold' }),
    multiValueRemove: (provided) => ({ ...provided, color: isDarkMode ? '#9ca3af' : '#6b7280', ':hover': { backgroundColor: isDarkMode ? '#ef4444' : '#fee2e2', color: isDarkMode ? 'white' : '#ef4444' } }),
  };

  // 🔥 MAGIA DE UX: Filtrar las opciones para que solo muestre las salidas válidas 🔥
  const validTransitions = transitions.filter(t => {
    // Si estamos editando una acción en una flecha (ej: "INICIAR")...
    if (selectedElement?.type === 'transition') {
      // Queremos las flechas que SALEN del estado de DESTINO de la flecha actual
      // (ej: salen de "Medio")
      return t.from_status_id === selectedElement.data.to_status_id;
    }
    return true; // Por si acaso
  });

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
               <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <Zap size={18} className="text-blue-500 fill-blue-500"/> {editingActionId ? 'Editar Acción' : 'Configurar Nueva Acción'}
               </h3>
               <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>
            
            <form id="action-form" onSubmit={onSave} className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <div>
                   <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Tipo de Acción</label>
                   <select value={newAction.action_type} onChange={e => setNewAction({ action_type: e.target.value, target_field: '', action_value: '', function_code: '', action_config: {} })} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm transition-colors">
                     <optgroup label="Súper Acciones">
                        <option value="CHANGE_OWNER">Asignar Registro (Round Robin)</option>
                        <option value="COPY_FIELD">Copiar Valor de Campo</option>
                        <option value="CREATE_RECORD">Crear Registro en otro Módulo</option>
                     </optgroup>
                     {/* 🔥 NUEVO GRUPO: INTEGRACIONES 🔥 */}
                     <optgroup label="Integraciones Externas">
                        <option value="SEND_SIGNATURIT">Enviar Plantilla a Firmar (Signaturit)</option>
                     </optgroup>
                     <optgroup label="Datos y Lógica">
                        <option value="UPDATE_VALUE">Sobrescribir Valor Fijo</option>
                        <option value="CUSTOM_FUNCTION">Script Low-Code (Python)</option>
                        <option value="SEND_NOTIFICATION">Notificaciones (Multicast)</option>
                     </optgroup>
                     <optgroup label="Reglas de Interfaz (UI)">
                        <option value="SET_REQUIRED">Hacer Campo Obligatorio</option>
                        <option value="SET_OPTIONAL">Quitar Obligatoriedad</option>
                        <option value="SET_READONLY">Bloquear Campo (Solo Lectura)</option>
                        <option value="SET_EDITABLE">Desbloquear Campo</option>
                        <option value="SET_HIDDEN">Ocultar (Campo o Sección)</option>
                        <option value="SET_VISIBLE">Mostrar (Campo o Sección)</option>
                     </optgroup>
                   </select>
                </div>

                {newAction.action_type === 'CHANGE_OWNER' && (
                   <div className="animate-in fade-in duration-200 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-5 rounded-xl">
                      <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-2 flex items-center gap-1.5"><User size={14}/> Destino de Asignación</label>
                      <Select 
                         options={[
                            { label: 'Usuarios', options: companyUsers.map(u => ({ value: u.id.toString(), label: ` ${u.first_name ? u.first_name + ' ' + (u.last_name || '') : u.email}` })) },
                            { label: 'Roles (Round Robin)', options: companyRoles.map(r => ({ value: `role_${r.id}`, label: ` Rol: ${r.name}` })) },
                            { label: 'Perfiles (Round Robin)', options: companyProfiles.map(p => ({ value: `profile_${p.id}`, label: ` Perfil: ${p.name}` })) }
                         ]}
                         value={newAction.action_value ? { value: newAction.action_value, label: newAction.action_value } : null} 
                         onChange={(opt) => setNewAction({...newAction, action_value: opt.value})}
                         placeholder="Buscar destinatario..."
                         styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                      />
                      <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-2 italic">Si eliges Rol o Perfil, el sistema asignará los casos equitativamente uno a uno a los miembros del grupo.</p>
                   </div>
                )}

                {newAction.action_type === 'SEND_NOTIFICATION' && (
                   <div className="animate-in fade-in duration-200 space-y-4">
                     <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-5 rounded-xl">
                        <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-2 flex items-center gap-1.5"><BellRing size={14}/> Destinatarios (Multicast)</label>
                        <Select 
                           isMulti 
                           options={notificationOptions} 
                           value={getSelectedNotificationTargets()} 
                           onChange={handleNotificationTargetsChange} 
                           placeholder="Buscar usuarios, roles o perfiles..." 
                           styles={customMultiSelectStyles} 
                           menuPortalTarget={document.body} 
                           menuPosition={'fixed'} 
                           menuShouldScrollIntoView={false}
                        />
                        <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 mt-2 italic">Si no seleccionas a nadie, se notificará únicamente al creador del registro.</p>
                     </div>
                     
                     <button 
                        type="button" 
                        onClick={() => setIsEmailModalOpen(true)}
                        className="w-full bg-white dark:bg-gray-900 border border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                     >
                        <Edit2 size={16} /> Configurar Plantilla y Correo
                     </button>
                   </div>
                )}

                {['UPDATE_VALUE', 'SET_REQUIRED', 'SET_OPTIONAL', 'SET_READONLY', 'SET_EDITABLE', 'SET_HIDDEN', 'SET_VISIBLE'].includes(newAction.action_type) && (
                   <div className="animate-in fade-in duration-200">
                     <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">¿A qué elemento de este registro aplica?</label>
                     <Select 
                        options={(() => {
                           let opts = [];
                           if (['SET_HIDDEN', 'SET_VISIBLE'].includes(newAction.action_type) && moduleSections.length > 0) {
                              opts.push({ label: 'Secciones Completas', options: moduleSections.map(s => ({ value: `section_${s.id}`, label: `🗂️ Sección: ${s.title}` })) });
                           }
                           opts.push({ label: 'Campos Individuales', options: moduleFields.map(f => ({ value: f.api_name || f.label, label: `📝 Campo: ${f.display_label}` })) });
                           return opts;
                        })()}
                        value={newAction.target_field ? { value: newAction.target_field, label: newAction.target_field.startsWith('section_') ? `Sección ID ${newAction.target_field.split('_')[1]}` : moduleFields.find(f => (f.api_name || f.label) === newAction.target_field)?.display_label || newAction.target_field } : null}
                        onChange={(opt) => setNewAction({...newAction, target_field: opt.value})}
                        placeholder="Buscar campo o sección..."
                        styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                     />
                   </div>
                )}

                {newAction.action_type === 'COPY_FIELD' && (
                   <div className="animate-in fade-in duration-200 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Copiar Desde (Origen)</label>
                         <Select 
                            options={moduleFields.map(f => ({ value: f.api_name || f.label, label: f.display_label }))}
                            value={newAction.action_value ? { value: newAction.action_value, label: moduleFields.find(f => (f.api_name || f.label) === newAction.action_value)?.display_label || newAction.action_value } : null}
                            onChange={(opt) => setNewAction({...newAction, action_value: opt.value})}
                            placeholder="Buscar Origen..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                         />
                      </div>
                      <div className="flex justify-center text-gray-400 mt-6 sm:mt-0"><ArrowRight size={24} className="rotate-90 sm:rotate-0"/></div>
                      <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Pegar En (Destino)</label>
                         <Select 
                            options={moduleFields.map(f => ({ value: f.api_name || f.label, label: f.display_label }))}
                            value={newAction.target_field ? { value: newAction.target_field, label: moduleFields.find(f => (f.api_name || f.label) === newAction.target_field)?.display_label || newAction.target_field } : null}
                            onChange={(opt) => setNewAction({...newAction, target_field: opt.value})}
                            placeholder="Buscar Destino..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                         />
                      </div>
                   </div>
                )}

                {newAction.action_type === 'CREATE_RECORD' && (
                   <div className="animate-in fade-in duration-200 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase mb-2 flex items-center gap-1.5"><Database size={14}/> Módulo Destino</label>
                           <Select 
                              options={allModules.filter(m => m.id !== moduleId).map(m => ({ value: m.id, label: m.name }))}
                              value={newAction.action_config?.module_id ? { value: newAction.action_config.module_id, label: allModules.find(m => m.id === parseInt(newAction.action_config.module_id))?.name } : null}
                              onChange={(opt) => setNewAction({...newAction, action_config: { module_id: opt.value, form_id: '', mapping: {} }})}
                              placeholder="Buscar módulo..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                           />
                        </div>
                        {newAction.action_config?.module_id && (
                           <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Formulario a usar</label>
                              <Select 
                                 options={allForms.filter(f => f.module_id == newAction.action_config.module_id).map(form => ({ value: form.id, label: form.name }))}
                                 value={newAction.action_config?.form_id ? { value: newAction.action_config.form_id, label: allForms.find(f => f.id === parseInt(newAction.action_config.form_id))?.name } : null}
                                 onChange={(opt) => setNewAction({...newAction, action_config: { ...newAction.action_config, form_id: opt.value }})}
                                 placeholder="Buscar Formulario..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                              />
                           </div>
                        )}
                      </div>

                      {newAction.action_config?.form_id && targetModuleFields.length > 0 && (
                         <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                               <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2"><Copy size={16}/> Mapeo de Campos</label>
                               <button type="button" onClick={handleAddMappingRow} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"><Plus size={14}/> Añadir Campo</button>
                            </div>
                            
                            <div className="space-y-3">
                               {Object.keys(newAction.action_config.mapping || {}).length === 0 && <p className="text-sm text-gray-400 italic text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">No hay campos mapeados. El registro se creará vacío.</p>}
                               {Object.entries(newAction.action_config.mapping || {}).map(([targetKey, configData]) => (
                                  <div key={targetKey} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm group">
                                     <select value={targetKey} onChange={e => handleUpdateMappingRow(targetKey, e.target.value, configData.type, configData.value)} className="w-full text-sm font-semibold bg-transparent border-b border-gray-300 dark:border-gray-600 outline-none text-gray-900 dark:text-white pb-1 focus:border-blue-500">
                                        {targetModuleFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.display_label}</option>)}
                                     </select>
                                     <div className="hidden sm:flex text-gray-400"><ArrowLeft size={16}/></div>
                                     <div className="flex items-center gap-2">
                                        <select value={configData.type} onChange={e => handleUpdateMappingRow(targetKey, targetKey, e.target.value, '')} className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 outline-none text-gray-700 dark:text-gray-300 font-medium">
                                           <option value="static">Fijo</option>
                                           <option value="dynamic">Dinámico</option>
                                        </select>
                                        {configData.type === 'static' ? (
                                           <input type="text" placeholder="Escribe un valor..." value={configData.value} onChange={e => handleUpdateMappingRow(targetKey, targetKey, 'static', e.target.value)} className="flex-1 text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 outline-none text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500" />
                                        ) : (
                                           <select value={configData.value} onChange={e => handleUpdateMappingRow(targetKey, targetKey, 'dynamic', e.target.value)} className="flex-1 text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 outline-none text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500">
                                              <option value="">Copiar desde campo actual...</option>
                                              {moduleFields.map(f => <option key={`map-src-${f.id}`} value={f.api_name || f.label}>{f.display_label}</option>)}
                                           </select>
                                        )}
                                     </div>
                                     <button type="button" onClick={() => handleRemoveMappingRow(targetKey)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                  </div>
                               ))}
                            </div>
                         </div>
                      )}
                   </div>
                )}
                {/* 🔥 UI PARA SIGNATURIT (MAPEO DINÁMICO) 🔥 */}
                {newAction.action_type === 'SEND_SIGNATURIT' && (
                   <div className="animate-in fade-in duration-200 space-y-6">
                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-5 rounded-xl space-y-4">
                         {/* SELECTOR DE PLANTILLA */}
                         <div>
                            <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase mb-2 flex items-center gap-1.5"><Zap size={14}/> Plantilla de Signaturit a Enviar</label>
                            {loadingTemplates ? (
                                <p className="text-sm text-emerald-600 flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Cargando plantillas desde la nube...</p>
                            ) : (
                                <Select 
                                   options={signaturitTemplates.map(t => ({ value: t.id, label: t.name }))}
                                   value={newAction.action_config?.template_id ? { value: newAction.action_config.template_id, label: signaturitTemplates.find(t => t.id === newAction.action_config.template_id)?.name } : null}
                                   onChange={(opt) => setNewAction({...newAction, action_config: { ...newAction.action_config, template_id: opt.value, signers: newAction.action_config?.signers || [{ name_field: '', email_field: '' }] }})}
                                   placeholder="Selecciona la plantilla..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                                />
                            )}
                         </div>
                         
                         {/* SELECTOR DE TIPO DE FIRMA */}
                         {newAction.action_config?.template_id && (
                             <div className="animate-in fade-in zoom-in-95 duration-200">
                                <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase mb-2">Validez Legal (Tipo de Firma)</label>
                                <select 
                                   value={newAction.action_config?.signature_type || 'advanced'} 
                                   onChange={e => setNewAction({...newAction, action_config: { ...newAction.action_config, signature_type: e.target.value }})}
                                   className="w-full text-sm px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500 shadow-sm"
                                >
                                   <option value="advanced">Firma Avanzada (Biométrica y Legalmente Vinculante)</option>
                                   <option value="simple">Firma Simple (Check de Aceptación)</option>
                                </select>
                             </div>
                         )}
                      </div>

                      {newAction.action_config?.template_id && (
                         <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                               <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2"><User size={16}/> Mapeo de Firmantes</label>
                               <button type="button" onClick={() => {
                                  const config = { ...newAction.action_config };
                                  config.signers = [...(config.signers || []), { name_field: '', email_field: '' }];
                                  setNewAction({ ...newAction, action_config: config });
                               }} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"><Plus size={14}/> Añadir Firmante</button>
                            </div>
                            
                            <p className="text-[10px] text-gray-500 mb-3">En lugar de escribir nombres, selecciona los campos del formulario de donde AegisFlow extraerá los datos automáticamente.</p>
                            
                            <div className="space-y-3">
                               {(newAction.action_config?.signers || []).map((signer, idx) => (
                                  <div key={idx} className="flex flex-col sm:flex-row gap-3 items-center bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                     <div className="flex-1 w-full">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Extraer Nombre desde:</label>
                                        <select value={signer.name_field} onChange={e => {
                                           const config = { ...newAction.action_config };
                                           config.signers[idx].name_field = e.target.value;
                                           setNewAction({ ...newAction, action_config: config });
                                        }} className="w-full text-xs px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 outline-none bg-transparent text-gray-900 dark:text-white">
                                           <option value="">Seleccione Campo...</option>
                                           {moduleFields.map(f => <option key={`n-${f.id}`} value={f.api_name || f.label}>{f.display_label}</option>)}
                                        </select>
                                     </div>
                                     <div className="flex-1 w-full">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Extraer Email desde:</label>
                                        <select value={signer.email_field} onChange={e => {
                                           const config = { ...newAction.action_config };
                                           config.signers[idx].email_field = e.target.value;
                                           setNewAction({ ...newAction, action_config: config });
                                        }} className="w-full text-xs px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 outline-none bg-transparent text-gray-900 dark:text-white">
                                           <option value="">Seleccione Campo...</option>
                                           {moduleFields.map(f => <option key={`e-${f.id}`} value={f.api_name || f.label}>{f.display_label}</option>)}
                                        </select>
                                     </div>
                                     {idx > 0 && (
                                        <button type="button" onClick={() => {
                                           const config = { ...newAction.action_config };
                                           config.signers.splice(idx, 1);
                                           setNewAction({ ...newAction, action_config: config });
                                        }} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-4 sm:mt-0"><Trash2 size={16}/></button>
                                     )}
                                  </div>
                               ))}
                            </div>
                         </div>
                      )}
                   </div>
                )}

                {newAction.action_type === 'UPDATE_VALUE' && (
                   <div className="animate-in fade-in duration-200">
                     <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Nuevo Valor (Puedes usar {'{NOW}'} para la fecha actual)</label>
                     <input type="text" required placeholder="Ej: Aprobado, o {NOW}" value={newAction.action_value} onChange={e => setNewAction({...newAction, action_value: e.target.value})} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm" />
                   </div>
                )}

                {newAction.action_type === 'CUSTOM_FUNCTION' && (
   <div className="animate-in fade-in duration-200 space-y-3">
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
           {newAction.function_code || "# No hay código definido aún..."}
        </pre>
     </div>

     {/* EL EDITOR DE PANTALLA COMPLETA */}
     <CodeEditorModal 
        isOpen={isCodeEditorOpen}
        onClose={() => setIsCodeEditorOpen(false)}
        initialCode={newAction.function_code}
        mockDataInitial={null} // Podrías pasar datos del módulo aquí
        onSave={(updatedCode) => {
           setNewAction({ ...newAction, function_code: updatedCode });
           setIsCodeEditorOpen(false);
        }}
     />
   </div>
)}
            </form>
            
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex justify-end gap-3">
               <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
               <button type="submit" form="action-form" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2"><Save size={16}/> Guardar Regla</button>
            </div>
          </div>
        </div>, 
        document.body
      )}

      {/* 🔥 EL MODAL DE PLANTILLA DE CORREO RECUPERADO 🔥 */}
      {isEmailModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-200">
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
                <input type="text" placeholder="Ej: Registro Actualizado" required value={newAction.target_field} onChange={e => setNewAction({ ...newAction, target_field: e.target.value })} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mensaje / Cuerpo del Correo</label>
                <textarea rows={4} placeholder="Ej: Se han aplicado nuevas reglas automáticas." value={newAction.action_value} onChange={e => setNewAction({ ...newAction, action_value: e.target.value })} className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm resize-none custom-scrollbar" />
              </div>
              
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox" id="send_email_check_modal"
                    checked={newAction.action_config?.send_email || false}
                    onChange={e => {
                      const currentConfig = newAction.action_config || {};
                      setNewAction({ ...newAction, action_config: { ...currentConfig, send_email: e.target.checked } });
                    }}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="send_email_check_modal" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                     Enviar también copia por correo electrónico
                  </label>
                </div>

                {newAction.action_config?.send_email && (
                  <div className="pl-6 animate-in slide-in-from-top-2 space-y-3">
                     <div className="flex items-center gap-2">
                        <input 
                           type="checkbox" id="enable_email_actions_modal"
                           checked={newAction.action_config?.enable_email_actions || false}
                           onChange={e => {
                              const currentConfig = newAction.action_config || {};
                              setNewAction({ ...newAction, action_config: { ...currentConfig, enable_email_actions: e.target.checked } });
                           }}
                           className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="enable_email_actions_modal" className="text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer">
                           ⚡ Habilitar Botones de Acción Rápida (Aprobaciones)
                        </label>
                     </div>
                     
                     {newAction.action_config?.enable_email_actions && (
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl animate-in fade-in">
                           <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">¿Qué transiciones (Botones) deseas incluir?</label>
                           <Select 
                              isMulti
                              options={validTransitions.map(t => ({ value: t.id, label: `👉 ${t.name}` }))}
                              value={validTransitions.filter(t => (newAction.action_config?.email_actions || []).includes(t.id)).map(t => ({ value: t.id, label: `👉 ${t.name}` }))}
                              onChange={opts => {
                                 const selectedIds = opts.map(o => o.value);
                                 const currentConfig = newAction.action_config || {};
                                 setNewAction({ ...newAction, action_config: { ...currentConfig, email_actions: selectedIds } });
                              }}
                              placeholder="Selecciona las flechas permitidas..."
                              styles={customMultiSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'}
                           />
                           <p className="text-[10px] text-gray-500 mt-2">El sistema inyectará automáticamente estos botones al final del correo para que el destinatario pueda mover el caso con 1 clic.</p>
                        </div>
                     )}
                  </div>
                )}
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
    </>
  );
};

export default ActionModal;
