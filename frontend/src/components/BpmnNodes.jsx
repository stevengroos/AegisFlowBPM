import React from 'react';
import { Handle, Position } from 'reactflow';
import { Star } from 'lucide-react';

// 🔥 Puntos de conexión (Puntos magnéticos para las flechas) 🔥
const StandardHandles = () => (
  <>
    <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-400 dark:!bg-gray-500 border-none" />
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-400 dark:!bg-gray-500 border-none" />
    <Handle type="source" position={Position.Right} id="right" className="w-2 h-2 !bg-gray-400 dark:!bg-gray-500 border-none" />
    <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 !bg-gray-400 dark:!bg-gray-500 border-none" />
  </>
);

// 🔥 Etiqueta interna reutilizable 🔥
const NodeLabel = ({ data }) => (
  <div className="flex flex-col items-center justify-center text-center p-1 pointer-events-none">
    <span className="font-bold text-[10px] sm:text-xs text-gray-900 dark:text-gray-100 leading-tight">
      {data.raw_data?.name || 'Estado'}
    </span>
    {data.raw_data?.is_initial && <Star size={10} className="text-yellow-500 fill-yellow-500 mt-0.5" />}
  </div>
);

// ==========================================
// 1. NODO TAREA (Rectángulo Redondeado)
// ==========================================
export const TaskNode = ({ data, selected }) => (
  <div className={`min-w-[140px] px-3 py-3 bg-white dark:bg-gray-800 border-2 rounded-xl shadow-sm transition-all ${selected ? 'border-blue-500 shadow-blue-500/30 shadow-lg scale-105' : 'border-gray-200 dark:border-gray-600'}`}>
    <StandardHandles />
    <NodeLabel data={data} />
  </div>
);

// ==========================================
// 2. NODO INICIO (Círculo Verde)
// ==========================================
export const StartNode = ({ data, selected }) => (
  <div className={`w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border-2 flex items-center justify-center shadow-sm transition-all ${selected ? 'border-emerald-500 shadow-emerald-500/30 shadow-lg scale-105' : 'border-emerald-400 dark:border-emerald-600'}`}>
    <StandardHandles />
    <NodeLabel data={data} />
  </div>
);

// ==========================================
// 3. NODO FIN (Círculo Rojo Grueso)
// ==========================================
export const EndNode = ({ data, selected }) => (
  <div className={`w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-900/20 border-4 flex items-center justify-center shadow-sm transition-all ${selected ? 'border-rose-600 shadow-rose-500/30 shadow-lg scale-105' : 'border-rose-400 dark:border-rose-600'}`}>
    <StandardHandles />
    <NodeLabel data={data} />
  </div>
);

// ==========================================
// 4. NODO COMPUERTA / DECISIÓN (Rombo Amarillo)
// ==========================================
export const GatewayNode = ({ data, selected }) => (
  <div className="relative w-24 h-24 flex items-center justify-center">
    {/* El fondo que gira 45 grados para hacer el rombo */}
    <div className={`absolute inset-0 rotate-45 bg-amber-50 dark:bg-amber-900/20 border-2 rounded-md shadow-sm transition-all ${selected ? 'border-amber-500 shadow-amber-500/30 shadow-lg scale-105' : 'border-amber-300 dark:border-amber-600'}`}></div>
    <StandardHandles />
    {/* El texto que se queda recto */}
    <div className="relative z-10">
      <NodeLabel data={data} />
    </div>
  </div>
);