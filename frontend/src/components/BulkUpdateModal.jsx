import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';
import Select from 'react-select';

const BulkUpdateModal = ({ isOpen, onClose, fields, onConfirm, isSaving, selectedCount }) => {
  const [selectedField, setSelectedField] = useState(null);
  const [newValue, setNewValue] = useState('');
  // 🔥 DETECCIÓN DE MODO OSCURO 🔥
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 🔥 ESTILOS CUSTOM PARA EL SELECT 🔥
  const customStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.75rem', minHeight: '46px', boxShadow: 'none', color: isDarkMode ? 'white' : 'black', '&:hover': { borderColor: isDarkMode ? '#4b5563' : '#9ca3af' } }),
    singleValue: (provided) => ({ ...provided, color: isDarkMode ? '#f9fafb' : '#111827' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', zIndex: 99999 }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (provided, state) => ({ ...provided, backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
    placeholder: (provided) => ({ ...provided, color: isDarkMode ? '#9ca3af' : '#6b7280' })
  };

  if (!isOpen) return null;

  const fieldOptions = fields
    .filter(f => !['file', 'subform'].includes(f.type)) // No permitimos archivos masivos por seguridad
    .map(f => ({ value: f.api_name, label: f.label }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedField || !newValue) return;
    onConfirm(selectedField.value, newValue);
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Actualización Masiva</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex gap-3">
            <AlertCircle className="text-blue-600 shrink-0" size={20} />
            <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">
              Estás a punto de cambiar un dato en <b>{selectedCount} registros</b>. Esta acción no se puede deshacer.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">1. Selecciona el campo</label>
            <Select 
              options={fieldOptions}
              onChange={setSelectedField}
              placeholder="Ej: Ciudad, Empresa..."
              className="my-react-select-container"
              classNamePrefix="my-react-select"
              styles={customStyles} // 🔥 LÍNEA NUEVA
              menuPortalTarget={document.body}
            />
          </div>

          {selectedField && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">2. Nuevo valor para "{selectedField.label}"</label>
              <input 
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Escribe el nuevo valor..."
                autoFocus
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={!selectedField || !newValue || isSaving}
              className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Aplicar a {selectedCount} registros
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkUpdateModal;