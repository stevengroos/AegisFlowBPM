import React, { useState, useEffect, useRef } from 'react';
import { FileDown, Loader2, ChevronDown } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const ExportPdfButton = ({ moduleId, recordId }) => {
  const { notify } = useNotification();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // 1. Buscar las plantillas activas del módulo
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await api.get(`/api/v1/templates/module/${moduleId}`);
        // Solo mostramos plantillas Activas y que tengan al menos 1 versión guardada
        const activeTemplates = res.data.filter(t => t.is_active && t.versions?.length > 0);
        setTemplates(activeTemplates);
      } catch (error) {
        console.error("Error cargando plantillas:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [moduleId]);

  // 2. Cerrar el menú si hacen clic afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3. Generar y Descargar el PDF
  const handleGenerate = async (templateId, templateName) => {
    setGenerating(true);
    setShowMenu(false);
    try {
      // ⚠️ IMPORTANTE: responseType 'blob' es vital para descargar archivos binarios (PDFs)
      const response = await api.post(
        `/api/v1/templates/${templateId}/generate/${recordId}`,
        {},
        { responseType: 'blob' } 
      );
      
      // Convertir la respuesta a un objeto Blob (Archivo)
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Crear un enlace invisible y forzar la descarga
      const link = document.createElement('a');
      link.href = url;
      
      // Intentar sacar el nombre del archivo de las cabeceras, o usar uno por defecto
      const contentDisposition = response.headers['content-disposition'];
      let fileName = `${templateName.replace(/ /g, '_')}_${recordId}.pdf`;
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (fileNameMatch && fileNameMatch.length === 2) {
          fileName = fileNameMatch[1];
        }
      }
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // Limpiar memoria
      
      notify.success("Documento generado con éxito");
    } catch (error) {
      notify.error("Error al generar el documento");
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  // Si está cargando o no hay plantillas, no renderizamos nada (ocultamos el botón)
  if (loading || templates.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      {templates.length === 1 ? (
        // BOTÓN SIMPLE (Solo hay 1 plantilla)
        <button
          onClick={() => handleGenerate(templates[0].id, templates[0].name)}
          disabled={generating}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-70"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          Exportar PDF
        </button>
      ) : (
        // BOTÓN DESPLEGABLE (Hay varias plantillas)
        <>
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={generating}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-70"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            Exportar PDF
            <ChevronDown size={14} />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Elige un formato</span>
              </div>
              <div className="p-1.5">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleGenerate(template.id, template.name)}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <FileDown size={15} className="opacity-70" /> {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExportPdfButton;