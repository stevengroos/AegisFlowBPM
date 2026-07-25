import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom'; // 1. Importar createPortal
import { Search, ChevronDown } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 2. Estados para manejar las coordenadas espaciales
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  
  // 3. Dos referencias separadas: una para el botón y otra para el portal
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  // 🔥 FIX: Ahora soporta opciones con 'value' o con 'api_name' para ser compatible con todo 🔥
  const getOptValue = (opt) => opt.value !== undefined ? opt.value : opt.api_name;
  
  const selectedOption = options.find(opt => getOptValue(opt) === value);
  
  const filteredOptions = options.filter(opt => {
    const labelMatch = opt.label?.toLowerCase().includes(searchTerm.toLowerCase());
    const valueMatch = String(getOptValue(opt)).toLowerCase().includes(searchTerm.toLowerCase());
    return labelMatch || valueMatch;
  }).slice(0, 50);

  // 4. Función para calcular la posición exacta del botón en la pantalla
  const updateCoords = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, []);

  // 5. Función manejadora de apertura
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords(); // Calculamos dónde abrir antes de mostrar
    }
    setIsOpen(!isOpen);
    setSearchTerm('');
  };

  useEffect(() => {
    const handleClickOutside = (event) => { 
      // 6. Verificar si el clic fue fuera del botón Y fuera del portal flotante
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) updateCoords();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // 7. Actualizar coordenadas si el usuario scrollea la tabla o redimensiona
      window.addEventListener('scroll', handleScrollOrResize, true); 
      window.addEventListener('resize', handleScrollOrResize);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateCoords]);

  return (
    <div className={`relative w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} ref={containerRef}>
      <div 
        onClick={handleToggle} 
        className={`w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white shadow-sm flex justify-between items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selectedOption ? '' : 'text-gray-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-gray-400" />
      </div>

      {/* 8. Renderizamos la caja de búsqueda usando createPortal */}
      {isOpen && !disabled && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: `${coords.top + 4}px`,
            left: `${coords.left}px`,
            width: `${Math.max(coords.width, 200)}px`,
            zIndex: 99999 // Asegura que siempre esté por encima de todo
          }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2"
        >
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
                    {typeof optValue === 'string' && isNaN(optValue) && (
                      <span className="text-[10px] text-gray-400 font-mono bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">{optValue}</span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>,
        document.body // Inyectamos este menú directamente en el body
      )}
    </div>
  );
};

export default SearchableSelect;