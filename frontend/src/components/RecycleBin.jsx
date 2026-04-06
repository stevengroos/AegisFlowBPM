import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Trash2, RotateCcw, AlertTriangle, Search, Filter, Loader2, Database, Clock, UserX, ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react';

import { useNotification } from '../context/NotificationContext';

const RecycleBin = () => {
  const { notify, confirm } = useNotification();

  const [records, setRecords] = useState([]);
  const [modules, setModules] = useState([]);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); 
  
  const [selectedModule, setSelectedModule] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // 🔥 1. Carga inicial de Catálogos (Módulos y Usuarios) 🔥
  useEffect(() => {
    const controller = new AbortController();
    
    Promise.all([
      api.get('/api/v1/modules/', { signal: controller.signal }),
      api.get('/api/v1/auth/users', { signal: controller.signal })
    ])
    .then(([modRes, usersRes]) => {
        setModules(Array.isArray(modRes.data) ? modRes.data : []);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    })
    .catch(err => { 
        if (err.name !== 'CanceledError') console.error("Error al cargar catálogos iniciales"); 
    });

    return () => controller.abort();
  }, []);

  // 🔥 2. Carga de Registros Eliminados 🔥
  const fetchDeletedRecords = useCallback(async (moduleFilter, signal) => {
    setLoading(true);
    try {
      let url = '/api/v1/cases/recycle-bin';
      if (moduleFilter) {
          url += `?module_id=${moduleFilter}`;
      } else {
          url += `?`;
      }
      
      const res = await api.get(url, { signal });
      
      let rawData = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.records || []);
      
      const safeRecords = rawData.map(r => {
          let safeData = r.data;
          if (typeof safeData === 'string') {
              try { safeData = JSON.parse(safeData); } 
              catch(e) { safeData = {}; }
          }
          return { ...r, data: safeData || {} };
      });
      
      setRecords(safeRecords);
    } catch (error) {
      if (error.name !== 'CanceledError') {
        notify.error("Error al cargar los registros de la papelera.");
      }
    } finally {
      setLoading(false);
    }
  }, [notify]); 

  useEffect(() => {
    const controller = new AbortController();
    fetchDeletedRecords(selectedModule, controller.signal);
    return () => controller.abort();
  }, [selectedModule, fetchDeletedRecords]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedModule]);

  // 🔥 3. Funciones de Acción 🔥
  const handleRestore = async (id) => {
    setIsProcessing(true);
    try {
      await api.post(`/api/v1/cases/${id}/restore`);
      notify.success("Registro restaurado con éxito.");
      fetchDeletedRecords(selectedModule);
    } catch (error) {
      notify.error("Error al intentar restaurar el registro.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHardDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Eliminación Permanente',
      message: '⚠️ ADVERTENCIA: Esta acción borrará el registro de la base de datos de forma irreversible. ¿Estás completamente seguro?',
      confirmText: 'Sí, eliminar permanentemente',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    setIsProcessing(true);
    try {
      await api.delete(`/api/v1/cases/${id}/permanent`);
      notify.success("Registro eliminado permanentemente.");
      fetchDeletedRecords(selectedModule);
    } catch (error) {
      notify.error("Error al eliminar el registro.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyBin = async () => {
    if (!Array.isArray(records) || records.length === 0) return;

    const isConfirmed = await confirm({
      title: 'Vaciar Papelera',
      message: '🚨 ALERTA CRÍTICA: Estás a punto de eliminar PERMANENTEMENTE todos los registros visibles en la papelera. Esta acción no tiene vuelta atrás. ¿Deseas proceder?',
      confirmText: 'Sí, vaciar todo',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    setIsProcessing(true);
    try {
      const deletePromises = filteredRecords.map(r => api.delete(`/api/v1/cases/${r.id}/permanent`));
      await Promise.all(deletePromises);
      
      notify.success("La papelera ha sido vaciada.");
      fetchDeletedRecords(selectedModule);
    } catch (error) {
      notify.error("Hubo un error al vaciar algunos registros.");
      fetchDeletedRecords(selectedModule); 
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔥 4. Helpers para Cruce de Datos Seguros 🔥
  const getModuleName = (moduleId) => {
    const mod = modules.find(m => m.id == moduleId);
    return mod ? mod.name : `Módulo #${moduleId || 'Desconocido'}`;
  };

  const getUserName = (userId) => {
    if (!userId) return 'Sistema / Desconocido';
    const user = users.find(u => u.id == userId);
    if (user) {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      return fullName || user.email;
    }
    return `Usuario #${userId}`;
  };

  const getSafeDate = (record) => {
    const rawDate = record.deleted_at || record.updated_at;
    if (!rawDate) return "Fecha desconocida";
    try {
      return new Date(rawDate).toLocaleString();
    } catch (error) {
      return "Fecha inválida";
    }
  };

  // 🔥 5. Lógica de Filtrado y Paginación 🔥
  const safeRecordsList = Array.isArray(records) ? records : [];
  const filteredRecords = safeRecordsList.filter(record => {
    if (!record) return false;
    const term = searchTerm.toLowerCase();
    
    const modName = getModuleName(record.module_id).toLowerCase();
    const dataValues = Object.values(record.data || {}).join(' ').toLowerCase();

    return (
      (record.id && record.id.toString().includes(term)) ||
      modName.includes(term) ||
      dataValues.includes(term)
    );
  });

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage) || 1;

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  // 🔥 6. Resumen Visual de los Datos del Caso 🔥
  const renderRecordSummary = (dataObj) => {
    if (!dataObj || Object.keys(dataObj).length === 0) {
      return (
        <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 italic text-xs mt-1">
          <FileQuestion size={12}/> Sin datos descriptivos
        </span>
      );
    }
    
    const entries = Object.entries(dataObj).slice(0, 2);
    return (
      <div className="flex flex-col gap-1 mt-1.5">
        {entries.map(([key, val]) => (
          <span key={key} className="text-xs truncate max-w-[300px] flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/50 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-700/50 w-fit">
            <span className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[9px]">{key}:</span>
            <span className="text-gray-900 dark:text-gray-200 font-medium">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
          </span>
        ))}
        {Object.keys(dataObj).length > 2 && <span className="text-[10px] text-blue-500 font-bold ml-1">+{Object.keys(dataObj).length - 2} campos más ocultos...</span>}
      </div>
    );
  };

  return (
    <div className="p-6 pb-8 h-full flex flex-col animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
      
      {/* HEADER Y FILTROS */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-5 shrink-0 mb-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Trash2 className="text-red-500" /> Papelera de Reciclaje
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Restaura registros eliminados o bórralos permanentemente del sistema.
            </p>
          </div>
          
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar por ID o contenido..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-sm text-gray-500 font-bold bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0">
               <Filter size={14} /> Filtro:
            </div>
            <select 
              value={selectedModule} 
              onChange={(e) => setSelectedModule(e.target.value)} 
              className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-red-500/50 cursor-pointer shadow-sm transition-all"
            >
              <option value="">Todos los Módulos</option>
              {Array.isArray(modules) && modules.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleEmptyBin} 
            disabled={!Array.isArray(records) || records.length === 0 || isProcessing}
            className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-500 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/30 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm w-full sm:w-auto active:scale-95"
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
            Vaciar Papelera
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col flex-1 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-red-500" size={32} /></div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Módulo</th>
                    <th className="px-6 py-4">Registro (Resumen)</th>
                    <th className="px-6 py-4">Fechas</th>
                    <th className="px-6 py-4">Creado por</th>
                    <th className="px-6 py-4">Eliminado por</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {currentRecords.length > 0 ? (
                    currentRecords.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50 font-bold text-xs tracking-wide">
                            <Database size={14} /> {getModuleName(record.module_id)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-black text-gray-900 dark:text-white text-sm">ID: #{record.id}</div>
                          {renderRecordSummary(record.data)}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300">
                          <div className="flex flex-col gap-1">
                             <span className="flex items-center gap-1.5 opacity-80" title="Fecha de Creación">
                                <Clock size={12} /> C: {record.created_at ? new Date(record.created_at).toLocaleDateString() : 'N/A'}
                             </span>
                             <span className="flex items-center gap-1.5 font-medium text-red-500/90" title="Fecha de Eliminación">
                                <Trash2 size={12} /> E: {getSafeDate(record)}
                             </span>
                          </div>
                        </td>
                        {/* COLUMNA: CREADOR */}
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-1.5 font-medium bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1 rounded-md w-fit border border-gray-100 dark:border-gray-700/50">
                             <UserX size={14} className="text-gray-400" />
                             {getUserName(record.created_by)}
                          </div>
                        </td>
                        {/* COLUMNA: ELIMINADOR */}
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-1.5 font-bold bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-md w-fit border border-red-100 dark:border-red-900/30">
                             <Trash2 size={14} className="text-red-500/70" />
                             {record.deleted_by ? getUserName(record.deleted_by) : 'N/A (Antiguo)'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleRestore(record.id)} 
                              disabled={isProcessing}
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                              title="Restaurar Registro"
                            >
                              <RotateCcw size={14}/> Restaurar
                            </button>
                            <button 
                              onClick={() => handleHardDelete(record.id)} 
                              disabled={isProcessing}
                              className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                              title="Eliminar Permanentemente"
                            >
                              <Trash2 size={14}/> Destruir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <Trash2 size={40} className="mx-auto text-gray-200 dark:text-gray-800 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">La papelera está vacía</h3>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">No hay registros eliminados que coincidan con tu búsqueda.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINACIÓN */}
            {filteredRecords.length > 0 && (
              <div className="bg-gray-50/80 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Mostrando <span className="font-bold text-gray-900 dark:text-white">{indexOfFirstRecord + 1}</span> a <span className="font-bold text-gray-900 dark:text-white">{Math.min(indexOfLastRecord, filteredRecords.length)}</span> de <span className="font-bold text-gray-900 dark:text-white">{filteredRecords.length}</span> registros
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={prevPage} disabled={currentPage === 1 || isProcessing} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm bg-white dark:bg-gray-800">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 px-2">Página {currentPage} de {totalPages}</span>
                  <button onClick={nextPage} disabled={currentPage === totalPages || isProcessing} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm bg-white dark:bg-gray-800">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default RecycleBin;