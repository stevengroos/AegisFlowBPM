import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder }) => {
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

  const selectedOption = options.find(opt => opt.api_name === value);
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    opt.api_name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white cursor-pointer shadow-sm flex justify-between items-center"
      >
        <span className={selectedOption ? '' : 'text-gray-400'}>
          {selectedOption ? `${selectedOption.label} (${selectedOption.api_name})` : placeholder}
        </span>
        <ChevronDown size={16} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700 relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              autoFocus 
              type="text" 
              placeholder="Buscar campo..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500" 
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
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No se encontraron campos</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt.api_name} 
                  onClick={() => { onChange(opt.api_name); setIsOpen(false); setSearchTerm(''); }} 
                  className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer rounded-md flex justify-between items-center group"
                >
                  <span className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">{opt.label}</span>
                  <span className="text-[10px] text-gray-400 font-mono bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">{opt.api_name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;