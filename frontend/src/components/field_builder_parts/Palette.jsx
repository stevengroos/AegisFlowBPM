import React from 'react';
import { Type, AlignLeft, Hash, Calendar, CheckSquare, List, Image, FileBox, TableProperties, LinkIcon, MapPin, Calculator, Link2, Users } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';

// 🔥 AÑADIMOS LOS 3 SÚPER CAMPOS (MapPin, Calculator, LinkIcon) 🔥
export const PALETTE_ITEMS = [
  { type: 'text', icon: <Type size={16}/>, label: 'Texto Corto' },
  { type: 'textarea', icon: <AlignLeft size={16}/>, label: 'Texto Largo' },
  { type: 'number', icon: <Hash size={16}/>, label: 'Número' },
  { type: 'date', icon: <Calendar size={16}/>, label: 'Fecha' },
  { type: 'select', icon: <List size={16}/>, label: 'Desplegable' },
  { type: 'checkbox', icon: <CheckSquare size={16}/>, label: 'Casilla (Sí/No)' },
  { type: 'url', icon: <Link2 size={16}/>, label: 'Enlace Web' },
  { type: 'relation', icon: <LinkIcon size={16}/>, label: 'Relacional (Otro Módulo)' },
  { type: 'user_relation', icon: <Users size={16} className="text-indigo-500"/>, label: 'Relación con Usuarios' }, // 🔥 AÑADE ESTA LÍNEA 🔥
  { type: 'map', icon: <MapPin size={16} className="text-red-500"/>, label: 'Geolocalización' },
  { type: 'formula', icon: <Calculator size={16} className="text-emerald-500"/>, label: 'Fórmula (Calculado)' },
  { type: 'file', icon: <FileBox size={16}/>, label: 'Archivo Adjunto' },
  { type: 'image', icon: <Image size={16}/>, label: 'Imagen' },
  { type: 'subform', icon: <TableProperties size={16}/>, label: 'Subformulario (Tabla)' }
];

export const getFieldTypeIcon = (type) => { 
  const found = PALETTE_ITEMS.find(p => p.type === type); 
  return found ? found.icon : <Type size={14} />; 
};

const PaletteItem = ({ item, onClick }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { type: item.type, label: item.label, icon: item.icon }
  });
  return (
    <button ref={setNodeRef} {...listeners} {...attributes} onClick={onClick} className={`w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 transition-all text-left group ${isDragging ? 'opacity-50' : ''}`}>
      <span className="text-gray-400 group-hover:text-blue-500 transition-colors">{item.icon}</span>{item.label}
    </button>
  );
};

export const Palette = ({ onAddField }) => {
  return (
    <div className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
      {PALETTE_ITEMS.map(item => (
        <PaletteItem key={item.type} item={item} onClick={() => onAddField(item.type)} />
      ))}
    </div>
  );
};

export default Palette;