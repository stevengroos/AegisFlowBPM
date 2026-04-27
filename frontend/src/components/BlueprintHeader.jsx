import React from 'react';
import { ArrowLeft, GitMerge, RotateCcw, Shapes, Zap, Copy, History, DownloadCloud, UploadCloud, X, Loader2, ShieldAlert } from 'lucide-react';

const BlueprintHeader = ({
  selectedBlueprint,
  viewingOldVersion,
  currentVersionId,
  versions,
  handleCloseAttempt,
  handleRestoreVersion,
  setCurrentVersionId,
  setViewingOldVersion,
  selectedElement,
  setIsShapeModalOpen,
  aiImageInputRef,
  handleGenerateFromImage,
  handleCreateNewVersion,
  fetchVersions,
  handleExportBlueprint,
  fileInputRef,
  handleImportBlueprint,
  showVersions,
  setShowVersions,
  loadingVersions,
  handleLoadVersion,
  setIsActionsListOpen,
  setIsValidationsListOpen,
  transitionActions,
  transitionValidations
}) => {

  return (
    <div className={`px-6 py-4 border-b flex justify-between items-center z-10 shadow-sm transition-colors ${viewingOldVersion ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
      
      {/* Título y Botón de Volver */}
      <div className="flex items-center gap-4">
        <button onClick={handleCloseAttempt} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Volver y guardar cambios">
            <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${viewingOldVersion ? 'text-amber-700 dark:text-amber-500' : 'text-gray-900 dark:text-white'}`}>
            <GitMerge size={18} className={viewingOldVersion ? "text-amber-500" : "text-blue-500"} /> 
            {selectedBlueprint.name} {viewingOldVersion ? '(Moviendo al Pasado)' : ''}
          </h2>
          <div className="flex items-center gap-2">
              <p className="text-[11px] text-gray-500 font-medium tracking-wide uppercase mt-0.5">
                Blueprint & Automatizaciones
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${viewingOldVersion ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                V{versions.find(v => v.id === currentVersionId)?.version || selectedBlueprint.version || 1}
              </span>
          </div>
        </div>
      </div>

      {/* Botonera Derecha */}
      <div className="flex items-center gap-3">
        {viewingOldVersion ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setCurrentVersionId(selectedBlueprint.id); setViewingOldVersion(false); }} 
              className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button onClick={handleRestoreVersion} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
              <RotateCcw size={16} /> Restaurar esta versión
            </button>
          </div>
        ) : (
          <div className="flex border-r border-gray-200 dark:border-gray-700 pr-3 mr-1 gap-2">
             {selectedElement?.type === 'status' && !viewingOldVersion && (
               <button onClick={() => setIsShapeModalOpen(true)} className="p-2 text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold mr-2 border border-purple-200 dark:border-purple-800/50 shadow-sm" title="Cambiar Forma Visual">
                  <Shapes size={16} /> <span className="hidden sm:inline">Forma</span>
               </button>
             )}

             {/* 🔥 NUEVOS BOTONES DE ACCIONES Y VALIDACIONES (Solo visibles en transiciones) 🔥 */}
             {selectedElement?.type === 'transition' && !viewingOldVersion && (
                <div className="flex items-center gap-2 mr-2 border-r border-gray-200 dark:border-gray-700 pr-3">
                   <button onClick={() => setIsActionsListOpen(true)} className="px-3 py-2 text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-blue-200 dark:border-blue-800/50 shadow-sm">
                      <Zap size={16} className="fill-blue-500" /> 
                      <span className="hidden sm:inline">Acciones ({transitionActions?.length || 0})</span>
                   </button>
                   <button onClick={() => setIsValidationsListOpen(true)} className="px-3 py-2 text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-red-200 dark:border-red-800/50 shadow-sm">
                      <ShieldAlert size={16} className="fill-red-500" /> 
                      <span className="hidden sm:inline">Validaciones ({transitionValidations?.length || 0})</span>
                   </button>
                </div>
             )}
             {/* 🔥 NUEVO BOTÓN QUE ABRE EL MODAL DE IA 🔥 */}
             <button 
                onClick={() => setIsShapeModalOpen('ai_modal')} // Usamos un truco pasando un string para abrir el modal en el padre
                className="p-2 text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-purple-200 dark:border-purple-800/50 shadow-sm" 
                title="Generar flujo con IA"
             >
                <Zap size={18} className="fill-purple-500" /> <span className="hidden sm:inline">Generar con IA</span>
             </button>
             
             <button onClick={handleCreateNewVersion} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold" title="Tomar foto y crear nueva versión">
                <Copy size={18} /> <span className="hidden sm:inline">Versionar</span>
             </button>
             
             {/* Envolvemos el botón de historial en un relative para el menú flotante */}
             <div className="relative">
                <button onClick={fetchVersions} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Historial de Versiones">
                   <History size={18} />
                </button>
                
                {/* 🔥 PANEL FLOTANTE DE HISTORIAL DE VERSIONES 🔥 */}
                {showVersions && (
                  <div className="absolute top-full right-0 mt-2 z-[60] w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 flex flex-col max-h-[60vh]">
                     <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><History size={16} className="text-blue-500" /> Historial</h3>
                        <button onClick={() => setShowVersions(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={16}/></button>
                     </div>
                     <div className="overflow-y-auto p-2 custom-scrollbar">
                        {loadingVersions ? (
                          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" size={24}/></div>
                        ) : (
                          versions.map((v) => (
                            <button 
                              key={v.id} 
                              onClick={() => handleLoadVersion(v.id, v.is_active)}
                              className={`w-full text-left p-3 rounded-xl mb-1 transition-all border ${currentVersionId === v.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50' : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'} flex flex-col gap-1`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className={`font-bold ${currentVersionId === v.id ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-200'}`}>Versión {v.version}</span>
                                {v.is_active && <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded">Activa</span>}
                              </div>
                              <span className="text-xs text-gray-500">ID del Registro: #{v.id}</span>
                            </button>
                          ))
                        )}
                     </div>
                  </div>
                )}
             </div>

             <button onClick={handleExportBlueprint} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Exportar Flujo JSON">
                <DownloadCloud size={18} />
             </button>
             <button onClick={() => fileInputRef.current.click()} className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Importar JSON de Flujo">
                <UploadCloud size={18} />
             </button>
             <input type="file" ref={fileInputRef} onChange={handleImportBlueprint} accept=".json" className="hidden" />
          </div>
        )}
      </div>
    </div>
  );
};

export default BlueprintHeader;