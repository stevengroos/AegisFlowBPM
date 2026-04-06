import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import { Loader2, X, History, FileSpreadsheet, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const ImportHistoryModal = ({ isOpen, onClose, moduleId, onSuccess }) => {
  const { notify, confirm } = useNotification();
  const [importHistory, setImportHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchImportHistory = async () => {
        setLoadingHistory(true);
        try {
          const res = await api.get(`/api/v1/cases/import/history/${moduleId}`);
          setImportHistory(res.data);
        } catch (error) {
          notify.error("No se pudo cargar el historial.");
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchImportHistory();
    }
  }, [isOpen, moduleId, notify]);

  const handleUndoImport = async (batchId) => {
    const isConfirmed = await confirm({
      title: 'Deshacer Importación',
      message: '⚠️ ¿Estás seguro de deshacer esta importación? Se eliminarán permanentemente todos los registros creados en este lote.',
      confirmText: 'Sí, Deshacer',
      variant: 'danger'
    });
    
    if (!isConfirmed) return;
    
    try {
      const res = await api.post(`/api/v1/cases/import/undo/${batchId}`);
      notify.success(res.data.message || "Importación deshecha correctamente.");
      onClose(); // Cerramos y recargamos padre
      onSuccess(); 
    } catch (error) {
      notify.error("Error al deshacer la importación.");
    }
  };

  if (!isOpen) return null;

  return createPortal(
    // 🔥 SOLUCIÓN: Cambiamos z-[99999] por z-[50] para que no pelee con el confirm() 🔥
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[550] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                <History size={20} className="text-blue-500"/> Historial de Importaciones
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Revisa cargas masivas pasadas o deshace errores.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-xl transition-colors"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loadingHistory ? (
              <div className="flex justify-center py-20 text-gray-400"><Loader2 size={40} className="animate-spin"/></div>
          ) : importHistory.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <History size={40} className="mx-auto mb-4 opacity-50"/>
                <p>No se han realizado importaciones en este módulo.</p>
              </div>
          ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                      <tr>
                          <th className="px-4 py-3">Fecha y Hora</th>
                          <th className="px-4 py-3">Archivo</th>
                          <th className="px-4 py-3 text-center">Registros</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                      {importHistory.map(batch => (
                          <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{new Date(batch.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 truncate max-w-[200px]" title={batch.filename}><FileSpreadsheet size={14} className="text-emerald-500 shrink-0"/>{batch.filename}</td>
                            <td className="px-4 py-3 text-sm text-center font-bold text-gray-700 dark:text-gray-300">{batch.record_count}</td>
                            <td className="px-4 py-3 text-center">
                                {batch.status === 'COMPLETED' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={12}/> Completado</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"><RotateCcw size={12}/> Deshecho</span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {batch.status === 'COMPLETED' && (
                                  <button onClick={() => handleUndoImport(batch.id)} className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-red-500 hover:text-red-600 dark:hover:text-red-400 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 ml-auto">
                                      <AlertTriangle size={14}/> Deshacer
                                  </button>
                                )}
                            </td>
                          </tr>
                      ))}
                    </tbody>
                </table>
              </div>
          )}
        </div>
      </div>
    </div>, document.body
  );
};

export default ImportHistoryModal;