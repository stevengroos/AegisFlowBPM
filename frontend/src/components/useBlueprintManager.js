import { useState, useCallback, useEffect } from 'react';
import api from '../api/axios';

export const useBlueprintManager = ({ 
  moduleId, 
  currentVersionId, 
  selectedBlueprint, 
  viewingOldVersion, 
  notify, 
  confirm, 
  reloadBlueprints
}) => {

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [transitionActions, setTransitionActions] = useState([]);
  const [transitionValidations, setTransitionValidations] = useState([]);
  
  const [moduleFields, setModuleFields] = useState([]);
  const [moduleSections, setModuleSections] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [companyRoles, setCompanyRoles] = useState([]);
  const [companyProfiles, setCompanyProfiles] = useState([]);
  const [allModules, setAllModules] = useState([]);
  const [allForms, setAllForms] = useState([]);

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const [fieldsRes, usersRes, modRes, formsRes, rolesRes, profilesRes] = await Promise.all([
          api.get(`/api/v1/fields/?module_id=${moduleId}`),
          api.get('/api/v1/auth/users'),
          api.get('/api/v1/modules/'),
          api.get('/api/v1/forms/'),
          api.get('/api/v1/security/roles'),
          api.get('/api/v1/security/profiles')
        ]);
        
        const activeFields = fieldsRes.data.filter(f => f.is_active);
        const uniqueFieldsMap = new Map();
        activeFields.forEach(f => {
            const key = f.api_name || f.label;
            if (!uniqueFieldsMap.has(key)) {
                f.display_label = f.api_name && f.api_name !== f.label ? `${f.label} (${f.api_name})` : f.label;
                uniqueFieldsMap.set(key, f);
            }
        });
        setModuleFields(Array.from(uniqueFieldsMap.values()));
        setCompanyUsers(usersRes.data);
        setAllModules(modRes.data);
        setAllForms(formsRes.data);
        setCompanyRoles(rolesRes.data);
        setCompanyProfiles(profilesRes.data);

        const modForms = formsRes.data.filter(f => f.module_id === parseInt(moduleId) && f.is_active);
        let allSections = [];
        for(let f of modForms) {
            try {
                const secRes = await api.get(`/api/v1/fields/sections?form_id=${f.id}`);
                allSections = [...allSections, ...secRes.data];
            } catch(e) {}
        }
        setModuleSections(allSections);
      } catch (error) { 
          notify.error("Error al cargar los catálogos del sistema."); 
      }
    };
    if (moduleId) fetchCatalogs();
  }, [moduleId, notify]);

  const fetchBlueprintData = useCallback(async (setSelectedElement, setRenameValue, setEditSlaHours, selectedElementRef) => {
    try {
      const [statusesRes, transRes] = await Promise.all([
        api.get(`/api/v1/statuses/?blueprint_id=${currentVersionId}`),
        api.get(`/api/v1/transitions/?blueprint_id=${currentVersionId}`)
      ]);

      const currentDarkMode = document.documentElement.classList.contains('dark');

      setNodes(() => {
         const dbNodes = statusesRes.data.map((status, index) => {
           const xPos = status.position_x !== null ? status.position_x : (index % 4) * 250 + 50;
           const yPos = status.position_y !== null ? status.position_y : Math.floor(index / 4) * 150 + 50;

           return {
             id: status.id.toString(),
             data: { raw_data: status },
             position: { x: xPos, y: yPos },
             type: status.bpmn_shape || 'task',
             style: {
               backgroundColor: currentDarkMode ? '#1f2937' : 'white',
               border: currentDarkMode ? '2px solid #4b5563' : '2px solid #e5e7eb'
             }
           };
         });
         return dbNodes;
      });

      setEdges(() => {
         const dbEdges = transRes.data.map(t => ({
           id: t.id.toString(), source: t.from_status_id.toString(), target: t.to_status_id.toString(), label: t.name, data: { raw_data: t }, 
           labelStyle: { fill: currentDarkMode ? '#f3f4f6' : '#374151', fontWeight: 800, fontSize: 11, fontFamily: 'monospace' },
           labelBgStyle: { fill: currentDarkMode ? '#374151' : 'white', fillOpacity: 0.9, rx: 4, ry: 4 },
           labelBgPadding: [4, 4],
           markerEnd: { type: 'arrowclosed', color: currentDarkMode ? '#60a5fa' : '#2563eb', width: 20, height: 20 },
           style: { stroke: currentDarkMode ? '#60a5fa' : '#2563eb', strokeWidth: 2.5 }, animated: true,
         }));
         return dbEdges;
      });

      const currentSelected = selectedElementRef?.current;
      if (currentSelected) {
         if (currentSelected.type === 'status') {
             const updatedStatus = statusesRes.data.find(s => s.id.toString() === currentSelected.data.id.toString());
             if (updatedStatus) {
                 if (setSelectedElement) setSelectedElement({ type: 'status', data: updatedStatus });
                 if (setRenameValue) setRenameValue(updatedStatus.name);
                 if (setEditSlaHours) setEditSlaHours(updatedStatus.sla_hours || "");
             } else { if (setSelectedElement) setSelectedElement(null); }
         } else {
             const updatedTrans = transRes.data.find(t => t.id.toString() === currentSelected.data.id.toString());
             if (updatedTrans) {
                 if (setSelectedElement) setSelectedElement({ type: 'transition', data: updatedTrans });
                 if (setRenameValue) setRenameValue(updatedTrans.name);
             } else { if (setSelectedElement) setSelectedElement(null); }
         }
      }
    } catch (error) { 
        notify.error("Error al cargar el flujo de trabajo.");
    }
  }, [currentVersionId, notify]);

  const loadTransitionDetails = async (transitionId) => {
    try {
      const [actRes, valRes] = await Promise.all([
         api.get(`/api/v1/transitions/${transitionId}/actions`),
         api.get(`/api/v1/transitions/${transitionId}/validations`)
      ]);
      setTransitionActions(actRes.data);
      setTransitionValidations(valRes.data);
    } catch (error) { console.error("Error detalles transición:", error); }
  };

  const fetchVersions = async (setShowVersions) => {
    setLoadingVersions(true);
    try {
      const res = await api.get(`/api/v1/blueprints/${selectedBlueprint.id}/versions`);
      setVersions(res.data);
      setShowVersions(true);
    } catch (error) { notify.error("Error historial versiones."); } 
    finally { setLoadingVersions(false); }
  };

  const handleRestoreVersion = async (setCurrentVersionId, setViewingOldVersion) => {
    const isConfirmed = await confirm({ title: 'Restaurar Versión', message: '¿Crear una NUEVA versión exacta a esta y activarla?', confirmText: 'Sí, restaurar', variant: 'primary' });
    if (!isConfirmed) return;
    try {
      const res = await api.put(`/api/v1/blueprints/${currentVersionId}`, { name: selectedBlueprint.name, is_active: true });
      notify.success("¡Versión restaurada con éxito!");
      setViewingOldVersion(false); setCurrentVersionId(res.data.id);
      if(reloadBlueprints) reloadBlueprints();
    } catch (error) { notify.error("Error al restaurar."); }
  };

  const handleCreateNewVersion = async (setCurrentVersionId) => {
    const currentV = versions.find(v => v.id === currentVersionId)?.version || selectedBlueprint.version || 1;
    const isConfirmed = await confirm({ title: 'Generar Nueva Versión', message: `Creará la Versión ${currentV + 1}. ¿Deseas continuar?`, confirmText: `Sí, crear V${currentV + 1}`, variant: 'primary' });
    if (!isConfirmed) return;
    try {
      const res = await api.put(`/api/v1/blueprints/${currentVersionId}`, { name: selectedBlueprint.name, is_active: true });
      notify.success(`¡Versión ${res.data.version} generada!`);
      setCurrentVersionId(res.data.id);
      if(reloadBlueprints) reloadBlueprints();
    } catch (error) { notify.error("Error al generar versión."); }
  };

  const handleExportBlueprint = async () => {
    try {
       notify.info("Compilando reglas de negocio...");
       
       const exportTransitions = await Promise.all(edges.map(async (edge) => {
           const tData = { ...edge.data.raw_data };
           const [actRes, valRes] = await Promise.all([
               api.get(`/api/v1/transitions/${tData.id}/actions`),
               api.get(`/api/v1/transitions/${tData.id}/validations`)
           ]);
           tData.actions = actRes.data;
           tData.validations = valRes.data;
           return tData;
       }));

       const exportData = { blueprint: selectedBlueprint, statuses: nodes.map(n => n.data.raw_data), transitions: exportTransitions };
       const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a'); a.href = url; a.download = `flujo_${selectedBlueprint.name.replace(/\s+/g, '_').toLowerCase()}_v${selectedBlueprint.version || 1}.json`; a.click(); URL.revokeObjectURL(url);
       
       notify.success("Exportación de flujo inteligente completada.");
    } catch(err) { notify.error("Error compilando exportación."); }
  };

  const handleImportBlueprint = (event, fetchBlueprintDataCb) => {
    if (viewingOldVersion) return;
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        notify.info("Importando flujo directamente a la base de datos...");
        const importedData = JSON.parse(e.target.result);
        const oldToNewMap = {};

        // 1. Guardar Nodos reales
        for (const status of importedData.statuses || []) {
           const payload = {
              name: status.name,
              is_initial: status.is_initial || false,
              blueprint_id: parseInt(currentVersionId),
              sla_hours: status.sla_hours ? parseInt(status.sla_hours) : null,
              bpmn_shape: status.bpmn_shape || 'task',
              position_x: status.position_x || 50,
              position_y: status.position_y || 50
           };
           const res = await api.post('/api/v1/statuses/', payload);
           oldToNewMap[status.id] = res.data.id;
        }

        // 2. Guardar Transiciones reales y reglas anidadas
        for (const t of importedData.transitions || []) {
           const newSource = oldToNewMap[t.from_status_id];
           const newTarget = oldToNewMap[t.to_status_id];
           if(!newSource || !newTarget) continue;

           const payload = {
              name: t.name || 'Avanzar',
              blueprint_id: parseInt(currentVersionId),
              from_status_id: newSource,
              to_status_id: newTarget
           };
           const resTrans = await api.post('/api/v1/transitions/', payload);

           // Inyectar Reglas y Validaciones si las tiene
           if (t.actions && t.actions.length > 0) {
              for (const action of t.actions) {
                  const actionPayload = { ...action };
                  delete actionPayload.id; delete actionPayload.transition_id;
                  await api.post(`/api/v1/transitions/${resTrans.data.id}/actions`, actionPayload);
              }
           }
           if (t.validations && t.validations.length > 0) {
              for (const val of t.validations) {
                  const valPayload = { ...val };
                  delete valPayload.id; delete valPayload.transition_id;
                  await api.post(`/api/v1/transitions/${resTrans.data.id}/validations`, valPayload);
              }
           }
        }
        notify.success("¡Flujo importado en la Base de Datos!");
        if (fetchBlueprintDataCb) fetchBlueprintDataCb();
      } catch (err) { 
        notify.error("Error al importar JSON. Formato inválido."); 
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return {
    nodes, setNodes, edges, setEdges,
    moduleFields, moduleSections, companyUsers, companyRoles, companyProfiles, allModules, allForms,
    versions, loadingVersions, transitionActions, transitionValidations,
    fetchBlueprintData, loadTransitionDetails, fetchVersions,
    handleRestoreVersion, handleCreateNewVersion, handleExportBlueprint, handleImportBlueprint
  };
};