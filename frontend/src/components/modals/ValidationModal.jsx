import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X } from 'lucide-react';
import Select from 'react-select';

const ValidationModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  newValidation, 
  setNewValidation, 
  moduleFields 
}) => {
  // Manejo del Dark Mode interno para los estilos del Select
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (!isOpen) return null;

  const customSingleSelectStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.75rem', padding: '0.1rem', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black', '&:hover': { borderColor: isDarkMode ? '#4b5563' : '#9ca3af' } }),
    singleValue: (provided) => ({ ...provided, color: isDarkMode ? '#f9fafb' : '#111827' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', zIndex: 99999 }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-200 dark:border-gray-800">
         <div className="p-5 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center bg-red-50/50 dark:bg-red-900/10">
           <h3 className="font-bold text-red-900 dark:text-red-400 flex items-center gap-2"><ShieldAlert size={18}/> Regla de Validación (Bloqueo)</h3>
           <button onClick={onClose} className="text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/50 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
         </div>
         <form id="validation-form" onSubmit={onSave} className="p-6 space-y-5">
            {/* NUEVA DISPOSICIÓN: Condición primero, Campo después (solo si es necesario) */}
            <div className="grid grid-cols-1 gap-4">
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Condición de Desbloqueo (El registro avanzará solo si...)</label>
                  <select 
                      required 
                      value={newValidation.operator} 
                      onChange={e => {
                          const op = e.target.value;
                          // Si elige la regla de firma, el campo target_field puede ir con un texto comodín
                          if (op === "HAS_COMPLETED_SIGNATURE") {
                              setNewValidation({...newValidation, operator: op, target_field: "Firma_Digital_Signaturit", validation_value: ""});
                          } else {
                              setNewValidation({...newValidation, operator: op});
                          }
                      }} 
                      className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-red-500 shadow-sm"
                  >
                     <optgroup label="Integraciones Externas">
                         {/* 🔥 NUESTRA NUEVA REGLA ENTERPRISE 🔥 */}
                         <option value="HAS_COMPLETED_SIGNATURE">Tiene una firma de Signaturit COMPLETADA</option>
                     </optgroup>
                     <optgroup label="Datos del Registro">
                         <option value="IS_EMPTY">El campo está Vacío</option>
                         <option value="NOT_EMPTY">El campo NO está Vacío</option>
                         <option value="==">El campo es IGUAL A...</option>
                         <option value="!=">El campo es DIFERENTE DE...</option>
                         <option value="CONTAINS">El campo CONTIENE texto...</option>
                         <option value=">">El campo es MAYOR A (Numérico)...</option>
                         <option value="<">El campo es MENOR A (Numérico)...</option>
                     </optgroup>
                  </select>
               </div>

               {/* Solo mostramos el selector de campo si la condición NO es la de la firma */}
               {newValidation.operator !== "HAS_COMPLETED_SIGNATURE" && (
                   <div className="animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">¿A qué campo aplica esta regla?</label>
                      <Select 
                         options={moduleFields.map(f => ({ value: f.api_name || f.label, label: f.display_label }))}
                         value={newValidation.target_field ? { value: newValidation.target_field, label: moduleFields.find(f => (f.api_name || f.label) === newValidation.target_field)?.display_label || newValidation.target_field } : null}
                         onChange={(opt) => setNewValidation({...newValidation, target_field: opt.value})}
                         placeholder="Buscar campo..."
                         styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                      />
                   </div>
               )}

               {/* Solo mostramos la caja de valor si la condición requiere comparar algo */}
               {!['IS_EMPTY', 'NOT_EMPTY', 'HAS_COMPLETED_SIGNATURE'].includes(newValidation.operator) && (
                  <div className="animate-in fade-in zoom-in-95">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Valor a comparar</label>
                     <input type="text" required placeholder="Ej: Rechazado" value={newValidation.validation_value} onChange={e => setNewValidation({...newValidation, validation_value: e.target.value})} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-red-500 shadow-sm" />
                  </div>
               )}
            </div>
            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mensaje de Error para el Usuario</label>
               <textarea rows={2} required placeholder="Ej: No puedes avanzar sin adjuntar el documento de identidad." value={newValidation.error_message} onChange={e => setNewValidation({...newValidation, error_message: e.target.value})} className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-red-500 shadow-sm resize-none custom-scrollbar" />
            </div>
         </form>
         <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
           <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
           <button type="submit" form="validation-form" className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95">Guardar Bloqueo</button>
         </div>
      </div>
    </div>, document.body
  );
};

export default ValidationModal;