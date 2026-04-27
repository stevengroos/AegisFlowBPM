import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Loader2 } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

// Importamos los hijos
import AutomationList from '../features/automations/AutomationList';
import AutomationForm from '../features/automations/AutomationForm';

const AutomationBuilder = ({ moduleId, setHasUnsavedChanges }) => {
  const { notify, confirm } = useNotification();

  const [rules, setRules] = useState([]);
  const [fields, setFields] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [allModules, setAllModules] = useState([]);
  const [allForms, setAllForms] = useState([]);
  
  // 🔥 NUEVOS ESTADOS PARA SOPORTAR SELECTORES AVANZADOS 🔥
  const [companyRoles, setCompanyRoles] = useState([]);
  const [companyProfiles, setCompanyProfiles] = useState([]);
  const [moduleSections, setModuleSections] = useState([]);

  const [loading, setLoading] = useState(true);

  const [view, setView] = useState('list'); // 'list' o 'form'
  const [editingRule, setEditingRule] = useState(null);

  const fetchInitialData = useCallback(async (signal) => {
    try {
      setLoading(true);
      // 🔥 AÑADIMOS ROLES Y PERFILES A LA LLAMADA EN PARALELO 🔥
      const [fieldsRes, rulesRes, usersRes, modRes, formsRes, rolesRes, profilesRes] = await Promise.all([
        api.get(`/api/v1/fields/?module_id=${moduleId}`, { signal }),
        api.get(`/api/v1/automations/?module_id=${moduleId}`, { signal }),
        api.get('/api/v1/auth/users', { signal }),
        api.get('/api/v1/modules/', { signal }),
        api.get('/api/v1/forms/', { signal }),
        api.get('/api/v1/security/roles', { signal }),
        api.get('/api/v1/security/profiles', { signal })
      ]);

      // 🔥 FIX: Limpiamos duplicados y preparamos el formato "Label (api_name)"
      const activeFields = fieldsRes.data?.filter(f => f.is_active) || [];
      const uniqueFieldsMap = new Map();
      activeFields.forEach(f => {
          const key = f.api_name || f.label;
          if (!uniqueFieldsMap.has(key)) {
              f.display_label = f.api_name && f.api_name !== f.label 
                  ? `${f.label} (${f.api_name})` 
                  : f.label;
              uniqueFieldsMap.set(key, f);
          }
      });
      setFields(Array.from(uniqueFieldsMap.values()));
      setRules(rulesRes.data || []);
      setCompanyUsers(usersRes.data || []);
      setAllModules(modRes.data || []);
      setAllForms(formsRes.data || []);
      setCompanyRoles(rolesRes.data || []);
      setCompanyProfiles(profilesRes.data || []);

      // 🔥 EXTRAER SECCIONES DE LOS FORMULARIOS ACTIVOS DEL MÓDULO 🔥
      const activeForms = (formsRes.data || []).filter(f => f.module_id === parseInt(moduleId) && f.is_active);
      let allSections = [];
      for (let f of activeForms) {
          try {
              const secRes = await api.get(`/api/v1/fields/sections?form_id=${f.id}`, { signal });
              allSections = [...allSections, ...secRes.data];
          } catch(e) {}
      }
      setModuleSections(allSections);

    } catch (error) {
      if (error.name !== 'CanceledError') notify.error("Error al cargar las automatizaciones.");
    } finally {
      setLoading(false);
    }
  }, [moduleId, notify]);

  useEffect(() => {
    const controller = new AbortController();
    if (moduleId) fetchInitialData(controller.signal);
    return () => controller.abort();
  }, [moduleId, fetchInitialData]);

  const handleDeleteRule = async (ruleId) => {
    const isConfirmed = await confirm({
      title: 'Eliminar Automatización',
      message: '¿Estás seguro de que deseas eliminar esta regla?',
      confirmText: 'Sí, eliminar',
      variant: 'danger'
    });

    if (!isConfirmed) return;
    try {
      await api.delete(`/api/v1/automations/${ruleId}`);
      notify.success("Automatización eliminada.");
      fetchInitialData(new AbortController().signal); 
    } catch (error) {
      notify.error("Error al eliminar la regla.");
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <>
      {view === 'list' && (
        <AutomationList 
           rules={rules}
           onCreate={() => { setEditingRule(null); setView('form'); }}
           onEdit={(rule) => { setEditingRule(rule); setView('form'); }}
           onDelete={handleDeleteRule}
        />
      )}
      
      {view === 'form' && (
        <AutomationForm 
           moduleId={moduleId}
           initialRule={editingRule}
           fields={fields}
           companyUsers={companyUsers}
           allModules={allModules}
           allForms={allForms}
           companyRoles={companyRoles}       // 🔥 PASAMOS LOS ROLES
           companyProfiles={companyProfiles} // 🔥 PASAMOS LOS PERFILES
           moduleSections={moduleSections}   // 🔥 PASAMOS LAS SECCIONES
           onSave={() => { fetchInitialData(new AbortController().signal); setView('list'); }}
           onCancel={() => setView('list')}
           setHasUnsavedChanges={setHasUnsavedChanges}
        />
      )}
    </>
  );
};

export default AutomationBuilder;