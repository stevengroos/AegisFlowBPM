import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Loader2, TrendingUp, Layers, FileText, Activity, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Estados para métricas
  const [stats, setStats] = useState({ totalCases: 0, totalModules: 0, recentCases: 0 });
  const [moduleData, setModuleData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  // Paleta de colores para el gráfico circular
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    // 🔥 PENTEST FIX: Evitar fugas de memoria si el usuario cambia de página rápido 🔥
    const controller = new AbortController();
    
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Pasamos la señal de aborto a las peticiones Axios
        const [casesRes, modulesRes] = await Promise.all([
          api.get('/api/v1/cases/', { signal: controller.signal }),
          api.get('/api/v1/modules/', { signal: controller.signal })
        ]);

        const allCases = casesRes.data;
        const allModules = modulesRes.data;

        // 1. Cálculos de Tarjetas
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recent = allCases.filter(c => new Date(c.created_at) >= oneWeekAgo).length;

        setStats({
          totalCases: allCases.length,
          totalModules: allModules.length,
          recentCases: recent
        });

        // 2. Cálculo para Gráfico Circular (Distribución por Módulo)
        const distribution = allModules.map(mod => ({
          name: mod.name,
          value: allCases.filter(c => c.module_id === mod.id).length
        })).filter(item => item.value > 0); 
        
        setModuleData(distribution);

        // 3. Cálculo para Gráfico de Barras (Últimos 7 días)
        const trends = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          // Mejor forma de extraer la fecha local en formato YYYY-MM-DD para comparar
          const dateStr = d.toLocaleDateString('en-CA'); 
          
          const count = allCases.filter(c => c.created_at.startsWith(dateStr)).length;
          trends.push({ 
            name: d.toLocaleDateString('es-ES', { weekday: 'short' }), 
            casos: count 
          });
        }
        setTrendData(trends);

        // 4. Última Actividad (Los 5 casos más nuevos)
        const sortedCases = [...allCases].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
        
        const activityWithModules = sortedCases.map(c => ({
          ...c,
          moduleName: allModules.find(m => m.id === c.module_id)?.name || 'Desconocido'
        }));
        
        setRecentActivity(activityWithModules);

      } catch (error) {
        if (error.name !== 'CanceledError') {
          console.error("Error cargando el dashboard:", error);
        }
      } finally {
        // Aseguramos que setLoading solo cambie si el componente sigue montado
        if (!controller.signal.aborted) {
            setLoading(false);
        }
      }
    };

    fetchDashboardData();
    
    // Función de limpieza al desmontar el componente
    return () => {
        controller.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center flex-col text-gray-400">
        <Loader2 className="animate-spin mb-4 text-blue-500" size={40} />
        <p>Calculando métricas globales...</p>
      </div>
    );
  }

  // Componente de Tooltip personalizado para el modo oscuro
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg shadow-xl">
          <p className="font-bold text-gray-900 dark:text-white mb-1">{label || payload[0].name}</p>
          <p className="text-blue-600 dark:text-blue-400 font-medium">
            Registros: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  // Función helper para calcular tiempo transcurrido (UX mejorado)
  const getTimeAgo = (dateString) => {
    const hours = Math.round((new Date() - new Date(dateString)) / (1000 * 60 * 60));
    if (hours === 0) return "Hace menos de 1 hora";
    if (hours === 1) return "Hace 1 hora";
    if (hours < 24) return `Hace ${hours} horas`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Hace 1 día";
    return `Hace ${days} días`;
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Centro de Comando</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Métricas y rendimiento global de tu empresa.</p>
      </div>

      {/* 🔥 1. TARJETAS DE MÉTRICAS (KPIs) 🔥 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-5 transition-transform hover:-translate-y-1">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            <FileText size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Registros</p>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalCases}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-5 transition-transform hover:-translate-y-1">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
            <Layers size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Módulos Activos</p>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalModules}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-5 transition-transform hover:-translate-y-1">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Últimos 7 Días</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white">{stats.recentCases}</h3>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">+ Nuevos</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 2. SECCIÓN DE GRÁFICOS 🔥 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* GRÁFICO: Tendencia Semanal */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Activity size={18} className="text-blue-500" /> Creación de Registros (7 Días)
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                <Bar dataKey="casos" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO: Distribución por Módulos */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Layers size={18} className="text-emerald-500" /> Distribución por Módulo
          </h2>
          <div className="h-72 w-full flex items-center justify-center">
            {moduleData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={moduleData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                    {moduleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <p className="text-gray-400 italic text-sm">No hay suficientes datos para graficar.</p>
            )}
          </div>
          {/* Leyenda personalizada */}
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {moduleData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                {entry.name} ({entry.value})
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 🔥 3. FEED DE ACTIVIDAD RECIENTE 🔥 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Últimos Registros Creados</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {recentActivity.length > 0 ? recentActivity.map((rec) => (
            <div 
              key={rec.id} 
              onClick={() => navigate(`/cases/${rec.id}`)}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-gray-100 dark:bg-gray-800 w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-xs border border-gray-200 dark:border-gray-700">
                  #{rec.id}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Nuevo registro en <span className="text-blue-600 dark:text-blue-400">{rec.moduleName}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {getTimeAgo(rec.created_at)}
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors" />
            </div>
          )) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm italic">
              Aún no hay actividad reciente.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Dashboard;