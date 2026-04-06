import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Loader2, Plus, LayoutDashboard, Edit3, Trash2, Undo2, Save, BarChart2, Download } from 'lucide-react'; 
import ChartWidget from '../components/ChartWidget';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import ReportBuilderModal from '../features/dashboards/ReportBuilderModal';

// 🔥 IMPORTAMOS NUESTRO SISTEMA GLOBAL DE NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

const Dashboards = () => {
  const { notify, confirm } = useNotification();

  const [dashboards, setDashboards] = useState([]);
  const [activeDashId, setActiveDashId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState([]);

  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);
  const [isDashModalOpen, setIsDashModalOpen] = useState(false);
  const [editingDashId, setEditingDashId] = useState(null);
  const [dashFormName, setDashFormName] = useState('');

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportToEdit, setReportToEdit] = useState(null);

  const fetchData = async (signal) => {
    try {
      const resDash = await api.get('/api/v1/dashboards/', { signal });
      setDashboards(resDash.data);
      if (resDash.data.length > 0 && !activeDashId) setActiveDashId(resDash.data[0].id);
      
      const resMods = await api.get('/api/v1/modules/', { signal });
      setModules(resMods.data);
      setHasUnsavedLayout(false); 
    } catch (error) { 
      if (error.name !== 'CanceledError') {
        console.error("Error cargando datos:", error);
        notify.error("Error al cargar los datos del dashboard."); 
      }
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    const controller = new AbortController();
    fetchData(controller.signal); 
    return () => controller.abort();
  }, []);

  const handleOpenDashModal = (dashId = null, currentName = '') => {
    setEditingDashId(dashId); setDashFormName(currentName); setIsDashModalOpen(true);
  };

  const handleSaveDashboard = async () => {
    if (!dashFormName.trim()) {
      notify.warning("El nombre del dashboard no puede estar vacío."); 
      return;
    }
    
    try {
      if (editingDashId) {
        await api.put(`/api/v1/dashboards/${editingDashId}`, { name: dashFormName, is_active: true });
        notify.success("Dashboard actualizado exitosamente.");
      } else {
        const res = await api.post('/api/v1/dashboards/', { name: dashFormName, is_active: true });
        setActiveDashId(res.data.id);
        notify.success("Dashboard creado exitosamente.");
      }
      setIsDashModalOpen(false); 
      fetchData();
    } catch (error) { 
      notify.error("Error al guardar el dashboard."); 
    }
  };

  const handleDeleteDashboard = async (id) => {
    const isConfirmed = await confirm({
      title: 'Eliminar Dashboard',
      message: '¿Seguro que deseas eliminar TODO este Dashboard y sus reportes? Esta acción es irreversible.',
      confirmText: 'Sí, eliminar todo',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try { 
      await api.delete(`/api/v1/dashboards/${id}`); 
      setActiveDashId(null); 
      fetchData(); 
      notify.success("Dashboard eliminado correctamente.");
    } catch (error) { 
      notify.error("Error al eliminar el dashboard."); 
    }
  };

  const handleSaveReportAPI = async (payload, reportId = null) => {
    try {
      if (reportId) {
        await api.put(`/api/v1/dashboards/reports/${reportId}`, payload);
        notify.success("Reporte actualizado exitosamente.");
      } else {
        await api.post(`/api/v1/dashboards/${activeDashId}/reports`, payload);
        notify.success("Reporte creado exitosamente.");
      }
      setIsReportModalOpen(false); 
      fetchData(); 
    } catch (error) { 
      notify.error("Error al guardar el reporte."); 
    }
  };

  const handleDeleteReport = async (reportId) => {
    try { 
      await api.delete(`/api/v1/dashboards/reports/${reportId}`); 
      fetchData(); 
      notify.success("Reporte eliminado."); 
    } catch (error) { 
      notify.error("Error al eliminar el reporte."); 
    } 
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return; 
    const activeDash = dashboards.find(d => d.id === activeDashId);
    if (!activeDash) return;

    const sortedReports = [...activeDash.reports].sort((a, b) => (a.grid_layout?.order || 0) - (b.grid_layout?.order || 0));
    const [reorderedItem] = sortedReports.splice(result.source.index, 1);
    sortedReports.splice(result.destination.index, 0, reorderedItem);

    sortedReports.forEach((rep, index) => {
      if (!rep.grid_layout) rep.grid_layout = {};
      rep.grid_layout.order = index;
    });

    setDashboards(prev => prev.map(d => d.id === activeDashId ? { ...d, reports: sortedReports } : d));
    setHasUnsavedLayout(true);
  };

  const commitLayoutToBackend = async () => {
    const activeDash = dashboards.find(d => d.id === activeDashId);
    if (!activeDash) return;
    const layoutPayload = activeDash.reports.map(r => ({ report_id: r.id, order: r.grid_layout?.order || 0 }));
    try {
      await api.put(`/api/v1/dashboards/${activeDashId}/layout`, { layout: layoutPayload });
      setHasUnsavedLayout(false); 
      notify.success("Diseño del dashboard guardado."); 
    } catch (error) { 
      notify.error("Error al guardar el diseño del dashboard."); 
    }
  };

  const handleSwitchDashboard = async (targetDashId) => {
    if (hasUnsavedLayout) {
      const isConfirmed = await confirm({
        title: 'Cambios sin guardar',
        message: 'Tienes cambios en la posición de los gráficos que no has guardado. ¿Deseas descartarlos y cambiar de dashboard?',
        confirmText: 'Descartar cambios',
        variant: 'danger'
      });
      if (!isConfirmed) return;
    }
    setActiveDashId(targetDashId);
    setHasUnsavedLayout(false);
  };

  const activeDashboard = dashboards.find(d => d.id === activeDashId);
  const sortedReports = activeDashboard ? [...activeDashboard.reports].sort((a, b) => (a.grid_layout?.order || 0) - (b.grid_layout?.order || 0)) : [];

  return (
    <>
      <div className="flex flex-col md:flex-row gap-6 h-full animate-in fade-in duration-300">
        
        {/* MENÚ LATERAL DE DASHBOARDS */}
        <div className="print:hidden w-full md:w-64 shrink-0 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
              <LayoutDashboard size={16} className="text-blue-500" /> Mis Dashboards
            </h2>
            <button onClick={() => handleOpenDashModal()} className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded-md transition-colors">
              <Plus size={16} />
            </button>
          </div>
          
          {loading ? (
             <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
              {dashboards.map(dash => (
                <div key={dash.id} className="flex group">
                  <button 
                    onClick={() => handleSwitchDashboard(dash.id)} 
                    className={`flex-1 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors truncate ${activeDashId === dash.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    {dash.name}
                  </button>
                  {activeDashId === dash.id && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenDashModal(dash.id, dash.name)} className="p-1 text-gray-400 hover:text-blue-500"><Edit3 size={14}/></button>
                      <button onClick={() => handleDeleteDashboard(dash.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LIENZO PRINCIPAL (DRAG & DROP) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {activeDashboard ? (
            <>
              <div className="print:hidden flex justify-between items-center mb-6 shrink-0 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{activeDashboard.name}</h1>
                <div className="flex items-center gap-3">
                  
                  <button 
                    onClick={() => window.print()} 
                    className="text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    <Download size={16} /> Exportar PDF
                  </button>

                  {hasUnsavedLayout && (
                    <div className="flex items-center gap-2 mx-2 border-l border-r border-gray-200 dark:border-gray-800 px-4 animate-in fade-in">
                      <button onClick={() => fetchData()} className="text-gray-500 hover:text-gray-800 dark:hover:text-white p-2 rounded-lg text-sm font-medium flex gap-1"><Undo2 size={16} /> Cancelar</button>
                      <button onClick={commitLayoutToBackend} className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex gap-2"><Save size={16} /> Guardar Diseño</button>
                    </div>
                  )}
                  <button onClick={() => { setReportToEdit(null); setIsReportModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700">
                    <Plus size={16} /> Crear Reporte
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pb-8 px-1 print:overflow-visible printable-area bg-transparent dark:bg-transparent">
                
                <div className="hidden print:block mb-8 text-center border-b pb-4">
                    <h1 className="text-3xl font-black text-black">{activeDashboard.name}</h1>
                    <p className="text-gray-500 mt-2">Exportado el: {new Date().toLocaleDateString()}</p>
                </div>

                {sortedReports.length > 0 ? (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="dashboard-grid" direction="horizontal" type="widget">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-max print:grid-cols-2 print:gap-8 print:w-full">
                          {sortedReports.map((report, index) => (
                            <Draggable key={report.id.toString()} draggableId={report.id.toString()} index={index}>
                              {(provided) => (
                                // 🔥 FIX APLICADO AQUÍ: Agregamos w-full, overflow-hidden y {...provided.dragHandleProps}
                                <div 
                                  ref={provided.innerRef} 
                                  {...provided.draggableProps} 
                                  {...provided.dragHandleProps} 
                                  className={`chart-container relative w-full overflow-hidden ${report.chart_type === 'metric' ? 'h-40' : 'h-[350px]'} print:h-[400px]`}
                                >
                                  <ChartWidget 
                                    report={report} 
                                    onEdit={(rep) => { setReportToEdit(rep); setIsReportModalOpen(true); }} 
                                    onDelete={handleDeleteReport} 
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                ) : (
                  <div className="print:hidden h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center">
                    <BarChart2 size={48} className="mb-4 opacity-30" />
                    <p className="font-bold text-gray-700 dark:text-gray-300 text-lg">Dashboard vacío</p>
                  </div>
                )}
              </div>
            </>
          ) : (
             <div className="print:hidden flex-1 flex items-center justify-center text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 shadow-sm p-6">Selecciona un dashboard.</div>
          )}
        </div>
      </div>

      {/* MODAL PARA DASHBOARD */}
      {isDashModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex justify-center items-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{editingDashId ? 'Renombrar Dashboard' : 'Nuevo Dashboard'}</h2>
            <input autoFocus type="text" placeholder="Ej: Ventas Q3" value={dashFormName} onChange={e => setDashFormName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none mb-6 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDashModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleSaveDashboard} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-900/20">Guardar</button>
            </div>
          </div>
        </div>
      )}

      <ReportBuilderModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        onSave={handleSaveReportAPI} 
        reportToEdit={reportToEdit} 
        modules={modules} 
      />
    </>
  );
};

export default Dashboards;