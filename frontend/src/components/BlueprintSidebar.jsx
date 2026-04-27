import React from 'react';
import { Plus, Settings2, ArrowRight, Star, Loader2, Save, Trash2, Zap, ShieldAlert, Edit2 } from 'lucide-react';
import { GitMerge } from 'lucide-react';

const BlueprintSidebar = ({
  viewingOldVersion,
  newStatus,
  setNewStatus,
  handleCreateStatus,
  selectedElement,
  renameValue,
  setRenameValue,
  handleRenameElement,
  isRenaming,
  editSlaHours,
  setEditSlaHours,
  activeTab,
  setActiveTab,
  transitionActions,
  getActionIcon,
  getActionLabel,
  allModules,
  openEditActionModal,
  handleDeleteAction,
  setIsAddingAction,
  transitionValidations,
  openEditValidationModal,
  handleDeleteValidation,
  setIsAddingValidation,
  handleDeleteElement
}) => {
  return (
    <div className={`w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col z-10 overflow-y-auto custom-scrollbar shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-colors ${viewingOldVersion ? 'bg-amber-50/30 dark:bg-amber-950/20' : 'bg-white dark:bg-gray-900'}`}>
        
        {/* ========================================= */}
        {/* 1. SECCIÓN: CREAR NUEVO ESTADO */}
        {/* ========================================= */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Plus size={14}/> Nuevo Estado</h3>
           <form onSubmit={handleCreateStatus} className="space-y-4">
             <div>
               <input disabled={viewingOldVersion} type="text" required value={newStatus.name} onChange={(e) => setNewStatus({...newStatus, name: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" placeholder="Ej: En Progreso" />
             </div>
             <div>
               <input disabled={viewingOldVersion} type="number" min="1" value={newStatus.sla_hours} onChange={(e) => setNewStatus({...newStatus, sla_hours: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2" placeholder="Límite de tiempo en horas (SLA)" />
             </div>
             <div className="flex items-center gap-2 px-1">
               <input disabled={viewingOldVersion} type="checkbox" checked={newStatus.is_initial} onChange={(e) => setNewStatus({...newStatus, is_initial: e.target.checked})} className="w-4 h-4 rounded text-blue-600 cursor-pointer disabled:cursor-not-allowed" />
               <label className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Definir como Estado Inicial</label>
             </div>
             <button disabled={viewingOldVersion} type="submit" className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Agregar al Lienzo</button>
           </form>
        </div>

        {/* ========================================= */}
        {/* 2. SECCIÓN: PROPIEDADES DEL ELEMENTO SELECCIONADO */}
        {/* ========================================= */}
        {selectedElement ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
             <div className="p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Settings2 size={14} /> Propiedades</h3>
                <div className="flex items-center gap-2">
                   <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                         {selectedElement.type === 'transition' ? <ArrowRight size={14} className="text-blue-500"/> : <Star size={14} className="text-amber-500"/>}
                      </div>
                      <input 
                         disabled={viewingOldVersion}
                         type="text" 
                         value={renameValue} 
                         onChange={(e) => setRenameValue(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleRenameElement()}
                         className="w-full pl-9 pr-3 py-2 text-sm font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded-lg outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                   </div>
                   {/* Botón de guardar renombre/SLA */}
                   {(renameValue !== selectedElement.data.name || (selectedElement.type === 'status' && editSlaHours !== (selectedElement.data.sla_hours || ""))) && !viewingOldVersion && (
                      <button onClick={handleRenameElement} disabled={isRenaming} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm disabled:opacity-50">
                         {isRenaming ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                      </button>
                   )}
                </div>

                {/* Input de SLA solo para estados */}
                {selectedElement.type === 'status' && (
                    <div className="mt-3">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Límite SLA (Horas)</label>
                       <input 
                          disabled={viewingOldVersion} type="number" min="1" value={editSlaHours} onChange={(e) => setEditSlaHours(e.target.value)}
                          placeholder="Sin límite..."
                          className="w-full px-3 py-2 text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 rounded-lg outline-none transition-all disabled:opacity-50"
                       />
                    </div>
                )}
             </div>

             

             {/* Botón Eliminar Elemento (Abajo del todo) */}
             {!viewingOldVersion && (
               <div className="p-5 border-t border-gray-100 dark:border-gray-800 shrink-0 mt-auto">
                 <button onClick={handleDeleteElement} className="w-full flex justify-center items-center gap-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">
                   <Trash2 size={16} /> Quitar del Lienzo
                 </button>
               </div>
             )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
             <GitMerge size={40} className="mb-4 opacity-20"/>
             <p className="text-sm font-medium">Selecciona un Estado o una Transición (Flecha) en el lienzo para ver sus propiedades.</p>
          </div>
        )}
    </div>
  );
};

export default BlueprintSidebar;