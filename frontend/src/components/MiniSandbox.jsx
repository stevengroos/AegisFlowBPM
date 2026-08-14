import React, { useState, useCallback } from 'react';
import ReactFlow, { addEdge, Background, Handle, Position, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import confetti from 'canvas-confetti';
import { UserPlus, Trophy, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

// 🔥 1. DISEÑO DE NUESTROS NODOS PERSONALIZADOS 🔥
const CustomNode = ({ data }) => {
  return (
    <div className={`px-5 py-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] rounded-2xl bg-[#0B0F19] border ${data.colorBorder} text-white flex items-center gap-3 min-w-[200px]`}>
      {/* Conector de entrada (Solo si no es el primer nodo) */}
      {!data.isStart && <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 border-none" />}
      
      <div className={`p-2 rounded-lg ${data.colorBg}`}>
        {data.icon}
      </div>
      <div>
        <div className="font-bold text-sm">{data.label}</div>
        <div className="text-xs text-gray-400">{data.sublabel}</div>
      </div>

      {/* Conector de salida (Solo si no es el último nodo) */}
      {!data.isEnd && <Handle type="source" position={Position.Right} className="w-4 h-4 bg-purple-500 border-2 border-white cursor-pointer hover:scale-125 transition-transform" />}
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

// 🔥 2. ESTADO INICIAL DEL LIENZO 🔥
const initialNodes = [
  {
    id: 'node-1',
    type: 'custom',
    position: { x: 50, y: 150 },
    data: { 
      label: 'Nuevo Prospecto', 
      sublabel: 'Arrastra el conector 👉',
      icon: <UserPlus className="w-5 h-5 text-blue-400" />,
      colorBorder: 'border-blue-500/50',
      colorBg: 'bg-blue-500/10',
      isStart: true 
    },
  },
  {
    id: 'node-2',
    type: 'custom',
    position: { x: 450, y: 150 },
    data: { 
      label: 'Venta Ganada', 
      sublabel: 'Conéctalo aquí',
      icon: <Trophy className="w-5 h-5 text-emerald-400" />,
      colorBorder: 'border-emerald-500/50',
      colorBg: 'bg-emerald-500/10',
      isEnd: true 
    },
  },
];

export default function MiniSandbox() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  // 🔥 3. LÓGICA CUANDO EL USUARIO CONECTA LOS NODOS 🔥
  const onConnect = useCallback((params) => {
    // Añadimos la flecha con estilo neón animado
    const newEdge = { 
      ...params, 
      animated: true, 
      style: { stroke: '#8B5CF6', strokeWidth: 3 } // Purple-500
    };
    setEdges((eds) => addEdge(newEdge, eds));
    
    // Cambiamos el estado a éxito
    setIsSuccess(true);

    // ¡ESTALLA EL CONFETI!
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#3B82F6', '#8B5CF6', '#10B981']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#3B82F6', '#8B5CF6', '#10B981']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="relative w-full h-[400px] bg-[#0A0D12] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }} // Oculta el logo de ReactFlow para que se vea premium
        // 🔥 OPTIMIZACIONES PARA MOBILE Y RENDIMIENTO 🔥
        preventScrolling={false} // Evita que el sandbox bloquee el scroll del celular
        zoomOnScroll={false}     // Desactiva el zoom pesado
        panOnDrag={false}        // Evita calcular físicas de arrastre del fondo
        panOnScroll={false}      // Mejora la alerta de "Redistribución forzada"
        zoomOnDoubleClick={false}
      >
        {/* Puntos de fondo elegantes */}
        <Background color="#ffffff" gap={24} size={1} opacity={0.05} />
      </ReactFlow>

      {/* MENSAJE DE ÉXITO FLOTANTE */}
      {isSuccess && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute top-6 left-1/2 -translate-x-1/2 bg-emerald-500/20 border border-emerald-500 text-emerald-400 px-6 py-3 rounded-full font-bold flex items-center gap-2 backdrop-blur-md z-10"
        >
          <Sparkles className="w-5 h-5" />
          ¡Acabas de automatizar tu primera venta!
        </motion.div>
      )}

      {/* INSTRUCCIÓN INICIAL */}
      {!isSuccess && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-blue-500/20 border border-blue-500 text-blue-400 px-6 py-2 rounded-full font-medium text-sm backdrop-blur-md z-10 animate-pulse">
          Pruébalo: Arrastra el círculo morado hacia la meta
        </div>
      )}
    </div>
  );
}