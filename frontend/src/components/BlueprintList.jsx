import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { Plus, Trash2, GitMerge, Edit3, X, Pencil, Loader2, AlertTriangle, Search, ChevronRight } from 'lucide-react';
import Select from 'react-select';

// 🔥 IMPORTAMOS NUESTRAS NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

const BlueprintList = ({ blueprints, fields, fetchInitialData, openCanvas, moduleId }) => {
  const { notify, confirm } = useNotification();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);

  const [newBp, setNewBp] = useState({ name: '', trigger_field: '', trigger_value: '' });
  const [editBp, setEditBp] = useState({ id: '', name: '', trigger_field: '', trigger_value: '' }); 
  
  // 🔥 ESTADO PARA LA BÚSQUEDA 🔥
  const [searchTerm, setSearchTerm] = useState('');

  // Estado reactivo para estilos del Select
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const uniqueFields = [];
  const seenApiNames = new Set();
  fields.forEach(f => {
    if (f.api_name && !seenApiNames.has(f.api_name)) {
      uniqueFields.push(f);
      seenApiNames.add(f.api_name);
    }
  });

  const triggerOptions = [
    { value: '', label: '(Ninguno) - Aplica a todos los casos' },
    ...uniqueFields.map(f => ({ value: f.api_name, label: `${f.label} (${f.api_name})` }))
  ];
  
  const customSelectStyles = {
    control: (provided) => ({
      ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white',
      borderRadius: '0.75rem', padding: '0.25rem', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black',
      '&:hover': { borderColor: isDarkMode ? '#4b5563' : '#9ca3af' }
    }),
    singleValue: (provided) => ({ ...provided, color: isDarkMode ? '#f9fafb' : '#111827' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', marginTop: '0.5rem' }),
    option: (provided, state) => ({
      ...provided, fontSize: '0.875rem',
      backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent',
      color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer'
    }),
    menuPortal: base => ({ ...base, zIndex: 99999 })
  };

  const renderTriggerValueInput = (data, setter) => {
    const selectedField = fields.find(f => f.api_name === data.trigger_field || f.label === data.trigger_field);
    if (!selectedField) return null;
    const commonClasses = "w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm";

    if (selectedField.field_type === 'select' && selectedField.options) {
      let opts = [];
      if (Array.isArray(selectedField.options)) opts = selectedField.options;
      else if (typeof selectedField.options === 'string') opts = selectedField.options.split(',');

      return (
        <select required value={data.trigger_value} onChange={e => setter({...data, trigger_value: e.target.value})} className={commonClasses}>
          <option value="">Selecciona una opción...</option>
          {opts.map((opt, i) => (<option key={i} value={typeof opt === 'string' ? opt.trim() : opt}>{typeof opt === 'string' ? opt.trim() : opt}</option>))}
        </select>
      );
    }
    if (selectedField.field_type === 'checkbox') {
      return (
        <select required value={data.trigger_value} onChange={e => setter({...data, trigger_value: e.target.value})} className={commonClasses}>
          <option value="">Selecciona estado...</option>
          <option value="true">Verdadero (Marcado)</option>
          <option value="false">Falso (No marcado)</option>
        </select>
      );
    }
    return <input type={selectedField.field_type === 'number' ? 'number' : selectedField.field_type === 'date' ? 'date' : 'text'} required value={data.trigger_value} onChange={e => setter({...data, trigger_value: e.target.value})} className={commonClasses} placeholder="Escribe el valor exacto..." />;
  };

  const handleCreateBlueprint = async (e) => {
    e.preventDefault();
    if (!newBp.name) return notify.warning("El nombre del flujo es obligatorio.");
    
    setIsSaving(true);
    try {
      await api.post('/api/v1/blueprints/', { 
        name: newBp.name, 
        trigger_field: newBp.trigger_field || null, 
        trigger_value: newBp.trigger_value || null, 
        is_active: true,
        module_id: moduleId 
      });
      notify.success("Flujo de trabajo creado exitosamente.");
      setNewBp({ name: '', trigger_field: '', trigger_value: '' }); 
      setIsModalOpen(false); 
      fetchInitialData();
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al crear el flujo de trabajo."); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBlueprint = async (e) => {
    e.preventDefault();
    if (!editBp.name) return notify.warning("El nombre del flujo es obligatorio.");
    
    setIsSaving(true);
    try {
      await api.put(`/api/v1/blueprints/${editBp.id}`, { 
        name: editBp.name, 
        trigger_field: editBp.trigger_field || null, 
        trigger_value: editBp.trigger_value || null,
        module_id: moduleId 
      });
      notify.success("Flujo actualizado correctamente.");
      setIsEditModalOpen(false); 
      fetchInitialData();
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al actualizar la configuración."); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBlueprint = async (id) => {
    const isConfirmed = await confirm({
      title: 'Eliminar Flujo Completo',
      message: '⚠️ ¿Estás seguro de que deseas eliminar TODO este flujo? Se borrarán todos los estados y transiciones asociadas. Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar flujo',
      variant: 'danger'
    });

    if(!isConfirmed) return;
    
    try { 
      await api.delete(`/api/v1/blueprints/${id}`); 
      notify.success("Flujo de trabajo eliminado.");
      fetchInitialData(); 
    } catch (error) { 
      notify.error("Error al intentar eliminar el flujo."); 
    }
  };

  // 🔥 LÓGICA DE FILTRADO 🔥
  const filteredBlueprints = blueprints.filter(bp => 
    bp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
      
      {/* HEADER REFINADO */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800/60 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Flujos de Trabajo (Blueprints)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Administra los procesos y transiciones obligatorias de tus casos.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 shrink-0">
          <Plus size={18} /> Nuevo Flujo
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      {blueprints.length > 0 && (
        <div className="mb-6 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar flujos de trabajo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white shadow-sm"
            />
          </div>
        </div>
      )}

      {blueprints.length === 0 ? (
        <div className="bg-white dark:bg-gray-900/40 p-10 rounded-3xl border border-gray-200 dark:border-gray-800/60 text-center shadow-sm max-w-md mx-auto mt-10">
          <GitMerge className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-gray-900 dark:text-white font-bold text-lg">No tienes flujos creados</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Crea un blueprint para definir por qué etapas pasará un registro y automatizar tu proceso.</p>
        </div>
      ) : filteredBlueprints.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No se encontraron flujos que coincidan con "{searchTerm}".</p>
        </div>
      ) : (
        // 🔥 LISTA DE TARJETAS AL ESTILO PREMIUM (w-full para ocupar todo el ancho) 🔥
        <div className="space-y-4 w-full">
          {filteredBlueprints.map(bp => {
            const relatedField = fields.find(f => f.api_name === bp.trigger_field || f.label === bp.trigger_field);
            const displayField = relatedField ? relatedField.label : bp.trigger_field;
            
            return (
              <div 
                key={bp.id} 
                onClick={() => openCanvas(bp)}
                className="relative p-4 md:px-6 md:py-5 rounded-2xl border transition-all duration-300 flex items-center gap-5 group bg-white dark:bg-[#121826]/80 border-gray-200 dark:border-gray-700/60 shadow-sm cursor-pointer hover:border-blue-400/60 dark:hover:border-blue-500/50 hover:shadow-md hover:bg-blue-50/30 dark:hover:bg-[#1a2333]/80 hover:-translate-y-0.5"
              >
                
                {/* ÍCONO */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-500/20">
                  <GitMerge size={22} />
                </div>
                
                {/* TEXTO Y BADGES */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <h3 className="text-base font-bold truncate transition-colors duration-300 text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                    {bp.name}
                  </h3>
                  
                  <div className="flex items-center">
                    {bp.trigger_field ? (
                      <div className="inline-flex items-center gap-1.5 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-800/50">
                        <span className="font-semibold text-[11px] tracking-wide">{displayField}</span>
                        <span className="text-[10px] opacity-60">===</span>
                        <span className="font-mono text-[11px] font-bold bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded shadow-sm">"{bp.trigger_value}"</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-[11px] font-bold tracking-wide border border-gray-200 dark:border-gray-700/50">
                        Aplica a todos los casos
                      </span>
                    )}
                  </div>
                </div>

                {/* CONTROLES FLOTANTES */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditBp({ id: bp.id, name: bp.name, trigger_field: bp.trigger_field || '', trigger_value: bp.trigger_value || '' }); 
                      setIsEditModalOpen(true); 
                    }} 
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white dark:hover:text-blue-400 dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700" 
                    title="Editar Reglas"
                  >
                    <Pencil size={18} />
                  </button>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleDeleteBlueprint(bp.id); 
                    }} 
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-white dark:hover:text-red-400 dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700" 
                    title="Eliminar Flujo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                {/* ACCIÓN PRINCIPAL (Diseñar) */}
                <div className="ml-2 pl-4 md:pl-6 border-l border-gray-200 dark:border-gray-700/60 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                  <span className="text-xs font-bold hidden sm:block uppercase tracking-widest">Diseñar</span>
                  <ChevronRight size={20} className="transform group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear Flujo (PORTAL) */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-visible relative border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Crear Nuevo Flujo</h2>
              <button onClick={() => setIsModalOpen(false)} disabled={isSaving} className="text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 rounded-lg transition-colors disabled:opacity-50"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateBlueprint} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nombre del Flujo <span className="text-red-500">*</span></label>
                <input type="text" required value={newBp.name} onChange={e => setNewBp({...newBp, name: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all shadow-sm" placeholder="Ej: Proceso de Ventas" />
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-500"/> Regla Detonante (Opcional)</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">Si dejas esto en blanco, el flujo se aplicará a TODOS los registros de este módulo.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Si este campo...</label>
                    <Select options={triggerOptions} value={triggerOptions.find(opt => opt.value === newBp.trigger_field) || triggerOptions[0]} onChange={(option) => setNewBp({...newBp, trigger_field: option.value, trigger_value: ''})} isSearchable={true} placeholder="Buscar campo..." styles={customSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} />
                  </div>
                  {newBp.trigger_field && 
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 mt-2">Es igual a...</label>
                      {renderTriggerValueInput(newBp, setNewBp)}
                    </div>
                  }
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm active:scale-95 disabled:opacity-70 flex items-center gap-2">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Guardar Flujo
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* Modal Editar Flujo (PORTAL) */}
      {isEditModalOpen && createPortal(
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-visible relative border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar Configuración</h2>
              <button onClick={() => setIsEditModalOpen(false)} disabled={isSaving} className="text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 rounded-lg transition-colors disabled:opacity-50"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateBlueprint} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nombre del Flujo <span className="text-red-500">*</span></label>
                <input type="text" required value={editBp.name} onChange={e => setEditBp({...editBp, name: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all shadow-sm" />
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-500"/> Regla Detonante (Opcional)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Si este campo...</label>
                    <Select options={triggerOptions} value={triggerOptions.find(opt => opt.value === editBp.trigger_field) || triggerOptions[0]} onChange={(option) => setEditBp({...editBp, trigger_field: option.value, trigger_value: ''})} isSearchable={true} placeholder="Buscar campo..." styles={customSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} />
                  </div>
                  {editBp.trigger_field && 
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 mt-2">Es igual a...</label>
                      {renderTriggerValueInput(editBp, setEditBp)}
                    </div>
                  }
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsEditModalOpen(false)} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm active:scale-95 disabled:opacity-70 flex items-center gap-2">
                   {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                   Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default BlueprintList;