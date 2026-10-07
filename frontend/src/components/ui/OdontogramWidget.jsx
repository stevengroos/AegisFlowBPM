import React, { useState } from 'react';

// Estructura universal FDI de dentición adulta (32 dientes)
const ADULT_TEETH = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
};

// Estados posibles de un diente
const TOOTH_STATES = [
  { id: 'sano', label: 'Sano', color: '#e5e7eb', darkColor: '#374151' },
  { id: 'caries', label: 'Caries', color: '#ef4444', darkColor: '#b91c1c' },
  { id: 'obturado', label: 'Obturado (Empaste)', color: '#3b82f6', darkColor: '#1d4ed8' },
  { id: 'ausente', label: 'Ausente / Extraído', color: '#000000', darkColor: '#000000' },
  { id: 'implante', label: 'Implante / Corona', color: '#10b981', darkColor: '#047857' }
];

const OdontogramWidget = ({ value = {}, onChange, readOnly = false }) => {
  const [selectedTooth, setSelectedTooth] = useState(null);

  // Manejar el clic en un diente
  const handleToothClick = (toothNum) => {
    if (readOnly) return;
    setSelectedTooth(selectedTooth === toothNum ? null : toothNum);
  };

  // Cambiar el estado de la pieza seleccionada
  const handleStateChange = (stateId) => {
    if (!selectedTooth || readOnly) return;
    
    const updatedValue = { ...value };
    if (stateId === 'sano') {
       delete updatedValue[selectedTooth]; // Limpiamos el objeto si está sano para no llenar la BD de basura
    } else {
       updatedValue[selectedTooth] = { state: stateId, notes: updatedValue[selectedTooth]?.notes || '' };
    }
    
    onChange(updatedValue);
    setSelectedTooth(null); // Deseleccionamos luego de marcar
  };

  // Función para obtener el color dinámico del SVG
  const getToothColor = (toothNum) => {
    const toothData = value[toothNum];
    if (!toothData) return 'currentColor'; // Sano usa el color por defecto (adaptable a dark mode)
    
    const stateConfig = TOOTH_STATES.find(s => s.id === toothData.state);
    // Asumimos que hereda la clase 'dark' del padre mediante Tailwind
    const isDark = document.documentElement.classList.contains('dark');
    return isDark ? (stateConfig?.darkColor || '#374151') : (stateConfig?.color || '#e5e7eb');
  };

  // Componente interno para dibujar cada Diente (SVG simplificado)
  const Tooth = ({ number }) => {
    const isSelected = selectedTooth === number;
    const toothData = value[number];
    
    return (
      <div 
         className={`flex flex-col items-center gap-1 cursor-pointer transition-transform ${isSelected ? 'scale-110 -translate-y-1' : 'hover:scale-105'}`} 
         onClick={() => handleToothClick(number)}
      >
        <span className={`text-[10px] font-bold px-1.5 rounded ${isSelected ? 'bg-indigo-500 text-white' : 'text-gray-500 dark:text-gray-400'}`}>
          {number}
        </span>
        {/* SVG Dinámico */}
        <svg viewBox="0 0 40 40" className={`w-8 h-10 ${toothData?.state === 'ausente' ? 'opacity-20' : ''}`}>
           {/* Corona del diente */}
           <path 
             d="M10,20 C10,5 30,5 30,20 C30,30 25,35 20,35 C15,35 10,30 10,20 Z" 
             fill="none" 
             stroke={getToothColor(number)} 
             strokeWidth="2"
           />
           {/* Si tiene Caries, llenamos la corona */}
           {toothData?.state && toothData.state !== 'ausente' && (
              <path 
                d="M12,20 C12,10 28,10 28,20 C28,28 23,32 20,32 C17,32 12,28 12,20 Z" 
                fill={getToothColor(number)} 
                opacity="0.8"
              />
           )}
           {/* Cruz para Extracciones */}
           {toothData?.state === 'ausente' && (
             <path d="M5,5 L35,35 M35,5 L5,35" stroke="#ef4444" strokeWidth="3" />
           )}
        </svg>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 select-none">
       {/* Maxilar Superior */}
       <div className="flex gap-1 sm:gap-2">
         {ADULT_TEETH.upper.map(num => <Tooth key={num} number={num} />)}
       </div>

       {/* Maxilar Inferior */}
       <div className="flex gap-1 sm:gap-2">
         {ADULT_TEETH.lower.map(num => <Tooth key={num} number={num} />)}
       </div>

       {/* Panel de Herramientas Flotante */}
       {selectedTooth && !readOnly && (
         <div className="mt-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl animate-in slide-in-from-bottom-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-3">Pieza seleccionada: {selectedTooth}</p>
            <div className="flex flex-wrap gap-2 justify-center">
               {TOOTH_STATES.map(state => (
                 <button
                    key={state.id}
                    type="button"
                    onClick={() => handleStateChange(state.id)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border hover:opacity-80 transition-opacity"
                    style={{ 
                       backgroundColor: `${state.color}20`, 
                       color: state.id === 'ausente' ? '#ef4444' : state.color,
                       borderColor: state.color 
                    }}
                 >
                    {state.label}
                 </button>
               ))}
            </div>
         </div>
       )}
    </div>
  );
};

export default OdontogramWidget;