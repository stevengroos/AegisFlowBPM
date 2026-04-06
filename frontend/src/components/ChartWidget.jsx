import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { Loader2, AlertTriangle, BarChart2, TrendingUp, PieChart as PieChartIcon, MoreVertical, Edit, Trash2, FileText, Layers, GripHorizontal, Download } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';

import { saveAs } from 'file-saver';

// 🔥 IMPORTAMOS NUESTRO SISTEMA GLOBAL DE NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const ChartWidget = ({ report, onEdit, onDelete, dragHandleProps }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  
  const chartRef = useRef(null);
  
  // Extraemos nuestras herramientas mágicas
  const { notify, confirm } = useNotification();

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/api/v1/dashboards/reports/${report.id}/execute`, {
          signal: controller.signal
        });
        setData(res.data.data);
      } catch (err) {
        if (err.name !== 'CanceledError') {
          setError(err.response?.data?.detail || "Error al ejecutar el script del reporte.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();

    return () => controller.abort();
  }, [report.id]); 

  // ==========================================
  // 🔥 FUNCIONES DE EXPORTACIÓN SEGURAS 🔥
  // ==========================================
  const handleExportCSV = () => {
    setShowMenu(false);
    if (!data || data.length === 0) {
      return notify.warning("No hay datos para exportar."); 
    }

    const sanitizeCSV = (str) => {
      let text = String(str).replace(/"/g, '""'); 
      if (/^[=\-+@]/.test(text)) {
        text = "'" + text; 
      }
      return `"${text}"`;
    };

    const isMetric = report.chart_type === 'metric';
    const csvHeader = isMetric ? "Métrica,Valor\n" : "Categoría,Valor\n";
    
    const csvContent = data.map(row => `${sanitizeCSV(row.name)},${row.value}`).join("\n");
    const fullCsv = csvHeader + csvContent;

    const blob = new Blob(["\uFEFF" + fullCsv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `${report.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_datos.csv`);
    
    notify.success("Datos exportados exitosamente en formato CSV."); 
  };

  // ==========================================
  // 🔥 BORRADO SEGURO CON CONFIRMACIÓN 🔥
  // ==========================================
  const handleDeleteClick = async () => {
    setShowMenu(false);
    
    const isConfirmed = await confirm({
      title: 'Eliminar Gráfico',
      message: `¿Estás seguro de que deseas eliminar el gráfico "${report.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar',
      variant: 'danger'
    });
    
    if (isConfirmed) {
      onDelete(report.id);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl">
        <Loader2 className="animate-spin mb-2" size={24} />
        <span className="text-xs font-medium uppercase tracking-wider">Calculando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl p-4 text-center relative group">
        <div {...dragHandleProps} className="absolute top-2 left-2 p-1.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <GripHorizontal size={16} />
        </div>
        <button onClick={handleDeleteClick} aria-label="Eliminar reporte con error" className="absolute top-2 right-2 p-1.5 bg-white/50 dark:bg-black/50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          <Trash2 size={16} />
        </button>
        <AlertTriangle className="mb-2" size={24} />
        <span className="text-xs font-bold uppercase tracking-wider mb-1">Error de Ejecución</span>
        <span className="text-[10px] text-red-400 dark:text-red-300 font-mono break-words max-w-full overflow-hidden">{error}</span>
      </div>
    );
  }

  if (report.chart_type === 'metric') {
    const customIcon = report.config?.metric_icon === 'layers' ? <Layers size={24} className="text-emerald-500" /> : 
                       report.config?.metric_icon === 'trend' ? <TrendingUp size={24} className="text-amber-500" /> : 
                       <FileText size={24} className="text-blue-500" />;
                       
    const iconBg = report.config?.metric_icon === 'layers' ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : 
                   report.config?.metric_icon === 'trend' ? 'bg-amber-500/10 dark:bg-amber-500/20' : 
                   'bg-blue-500/10 dark:bg-blue-500/20';

    return (
      <div ref={chartRef} className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm dark:shadow-lg p-6 flex items-center justify-between h-full transition-all hover:border-gray-300 dark:hover:border-gray-700 relative group">
        
        <div {...dragHandleProps} className="absolute top-3 left-3 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <GripHorizontal size={16} />
        </div>

        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setShowMenu(!showMenu)} aria-label="Opciones del reporte" aria-expanded={showMenu} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg"><MoreVertical size={16} /></button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
              <div role="menu" className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                <button role="menuitem" onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"><Download size={14} /> Descargar CSV</button>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                <button role="menuitem" onClick={() => { setShowMenu(false); onEdit(report); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"><Edit size={14} /> Editar</button>
                <button role="menuitem" onClick={handleDeleteClick} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"><Trash2 size={14} /> Eliminar</button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-5 ml-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${iconBg}`}>{customIcon}</div>
          <div>
            <h3 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">{report.name}</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900 dark:text-white leading-none tracking-tight">{data[0]?.value || 0}</span>
              {report.config?.metric_subtitle && <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{report.config.metric_subtitle}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-gray-400">Sin datos</div>;

    switch (report.chart_type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      default: return null;
    }
  };

  const getIcon = () => {
    switch (report.chart_type) {
      case 'bar': return <BarChart2 size={16} className="text-blue-500" />;
      case 'line': return <TrendingUp size={16} className="text-emerald-500" />;
      case 'pie': return <PieChartIcon size={16} className="text-purple-500" />;
      default: return <BarChart2 size={16} className="text-gray-500" />;
    }
  };

  return (
    <div ref={chartRef} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-5 flex flex-col h-full transition-all hover:shadow-md relative group">
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden pr-2">
          <div {...dragHandleProps} className="p-1 text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
            <GripHorizontal size={16} />
          </div>
          <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg shrink-0">{getIcon()}</div>
          <h3 className="font-bold text-gray-900 dark:text-white truncate" title={report.name}>{report.name}</h3>
        </div>
        <div className="relative shrink-0">
          <button aria-label="Opciones del reporte" aria-expanded={showMenu} onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><MoreVertical size={16} /></button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
              <div role="menu" className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <button role="menuitem" onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"><Download size={14} /> Descargar CSV</button>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                <button role="menuitem" onClick={() => { setShowMenu(false); onEdit(report); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"><Edit size={14} /> Editar</button>
                <button role="menuitem" onClick={handleDeleteClick} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"><Trash2 size={14} /> Eliminar</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-[200px]">
        {renderChart()}
      </div>
    </div>
  );
};

export default ChartWidget;