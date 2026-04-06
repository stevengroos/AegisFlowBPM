import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { ShieldAlert, Search, Filter, ChevronLeft, ChevronRight, Loader2, Eye, X, Activity, Server, FileJson, Download } from 'lucide-react';

import { useNotification } from '../context/NotificationContext';

const GlobalAudit = () => {
  const { notify } = useNotification();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  const [page, setPage] = useState(1);
  const limit = 20;
  const [searchTerm, setSearchTerm] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actionType, setActionType] = useState('');
  
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async (signal) => {
    setLoading(true);
    try {
      const skip = (page - 1) * limit;
      let url = `/api/v1/global_audit/?skip=${skip}&limit=${limit}`;
      
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (entityType) url += `&entity_type=${entityType}`;
      if (actionType) url += `&action=${actionType}`;

      const res = await api.get(url, { signal });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      if (error.name !== 'CanceledError') {
        notify.error("Error al cargar los registros de auditoría.");
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, entityType, actionType, notify]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    return () => controller.abort();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, entityType, actionType]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      let url = `/api/v1/global_audit/?skip=0&limit=10000`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (entityType) url += `&entity_type=${entityType}`;
      if (actionType) url += `&action=${actionType}`;

      const res = await api.get(url);
      const exportData = res.data.logs || [];

      if (exportData.length === 0) {
        notify.warning("No hay datos para exportar con estos filtros.");
        setExporting(false);
        return;
      }

      const headers = ["ID", "Fecha", "Usuario", "IP", "Entidad", "Accion", "Detalles"];
      const csvRows = [headers.join(",")];

      exportData.forEach(log => {
        const row = [
          log.id,
          `"${new Date(log.created_at).toLocaleString()}"`,
          `"${log.user_name || 'Sistema'}"`,
          `"${log.ip_address || 'N/A'}"`,
          log.entity_type,
          log.action,
          `"${(log.details || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(","));
      });

      const csvContent = csvRows.join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
      const link = document.createElement("a");
      const urlBlob = URL.createObjectURL(blob);
      link.setAttribute("href", urlBlob);
      link.setAttribute("download", `Auditoria_Global_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      notify.success("Archivo CSV exportado correctamente.");
    } catch (error) {
      notify.error("Hubo un error al generar el archivo de exportación.");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // 🔥 SE AGREGA EL BADGE DE RESTAURACIÓN (RESTORE) 🔥
  const getActionBadge = (action) => {
    switch (action) {
      case 'CREATE': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md text-[10px] font-bold tracking-wider">CREAR</span>;
      case 'UPDATE': return <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-md text-[10px] font-bold tracking-wider">EDITAR</span>;
      case 'DELETE': return <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md text-[10px] font-bold tracking-wider">BORRAR</span>;
      case 'RESTORE': return <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-md text-[10px] font-bold tracking-wider">RESTAURAR</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 rounded-md text-[10px] font-bold tracking-wider">{action}</span>;
    }
  };

  const getSafeJsonString = (data) => {
     if (!data) return 'Ningún dato previo';
     try {
         const parsed = typeof data === 'string' ? JSON.parse(data) : data;
         return JSON.stringify(parsed, null, 2);
     } catch (e) {
         return String(data);
     }
  };

  const JsonViewer = ({ data, title, headerBg, headerText }) => (
    <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
      <div className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${headerBg} ${headerText} border-b border-gray-200 dark:border-gray-800`}>
         <FileJson size={14} /> {title}
      </div>
      <div className="p-4 bg-gray-50 dark:bg-[#0d1117] overflow-auto max-h-64 custom-scrollbar">
        <pre className="text-[11px] font-mono text-gray-800 dark:text-gray-300 m-0 whitespace-pre-wrap break-words">
          {getSafeJsonString(data)}
        </pre>
      </div>
    </div>
  );

  return (
    <div className="p-6 pb-8 space-y-6 animate-in fade-in duration-300 h-full flex flex-col overflow-y-auto custom-scrollbar">
      
      {/* HEADER Y FILTROS */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-4 shrink-0">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="text-red-500" /> Auditoría Global
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Registro inmutable de toda la actividad de configuración y seguridad del sistema.
            </p>
          </div>
          
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar usuario o detalle..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* CONTROLES (FILTROS Y EXPORTAR) */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-sm text-gray-500 font-bold bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0">
               <Filter size={14} /> Filtros:
            </div>
            
            {/* 🔥 LISTA EXHAUSTIVA DE ENTIDADES SEGÚN EL CSV 🔥 */}
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="flex-1 sm:flex-none px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-red-500 cursor-pointer shadow-sm">
              <option value="">Todas las Entidades</option>
              <optgroup label="Estructura y Datos">
                 <option value="MODULE">Módulos</option>
                 <option value="FORM">Formularios (Plantillas)</option>
                 <option value="FIELD_SECTION">Secciones de Campos</option>
                 <option value="FIELD">Campos del Formulario</option>
              </optgroup>
              <optgroup label="Procesos y Automatizaciones">
                 <option value="BLUEPRINT">Flujos (Blueprints)</option>
                 <option value="STATUS">Estados de Flujo</option>
                 <option value="TRANSITION">Transiciones de Flujo</option>
                 <option value="TRANSITION_ACTION">Acciones de Transición</option>
                 <option value="AUTOMATION">Automatizaciones Globales</option>
              </optgroup>
              <optgroup label="Seguridad y Accesos">
                 <option value="ROLE">Roles de Jerarquía</option>
                 <option value="PROFILE">Perfiles y Permisos</option>
                 <option value="USER">Usuarios</option>
              </optgroup>
            </select>

            {/* 🔥 SE AÑADE RESTORE A LAS ACCIONES 🔥 */}
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="flex-1 sm:flex-none px-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-red-500 cursor-pointer shadow-sm">
              <option value="">Todas las Acciones</option>
              <option value="CREATE">Creaciones (CREATE)</option>
              <option value="UPDATE">Ediciones (UPDATE)</option>
              <option value="DELETE">Eliminaciones (DELETE)</option>
              <option value="RESTORE">Restauraciones (RESTORE)</option>
            </select>
          </div>

          <button 
            onClick={handleExportCSV}
            disabled={exporting || total === 0}
            className="flex items-center gap-2 bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-200 hover:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0 w-full sm:w-auto justify-center"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar CSV
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col flex-1 overflow-hidden min-h-[400px] mb-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-red-500" size={32} /></div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3">Fecha y Hora</th>
                    <th className="px-5 py-3">Usuario (Autor)</th>
                    <th className="px-5 py-3">Entidad</th>
                    <th className="px-5 py-3">Acción</th>
                    <th className="px-5 py-3 w-full">Detalle del Evento</th>
                    <th className="px-5 py-3 text-center">Rayos X</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {logs.length > 0 ? (
                    logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                           {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-bold text-gray-900 dark:text-white text-sm">{log.user_name}</div>
                          {log.ip_address && <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-1"><Server size={10}/> IP: {log.ip_address}</div>}
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                            <Activity size={14} className="text-blue-500"/> {log.entity_type}
                          </span>
                        </td>
                        <td className="px-5 py-3">{getActionBadge(log.action)}</td>
                        <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs" title={log.details}>
                          {log.details}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {(log.old_value || log.new_value) ? (
                            <button onClick={() => setSelectedLog(log)} className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 rounded-lg transition-colors inline-flex justify-center" title="Ver detalle JSON">
                              <Eye size={16} />
                            </button>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-700">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No se encontraron registros de auditoría con estos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINACIÓN */}
            {total > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Mostrando <span className="font-bold text-gray-900 dark:text-white">{(page - 1) * limit + 1}</span> a <span className="font-bold text-gray-900 dark:text-white">{Math.min(page * limit, total)}</span> de <span className="font-bold text-gray-900 dark:text-white">{total}</span> eventos
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 px-2">Página {page} de {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL DE RAYOS X (PORTAL) */}
      {selectedLog && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-4xl shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
               <div>
                 <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                   <Eye size={18} className="text-red-500" /> Detalle del Cambio
                 </h3>
                 <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">{selectedLog.details}</p>
               </div>
               <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto flex flex-col lg:flex-row gap-4">
               <JsonViewer 
                 data={selectedLog.old_value} 
                 title="Valor Anterior (Original)" 
                 headerBg="bg-amber-100 dark:bg-amber-900/30" 
                 headerText="text-amber-800 dark:text-amber-400"
               />
               
               <JsonViewer 
                 data={selectedLog.new_value} 
                 title="Nuevo Valor (Modificado)" 
                 headerBg="bg-emerald-100 dark:bg-emerald-900/30" 
                 headerText="text-emerald-800 dark:text-emerald-400"
               />
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex justify-between items-center text-xs text-gray-500">
               <span><strong>Autor:</strong> {selectedLog.user_name} (IP: {selectedLog.ip_address})</span>
               <span>{new Date(selectedLog.created_at).toLocaleString()}</span>
            </div>

          </div>
        </div>, document.body
      )}

    </div>
  );
};

export default GlobalAudit;