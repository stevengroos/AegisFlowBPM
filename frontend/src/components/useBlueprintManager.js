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
  
  // Catálogos
  const [moduleFields, setModuleFields] = useState([]);
  const [moduleSections, setModuleSections] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [companyRoles, setCompanyRoles] = useState([]);
  const [companyProfiles, setCompanyProfiles] = useState([]);
  const [allModules, setAllModules] = useState([]);
  const [allForms, setAllForms] = useState([]);

  // =================================================================
  // 1. CARGA DE CATÁLOGOS GLOBALES
  // =================================================================
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

  // =================================================================
  // 2. CARGA DEL LIENZO (NODOS Y FLECHAS)
  // =================================================================
  const fetchBlueprintData = useCallback(async (setSelectedElement, setRenameValue, setEditSlaHours, selectedElementRef) => {
    try {
      const [statusesRes, transRes] = await Promise.all([
        api.get(`/api/v1/statuses/?blueprint_id=${currentVersionId}`),
        api.get(`/api/v1/transitions/?blueprint_id=${currentVersionId}`)
      ]);

      const currentDarkMode = document.documentElement.classList.contains('dark');

      setNodes(currentNodes => {
         return statusesRes.data.map((status, index) => {
           const existingNode = currentNodes.find(n => n.id === status.id.toString());
           const xPos = status.position_x !== null ? status.position_x : (existingNode ? existingNode.position.x : (index % 4) * 250 + 50);
           const yPos = status.position_y !== null ? status.position_y : (existingNode ? existingNode.position.y : Math.floor(index / 4) * 150 + 50);

           return {
             id: status.id.toString(),
             data: { raw_data: status },
             position: { x: xPos, y: yPos },
             type: status.bpmn_shape || 'task',
           };
         });
      });

      // Asegurarse de importar MarkerType si se necesita, o reemplazar con el string 'arrowclosed'
      setEdges(transRes.data.map(t => ({
        id: t.id.toString(), source: t.from_status_id.toString(), target: t.to_status_id.toString(), label: t.name, data: { raw_data: t }, 
        labelStyle: { fill: currentDarkMode ? '#f3f4f6' : '#374151', fontWeight: 800, fontSize: 11, fontFamily: 'monospace' },
        labelBgStyle: { fill: currentDarkMode ? '#374151' : 'white', fillOpacity: 0.9, rx: 4, ry: 4 },
        labelBgPadding: [4, 4],
        markerEnd: { type: 'arrowclosed', color: currentDarkMode ? '#60a5fa' : '#2563eb', width: 20, height: 20 },
        style: { stroke: currentDarkMode ? '#60a5fa' : '#2563eb', strokeWidth: 2.5 }, animated: true,
      })));
      
      const currentSelected = selectedElementRef.current;
      if (currentSelected) {
         if (currentSelected.type === 'status') {
             const updatedStatus = statusesRes.data.find(s => s.id === currentSelected.data.id);
             if (updatedStatus) {
                 setSelectedElement({ type: 'status', data: updatedStatus });
                 setRenameValue(updatedStatus.name);
                 setEditSlaHours(updatedStatus.sla_hours || "");
             } else { setSelectedElement(null); }
         } else {
             const updatedTrans = transRes.data.find(t => t.id === currentSelected.data.id);
             if (updatedTrans) {
                 setSelectedElement({ type: 'transition', data: updatedTrans });
                 setRenameValue(updatedTrans.name);
             } else { setSelectedElement(null); }
         }
      }
    } catch (error) { 
        notify.error("Error al cargar el flujo de trabajo.");
    }
  }, [currentVersionId, notify]);

  // =================================================================
  // 3. CARGA DE DETALLES (ACCIONES Y VALIDACIONES)
  // =================================================================
  const loadTransitionDetails = async (transitionId) => {
    try {
      const [actRes, valRes] = await Promise.all([
         api.get(`/api/v1/transitions/${transitionId}/actions`),
         api.get(`/api/v1/transitions/${transitionId}/validations`)
      ]);
      setTransitionActions(actRes.data);
      setTransitionValidations(valRes.data);
    } catch (error) { 
        console.error("Error al cargar detalles de la transición:", error); 
    }
  };

  // =================================================================
  // 4. HISTORIAL DE VERSIONES
  // =================================================================
  const fetchVersions = async (setShowVersions) => {
    setLoadingVersions(true);
    try {
      const res = await api.get(`/api/v1/blueprints/${selectedBlueprint.id}/versions`);
      setVersions(res.data);
      setShowVersions(true);
    } catch (error) {
      notify.error("Error al cargar el historial de versiones.");
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (setCurrentVersionId, setViewingOldVersion) => {
    const isConfirmed = await confirm({
      title: 'Restaurar Versión',
      message: '¿Estás seguro de que deseas volver a esta versión? Se creará una NUEVA versión exacta a esta y se activará.',
      confirmText: 'Sí, restaurar',
      variant: 'primary'
    });
    if (!isConfirmed) return;
    try {
      const res = await api.put(`/api/v1/blueprints/${currentVersionId}`, { name: selectedBlueprint.name, is_active: true });
      notify.success("¡Versión restaurada con éxito!");
      setViewingOldVersion(false);
      setCurrentVersionId(res.data.id);
      if(reloadBlueprints) reloadBlueprints();
    } catch (error) { notify.error("Error al intentar restaurar la versión."); }
  };

  const handleCreateNewVersion = async (setCurrentVersionId) => {
    const currentV = versions.find(v => v.id === currentVersionId)?.version || selectedBlueprint.version || 1;
    const isConfirmed = await confirm({
      title: 'Generar Nueva Versión', message: `Creará la Versión ${currentV + 1} para que sigas trabajando. ¿Deseas continuar?`, confirmText: `Sí, crear V${currentV + 1}`, variant: 'primary'
    });
    if (!isConfirmed) return;
    try {
      const res = await api.put(`/api/v1/blueprints/${currentVersionId}`, { name: selectedBlueprint.name, is_active: true });
      notify.success(`¡Versión ${res.data.version} generada con éxito!`);
      setCurrentVersionId(res.data.id);
      if(reloadBlueprints) reloadBlueprints();
    } catch (error) { notify.error("Error al generar la nueva versión."); }
  };

  // =================================================================
  // 5. IMPORTACIÓN, EXPORTACIÓN E IA
  // =================================================================
  const handleExportBlueprint = async () => {
    try {
       const [sRes, tRes] = await Promise.all([
          api.get(`/api/v1/statuses/?blueprint_id=${currentVersionId}`),
          api.get(`/api/v1/transitions/?blueprint_id=${currentVersionId}`)
       ]);
       const transitions = [];
       for (const t of tRes.data) {
           const [aRes, vRes] = await Promise.all([
              api.get(`/api/v1/transitions/${t.id}/actions`),
              api.get(`/api/v1/transitions/${t.id}/validations`)
           ]);
           transitions.push({ ...t, actions: aRes.data, validations: vRes.data });
       }
       const exportData = { blueprint: selectedBlueprint, statuses: sRes.data, transitions: transitions };
       const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a'); a.href = url; a.download = `flujo_${selectedBlueprint.name.replace(/\s+/g, '_').toLowerCase()}_v${selectedBlueprint.version || 1}.json`; a.click(); URL.revokeObjectURL(url);
       notify.success("Exportación completada.");
    } catch(err) { notify.error("Error al exportar el flujo."); }
  };

  const handleGenerateFromImage = async (event, fetchBlueprintDataCb) => {
    if (viewingOldVersion) return;
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    notify.info("Analizando diagrama con IA... Esto tomará unos segundos 🤖", { autoClose: 5000 });

    try {
      const res = await api.post('/api/v1/ai/generate-blueprint', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const importedData = res.data;

      const currentEdges = edges.map(edge => edge.data.raw_data.id);
      const currentNodes = nodes.map(node => node.data.raw_data.id);
      for (const tid of currentEdges) await api.delete(`/api/v1/transitions/${tid}`);
      for (const sid of currentNodes) await api.delete(`/api/v1/statuses/${sid}`);

      const oldToNewStatusId = {};
      let xCounter = 50; let yCounter = 50;
      for (const status of importedData.statuses) {
         const newStatusRes = await api.post('/api/v1/statuses/', {
             name: status.name, is_initial: status.is_initial || false, blueprint_id: currentVersionId, bpmn_shape: status.bpmn_shape || 'task', position_x: xCounter, position_y: yCounter
         });
         oldToNewStatusId[status.id] = newStatusRes.data.id;
         xCounter += 200; if (xCounter > 800) { xCounter = 50; yCounter += 150; }
      }

      for (const transition of importedData.transitions) {
         if (oldToNewStatusId[transition.from_status_id] && oldToNewStatusId[transition.to_status_id]) {
             await api.post('/api/v1/transitions/', {
                 name: transition.name || 'Avanzar', blueprint_id: currentVersionId, from_status_id: oldToNewStatusId[transition.from_status_id], to_status_id: oldToNewStatusId[transition.to_status_id]
             });
         }
      }
      notify.success("¡Flujo generado exitosamente con Inteligencia Artificial! ✨");
      fetchBlueprintDataCb(); 
    } catch (err) { notify.error(err.response?.data?.detail || "Error al analizar la imagen."); }
    event.target.value = '';
  };

  const handleImportBlueprint = (event, fetchBlueprintDataCb) => {
    if (viewingOldVersion) return;
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        const currentEdges = edges.map(edge => edge.data.raw_data.id);
        const currentNodes = nodes.map(node => node.data.raw_data.id);
        for (const tid of currentEdges) await api.delete(`/api/v1/transitions/${tid}`);
        for (const sid of currentNodes) await api.delete(`/api/v1/statuses/${sid}`);

        const oldToNewStatusId = {};
        for (const status of importedData.statuses) {
           const res = await api.post('/api/v1/statuses/', {
               name: status.name, is_initial: status.is_initial, blueprint_id: currentVersionId, sla_hours: status.sla_hours, bpmn_shape: status.bpmn_shape, position_x: status.position_x, position_y: status.position_y
           });
           oldToNewStatusId[status.id] = res.data.id;
        }

        for (const transition of importedData.transitions) {
           const newTransRes = await api.post('/api/v1/transitions/', {
               name: transition.name, blueprint_id: currentVersionId, from_status_id: oldToNewStatusId[transition.from_status_id], to_status_id: oldToNewStatusId[transition.to_status_id]
           });
           if (transition.validations && transition.validations.length > 0) {
               for (const val of transition.validations) {
                   await api.post(`/api/v1/transitions/${newTransRes.data.id}/validations`, { target_field: val.target_field, operator: val.operator, validation_value: val.validation_value || '', error_message: val.error_message || '' });
               }
           }
           if (transition.actions && transition.actions.length > 0) {
               for (const act of transition.actions) {
                   await api.post(`/api/v1/transitions/${newTransRes.data.id}/actions`, { action_type: act.action_type, target_field: act.target_field || '', action_value: act.action_value || '', function_code: act.function_code || '', action_config: act.action_config || {} });
               }
           }
        }
        notify.success("¡Flujo importado con éxito!");
        fetchBlueprintDataCb();
      } catch (err) { notify.error("Error al importar el archivo JSON."); }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return {
    nodes, setNodes, edges, setEdges,
    moduleFields, moduleSections, companyUsers, companyRoles, companyProfiles, allModules, allForms,
    versions, loadingVersions,
    transitionActions, transitionValidations,
    fetchBlueprintData, loadTransitionDetails, fetchVersions,
    handleRestoreVersion, handleCreateNewVersion, handleExportBlueprint, handleGenerateFromImage, handleImportBlueprint
  };
};