import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import BlueprintList from './BlueprintList';
import BlueprintCanvas from './BlueprintCanvas';

// 🔥 IMPORTAMOS NUESTRAS NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

// 🔥 Recibimos moduleId y la nueva prop setHasUnsavedChanges 🔥
const BlueprintBuilder = ({ moduleId, setHasUnsavedChanges }) => {
  const { notify } = useNotification();
  
  const [view, setView] = useState('list');
  const [blueprints, setBlueprints] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState(null);

  // 🔥 FIX: useCallback y AbortController para llamadas seguras 🔥
  const fetchInitialData = useCallback(async (signal) => {
    try {
      const [bpRes, fieldsRes] = await Promise.all([
        api.get(`/api/v1/blueprints/?module_id=${moduleId}`, { signal }),
        api.get(`/api/v1/fields/?module_id=${moduleId}`, { signal })
      ]);
      setBlueprints(bpRes.data || []);
      setFields(fieldsRes.data || []);
    } catch (error) { 
      if (error.name !== 'CanceledError') {
        notify.error("Error al cargar los flujos y campos del módulo.");
      }
    }
  }, [moduleId, notify]);

  useEffect(() => { 
    const controller = new AbortController();
    fetchInitialData(controller.signal); 
    return () => controller.abort();
  }, [fetchInitialData]);

  const openCanvas = (blueprint) => {
    setSelectedBlueprint(blueprint);
    setView('canvas');
  };

  const closeCanvas = () => {
    setSelectedBlueprint(null);
    setView('list');
  };

  return (
    <>
      {view === 'list' && (
        <BlueprintList 
          blueprints={blueprints} 
          fields={fields} 
          // Envolvemos en una función anónima para evitar pasar el evento (e) como signal
          fetchInitialData={() => fetchInitialData()} 
          openCanvas={openCanvas}
          moduleId={moduleId} 
        />
      )}

      {view === 'canvas' && selectedBlueprint && (
        <BlueprintCanvas 
          selectedBlueprint={selectedBlueprint} 
          closeCanvas={closeCanvas}
          moduleId={moduleId} 
          // 🔥 PASAMOS EL ESCUDO AL LIENZO 🔥
          setHasUnsavedChanges={setHasUnsavedChanges}
        />
      )}
    </>
  );
};

export default BlueprintBuilder;