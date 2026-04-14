import React from 'react';
import { Edit2, Trash2, X, CheckSquare } from 'lucide-react';

const BulkActionsBar = ({ selectedCount, onClear, onUpdate, onDelete, canDelete }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10 border border-gray-700 dark:border-gray-200">
      <div className="flex items-center gap-3">
        <div className="bg-blue-500 text-white p-1.5 rounded-lg">
          <CheckSquare size={18} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold leading-none">{selectedCount} Seleccionados</span>
          <span className="text-[10px] opacity-60 uppercase tracking-widest font-bold">Acciones Masivas</span>
        </div>
      </div>
      
      <div className="w-px h-8 bg-gray-700 dark:bg-gray-200"></div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={onUpdate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-100 rounded-xl transition-colors"
        >
          <Edit2 size={16} className="text-blue-400" /> Actualizar Campos
        </button>
        
        {canDelete && (
          <button 
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold hover:bg-red-900/30 dark:hover:bg-red-50 text-red-400 dark:text-red-600 rounded-xl transition-colors"
          >
            <Trash2 size={16} /> Eliminar
          </button>
        )}
      </div>

      <button 
        onClick={onClear}
        className="ml-2 p-2 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-full transition-colors"
        title="Cancelar selección"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default BulkActionsBar;