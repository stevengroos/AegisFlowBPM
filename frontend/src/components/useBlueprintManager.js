import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/axios';

export const useBlueprintManager = ({ 
  moduleId, 
  currentVersionId, 
  selectedBlueprint, 
  viewingOldVersion, 
  notify, 
  confirm, 
  reloadBlueprints,
  setHasUnsavedChanges // 🔥 Control de cambios pendientes
}) => {

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [transitionActions, setTransitionActions] = useState([]);
  const [transitionValidations, setTransitionValidations] = useState([]);

  // 🔥 Listas en memoria para rastrear elementos eliminados o nuevos pendientes de guardar
  const deletedStatusIdsRef = useRef(new Set());
  const deletedTransitionIdsRef = useRef(new Set());
  
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
  // 2. CARGA DEL LIENZO (CON PROTECCIÓN DE NODOS TEMPORALES EN MEMORIA)
  // =================================================================
  const fetchBlueprintData = useCallback(async (setSelectedElement, setRenameValue, setEditSlaHours, selectedElementRef) => {
    try {
      const [statusesRes, transRes] = await Promise.all([
        api.get(`/api/v1/statuses/?blueprint_id=${currentVersionId}`),
        api.get(`/api/v1/transitions/?blueprint_id=${currentVersionId}`)
      ]);

      const currentDarkMode = document.documentElement.classList.contains('dark');

      // Mantenemos los nodos temporales (en memoria) y filtramos los eliminados
      setNodes(currentNodes => {
         const tempNodes = currentNodes.filter(n => n.id.toString().startsWith('temp_'));
         
         // 🔥 FIX: Ignoramos los nodos que el usuario marcó para borrar pero no ha guardado aún
         const activeStatuses = statusesRes.data.filter(status => !deletedStatusIdsRef.current.has(status.id));
         
         const dbNodes = activeStatuses.map((status, index) => {
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
         return [...dbNodes, ...tempNodes];
      });

      // Mantenemos las aristas temporales (en memoria) y filtramos las eliminadas
      setEdges(currentEdges => {
         const tempEdges = currentEdges.filter(e => e.id.toString().startsWith('temp_'));
         
         // 🔥 FIX: Ignoramos las transiciones que el usuario marcó para borrar
         const activeTransitions = transRes.data.filter(t => !deletedTransitionIdsRef.current.has(t.id));

         const dbEdges = activeTransitions.map(t => ({
           id: t.id.toString(), source: t.from_status_id.toString(), target: t.to_status_id.toString(), label: t.name, data: { raw_data: t }, 
           labelStyle: { fill: currentDarkMode ? '#f3f4f6' : '#374151', fontWeight: 800, fontSize: 11, fontFamily: 'monospace' },
           labelBgStyle: { fill: currentDarkMode ? '#374151' : 'white', fillOpacity: 0.9, rx: 4, ry: 4 },
           labelBgPadding: [4, 4],
           markerEnd: { type: 'arrowclosed', color: currentDarkMode ? '#60a5fa' : '#2563eb', width: 20, height: 20 },
           style: { stroke: currentDarkMode ? '#60a5fa' : '#2563eb', strokeWidth: 2.5 }, animated: true,
         }));
         return [...dbEdges, ...tempEdges];
      });

      if (setHasUnsavedChanges) setHasUnsavedChanges(false);

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
  }, [currentVersionId, notify, setHasUnsavedChanges]);

  // =================================================================
  // 3. GUARDADO MASIVO EN MEMORIA (BATCH SAVE)
  // =================================================================
  const saveBlueprintChanges = async (fetchBlueprintDataCb) => {
    if (viewingOldVersion) return;
    try {
      // 1. Procesar Eliminaciones pendientes
      for (const statusId of deletedStatusIdsRef.current) {
        if (!statusId.toString().startsWith('temp_')) {
          await api.delete(`/api/v1/statuses/${statusId}`);
        }
      }
      for (const transId of deletedTransitionIdsRef.current) {
        if (!transId.toString().startsWith('temp_')) {
          await api.delete(`/api/v1/transitions/${transId}`);
        }
      }

      // Mapa para registrar los IDs reales que genera la BD para nodos nuevos (temp -> id_real)
      const tempIdToRealIdMap = {};

      // 2. Procesar Nodos (Estados) - Creaciones y Actualizaciones
      for (const node of nodes) {
        const statusData = node.data.raw_data;
        const payload = {
          name: statusData.name,
          is_initial: statusData.is_initial || false,
          blueprint_id: parseInt(currentVersionId),
          sla_hours: statusData.sla_hours ? parseInt(statusData.sla_hours) : null,
          bpmn_shape: node.type || 'task',
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y)
        };

        if (node.id.toString().startsWith('temp_')) {
          const res = await api.post('/api/v1/statuses/', payload);
          tempIdToRealIdMap[node.id] = res.data.id.toString();
        } else {
          await api.put(`/api/v1/statuses/${node.id}`, payload);
        }
      }

      // 3. Procesar Conexiones (Transiciones) resolviendo IDs temporales si aplican
      for (const edge of edges) {
        const transData = edge.data.raw_data;
        
        let sourceId = edge.source.toString();
        let targetId = edge.target.toString();

        if (sourceId.startsWith('temp_')) sourceId = tempIdToRealIdMap[sourceId];
        if (targetId.startsWith('temp_')) targetId = tempIdToRealIdMap[targetId];

        if (!sourceId || !targetId) continue; // Si algún nodo padre falló, omitimos temporalmente

        const payload = {
          name: transData.name || 'Avanzar',
          blueprint_id: parseInt(currentVersionId),
          from_status_id: parseInt(sourceId),
          to_status_id: parseInt(targetId)
        };

        if (edge.id.toString().startsWith('temp_')) {
          await api.post('/api/v1/transitions/', payload);
        } else {
          await api.put(`/api/v1/transitions/${edge.id}`, payload);
        }
      }

      // 🔥 FIX: Limpiamos la memoria de borrados SOLO cuando el guardado fue exitoso
      deletedStatusIdsRef.current.clear();
      deletedTransitionIdsRef.current.clear();

      notify.success("¡Diseño del flujo guardado con éxito!");
      if (setHasUnsavedChanges) setHasUnsavedChanges(false);
      if (fetchBlueprintDataCb) fetchBlueprintDataCb();
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al guardar los cambios del flujo.");
    }
  };

  // =================================================================
  // 4. CARGA DE DETALLES (ACCIONES Y VALIDACIONES)
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
  // 5. HISTORIAL DE VERSIONES
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
  // 6. EXPORTACIÓN E IMPORTACIÓN
  // =================================================================
  const handleExportBlueprint = async () => {
    try {
       const exportData = { blueprint: selectedBlueprint, statuses: nodes.map(n => n.data.raw_data), transitions: edges.map(e => e.data.raw_data) };
       const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a'); a.href = url; a.download = `flujo_${selectedBlueprint.name.replace(/\s+/g, '_').toLowerCase()}_v${selectedBlueprint.version || 1}.json`; a.click(); URL.revokeObjectURL(url);
       notify.success("Exportación completada.");
    } catch(err) { notify.error("Error al exportar el flujo."); }
  };

  const handleImportBlueprint = (event, fetchBlueprintDataCb) => {
    if (viewingOldVersion) return;
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        const newNodes = importedData.statuses.map((status, index) => ({
          id: `temp_${Date.now()}_${index}`,
          data: { raw_data: status },
          position: { x: status.position_x || 50, y: status.position_y || 50 },
          type: status.bpmn_shape || 'task'
        }));

        setNodes(newNodes);
        setEdges([]);
        if (setHasUnsavedChanges) setHasUnsavedChanges(true);
        notify.success("¡Flujo importado en memoria con éxito! Recuerda guardar los cambios.");
      } catch (err) { notify.error("Error al importar el archivo JSON."); }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return {
    nodes, setNodes, edges, setEdges,
    deletedStatusIdsRef, deletedTransitionIdsRef,
    moduleFields, moduleSections, companyUsers, companyRoles, companyProfiles, allModules, allForms,
    versions, loadingVersions,
    transitionActions, transitionValidations,
    fetchBlueprintData, loadTransitionDetails, fetchVersions,
    handleRestoreVersion, handleCreateNewVersion, handleExportBlueprint, handleImportBlueprint,
    saveBlueprintChanges
  };
};