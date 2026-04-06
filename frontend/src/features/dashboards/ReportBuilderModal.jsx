import React, { useState, useEffect } from 'react';
import { X, Save, MousePointerSquareDashed, Code, Play, CheckCircle2, AlertTriangle, Filter, Loader2 } from 'lucide-react';
import { QueryBuilder } from 'react-querybuilder';
import SearchableSelect from '../../components/ui/SearchableSelect';
import api from '../../api/axios';

// Traducciones y Operadores
const qbTranslations = {
  fields: { title: 'Campos' }, operators: { title: 'Operadores' }, value: { title: 'Valor' },
  removeRule: { label: 'x', title: 'Eliminar regla' }, removeGroup: { label: 'x', title: 'Eliminar grupo' },
  addRule: { label: '+ Añadir Filtro', title: 'Añadir regla' }, addGroup: { label: '+ Añadir Grupo', title: 'Añadir grupo' },
  combinators: { title: 'Combinadores' }, notToggle: { title: 'Invertir' }
};

const getOperatorsByFieldType = (fieldType) => {
  const textOps = [{ name: '==', label: 'es igual a' }, { name: '!=', label: 'no es igual a' }, { name: 'contains', label: 'contiene' }, { name: 'notContains', label: 'no contiene' }, { name: 'null', label: 'está vacío' }, { name: 'notNull', label: 'no está vacío' }];
  const numberOps = [{ name: '==', label: 'es igual a' }, { name: '!=', label: 'no es igual a' }, { name: '>', label: 'es mayor que' }, { name: '<', label: 'es menor que' }, { name: '>=', label: 'es mayor o igual' }, { name: '<=', label: 'es menor o igual' }, { name: 'null', label: 'está vacío' }, { name: 'notNull', label: 'no está vacío' }];
  const dateOps = [{ name: '==', label: 'es la fecha' }, { name: '!=', label: 'no es la fecha' }, { name: '>', label: 'después de' }, { name: '<', label: 'antes de' }, { name: 'null', label: 'está vacío' }, { name: 'notNull', label: 'no está vacío' }];
  const booleanOps = [{ name: '==', label: 'es' }];
  
  if (['number', 'currency'].includes(fieldType)) return numberOps;
  if (['date', 'datetime'].includes(fieldType)) return dateOps;
  if (fieldType === 'checkbox') return booleanOps;
  return textOps; 
};

const buildPandasQuery = (ruleGroup) => {
  if (!ruleGroup.rules || ruleGroup.rules.length === 0) return '';
  const combinator = ruleGroup.combinator === 'and' ? ' and ' : ' or ';
  
  const rules = ruleGroup.rules.map(rule => {
    if (rule.rules) return `(${buildPandasQuery(rule)})`; 
    const { field, operator, value } = rule;
    const val = (typeof value === 'string' && isNaN(value)) ? `"${value}"` : (value || '""');
    
    switch (operator) {
      case '==': return `\`${field}\` == ${val}`;
      case '!=': return `\`${field}\` != ${val}`;
      case '<': return `\`${field}\` < ${val}`;
      case '>': return `\`${field}\` > ${val}`;
      case '<=': return `\`${field}\` <= ${val}`;
      case '>=': return `\`${field}\` >= ${val}`;
      case 'contains': return `\`${field}\`.str.contains(${val}, na=False)`;
      case 'notContains': return `~\`${field}\`.str.contains(${val}, na=False)`;
      case 'null': return `\`${field}\` == ""`; 
      case 'notNull': return `\`${field}\` != ""`;
      default: return `\`${field}\` == ${val}`;
    }
  }).filter(r => r !== '');
  return rules.join(combinator);
};

const ReportBuilderModal = ({ isOpen, onClose, onSave, reportToEdit, modules }) => {
  const [buildMode, setBuildMode] = useState('visual'); 
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [moduleFields, setModuleFields] = useState([]);
  const [queryBuilderFields, setQueryBuilderFields] = useState([]);
  const [filterRules, setFilterRules] = useState({ combinator: 'and', rules: [] });
  
  const [reportForm, setReportForm] = useState({
    name: '', chart_type: 'bar',
    visual_config: { module_id: '', y_axis_type: 'count', y_axis_field: '', x_axis: '', metric_icon: 'file', metric_subtitle: '', filter_query: '' },
    function_code: `# Escribe tu código Python aquí.\ncases = db.query(models.Case).filter(models.Case.company_id == company_id).all()\ndf = pd.DataFrame([c.data for c in cases])\nresult = [{"name": "Total", "value": len(df)}]`
  });

  // Inicialización al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      if (reportToEdit) {
        const isVisual = reportToEdit.function_code === 'VISUAL_MODE_FLAG';
        setBuildMode(isVisual ? 'visual' : 'code');
        const loadedConfig = reportToEdit.config || { module_id: '', y_axis_type: 'count', y_axis_field: '', x_axis: '', metric_icon: 'file', metric_subtitle: '', filter_query: '' };
        
        if (isVisual && loadedConfig.raw_filters) {
          try { setFilterRules(JSON.parse(loadedConfig.raw_filters)); } catch(e){}
        }

        setReportForm({
          name: reportToEdit.name, chart_type: reportToEdit.chart_type,
          visual_config: isVisual ? loadedConfig : { module_id: '', y_axis_type: 'count', y_axis_field: '', x_axis: '', metric_icon: 'file', metric_subtitle: '', filter_query: '' },
          function_code: isVisual ? reportForm.function_code : reportToEdit.function_code
        });
      } else {
        setBuildMode('visual');
        setFilterRules({ combinator: 'and', rules: [] });
        setReportForm({
          name: '', chart_type: 'bar',
          visual_config: { module_id: '', y_axis_type: 'count', y_axis_field: '', x_axis: '', metric_icon: 'file', metric_subtitle: '', filter_query: '' },
          function_code: `# Escribe tu código Python aquí.\ncases = db.query(models.Case).filter(models.Case.company_id == company_id).all()\ndf = pd.DataFrame([c.data for c in cases])\nresult = [{"name": "Total", "value": len(df)}]`
        });
      }
    }
  }, [isOpen, reportToEdit]);

  // Cargar campos dinámicamente según el módulo seleccionado
  useEffect(() => {
    if (reportForm.visual_config.module_id && isOpen) {
      const controller = new AbortController();
      api.get(`/api/v1/fields/?module_id=${reportForm.visual_config.module_id}`, { signal: controller.signal })
        .then(res => {
          setModuleFields(res.data);
          setQueryBuilderFields(res.data.map(f => ({ name: f.api_name, label: f.label, type: f.field_type })));
        })
        .catch(err => { if (err.name !== 'CanceledError') console.error("Error", err); });
      return () => controller.abort();
    } else {
      setModuleFields([]); setQueryBuilderFields([]);
    }
  }, [reportForm.visual_config.module_id, isOpen]);

  const handleTestScript = async () => {
    if (!reportForm.function_code) return;
    setIsTesting(true); setTestResult(null);
    try {
      const res = await api.post('/api/v1/dashboards/test-script', { function_code: reportForm.function_code });
      setTestResult(res.data);
    } catch (error) { setTestResult({ success: false, error: "Fallo al probar el script." }); } 
    finally { setIsTesting(false); }
  };

  const submitSave = () => {
    if (!reportForm.name) { alert("El nombre es obligatorio."); return; }
    let pandasQueryStr = '';
    if (buildMode === 'visual' && filterRules.rules.length > 0) pandasQueryStr = buildPandasQuery(filterRules);

    const payload = {
      name: reportForm.name, chart_type: reportForm.chart_type,
      config: buildMode === 'visual' ? { ...reportForm.visual_config, filter_query: pandasQueryStr, raw_filters: JSON.stringify(filterRules) } : { mode: 'code' },
      function_code: buildMode === 'code' ? reportForm.function_code : 'VISUAL_MODE_FLAG'
    };
    onSave(payload, reportToEdit?.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200 h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            {reportToEdit ? 'Editar Reporte' : 'Generador de Reportes'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre del Gráfico</label>
              <input type="text" value={reportForm.name} onChange={e => setReportForm({...reportForm, name: e.target.value})} className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white shadow-sm" placeholder="Ej: Casos por Estado" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tipo de Visualización</label>
              <select value={reportForm.chart_type} onChange={e => setReportForm({...reportForm, chart_type: e.target.value})} className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white cursor-pointer shadow-sm">
                <option value="bar">Gráfico de Barras</option>
                <option value="line">Gráfico de Líneas</option>
                <option value="pie">Gráfico Circular</option>
                <option value="metric">Métrica (KPI Estilo Tarjeta)</option>
              </select>
            </div>
          </div>

          <div className="border-b border-gray-200 dark:border-gray-800 flex gap-6">
            <button onClick={() => setBuildMode('visual')} className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${buildMode === 'visual' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <MousePointerSquareDashed size={16} /> Construcción Visual
            </button>
            <button onClick={() => setBuildMode('code')} className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${buildMode === 'code' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              <Code size={16} /> Python / Avanzado
            </button>
          </div>

          {buildMode === 'visual' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
                  <label className="block text-xs font-bold text-blue-500 uppercase mb-3">1. Fuente de Datos</label>
                  <select value={reportForm.visual_config.module_id} onChange={e => setReportForm({...reportForm, visual_config: {...reportForm.visual_config, module_id: e.target.value}})} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none text-gray-900 dark:text-white">
                    <option value="">Selecciona un módulo...</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl shadow-sm border-l-4 border-l-emerald-500">
                  <label className="block text-xs font-bold text-emerald-500 uppercase mb-3">2. Eje Y (Valores)</label>
                  <select value={reportForm.visual_config.y_axis_type} onChange={e => setReportForm({...reportForm, visual_config: {...reportForm.visual_config, y_axis_type: e.target.value}})} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm mb-3 outline-none text-gray-900 dark:text-white">
                    <option value="count">Contar Registros (Cantidad)</option>
                    <option value="sum">Sumar Valores Numéricos</option>
                    <option value="avg">Promediar Valores Numéricos</option>
                  </select>
                  {reportForm.visual_config.y_axis_type !== 'count' && (
                    <SearchableSelect options={moduleFields} value={reportForm.visual_config.y_axis_field} onChange={(val) => setReportForm({...reportForm, visual_config: {...reportForm.visual_config, y_axis_field: val}})} placeholder="Buscar campo..." />
                  )}
                </div>
                
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl shadow-sm border-l-4 border-l-amber-500">
                  <label className="block text-xs font-bold text-amber-500 uppercase mb-3">3. Eje X (Categorías)</label>
                  <SearchableSelect options={moduleFields} value={reportForm.visual_config.x_axis} onChange={(val) => setReportForm({...reportForm, visual_config: {...reportForm.visual_config, x_axis: val}})} placeholder="Buscar campo para agrupar..." />
                </div>
              </div>

              {reportForm.visual_config.module_id && queryBuilderFields.length > 0 && (
                <div className="bg-gray-50 dark:bg-[#1e1e1e] p-5 rounded-xl border border-gray-200 dark:border-gray-800">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-4 flex items-center gap-2"><Filter size={16} className="text-purple-500" /> Condiciones y Filtros</label>
                  <QueryBuilder 
                    fields={queryBuilderFields} query={filterRules} onQueryChange={setFilterRules} translations={qbTranslations}
                    getOperators={(fieldName) => getOperatorsByFieldType(queryBuilderFields.find(f => f.name === fieldName)?.type)}
                    controlClassnames={{ ruleGroup: 'bg-white dark:bg-[#252526] p-3 mb-2 rounded border dark:border-gray-700', rule: 'flex gap-2 items-center mb-2', value: 'bg-white dark:bg-gray-900 border rounded p-1.5 flex-1 outline-none text-gray-900 dark:text-white', fields: 'bg-white dark:bg-gray-800 border rounded p-1.5 outline-none text-gray-900 dark:text-white', operators: 'bg-white dark:bg-gray-800 border rounded p-1.5 outline-none text-gray-900 dark:text-white' }}
                  />
                </div>
              )}
            </div>
          )}

          {buildMode === 'code' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
              <div className="rounded-xl overflow-hidden shadow-inner border border-gray-800 flex flex-col h-full bg-[#0d1117]">
                <div className="bg-[#161b22] px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                  <span className="text-xs font-mono text-gray-400">script.py</span>
                  <button onClick={handleTestScript} disabled={isTesting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                    {isTesting ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>} Probar
                  </button>
                </div>
                <textarea value={reportForm.function_code} onChange={e => setReportForm({...reportForm, function_code: e.target.value})} className="flex-1 w-full bg-[#0d1117] text-[#c9d1d9] font-mono text-[13px] p-4 outline-none resize-none" spellCheck="false" />
              </div>
              <div className="rounded-xl overflow-hidden shadow-inner border border-gray-800 flex flex-col h-full bg-[#0d1117]">
                <div className="bg-[#161b22] px-4 py-2 border-b border-gray-800 text-xs font-mono text-gray-400">Salida de Consola</div>
                <div className="p-4 overflow-y-auto font-mono text-sm">
                  {testResult?.success ? (
                    <pre className="text-emerald-300 bg-emerald-950/30 p-3 rounded-lg border border-emerald-900/50 whitespace-pre-wrap">{JSON.stringify(testResult.data, null, 2)}</pre>
                  ) : testResult?.error ? (
                    <pre className="text-red-400 bg-red-950/30 p-3 rounded-lg border border-red-900/50 whitespace-pre-wrap">{testResult.error}</pre>
                  ) : <p className="text-gray-600 italic">// Resultados aquí...</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
          <button onClick={submitSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2">
            <Save size={16} /> {reportToEdit ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportBuilderModal;