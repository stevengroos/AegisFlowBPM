import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Loader2 } from 'lucide-react';
import TemplateList from './TemplateList';
import TemplateCanvas from './TemplateCanvas'; 

const TemplateBuilder = ({ moduleId, setHasUnsavedChanges }) => {
  const [view, setView] = useState('list'); // 'list' | 'canvas'
  const [templates, setTemplates] = useState([]);
  const [fields, setFields] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [templatesRes, fieldsRes] = await Promise.all([
        api.get(`/api/v1/templates/module/${moduleId}`),
        api.get(`/api/v1/fields/?module_id=${moduleId}`)
      ]);
      setTemplates(templatesRes.data);
      setFields(fieldsRes.data);
    } catch (error) {
      if (error.name !== 'CanceledError') console.error("Error cargando plantillas:", error);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchInitialData();
    return () => controller.abort();
  }, [fetchInitialData]);

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setView('canvas');
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setView('canvas');
  };

  const handleCloseCanvas = () => {
    setView('list');
    setEditingTemplate(null);
    setHasUnsavedChanges(false);
    fetchInitialData(); // Refrescar al salir del editor
  };

  if (loading && view === 'list') {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  }

  return (
    <div className="h-full">
      {view === 'list' ? (
        <TemplateList 
          templates={templates} 
          loading={loading}
          onCreateNew={handleCreateNew} 
          onEdit={handleEdit}
          refreshData={fetchInitialData}
        />
      ) : (
        <TemplateCanvas 
          moduleId={moduleId}
          template={editingTemplate}
          fields={fields}
          onClose={handleCloseCanvas}
          setHasUnsavedChanges={setHasUnsavedChanges}
        />
      )}
    </div>
  );
};

export default TemplateBuilder;