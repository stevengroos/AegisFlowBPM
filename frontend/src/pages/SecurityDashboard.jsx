import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Shield, Smartphone, MonitorSmartphone, Activity, Lock, Download, Filter, Search, Globe, Loader2, ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import Select from 'react-select'; 
import { useNotification } from '../context/NotificationContext';

// ==========================================
// 🔥 NUEVO COMPONENTE: MODAL PARA DRILL-DOWN 🔥
// ==========================================
const DrillDownModal = ({ isOpen, onClose, title, description, data, columns, icon: Icon, colorClass, bgClass, notify }) => {
  if (!isOpen) return null;

  const handleExport = () => {
    if (!data || data.length === 0) return notify.warning("No hay datos para exportar.");
    const separator = ';';
    const headers = columns.map(c => c.header);
    const rows = data.map(row => columns.map(c => `"${String(row[c.key] || '').replace(/"/g, '""')}"`));
    const csvContent = [headers.join(separator), ...rows.map(e => e.join(separator))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Detalle_${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    notify.success("Detalle exportado correctamente.");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50/50 dark:bg-gray-800/30 rounded-t-2xl">
          <div className="flex items-center gap-3">
             <div className={`p-2.5 rounded-xl ${bgClass} ${colorClass}`}><Icon size={20} /></div>
             <div>
               <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
               <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{description}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"><X size={20}/></button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-[11px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  {columns.map((col, idx) => <th key={idx} className="px-5 py-3">{col.header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.length > 0 ? data.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    {columns.map((col, colIdx) => (
                       <td key={colIdx} className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                         {col.render ? col.render(row[col.key], row) : row[col.key]}
                       </td>
                    ))}
                  </tr>
                )) : <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-gray-500 italic">No hay registros para mostrar en esta categoría.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end bg-gray-50/50 dark:bg-gray-800/30 rounded-b-2xl">
           <button onClick={handleExport} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
             <Download size={16} /> Exportar Detalle (CSV)
           </button>
        </div>
      </div>
    </div>
  );
};


const SecurityDashboard = () => {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  
  const [metrics, setMetrics] = useState(null);
  const [options, setOptions] = useState({ users: [], roles: [], profiles: [] });

  const [datePreset, setDatePreset] = useState('last7');

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    selectedUsers: [],
    selectedRoles: [],
    selectedProfiles: []
  });

  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;

  // 🔥 NUEVO: Estados para controlar qué modal está abierto 🔥
  const [activeModal, setActiveModal] = useState(null); // 'mfa', 'sessions', 'brute_force', 'blocked'

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    let start = '';
    let end = today.toISOString().split('T')[0];

    if (preset === 'today') {
      start = end;
    } else if (preset === 'last7') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
    } else if (preset === 'last30') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
    } else if (preset === 'custom') {
      return; 
    }
    setFilters(prev => ({ ...prev, startDate: start, endDate: end }));
  };

  useEffect(() => {
    handlePresetChange('last7');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [usersRes, rolesRes, profilesRes] = await Promise.all([
          api.get('/api/v1/auth/users'),
          api.get('/api/v1/security/roles'),
          api.get('/api/v1/security/profiles')
        ]);
        setOptions({
          users: usersRes.data.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''} (${u.email})` })),
          roles: rolesRes.data.map(r => ({ value: r.id, label: r.name })),
          profiles: profilesRes.data.map(p => ({ value: p.id, label: p.name }))
        });
      } catch (error) { notify.error("Error al cargar opciones de filtrado."); }
    };
    fetchOptions();
  }, [notify]);

  const fetchMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', new Date(filters.startDate).toISOString());
      if (filters.endDate) {
        const end = new Date(filters.endDate); end.setHours(23, 59, 59, 999);
        params.append('end_date', end.toISOString());
      }
      filters.selectedUsers.forEach(u => params.append('user_ids', u.value));
      filters.selectedRoles.forEach(r => params.append('role_ids', r.value));
      filters.selectedProfiles.forEach(p => params.append('profile_ids', p.value));

      const response = await api.get(`/api/v1/dashboards/security-metrics?${params.toString()}`);
      setMetrics(response.data);
      setCurrentPage(1); 
    } catch (error) { notify.error("Error al cargar el panel de seguridad."); } 
    finally { setLoading(false); setLoadingMetrics(false); }
  }, [filters, notify]);

  useEffect(() => { if (filters.startDate) fetchMetrics(); }, [fetchMetrics, filters.startDate]);

  const handleExportCSV = () => {
    if (!metrics || metrics.recent_logs.length === 0) return notify.warning("No hay datos para exportar.");
    const separator = ';';
    const headers = ['Fecha/Hora', 'Usuario', 'Acción', 'Detalle', 'Dirección IP'];
    const rows = metrics.recent_logs.map(log => [
      `"${String(new Date(log.created_at).toLocaleString()).replace(/"/g, '""')}"`,
      `"${String(log.user_name || '').replace(/"/g, '""')}"`,
      `"${String(log.action || '').replace(/"/g, '""')}"`,
      `"${String(log.details || '').replace(/"/g, '""')}"`,
      `"${String(log.ip_address || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(separator), ...rows.map(e => e.join(separator))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `Auditoria_Seguridad_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    notify.success("Reporte exportado correctamente.");
  };

  const customSelectStyles = {
    control: (base) => ({ ...base, backgroundColor: 'transparent', borderColor: '#374151', borderRadius: '0.75rem', padding: '2px', boxShadow: 'none', '&:hover': { borderColor: '#4b5563' }, minHeight: '40px', maxHeight: '40px' }),
    menu: (base) => ({ ...base, backgroundColor: '#111827', border: '1px solid #374151', zIndex: 50 }),
    option: (base, { isFocused }) => ({ ...base, backgroundColor: isFocused ? '#1f2937' : 'transparent', color: '#d1d5db', cursor: 'pointer' }),
    multiValue: (base) => ({ ...base, backgroundColor: '#374151', borderRadius: '0.5rem', maxHeight: '24px', maxWidth: '100%' }),
    multiValueLabel: (base) => ({ ...base, color: '#f3f4f6', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
    multiValueRemove: (base) => ({ ...base, color: '#9ca3af', '&:hover': { backgroundColor: '#4b5563', color: '#fff' } }),
    singleValue: (base) => ({ ...base, color: '#f3f4f6' }),
    input: (base) => ({ ...base, color: '#f3f4f6' }), 
    placeholder: (base) => ({ ...base, color: '#6b7280' }),
    valueContainer: (base) => ({ ...base, maxHeight: '34px', overflowY: 'auto', padding: '0 8px', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' })
  };

  if (loading) return <div className="flex h-full items-center justify-center p-10"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  if (!metrics) return null;

  const { kpis, timeline, top_ips, recent_logs, drilldown } = metrics;
  
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = recent_logs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(recent_logs.length / logsPerPage) || 1;

  // 🔥 NUEVO: Configuraciones de los Modales 🔥
  const modalConfigs = {
    mfa: {
      title: "Usuarios Vulnerables (Sin MFA)",
      description: "Lista de usuarios que no tienen activada la autenticación de doble factor.",
      data: drilldown.mfa_vulnerables,
      icon: Smartphone, colorClass: "text-purple-600 dark:text-purple-400", bgClass: "bg-purple-100 dark:bg-purple-900/30",
      columns: [ { header: "Nombre/Email", key: "name" }, { header: "Correo Electrónico", key: "email" } ]
    },
    sessions: {
      title: "Sesiones Activas",
      description: "Dispositivos actualmente conectados a la plataforma.",
      data: drilldown.active_sessions_list,
      icon: MonitorSmartphone, colorClass: "text-blue-600 dark:text-blue-400", bgClass: "bg-blue-100 dark:bg-blue-900/30",
      columns: [
        { header: "Usuario", key: "user_email", render: (val) => <span className="font-bold">{val}</span> },
        { header: "Dirección IP", key: "ip_address", render: (val) => <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{val}</span> },
        { header: "Navegador/Agente", key: "user_agent", render: (val) => <span className="text-xs truncate max-w-[200px] block" title={val}>{val}</span> },
        { header: "Expira el", key: "expires_at", render: (val) => new Date(val).toLocaleString() }
      ]
    },
    brute_force: {
      title: "Riesgo de Fuerza Bruta",
      description: "Usuarios que han fallado su contraseña repetidas veces recientemente.",
      data: drilldown.brute_force_users,
      icon: Activity, colorClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-100 dark:bg-amber-900/30",
      columns: [
        { header: "Usuario", key: "email", render: (val) => <span className="font-bold">{val}</span> },
        { header: "Intentos Fallidos", key: "failed_attempts", render: (val) => <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-1 rounded-lg font-bold text-xs">{val} fallos</span> }
      ]
    },
    blocked: {
      title: "Usuarios Bloqueados",
      description: "Lista de usuarios a los que se les ha denegado el acceso al sistema.",
      data: drilldown.blocked_users,
      icon: Lock, colorClass: "text-red-600 dark:text-red-400", bgClass: "bg-red-100 dark:bg-red-900/30",
      columns: [
        { header: "Usuario", key: "email", render: (val) => <span className="font-bold">{val}</span> },
        { header: "Tipo de Bloqueo", key: "type", render: (val) => <span className={`px-2 py-1 rounded-lg font-bold text-xs ${val === 'Permanente' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400'}`}>{val}</span> },
        { header: "Expira el", key: "expires_at", render: (val) => val === 'N/A' ? <span className="text-gray-400 italic">No expira</span> : new Date(val).toLocaleString() }
      ]
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300 relative">
      
      {/* RENDERIZADO DEL MODAL ACTIVO */}
      {activeModal && (
        <DrillDownModal 
          {...modalConfigs[activeModal]} 
          isOpen={!!activeModal} 
          onClose={() => setActiveModal(null)} 
          notify={notify}
        />
      )}

      {/* HEADER Y EXPORTAR */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-indigo-500" /> Centro de Inteligencia de Seguridad
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Auditoría, trazabilidad y monitoreo en tiempo real (ISO 27001).</p>
        </div>
        <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0">
          <Download size={18} /> Exportar Evidencia (CSV)
        </button>
      </div>

      {/* BARRA DE FILTROS AVANZADA */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
             <Filter size={16} /> Filtros de Investigación
           </div>
           <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 p-1 rounded-lg border border-gray-200 dark:border-gray-800">
              <button onClick={() => handlePresetChange('today')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${datePreset === 'today' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Hoy</button>
              <button onClick={() => handlePresetChange('last7')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${datePreset === 'last7' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Últimos 7 días</button>
              <button onClick={() => handlePresetChange('last30')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${datePreset === 'last30' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Últimos 30 días</button>
              <button onClick={() => handlePresetChange('custom')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${datePreset === 'custom' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}><Calendar size={12}/> Rango Personalizado</button>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Desde</label>
            <input type="date" disabled={datePreset !== 'custom'} value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full px-3 py-[9px] bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none disabled:opacity-50 dark:[color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Hasta</label>
            <input type="date" disabled={datePreset !== 'custom'} value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full px-3 py-[9px] bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none disabled:opacity-50 dark:[color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Roles</label>
            <Select isMulti options={options.roles} styles={customSelectStyles} placeholder="Todos..." onChange={v => setFilters({...filters, selectedRoles: v || []})} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Perfiles</label>
            <Select isMulti options={options.profiles} styles={customSelectStyles} placeholder="Todos..." onChange={v => setFilters({...filters, selectedProfiles: v || []})} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Usuarios</label>
              <Select isMulti options={options.users} styles={customSelectStyles} placeholder="Buscar..." onChange={v => setFilters({...filters, selectedUsers: v || []})} />
            </div>
            <button onClick={fetchMetrics} disabled={loadingMetrics} className="bg-indigo-600 hover:bg-indigo-700 text-white w-10 rounded-xl h-[40px] mt-auto transition-colors flex items-center justify-center shrink-0 active:scale-95 shadow-sm">
              {loadingMetrics ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* KPIS Clickeables (Drill-Down) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        <div onClick={() => setActiveModal('mfa')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4 cursor-pointer hover:border-purple-300 dark:hover:border-purple-800 hover:shadow-md transition-all group">
          <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shrink-0 group-hover:scale-110 transition-transform"><Smartphone size={24} /></div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Adopción MFA</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{kpis.mfa_adoption_rate}%</h3>
            <p className="text-xs text-gray-500 mt-1">{kpis.mfa_enabled} de {kpis.total_users} usuarios filtrados</p>
          </div>
        </div>

        <div onClick={() => setActiveModal('sessions')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4 cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md transition-all group">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform"><MonitorSmartphone size={24} /></div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Sesiones Activas</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{kpis.active_sessions}</h3>
            <p className="text-xs text-gray-500 mt-1">Dispositivos conectados ahora</p>
          </div>
        </div>

        <div onClick={() => setActiveModal('brute_force')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4 cursor-pointer hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-md transition-all group">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-110 transition-transform"><Activity size={24} /></div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Riesgo Fuerza Bruta</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{kpis.failed_attempts_sum}</h3>
            <p className="text-xs text-gray-500 mt-1">Intentos fallidos acumulados</p>
          </div>
        </div>

        <div onClick={() => setActiveModal('blocked')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start gap-4 cursor-pointer hover:border-red-300 dark:hover:border-red-800 hover:shadow-md transition-all group">
          <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0 group-hover:scale-110 transition-transform"><Lock size={24} /></div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Bloqueados</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{kpis.temporarily_blocked + kpis.permanently_blocked}</h3>
            <p className="text-xs text-gray-500 mt-1">{kpis.temporarily_blocked} temporal, {kpis.permanently_blocked} total</p>
          </div>
        </div>

      </div>

      {/* GRÁFICOS Y TOP IPs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Gráfico de Actividad */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Activity size={18} className="text-gray-400" /> Línea de Tiempo de Accesos
          </h3>
          <div className="h-72 w-full">
            {timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorExitosos" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorFallidos" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px', color: '#fff' }} />
                  <Legend iconType="circle" />
                  <Area type="monotone" name="Inicios Exitosos" dataKey="exitosos" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorExitosos)" />
                  <Area type="monotone" name="Intentos Fallidos" dataKey="fallidos" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorFallidos)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-gray-500 italic">No hay actividad en el rango seleccionado.</div>}
          </div>
        </div>

        {/* Top IPs Sospechosas */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Globe size={18} className="text-gray-400" /> Top IPs Sospechosas
          </h3>
          <p className="text-xs text-gray-500 mb-4">Orígenes con más accesos denegados.</p>
          
          <div className="flex-1 space-y-3">
            {top_ips.length > 0 ? top_ips.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                <span className="font-mono text-sm text-red-700 dark:text-red-400 font-bold">{item.ip}</span>
                <span className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-xs px-2 py-1 rounded-lg font-bold">{item.count} fallos</span>
              </div>
            )) : <div className="h-full flex items-center justify-center text-sm text-gray-500 italic">Red segura. No hay IPs sospechosas.</div>}
          </div>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA EN TIEMPO REAL CON PAGINACIÓN */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Search size={18} className="text-blue-500" /> Registro Forense ({recent_logs.length} eventos)
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-widest text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-4">Fecha y Hora</th>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Acción Detectada</th>
                <th className="px-6 py-4">Dirección IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {currentLogs.length > 0 ? currentLogs.map(log => {
                const isDanger = log.action.includes('FAIL') || log.action.includes('LOCK');
                return (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm font-bold text-gray-900 dark:text-white">{log.user_name}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${isDanger ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        {log.action}
                      </span>
                      {log.details && <span className="block text-xs text-gray-500 mt-1 truncate max-w-xs">{log.details}</span>}
                    </td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-500">{log.ip_address}</td>
                  </tr>
                )
              }) : (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500 italic">No hay registros de auditoría que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        {recent_logs.length > 0 && (
          <div className="bg-gray-50/80 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Mostrando <span className="font-bold text-gray-900 dark:text-white">{indexOfFirstLog + 1}</span> a <span className="font-bold text-gray-900 dark:text-white">{Math.min(indexOfLastLog, recent_logs.length)}</span> de <span className="font-bold text-gray-900 dark:text-white">{recent_logs.length}</span> registros
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 transition-colors bg-gray-50 dark:bg-gray-800">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 px-2">
                Página {currentPage} de {totalPages}
              </span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 transition-colors bg-gray-50 dark:bg-gray-800">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default SecurityDashboard;