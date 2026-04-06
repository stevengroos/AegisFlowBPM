import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import { Loader2, UploadCloud, X, FileSpreadsheet } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const ImportDataModal = ({ isOpen, onClose, moduleId, fields, forms, onSuccess }) => {
  const { notify } = useNotification();
  const fileInputRef = useRef(null);
  
  const [importFile, setImportFile] = useState(null);
  const [excelColumns, setExcelColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState(forms[0]?.id || '');
  const [step, setStep] = useState(1); // 1: Select File, 2: Map Columns

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImportFile(file);
    setAnalyzing(true);
    setStep(2);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await api.post(`/api/v1/cases/import/analyze/${moduleId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const cols = res.data.columns;
      setExcelColumns(cols);
      
      const initialMap = {};
      cols.forEach(col => {
         const match = fields.find(f => f.label.toLowerCase() === col.toLowerCase() || f.api_name === col.toLowerCase());
         if (match) initialMap[col] = match.api_name || match.label;
      });
      setColumnMapping(initialMap);

    } catch (error) {
      notify.error("Error al analizar el archivo. Verifica el formato.");
      resetState();
    } finally {
      setAnalyzing(false);
      e.target.value = null; 
    }
  };

  const handleMappingChange = (excelCol, fieldApiName) => {
    setColumnMapping(prev => {
       const newMap = { ...prev };
       if (!fieldApiName) delete newMap[excelCol];
       else newMap[excelCol] = fieldApiName;
       return newMap;
    });
  };

  const executeImport = async () => {
    if (Object.keys(columnMapping).length === 0) return notify.warning("Debes mapear al menos una columna.");
    if (!selectedFormId) return notify.warning("Selecciona un formulario.");
    
    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('mapping', JSON.stringify(columnMapping));
    formData.append('form_id', selectedFormId);

    try {
      const res = await api.post(`/api/v1/cases/import/execute/${moduleId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notify.success(res.data.message || "Importación completada con éxito.");
      onSuccess();
      resetState();
    } catch (error) {
      notify.error("Error al procesar la importación.");
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setImportFile(null); setExcelColumns([]); setColumnMapping({}); setStep(1); onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-3xl max-h-[90vh] shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                <FileSpreadsheet size={20} className="text-emerald-500"/> Importación Masiva
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sube registros desde Excel o CSV.</p>
            </div>
            <button onClick={resetState} disabled={importing} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-xl transition-colors disabled:opacity-50"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/30">
              <UploadCloud size={48} className="text-blue-500 mb-4" />
              <p className="text-gray-700 dark:text-gray-300 font-bold mb-2">Selecciona un archivo</p>
              <p className="text-xs text-gray-500 mb-6">Formatos soportados: .csv, .xlsx</p>
              <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md">
                Explorar Archivos
              </button>
              <input type="file" accept=".csv, .xlsx" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            </div>
          )}

          {step === 2 && analyzing && (
             <div className="flex flex-col items-center justify-center py-20 text-emerald-500 gap-4">
                <Loader2 size={40} className="animate-spin"/>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Leyendo columnas...</p>
             </div>
          )}

          {step === 2 && !analyzing && (
             <>
               <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex flex-col gap-2">
                 <label className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase">1. Selecciona el Formulario</label>
                 <select value={selectedFormId} onChange={e => setSelectedFormId(e.target.value)} className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-blue-200 dark:border-blue-700 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                    {forms.map(form => <option key={form.id} value={form.id}>{form.name}</option>)}
                 </select>
               </div>

               <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-2 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                     <div className="px-4 py-3">2. Columna en Archivo</div>
                     <div className="px-4 py-3 border-l border-gray-200 dark:border-gray-800">3. Mapear a Campo</div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                     {excelColumns.map((col, idx) => (
                        <div key={idx} className="grid grid-cols-2 bg-white dark:bg-gray-900 items-center hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                           <div className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={col}>{col}</div>
                           <div className="px-4 py-2 border-l border-gray-100 dark:border-gray-800">
                              <select value={columnMapping[col] || ''} onChange={(e) => handleMappingChange(col, e.target.value)} className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:text-gray-200 dark:bg-gray-900 transition-colors">
                                 <option value="">-- Ignorar --</option>
                                 {fields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                              </select>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
             </>
          )}
        </div>

        {step === 2 && !analyzing && (
          <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex justify-end gap-3">
            <button onClick={resetState} disabled={importing} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
            <button onClick={executeImport} disabled={importing} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70">
              {importing ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>} Procesar Importación
            </button>
          </div>
        )}
      </div>
    </div>, document.body
  );
};

export default ImportDataModal;