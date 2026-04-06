import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Box, Users, Building2, Folder, FileText, X, Loader2, Target, Briefcase, Edit2, Trash2, GripVertical, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';

// 🔥 Importaciones de DND-KIT 🔥
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

// 🔥 Importamos las Notificaciones 🔥
import { useNotification } from '../context/NotificationContext';

const ICON_MAP = {
  box: Box, users: Users, building: Building2, folder: Folder, folderOpen: FolderOpen,
  fileText: FileText, target: Target, briefcase: Briefcase
};

// ==========================================
// COMPONENTE AUXILIAR: Ítem Ordenable (Módulo o Categoría)
// ==========================================
const SortableItem = ({ item, isCategory, onSelect, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: isCategory ? `cat-${item.id}` : `mod-${item.id}` });
  
  const [isExpanded, setIsExpanded] = useState(false);

  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : 1 };
  const IconComponent = ICON_MAP[item.icon] || (isCategory ? Folder : Box);

  return (
    <div ref={setNodeRef} style={style} className={`relative mb-3 ${isDragging ? 'opacity-50 z-50' : ''}`}>
      <div 
        onClick={isCategory ? () => setIsExpanded(!isExpanded) : () => onSelect(item)}
        className={`bg-white dark:bg-gray-900 px-6 py-4 rounded-xl border border-gray-200 dark:border-gray-800/80 shadow-sm transition-all flex items-center gap-4 cursor-pointer group hover:border-blue-200 dark:hover:border-gray-600 ${isDragging ? 'shadow-2xl scale-[1.02] border-blue-300 dark:border-blue-700' : ''}`}
      >
        <div {...attributes} {...listeners} className="p-1 text-gray-400 cursor-grab hover:text-gray-900 dark:hover:text-white rounded active:cursor-grabbing transition-colors" onClick={(e) => e.stopPropagation()}>
          <GripVertical size={20} />
        </div>

        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isCategory ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:bg-blue-600 group-hover:text-white'}`}>
          <IconComponent size={20} />
        </div>
        
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{item.name}</h3>
            {!isCategory && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed truncate">{item.description || "Sin descripción."}</p>}
          </div>
          {isCategory && (
            <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">
               {item.modules?.length || 0} Módulos
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
            <button onClick={(e) => onEdit(e, item, isCategory)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Editar"><Edit2 size={16} /></button>
            <button onClick={(e) => onDelete(e, item.id, isCategory)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
          </div>
          {isCategory && (
             <div className="text-gray-400 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
               {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
             </div>
          )}
        </div>
      </div>

      {/* Renderizamos los módulos hijos si la categoría está expandida */}
      {isCategory && isExpanded && item.modules?.length > 0 && (
         <div className="ml-10 mt-3 pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/30 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
            {item.modules.map(mod => {
               const ModIcon = ICON_MAP[mod.icon] || Box;
               return (
                 <div key={mod.id} onClick={() => onSelect(mod)} className="bg-white dark:bg-gray-900 px-5 py-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4 cursor-pointer group hover:border-blue-200 dark:hover:border-gray-700 transition-all">
                    <div className="w-8 h-8 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors"><ModIcon size={16} /></div>
                    <div className="flex-1"><h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{mod.name}</h3></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(e, mod, false); }} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Edit2 size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(e, mod.id, false); }} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                    </div>
                 </div>
               )
            })}
         </div>
      )}
    </div>
  );
};


// ==========================================
// COMPONENTE PRINCIPAL: ModuleList 
// ==========================================
const ModuleList = ({ onSelectModule }) => {
  const { notify, confirm } = useNotification(); 
  
  const [modules, setModules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para Modales
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [editingId, setEditingId] = useState(null); 
  
  const defaultModuleState = { name: '', description: '', icon: 'box', category_id: '' };
  const defaultCategoryState = { name: '', icon: 'folder' };
  
  const [newModule, setNewModule] = useState(defaultModuleState);
  const [newCategory, setNewCategory] = useState(defaultCategoryState);

  const [activeDragId, setActiveDragId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = async (signal) => {
    try {
      setLoading(true);
      const [catsRes, modsRes] = await Promise.all([
          api.get('/api/v1/modules/categories/', { signal }),
          api.get('/api/v1/modules/', { signal })
      ]);
      
      const allMods = modsRes.data;
      const allCats = catsRes.data;
      
      // Agrupamos los módulos dentro de sus categorías para renderizado fácil
      const categoriesWithModules = allCats.map(cat => ({
          ...cat,
          modules: allMods.filter(m => m.category_id === cat.id).sort((a,b) => a.order - b.order)
      }));
      
      setCategories(categoriesWithModules);
      // Solo dejamos los sueltos en el array principal
      setModules(allMods.filter(m => !m.category_id).sort((a,b) => a.order - b.order));
      
    } catch (error) {
      if (error.name !== 'CanceledError') notify.error("Error al cargar la estructura de módulos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, []);

  // ====== LÓGICA DE CATEGORÍAS ======
  const handleOpenCreateCategory = () => { setNewCategory(defaultCategoryState); setEditingId(null); setIsCategoryModalOpen(true); };
  const handleOpenEditCategory = (e, cat) => { e.stopPropagation(); setNewCategory({ name: cat.name, icon: cat.icon }); setEditingId(cat.id); setIsCategoryModalOpen(true); };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return notify.warning("El nombre es obligatorio.");
    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/v1/modules/categories/${editingId}`, newCategory);
        notify.success("Categoría actualizada.");
      } else {
        await api.post('/api/v1/modules/categories/', newCategory);
        notify.success("Categoría creada.");
      }
      setIsCategoryModalOpen(false); setEditingId(null); fetchData();
    } catch (error) { notify.error("Error al guardar la categoría."); } finally { setIsSaving(false); }
  };

  const handleDeleteCategory = async (e, catId) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: 'Eliminar Categoría', message: '¿Eliminar esta carpeta? Los módulos que contiene NO se borrarán, solo quedarán "sueltos".', confirmText: 'Sí, eliminar', variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/api/v1/modules/categories/${catId}`);
      notify.success("Categoría eliminada."); fetchData();
    } catch (error) { notify.error("Error al eliminar la categoría."); }
  };

  // ====== LÓGICA DE MÓDULOS ======
  const handleOpenCreateModule = () => { setNewModule(defaultModuleState); setEditingId(null); setIsModuleModalOpen(true); };
  const handleOpenEditModule = (e, mod) => { e.stopPropagation(); setNewModule({ name: mod.name, description: mod.description, icon: mod.icon, category_id: mod.category_id || '' }); setEditingId(mod.id); setIsModuleModalOpen(true); };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!newModule.name.trim()) return notify.warning("El nombre es obligatorio.");
    setIsSaving(true);
    try {
      const payload = { ...newModule, category_id: newModule.category_id ? parseInt(newModule.category_id) : null };
      if (editingId) {
        await api.put(`/api/v1/modules/${editingId}`, payload);
        notify.success("Módulo actualizado.");
      } else {
        await api.post('/api/v1/modules/', payload);
        notify.success("Módulo creado.");
      }
      setIsModuleModalOpen(false); setEditingId(null); fetchData();
    } catch (error) { notify.error("Error al guardar el módulo."); } finally { setIsSaving(false); }
  };

  const handleDeleteModule = async (e, modId) => {
    e.stopPropagation(); 
    const isConfirmed = await confirm({
      title: 'Eliminar Módulo', message: '⚠️ ADVERTENCIA: Se eliminará el módulo, todos sus formularios y TODOS los registros asociados a él de forma permanente.', confirmText: 'Sí, eliminar todo', variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/api/v1/modules/${modId}`);
      notify.success("Módulo eliminado."); fetchData();
    } catch (error) { notify.error("Error al eliminar el módulo."); }
  };

  // ====== DRAG AND DROP (Reordenamiento) ======
  const handleDragEnd = async (event, isCategoryList) => {
    const { active, over } = event;
    setActiveDragId(null); 
    if (!over || active.id === over.id) return;

    const list = isCategoryList ? categories : modules;
    const oldIndex = list.findIndex((item) => (isCategoryList ? `cat-${item.id}` : `mod-${item.id}`) === active.id);
    const newIndex = list.findIndex((item) => (isCategoryList ? `cat-${item.id}` : `mod-${item.id}`) === over.id);

    const newOrderedList = arrayMove(list, oldIndex, newIndex);
    
    if (isCategoryList) setCategories(newOrderedList);
    else setModules(newOrderedList);

    const orderData = {};
    newOrderedList.forEach((item, i) => { orderData[item.id] = i; });

    try {
      const endpoint = isCategoryList ? '/api/v1/modules/categories/reorder' : '/api/v1/modules/reorder';
      await api.put(endpoint, orderData);
    } catch (error) {
      notify.error("No se pudo guardar el nuevo orden.");
      fetchData(); // Revertir
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      
      {/* HEADER REFINADO */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800/60 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Estructura del Sistema</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Gestiona y agrupa los módulos en categorías para el menú principal.</p>
        </div>
        <div className="flex gap-3">
           <button onClick={handleOpenCreateCategory} className="bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm">
             <FolderPlus size={18} /> Nueva Categoría
           </button>
           <button onClick={handleOpenCreateModule} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
             <Plus size={18} /> Nuevo Módulo
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
      ) : (
        <div className="space-y-10 max-w-5xl">
            
            {/* SECCIÓN 1: CARPETAS (CATEGORÍAS) */}
            <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Folder size={14}/> Agrupaciones (Carpetas)</h3>
               {categories.length === 0 ? (
                  <p className="text-sm text-gray-500 italic p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">No has creado ninguna categoría. Crea una para organizar tus módulos.</p>
               ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveDragId(e.active.id)} onDragEnd={e => handleDragEnd(e, true)} modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}>
                    <SortableContext items={categories.map(c => `cat-${c.id}`)} strategy={verticalListSortingStrategy}>
                      {categories.map(cat => (
                        // 🔥 SOLUCIÓN: Pasamos onSelectModule aquí también 🔥
                        <SortableItem key={`cat-${cat.id}`} item={cat} isCategory={true} onSelect={onSelectModule} onEdit={(e, item) => handleOpenEditCategory(e, item)} onDelete={(e, id) => handleDeleteCategory(e, id)} />
                      ))}
                    </SortableContext>
                  </DndContext>
               )}
            </div>

            {/* SECCIÓN 2: MÓDULOS SUELTOS */}
            <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Box size={14}/> Módulos Sueltos (Nivel Raíz)</h3>
               {modules.length === 0 ? (
                  <p className="text-sm text-gray-500 italic p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">Todos tus módulos están organizados dentro de carpetas.</p>
               ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveDragId(e.active.id)} onDragEnd={e => handleDragEnd(e, false)} modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}>
                    <SortableContext items={modules.map(m => `mod-${m.id}`)} strategy={verticalListSortingStrategy}>
                      {modules.map(mod => (
                        <SortableItem key={`mod-${mod.id}`} item={mod} isCategory={false} onSelect={onSelectModule} onEdit={(e, item) => handleOpenEditModule(e, item)} onDelete={(e, id) => handleDeleteModule(e, id)} />
                      ))}
                    </SortableContext>
                  </DndContext>
               )}
            </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREAR / EDITAR MÓDULO */}
      {/* ========================================== */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Box size={18} className="text-blue-500"/> {editingId ? 'Editar Módulo' : 'Nuevo Módulo'}</h2>
              <button onClick={() => setIsModuleModalOpen(false)} disabled={isSaving} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveModule} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Nombre <span className="text-red-500">*</span></label>
                <input type="text" required value={newModule.name} onChange={e => setNewModule({...newModule, name: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl outline-none focus:border-blue-500 text-sm" placeholder="Ej: Inventario" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-indigo-500 uppercase mb-1.5">Categoría (Carpeta)</label>
                <select value={newModule.category_id} onChange={e => setNewModule({...newModule, category_id: e.target.value})} className="w-full px-4 py-2.5 border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 text-gray-900 dark:text-white rounded-xl outline-none focus:border-indigo-500 text-sm font-medium">
                   <option value="">Ninguna (Dejar suelto en Nivel Raíz)</option>
                   {categories.map(c => <option key={c.id} value={c.id}>🗂️ {c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Descripción</label>
                <textarea value={newModule.description} onChange={e => setNewModule({...newModule, description: e.target.value})} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl outline-none focus:border-blue-500 text-sm resize-none" rows={2} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ícono del Módulo</label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(ICON_MAP).filter(k => k !== 'folderOpen').map(iconKey => {
                    const IconComp = ICON_MAP[iconKey];
                    return (
                      <button key={iconKey} type="button" onClick={() => setNewModule({...newModule, icon: iconKey})} className={`p-2.5 rounded-xl border transition-all ${newModule.icon === iconKey ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500'}`}>
                        <IconComp size={18} />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModuleModalOpen(false)} className="px-5 py-2 text-sm font-bold text-gray-600 dark:text-gray-400">Cancelar</button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 disabled:opacity-70">
                  {isSaving ? <Loader2 size={16} className="animate-spin"/> : null} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREAR / EDITAR CATEGORÍA */}
      {/* ========================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
              <h2 className="text-lg font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-2"><Folder size={18}/> {editingId ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} disabled={isSaving} className="text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 p-1.5 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Nombre de la Carpeta <span className="text-red-500">*</span></label>
                <input type="text" required value={newCategory.name} onChange={e => setNewCategory({...newCategory, name: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl outline-none focus:border-indigo-500 text-sm" placeholder="Ej: Recursos Humanos" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ícono de la Carpeta</label>
                <div className="flex flex-wrap gap-2">
                  {['folder', 'folderOpen', 'briefcase', 'building', 'users'].map(iconKey => {
                    const IconComp = ICON_MAP[iconKey];
                    return (
                      <button key={iconKey} type="button" onClick={() => setNewCategory({...newCategory, icon: iconKey})} className={`p-2.5 rounded-xl border transition-all ${newCategory.icon === iconKey ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500'}`}>
                        <IconComp size={18} />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-5 py-2 text-sm font-bold text-gray-600 dark:text-gray-400">Cancelar</button>
                <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 disabled:opacity-70">
                  {isSaving ? <Loader2 size={16} className="animate-spin"/> : null} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para el botón faltante (FolderPlus)
const FolderPlus = ({size}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
);

export default ModuleList;