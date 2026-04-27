import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css'; // Asegúrate de tener react-quill instalado
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { ArrowLeft, Save, Code, Type, FileCode2, Loader2 } from 'lucide-react';

const TemplateCanvas = ({ moduleId, template, fields, onClose, setHasUnsavedChanges }) => {
  const { notify } = useNotification();
  const quillRef = useRef(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [editorMode, setEditorMode] = useState('visual'); 
  
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    is_active: template?.is_active ?? true,
    content_html: '',
  });

  // 🔥 FIX: Limpiamos los campos duplicados en memoria usando useMemo 🔥
  const uniqueFields = useMemo(() => {
    if (!fields) return [];
    const uniqueMap = new Map();
    
    fields.forEach(f => {
      // Usamos api_name como llave principal, si no existe, usamos el label
      const key = f.api_name || f.label;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, f);
      }
    });
    
    return Array.from(uniqueMap.values());
  }, [fields]);

  useEffect(() => {
    if (template && template.versions?.length > 0) {
      const lastVersion = template.versions[template.versions.length - 1];
      setFormData(prev => ({ ...prev, content_html: lastVersion.content_html }));
      if (lastVersion.editor_type) setEditorMode(lastVersion.editor_type);
    }
  }, [template]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  // 🔥 MAGIA: Inyectar variable donde esté el cursor del usuario
  const insertVariable = (apiName) => {
    const variableTag = `{{ ${apiName} }}`;
    
    if (editorMode === 'visual' && quillRef.current) {
      const editor = quillRef.current.getEditor();
      const cursorPosition = editor.getSelection()?.index || (editor.getLength() - 1);
      editor.insertText(cursorPosition, variableTag);
      editor.setSelection(cursorPosition + variableTag.length);
      handleChange('content_html', editor.root.innerHTML);
    } else {
      handleChange('content_html', formData.content_html + variableTag);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return notify.warning("El nombre es obligatorio.");
    if (!formData.content_html.trim()) return notify.warning("El documento no puede estar vacío.");

    setIsSaving(true);
    try {
      if (template) {
        await api.put(`/api/v1/templates/${template.id}`, {
          name: formData.name,
          description: formData.description,
          is_active: formData.is_active
        });
        await api.post(`/api/v1/templates/${template.id}/versions`, {
          content_html: formData.content_html,
          editor_type: editorMode
        });
        notify.success("Nueva versión de plantilla guardada.");
      } else {
        await api.post('/api/v1/templates/', {
          name: formData.name,
          description: formData.description,
          module_id: moduleId,
          is_active: formData.is_active,
          initial_version: {
            content_html: formData.content_html,
            editor_type: editorMode
          }
        });
        notify.success("Plantilla creada exitosamente.");
      }
      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      notify.error("Error al guardar la plantilla.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
      {/* 🛠️ HEADER DEL EDITOR */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Nombre del Documento (Ej: Contrato Base)"
              className="text-lg font-bold bg-transparent border-none outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 w-80"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-200/50 dark:bg-gray-800 p-1 rounded-lg">
            <button onClick={() => setEditorMode('visual')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${editorMode === 'visual' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              <Type size={14}/> Visual
            </button>
            <button onClick={() => setEditorMode('html')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${editorMode === 'html' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              <Code size={14}/> Código (Jinja2)
            </button>
          </div>
          
          <button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar Documento
          </button>
        </div>
      </div>

      {/* 🛠️ ÁREA DE TRABAJO DUAL */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LADO IZQUIERDO: EL EDITOR */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
          {editorMode === 'visual' ? (
            <ReactQuill 
              ref={quillRef}
              theme="snow" 
              value={formData.content_html} 
              onChange={(val) => handleChange('content_html', val)}
              className="flex-1 flex flex-col h-full overflow-hidden [&_.ql-container]:flex-1 [&_.ql-container]:overflow-y-auto [&_.ql-editor]:min-h-full [&_.ql-editor]:p-8 [&_.ql-toolbar]:border-t-0 [&_.ql-toolbar]:border-x-0 dark:[&_.ql-toolbar]:bg-gray-900 dark:[&_.ql-toolbar]:border-gray-800 dark:[&_.ql-container]:border-none dark:[&_.ql-editor]:text-gray-100"
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                  [{ 'color': [] }, { 'background': [] }],
                  [{ 'align': [] }],
                  ['link', 'image'],
                  ['clean']
                ],
              }}
            />
          ) : (
            <textarea 
              value={formData.content_html}
              onChange={(e) => handleChange('content_html', e.target.value)}
              className="flex-1 w-full p-6 bg-[#1e1e1e] text-green-400 font-mono text-sm outline-none resize-none custom-scrollbar leading-relaxed"
              placeholder="{% if monto > 1000 %} Escribe tu lógica Jinja2 aquí... {% endif %}"
            />
          )}
        </div>

        {/* LADO DERECHO: PALETA DE VARIABLES */}
        <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileCode2 size={16} className="text-indigo-500"/> Variables Dinámicas
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Haz clic para inyectar en el cursor.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            
            {/* Variables del Sistema */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Campos del Sistema</div>
              {['caso_id', 'estado', 'fecha_creacion', 'cliente_nombre', 'cliente_email', 'agente_nombre'].map(sysVar => (
                <button key={sysVar} onClick={() => insertVariable(sysVar)} className="w-full text-left px-3 py-2 text-xs font-mono text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-100 dark:bg-gray-900 dark:border-gray-800 dark:text-indigo-400 dark:hover:border-indigo-800 rounded-lg mb-1.5 transition-colors shadow-sm">
                  {`{{ ${sysVar} }}`}
                </button>
              ))}
            </div>

            {/* Variables del Formulario */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Campos del Formulario</div>
              {/* 🔥 Mapeamos sobre la lista filtrada 'uniqueFields' 🔥 */}
              {uniqueFields.map(field => {
                const variableName = field.api_name || field.label; // Prevención de errores si no hay api_name
                return (
                  <div key={field.id} onClick={() => insertVariable(variableName)} className="w-full px-3 py-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 mb-1.5 transition-colors cursor-pointer group shadow-sm">
                    <div className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{field.label}</div>
                    <div className="font-mono text-[10px] text-gray-400 mt-0.5 group-hover:text-indigo-500 transition-colors truncate">
                      {`{{ ${variableName} }}`}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateCanvas;