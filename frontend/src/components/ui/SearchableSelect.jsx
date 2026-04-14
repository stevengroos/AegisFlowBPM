import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => { 
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false); 
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🔥 FIX: Ahora soporta opciones con 'value' o con 'api_name' para ser compatible con todo 🔥
  const getOptValue = (opt) => opt.value !== undefined ? opt.value : opt.api_name;
  
  const selectedOption = options.find(opt => getOptValue(opt) === value);
  
  const filteredOptions = options.filter(opt => {
    const labelMatch = opt.label?.toLowerCase().includes(searchTerm.toLowerCase());
    const valueMatch = String(getOptValue(opt)).toLowerCase().includes(searchTerm.toLowerCase());
    return labelMatch || valueMatch;
  }).slice(0, 50);

  return (
    <div className={`relative w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} ref={dropdownRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)} 
        className={`w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white shadow-sm flex justify-between items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selectedOption ? '' : 'text-gray-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-gray-400" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700 relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              autoFocus 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white" 
            />
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
            <div 
              onClick={() => { onChange(''); setIsOpen(false); setSearchTerm(''); }} 
              className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-md italic"
            >
              -- Limpiar selección --
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No se encontraron opciones</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const optValue = getOptValue(opt);
                return (
                  <div 
                    key={optValue || idx} 
                    onClick={() => { onChange(optValue); setIsOpen(false); setSearchTerm(''); }} 
                    className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer rounded-md flex justify-between items-center group"
                  >
                    <span className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">{opt.label}</span>
                    {/* Solo mostramos el badge gris si el valor es un texto (como un api_name), no si es un ID numérico */}
                    {typeof optValue === 'string' && isNaN(optValue) && (
                      <span className="text-[10px] text-gray-400 font-mono bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">{optValue}</span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;