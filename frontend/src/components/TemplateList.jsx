import React from 'react';
import { FileText, Plus, Edit2, Power, PowerOff } from 'lucide-react';
import api from '../api/axios';

const TemplateList = ({ templates, loading, onCreateNew, onEdit, refreshData }) => {

  const toggleStatus = async (template) => {
    try {
      await api.put(`/api/v1/templates/${template.id}`, { 
        name: template.name,
        is_active: !template.is_active 
      });
      refreshData();
    } catch (error) {
      console.error("Error cambiando estado:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando plantillas...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto h-full overflow-y-auto custom-scrollbar">
      {/* Cabecera */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
            <FileText className="text-indigo-500" />
            Plantillas de Documentos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Diseña los PDFs (contratos, facturas, reportes) para este módulo.
          </p>
        </div>
        <button 
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95"
        >
          <Plus size={18} />
          Nueva Plantilla
        </button>
      </div>

      {/* Lista/Grilla de Plantillas */}
      {templates.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">Aún no hay plantillas</h3>
          <p className="text-sm text-gray-500 mt-1">Crea tu primer documento PDF para empezar a automatizar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <div key={template.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-800 relative group">
              
              {/* Badge de Estado */}
              <div className="absolute top-5 right-5">
                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                  template.is_active 
                    ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {template.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 pr-16 truncate">
                {template.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px]">
                {template.description || 'Sin descripción'}
              </p>

              {/* Botones de Acción */}
              <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={() => onEdit(template)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 rounded-xl text-sm font-bold transition-colors"
                >
                  <Edit2 size={16} /> Diseñar
                </button>
                
                <button 
                  onClick={() => toggleStatus(template)}
                  title={template.is_active ? "Desactivar plantilla" : "Activar plantilla"}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  {template.is_active ? <PowerOff size={18} /> : <Power size={18} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateList;