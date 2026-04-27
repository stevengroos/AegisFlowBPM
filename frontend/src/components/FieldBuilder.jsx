import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import FormList from './FormList';
import FieldCanvas from './FieldCanvas';

// 🔥 IMPORTAMOS NUESTRO SISTEMA GLOBAL DE NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

const FieldBuilder = ({ moduleId, setHasUnsavedChanges }) => {
  const { notify } = useNotification();

  const [view, setView] = useState('list'); 
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  
  const [fields, setFields] = useState([]);
  const [inactiveFields, setInactiveFields] = useState([]); 
  const [availableToReuse, setAvailableToReuse] = useState([]);

  // 🔥 FIX: useCallback y AbortController para llamadas seguras a la API 🔥
  const fetchForms = useCallback(async (signal) => {
    try {
      const response = await api.get(`/api/v1/forms/?module_id=${moduleId}&include_inactive=true`, { signal });
      setForms(response.data || []);
    } catch (error) { 
      if (error.name !== 'CanceledError') {
        notify.error("Error al cargar la lista de formularios.");
      }
    }
  }, [moduleId, notify]);

  useEffect(() => { 
    const controller = new AbortController();
    fetchForms(controller.signal); 
    return () => controller.abort();
  }, [fetchForms]);

  const openCanvas = (form) => {
    setSelectedForm(form);
    setView('canvas');
  };

  const closeCanvas = () => {
    setSelectedForm(null);
    setFields([]); setInactiveFields([]); setAvailableToReuse([]);
    setView('list');
  };

  const fetchFields = useCallback(async (signal) => {
    if (!selectedForm) return;
    try {
      const response = await api.get(`/api/v1/fields/?include_inactive=true&module_id=${moduleId}`, { signal });
      const allModuleFields = response.data || [];

      setFields(allModuleFields.filter(f => f.form_id === selectedForm.id && f.is_active));
      setInactiveFields(allModuleFields.filter(f => f.form_id === selectedForm.id && !f.is_active));

      const currentFormApiNames = new Set(allModuleFields.filter(f => f.form_id === selectedForm.id).map(f => f.api_name));
      const otherFieldsInModule = allModuleFields.filter(f => f.form_id !== selectedForm.id && !currentFormApiNames.has(f.api_name));
      
      const uniqueOtherFields = [];
      const seenApiNames = new Set();
      
      for (const f of otherFieldsInModule) {
         if (!seenApiNames.has(f.api_name)) {
            uniqueOtherFields.push(f);
            seenApiNames.add(f.api_name);
         }
      }
      setAvailableToReuse(uniqueOtherFields);

    } catch (error) { 
      if (error.name !== 'CanceledError') {
        notify.error("Error al cargar los campos del formulario.");
      }
    }
  }, [moduleId, selectedForm, notify]);

  useEffect(() => { 
    if (view === 'canvas') {
      const controller = new AbortController();
      fetchFields(controller.signal);
      return () => controller.abort();
    }
  }, [view, fetchFields]);

  return (
    <>
      {view === 'list' && (
        <FormList 
          forms={forms} 
          // Pasamos una función envoltorio sin signal para recargas manuales
          fetchForms={() => fetchForms()} 
          onOpenCanvas={openCanvas} 
          moduleId={moduleId} 
        />
      )}

      {view === 'canvas' && selectedForm && (
        <FieldCanvas
          moduleId={moduleId} 
          selectedForm={selectedForm} 
          onCloseCanvas={closeCanvas}
          fields={fields}
          setFields={setFields}
          inactiveFields={inactiveFields}
          availableToReuse={availableToReuse}
          fetchFields={() => fetchFields()}
          setHasUnsavedChanges={setHasUnsavedChanges}
        />
      )}
    </>
  );
};

export default FieldBuilder;