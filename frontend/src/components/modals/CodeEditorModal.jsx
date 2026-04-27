import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import { X, Play, Save, Code, Database, Terminal, AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import api from '../../api/axios';

const CodeEditorModal = ({ isOpen, onClose, onSave, initialCode, mockDataInitial }) => {
  const [code, setCode] = useState(initialCode || '# Escribe tu lógica aquí...\ncase_data["ejemplo"] = "valor"');
  
  // 🔥 NUEVO: Rastreamos el último código que pasó la prueba exitosamente
  const [lastTestedCode, setLastTestedCode] = useState(initialCode || ''); 

  const [mockData, setMockData] = useState(JSON.stringify(mockDataInitial || { nombre: "Juan", monto: 100 }, null, 2));
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => { 
      if (isOpen) {
          setCode(initialCode || '');
          setLastTestedCode(initialCode || '');
          setTestResult(null);
      }
  }, [isOpen, initialCode]);

  if (!isOpen) return null;

  const handleTestScript = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/api/v1/transitions/actions/test-script', {
        function_code: code,
        mock_data: JSON.parse(mockData)
      });
      setTestResult(res.data);
      
      // 🔥 LÓGICA DE VALIDACIÓN: Si pasó, guardamos este código exacto como "Seguro"
      if (res.data.success) {
          setLastTestedCode(code);
      } else {
          setLastTestedCode(null); // Si falló, borramos el rastro seguro
      }
      
    } catch (err) {
      setTestResult({
        success: false,
        error_message: err.response?.data?.detail || "Error de sintaxis o conexión",
        traceback: "Verifica que el JSON de prueba sea válido y el código no tenga errores."
      });
      setLastTestedCode(null); // Si el JSON está mal, tampoco es seguro
    } finally {
      setIsTesting(false);
    }
  };

  // 🔥 NUEVO: ¿El botón de guardar debe estar habilitado?
  const isCodeSafeToSave = code === lastTestedCode;

  return createPortal(
    <div className="fixed inset-0 bg-gray-900/95 z-[100000] flex flex-col animate-in fade-in duration-200">
      
      {/* HEADER SUPERIOR */}
      <div className="h-16 border-b border-gray-800 flex justify-between items-center px-6 shrink-0 bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Code size={20} className="text-green-500" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Editor Low-Code (Python Sandbox)</h2>
            <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">AegisFlow Enterprise</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          
          {!isCodeSafeToSave && code.length > 0 && (
             <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1.5 animate-pulse mr-2">
                <ShieldAlert size={14}/> Prueba requerida antes de guardar
             </span>
          )}

          <button 
            onClick={handleTestScript}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" />}
            Probar Script
          </button>
          
          {/* 🔥 BOTÓN DE GUARDAR DINÁMICO 🔥 */}
          <button 
            onClick={() => onSave(code)}
            disabled={!isCodeSafeToSave}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${isCodeSafeToSave ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 active:scale-95' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
          >
            <Save size={16} /> Aplicar y Guardar
          </button>

          <div className="w-px h-6 bg-gray-800 mx-2" />
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* CUERPO PRINCIPAL (Layout Dividido) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LADO IZQUIERDO: EDITOR DE CÓDIGO */}
        <div className="flex-1 border-r border-gray-800 flex flex-col">
           <div className="bg-gray-900 px-4 py-2 flex items-center gap-2 border-b border-gray-800">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">main.py</span>
           </div>
           <Editor
             height="100%"
             defaultLanguage="python"
             theme={isDarkMode ? "vs-dark" : "light"}
             value={code}
             onChange={(val) => setCode(val)}
             options={{
               fontSize: 14,
               minimap: { enabled: false },
               automaticLayout: true,
               padding: { top: 20 },
               fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
               fontLigatures: true,
             }}
           />
        </div>

        {/* LADO DERECHO: PRUEBAS Y CONSOLA */}
        <div className="w-[450px] flex flex-col bg-[#0d1117] overflow-hidden">
           
           {/* PANEL: DATOS DE ENTRADA (MOCK) */}
           <div className="flex-1 flex flex-col border-b border-gray-800">
              <div className="px-4 py-3 bg-gray-900 flex items-center justify-between border-b border-gray-800">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Database size={14}/> Objeto de Prueba (JSON)
                </span>
              </div>
              <Editor
                height="100%"
                defaultLanguage="json"
                theme="vs-dark"
                value={mockData}
                onChange={(val) => setMockData(val)}
                options={{ fontSize: 12, minimap: { enabled: false }, lineNumbers: "off", folding: false }}
              />
           </div>

           {/* PANEL: RESULTADOS / CONSOLA */}
           <div className="h-[40%] flex flex-col bg-black/40">
              <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Terminal size={14}/> Salida de Consola
                </span>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto font-mono text-xs custom-scrollbar">
                {!testResult && !isTesting && (
                  <p className="text-gray-600 italic">Haz clic en "Probar Script" para ver los resultados aquí...</p>
                )}
                
                {isTesting && (
                  <div className="flex items-center gap-3 text-blue-400 animate-pulse">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Ejecutando en entorno seguro...</span>
                  </div>
                )}

                {testResult && (
                  <div className="space-y-4 animate-in slide-in-from-bottom-2">
                    {testResult.success ? (
                      <>
                        <div className="flex items-center gap-2 text-emerald-500 font-bold">
                          <CheckCircle2 size={16} /> ¡Ejecución Exitosa!
                        </div>
                        {testResult.console_output && (
                           <pre className="bg-gray-800/50 p-2 rounded text-gray-300 border border-gray-700">{testResult.console_output}</pre>
                        )}
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-500 uppercase font-bold">Datos Resultantes:</p>
                          <pre className="text-blue-300">{JSON.stringify(testResult.modified_data, null, 2)}</pre>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-rose-500 font-bold">
                          <AlertCircle size={16} /> Error en el Script
                        </div>
                        <p className="text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">{testResult.error_message}</p>
                        <pre className="text-[10px] text-gray-500 bg-gray-900 p-2 rounded overflow-x-auto">{testResult.traceback}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CodeEditorModal;