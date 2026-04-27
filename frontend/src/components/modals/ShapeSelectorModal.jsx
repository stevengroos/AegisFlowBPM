import React from 'react';
import { createPortal } from 'react-dom';
import { Shapes, X } from 'lucide-react';

const ShapeSelectorModal = ({ isOpen, onClose, selectedElement, onChangeShape }) => {
  // Si no está abierto, no dibujamos nada
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shapes size={18} className="text-purple-500" /> Seleccionar Forma (BPMN)
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors">
            <X size={18}/>
          </button>
        </div>
        
        <div className="p-6 grid grid-cols-2 gap-4">
           {/* Opción Task */}
           <button onClick={() => onChangeShape('task')} className={`p-4 border-2 rounded-xl flex flex-col items-center gap-3 transition-all hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${selectedElement?.data?.raw_data?.bpmn_shape === 'task' || !selectedElement?.data?.raw_data?.bpmn_shape ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="w-16 h-10 border-2 border-gray-400 dark:border-gray-500 rounded-md bg-white dark:bg-gray-800"></div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Actividad / Tarea</span>
           </button>

           {/* Opción Gateway */}
           <button onClick={() => onChangeShape('gateway')} className={`p-4 border-2 rounded-xl flex flex-col items-center gap-3 transition-all hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 ${selectedElement?.data?.raw_data?.bpmn_shape === 'gateway' ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="w-10 h-10 border-2 border-amber-500 bg-amber-100 dark:bg-amber-900/50 rotate-45 rounded-sm"></div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Decisión (Gateway)</span>
           </button>

           {/* Opción Start */}
           <button onClick={() => onChangeShape('start')} className={`p-4 border-2 rounded-xl flex flex-col items-center gap-3 transition-all hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${selectedElement?.data?.raw_data?.bpmn_shape === 'start' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="w-10 h-10 border-2 border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 rounded-full"></div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Evento de Inicio</span>
           </button>

           {/* Opción End */}
           <button onClick={() => onChangeShape('end')} className={`p-4 border-2 rounded-xl flex flex-col items-center gap-3 transition-all hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 ${selectedElement?.data?.raw_data?.bpmn_shape === 'end' ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="w-10 h-10 border-4 border-rose-500 bg-rose-100 dark:bg-rose-900/50 rounded-full"></div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Evento de Fin</span>
           </button>
        </div>
      </div>
    </div>, document.body
  );
};

export default ShapeSelectorModal;