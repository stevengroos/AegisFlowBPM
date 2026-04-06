import React, { useState } from 'react';
import api from '../api/axios';
import { Plus, FileText, X, Edit2, Trash2, Search, ChevronRight, Undo, Loader2 } from 'lucide-react';

// 🔥 IMPORTAMOS NUESTRAS NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

const FormList = ({ forms, fetchForms, onOpenCanvas, moduleId }) => {
  const { notify, confirm } = useNotification();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [isSaving, setIsSaving] = useState(false); 

  const defaultFormData = { name: '', description: '' };
  const [formData, setFormData] = useState(defaultFormData);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('active'); 

  const handleOpenCreate = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (e, form) => {
    e.stopPropagation(); 
    setFormData({ name: form.name, description: form.description || '' });
    setEditingId(form.id);
    setIsFormModalOpen(true);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return notify.warning("El nombre de la plantilla es obligatorio.");
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/v1/forms/${editingId}`, {
          name: formData.name,
          description: formData.description || null,
          module_id: moduleId
        });
        notify.success("Plantilla actualizada correctamente.");
      } else {
        await api.post('/api/v1/forms/', { 
          name: formData.name, 
          description: formData.description || null, 
          is_active: true,
          module_id: moduleId 
        });
        notify.success("Plantilla creada exitosamente.");
      }
      
      setFormData(defaultFormData);
      setEditingId(null);
      setIsFormModalOpen(false);
      fetchForms();
      setViewMode('active');
    } catch (error) { 
      notify.error(`Error al ${editingId ? 'actualizar' : 'crear'} el formulario. Verifica los datos.`); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteForm = async (e, formId) => {
    e.stopPropagation(); 
    
    const isConfirmed = await confirm({
      title: 'Archivar Formulario',
      message: '⚠️ ADVERTENCIA: Archivar este formulario ocultará sus campos en el módulo. Podrás restaurarlo después desde la pestaña de archivados. ¿Estás seguro?',
      confirmText: 'Sí, archivar',
      variant: 'danger'
    });

    if (!isConfirmed) return;
    
    try {
      await api.delete(`/api/v1/forms/${formId}`);
      notify.success("Formulario archivado correctamente.");
      fetchForms();
    } catch (error) { 
      notify.error("Error al archivar el formulario."); 
    }
  };

  const handleRestoreForm = async (e, formId) => {
    e.stopPropagation();
    try {
      await api.post(`/api/v1/forms/${formId}/restore`);
      notify.success("¡Formulario restaurado y activo de nuevo!");
      fetchForms();
    } catch (error) { 
      notify.error("Error al intentar restaurar el formulario."); 
    }
  };

  const activeForms = forms.filter(f => f.is_active);
  const archivedForms = forms.filter(f => !f.is_active);
  
  const currentFormsList = viewMode === 'active' ? activeForms : archivedForms;

  const filteredForms = currentFormsList.filter(form => 
    form.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (form.description && form.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
      
      {/* HEADER REFINADO */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800/60 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Plantillas de Formularios</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Crea y gestiona las plantillas de datos para este módulo.</p>
        </div>
        <button 
          onClick={handleOpenCreate} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0"
        >
          <Plus size={18} /> Nuevo Formulario
        </button>
      </div>

      {/* PESTAÑAS (TABS) */}
      <div className="flex gap-6 border-b border-gray-100 dark:border-gray-800 mb-6">
         <button 
            onClick={() => setViewMode('active')} 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${viewMode === 'active' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}
         >
            Activos ({activeForms.length})
         </button>
         <button 
            onClick={() => setViewMode('archived')} 
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${viewMode === 'archived' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}
         >
            Archivados ({archivedForms.length})
         </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      {currentFormsList.length > 0 && (
        <div className="mb-6 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder={`Buscar en ${viewMode === 'active' ? 'activos' : 'archivados'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white shadow-sm"
            />
          </div>
        </div>
      )}

      {currentFormsList.length === 0 ? (
        <div className="bg-white dark:bg-gray-900/40 p-10 rounded-3xl border border-gray-200 dark:border-gray-800/60 text-center shadow-sm max-w-md mx-auto mt-10">
          <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-gray-900 dark:text-white font-bold text-lg">
             {viewMode === 'active' ? 'No tienes formularios creados' : 'No hay formularios archivados'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
             {viewMode === 'active' ? 'Crea una plantilla para empezar a definir los campos.' : 'Aquí aparecerán las plantillas que decidas eliminar.'}
          </p>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No se encontraron plantillas con "{searchTerm}".</p>
        </div>
      ) : (
        // 🔥 AQUÍ ESTÁ LA MAGIA: Cambiamos max-w-5xl por w-full 🔥
        <div className="space-y-4 w-full">
          {filteredForms.map(form => (
            <div 
              key={form.id} 
              onClick={() => viewMode === 'active' ? onOpenCanvas(form) : null}
              className={`relative p-4 md:px-6 md:py-5 rounded-2xl border transition-all duration-300 flex items-center gap-5 group ${
                 viewMode === 'active' 
                   ? 'bg-white dark:bg-[#121826]/80 border-gray-200 dark:border-gray-700/60 shadow-sm cursor-pointer hover:border-blue-400/60 dark:hover:border-blue-500/50 hover:shadow-md hover:bg-blue-50/30 dark:hover:bg-[#1a2333]/80 hover:-translate-y-0.5' 
                   : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800/50 opacity-70 cursor-default'
              }`}
            >
              
              {/* ÍCONO */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${viewMode === 'active' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-500/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                <FileText size={22} />
              </div>
              
              {/* TEXTO */}
              <div className="flex-1 min-w-0">
                <h3 className={`text-base font-bold truncate transition-colors duration-300 ${viewMode === 'active' ? 'text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400' : 'text-gray-600 dark:text-gray-500 line-through'}`}>{form.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed truncate font-medium">{form.description || "Sin descripción."}</p>
              </div>

              {/* CONTROLES FLOTANTES */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {viewMode === 'active' ? (
                   <>
                     <button onClick={(e) => handleOpenEdit(e, form)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white dark:hover:text-blue-400 dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700" title="Editar Plantilla"><Edit2 size={18} /></button>
                     <button onClick={(e) => handleDeleteForm(e, form.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-white dark:hover:text-red-400 dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700" title="Archivar Formulario"><Trash2 size={18} /></button>
                   </>
                ) : (
                   <button onClick={(e) => handleRestoreForm(e, form.id)} className="px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 rounded-lg transition-colors flex items-center gap-1.5 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50" title="Restaurar Formulario">
                      <Undo size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Restaurar</span>
                   </button>
                )}
              </div>
              
              {/* ACCIÓN PRINCIPAL (Diseñar) */}
              {viewMode === 'active' && (
                 <div className="ml-2 pl-4 md:pl-6 border-l border-gray-200 dark:border-gray-700/60 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                    <span className="text-xs font-bold hidden sm:block uppercase tracking-widest">Diseñar</span>
                    <ChevronRight size={20} className="transform group-hover:translate-x-1 transition-transform duration-300" />
                 </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR / EDITAR FORMULARIO */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/30">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? 'Editar Formulario' : 'Nuevo Formulario'}
              </h2>
              <button 
                onClick={() => setIsFormModalOpen(false)} 
                disabled={isSaving} 
                className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveForm} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nombre de Plantilla <span className="text-red-500">*</span></label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all" placeholder="Ej: Ticket de Soporte IT" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Descripción</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all resize-none" placeholder="Propósito del formulario..." rows={2} />
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-gray-100 dark:border-gray-800/80">
                <button type="button" onClick={() => setIsFormModalOpen(false)} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm active:scale-95 disabled:opacity-70">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingId ? 'Actualizar' : 'Guardar Formulario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormList;