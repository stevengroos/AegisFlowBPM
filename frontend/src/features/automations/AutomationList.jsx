import React, { useState } from 'react';
import { Plus, Trash2, Zap, ArrowRight, Edit2, BellRing, Database, User, Copy, Code, Search, ChevronRight } from 'lucide-react';

const AutomationList = ({ rules, onCreate, onEdit, onDelete }) => {
  // 🔥 ESTADO PARA LA BÚSQUEDA 🔥
  const [searchTerm, setSearchTerm] = useState('');

  const getActionLabel = (type) => {
    const labels = {
      UPDATE_FIELD: 'Cambiar Valor', CUSTOM_FUNCTION: 'Script Low-Code', SET_REQUIRED: 'Hacer Obligatorio',
      SET_OPTIONAL: 'Hacer Opcional', SET_READONLY: 'Bloquear', SET_EDITABLE: 'Desbloquear', SET_HIDDEN: 'Ocultar',
      SET_VISIBLE: 'Mostrar', SEND_NOTIFICATION: 'Disparar Alerta', CHANGE_OWNER: 'Cambiar Propietario',
      COPY_FIELD: 'Copiar Campo', CREATE_RECORD: 'Crear Registro'
    };
    return labels[type] || type;
  };

  // 🔥 Iconos limpios (heredarán el color de la tarjeta y se volverán blancos al hacer hover) 🔥
  const getActionIcon = (type) => {
    if (type === 'CHANGE_OWNER') return <User size={22} />;
    if (type === 'COPY_FIELD') return <Copy size={22} />;
    if (type === 'CREATE_RECORD') return <Database size={22} />;
    if (type === 'SEND_NOTIFICATION') return <BellRing size={22} />;
    if (type === 'CUSTOM_FUNCTION') return <Code size={22} />;
    return <Zap size={22} />;
  };

  // 🔥 LÓGICA DE FILTRADO 🔥
  const filteredRules = rules.filter(rule => 
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getActionLabel(rule.action_type).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
      
      {/* HEADER REFINADO */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800/60 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Automatizaciones</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Reglas Globales y ejecución de procesos en segundo plano.</p>
        </div>
        <button 
          onClick={onCreate} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0"
        >
          <Plus size={18} /> Nueva Regla
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      {rules.length > 0 && (
        <div className="mb-6 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar reglas o acciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white shadow-sm"
            />
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="bg-white dark:bg-gray-900/40 p-10 rounded-3xl border border-gray-200 dark:border-gray-800/60 text-center shadow-sm max-w-md mx-auto mt-10">
          <Zap className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-gray-900 dark:text-white font-bold text-lg">No hay automatizaciones</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Crea tu primera regla para que el sistema trabaje por ti automáticamente.</p>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No se encontraron reglas que coincidan con "{searchTerm}".</p>
        </div>
      ) : (
        // 🔥 LISTA DE TARJETAS (w-full para ocupar todo el ancho) 🔥
        <div className="space-y-4 w-full">
          {filteredRules.map(rule => (
            <div 
              key={rule.id} 
              onClick={() => onEdit(rule)}
              className="relative p-4 md:px-6 md:py-5 rounded-2xl border transition-all duration-300 flex items-center gap-5 group bg-white dark:bg-[#121826]/80 border-gray-200 dark:border-gray-700/60 shadow-sm cursor-pointer hover:border-blue-400/60 dark:hover:border-blue-500/50 hover:shadow-md hover:bg-blue-50/30 dark:hover:bg-[#1a2333]/80 hover:-translate-y-0.5"
            >
              
              {/* ÍCONO */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-500/20">
                {getActionIcon(rule.action_type)}
              </div>
              
              {/* TEXTO Y BADGES */}
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h3 className="text-base font-bold truncate transition-colors duration-300 text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                  {rule.name}
                </h3>
                
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-0 font-medium">
                  <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800/80 rounded-md text-[10px] uppercase tracking-wider border border-gray-200 dark:border-gray-700/50 font-bold">
                    {(rule.event_type || 'ON_UPDATE').replace('ON_', '')}
                  </span>
                  <ArrowRight size={12} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
                  <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                    {getActionLabel(rule.action_type)}
                  </span>
                </div>
              </div>

              {/* CONTROLES FLOTANTES (Eliminar) */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); // Evita que se abra el modal de edición al eliminar
                    onDelete(rule.id); 
                  }} 
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-white dark:hover:text-red-400 dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700" 
                  title="Eliminar Regla"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              {/* ACCIÓN PRINCIPAL (Editar) */}
              <div className="ml-2 pl-4 md:pl-6 border-l border-gray-200 dark:border-gray-700/60 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                <span className="text-xs font-bold hidden sm:block uppercase tracking-widest">Editar</span>
                <ChevronRight size={20} className="transform group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutomationList;