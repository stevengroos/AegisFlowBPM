import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { X, User, Copy, Database, BellRing, Code, Zap, Sparkles, Type, FileBox, UploadCloud, CheckCircle, Loader2, Edit2, Trash2, Plus, ShieldAlert } from 'lucide-react';
import ReactFlow, { Background, Controls, MarkerType, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import { useNotification } from '../context/NotificationContext';

// Nodos y Modales
import { TaskNode, StartNode, EndNode, GatewayNode } from './BpmnNodes';
import ShapeSelectorModal from './modals/ShapeSelectorModal';
import ValidationModal from './modals/ValidationModal';
import ActionModal from './modals/ActionModal';
import BlueprintHeader from './BlueprintHeader';
import BlueprintSidebar from './BlueprintSidebar';
import { useBlueprintManager } from './useBlueprintManager';

const BlueprintCanvas = ({ selectedBlueprint, closeCanvas, moduleId, setHasUnsavedChanges, reloadBlueprints }) => {
  const { notify, confirm } = useNotification(); 

  const [isActionsListOpen, setIsActionsListOpen] = useState(false);
  const [isValidationsListOpen, setIsValidationsListOpen] = useState(false);
  
  const [newStatus, setNewStatus] = useState({ name: '', is_initial: false, sla_hours: '' });
  const [isShapeModalOpen, setIsShapeModalOpen] = useState(false);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiMode, setAiMode] = useState('text');
  const [aiFile, setAiFile] = useState(null);
  const aiBlueprintFileInputRef = useRef(null);

  useEffect(() => {
     if (isShapeModalOpen === 'ai_modal') {
        setIsAiModalOpen(true);
        setIsShapeModalOpen(false);
     }
  }, [isShapeModalOpen]);

  const nodeTypes = useMemo(() => ({ task: TaskNode, start: StartNode, end: EndNode, gateway: GatewayNode }), []);
  const [selectedElement, setSelectedElement] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [editSlaHours, setEditSlaHours] = useState(""); 
  const [isRenaming, setIsRenaming] = useState(false);
  
  const [showVersions, setShowVersions] = useState(false);
  const [viewingOldVersion, setViewingOldVersion] = useState(false); 
  const [currentVersionId, setCurrentVersionId] = useState(selectedBlueprint.id); 

  const [activeTab, setActiveTab] = useState('actions'); 

  const [isAddingAction, setIsAddingAction] = useState(false);
  const [editingActionId, setEditingActionId] = useState(null); 
  const defaultActionState = { action_type: 'UPDATE_VALUE', target_field: '', action_value: '', function_code: '', action_config: {} };
  const [newAction, setNewAction] = useState(defaultActionState);

  const [isAddingValidation, setIsAddingValidation] = useState(false);
  const [editingValidationId, setEditingValidationId] = useState(null);
  const defaultValidationState = { target_field: '', operator: '==', validation_value: '', error_message: '' };
  const [newValidation, setNewValidation] = useState(defaultValidationState);

  const [pendingConnection, setPendingConnection] = useState(null);
  const [newTransitionName, setNewTransitionName] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [targetModuleFields, setTargetModuleFields] = useState([]); 

  const fileInputRef = useRef(null); 
  const aiImageInputRef = useRef(null); 
  const selectedElementRef = useRef(selectedElement);

  useEffect(() => { selectedElementRef.current = selectedElement; }, [selectedElement]);

  const reportChanges = useCallback((hasPendingChanges) => {
      if (setHasUnsavedChanges) setHasUnsavedChanges(hasPendingChanges);
  }, [setHasUnsavedChanges]);

  const {
    nodes, setNodes, edges, setEdges,
    deletedStatusIdsRef, deletedTransitionIdsRef,
    moduleFields, moduleSections, companyUsers, companyRoles, companyProfiles, allModules, allForms,
    versions, loadingVersions, transitionActions, transitionValidations,
    fetchBlueprintData, loadTransitionDetails, fetchVersions,
    handleRestoreVersion, handleCreateNewVersion, handleExportBlueprint, handleImportBlueprint,
    saveBlueprintChanges
  } = useBlueprintManager({
    moduleId, currentVersionId, selectedBlueprint, viewingOldVersion, notify, confirm, reloadBlueprints, setHasUnsavedChanges: reportChanges
  });

  const hasTempItems = nodes.some(n => n.id.toString().startsWith('temp_')) || edges.some(e => e.id.toString().startsWith('temp_'));
  const hasPendingDeletions = deletedStatusIdsRef.current?.size > 0 || deletedTransitionIdsRef.current?.size > 0;
  const isEditingName = selectedElement && renameValue !== selectedElement.data.name;
  const isWritingNewStatus = newStatus.name.trim().length > 0;
  
  const hasLocalChanges = hasTempItems || hasPendingDeletions || isEditingName || isWritingNewStatus || isAddingAction || isAddingValidation;

  useEffect(() => { reportChanges(hasLocalChanges); }, [hasLocalChanges, reportChanges]);

  useEffect(() => {
    const handleBeforeUnload = (e) => { if (hasLocalChanges) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasLocalChanges]);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => { fetchBlueprintData(setSelectedElement, setRenameValue, setEditSlaHours, selectedElementRef); }, [fetchBlueprintData]);

  useEffect(() => {
     if (newAction.action_type === 'CREATE_RECORD' && newAction.action_config?.module_id) {
         api.get(`/api/v1/fields/?module_id=${newAction.action_config.module_id}`).then(res => {
                const activeTgt = res.data.filter(f => f.is_active);
                const uniqueTgtMap = new Map();
                activeTgt.forEach(f => {
                    const key = f.api_name || f.label;
                    if (!uniqueTgtMap.has(key)) {
                        f.display_label = f.api_name && f.api_name !== f.label ? `${f.label} (${f.api_name})` : f.label;
                        uniqueTgtMap.set(key, f);
                    }
                });
                setTargetModuleFields(Array.from(uniqueTgtMap.values()));
            }).catch(err => console.error(err));
     } else { setTargetModuleFields([]); }
  }, [newAction.action_config?.module_id]);

  useEffect(() => {
    if (nodes.length === 0) return;
    setNodes((currentNodes) => currentNodes.map((node) => ({
        ...node, style: { ...node.style, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '2px solid #4b5563' : '2px solid #e5e7eb' }
    })));
    setEdges((currentEdges) => currentEdges.map((edge) => ({
        ...edge, labelStyle: { fill: isDarkMode ? '#f3f4f6' : '#374151', fontWeight: 800, fontSize: 11, fontFamily: 'monospace' }, labelBgStyle: { fill: isDarkMode ? '#374151' : 'white', fillOpacity: 0.9 }, markerEnd: { type: MarkerType.ArrowClosed, color: isDarkMode ? '#60a5fa' : '#2563eb' }, style: { stroke: isDarkMode ? '#60a5fa' : '#2563eb', strokeWidth: 2.5 }
    })));
  }, [isDarkMode, setNodes, setEdges]); // 🔥 FIX: Agregamos dependencias seguras

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    reportChanges(true);
  }, [setNodes, reportChanges]);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    reportChanges(true);
  }, [setEdges, reportChanges]);

  const handleNodeDragStop = (event, node) => {
    if (viewingOldVersion) return; 
    setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, position: node.position } : n));
    reportChanges(true); 
  };

  const onConnect = (connection) => {
    if(viewingOldVersion) return; 
    setPendingConnection(connection);
    setNewTransitionName('');
  };

  const handleCreateTransition = (e) => {
    e.preventDefault();
    if (!newTransitionName.trim() || !pendingConnection || viewingOldVersion) return;
    
    const newEdgeId = `temp_${Date.now()}`;
    const newEdge = {
      id: newEdgeId,
      source: pendingConnection.source,
      target: pendingConnection.target,
      label: newTransitionName,
      data: {
        raw_data: {
          id: newEdgeId,
          name: newTransitionName,
          from_status_id: parseInt(pendingConnection.source),
          to_status_id: parseInt(pendingConnection.target),
          blueprint_id: parseInt(currentVersionId)
        }
      },
      markerEnd: { type: 'arrowclosed', color: isDarkMode ? '#60a5fa' : '#2563eb', width: 20, height: 20 },
      style: { stroke: isDarkMode ? '#60a5fa' : '#2563eb', strokeWidth: 2.5 },
      animated: true,
      labelStyle: { fill: isDarkMode ? '#f3f4f6' : '#374151', fontWeight: 800, fontSize: 11, fontFamily: 'monospace' },
      labelBgStyle: { fill: isDarkMode ? '#374151' : 'white', fillOpacity: 0.9, rx: 4, ry: 4 },
      labelBgPadding: [4, 4]
    };

    setEdges((eds) => [...eds, newEdge]);
    setPendingConnection(null); 
    setNewTransitionName('');
    reportChanges(true);
    notify.success("Transición agregada en memoria. No olvides guardar.");
  };

  const handleCreateStatus = (e) => {
    e.preventDefault();
    if (viewingOldVersion) return notify.warning("No puedes editar versiones antiguas.");
    if (!newStatus.name.trim()) return notify.warning("Escribe un nombre para el estado.");
    
    const newNodeId = `temp_${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: newStatus.bpmn_shape || 'task',
      position: { x: (nodes.length % 4) * 250 + 50, y: Math.floor(nodes.length / 4) * 150 + 50 },
      data: {
        raw_data: {
          id: newNodeId,
          name: newStatus.name,
          is_initial: newStatus.is_initial || nodes.length === 0,
          sla_hours: newStatus.sla_hours ? parseInt(newStatus.sla_hours) : null,
          blueprint_id: parseInt(currentVersionId),
          bpmn_shape: newStatus.bpmn_shape || 'task'
        }
      },
      // 🔥 FIX CRÍTICO 4: Inyectamos estilos al nacer para que nunca sea transparente
      style: {
        backgroundColor: isDarkMode ? '#1f2937' : 'white',
        border: isDarkMode ? '2px solid #4b5563' : '2px solid #e5e7eb'
      }
    };

    setNodes((nds) => [...nds, newNode]);
    setNewStatus({ name: '', is_initial: false, sla_hours: '' });
    reportChanges(true);
    notify.success("Estado agregado en memoria. No olvides guardar.");
  };

  const handleRenameElement = () => {
    if (!selectedElement || !renameValue || viewingOldVersion) return;
    setIsRenaming(true);

    if (selectedElement.type === 'status') {
      // 1. Preparamos la data actualizada
      const updatedRaw = { 
        ...selectedElement.data, 
        name: renameValue, 
        sla_hours: editSlaHours ? parseInt(editSlaHours) : null 
      };
      
      // 2. Sincronizamos la UI para que el panel lateral no tenga datos viejos
      setSelectedElement({ ...selectedElement, data: updatedRaw });

      // 3. Actualizamos el nodo en el lienzo
      setNodes((nds) => nds.map((n) => {
        if (n.id.toString() === selectedElement.data.id.toString()) {
          return { ...n, data: { ...n.data, raw_data: updatedRaw } };
        }
        return n;
      }));
    } else {
      const updatedRaw = { ...selectedElement.data, name: renameValue };
      
      setSelectedElement({ ...selectedElement, data: updatedRaw });

      setEdges((eds) => eds.map((e) => {
        if (e.id.toString() === selectedElement.data.id.toString()) {
          return { ...e, label: renameValue, data: { ...e.data, raw_data: updatedRaw } };
        }
        return e;
      }));
    }

    reportChanges(true);
    setIsRenaming(false);
    notify.success("Propiedades actualizadas en memoria.");
  };

  const handleChangeShape = (newShape) => {
    if (!selectedElement || viewingOldVersion || selectedElement.type !== 'status') return;
    
    setNodes((nds) => nds.map((n) => {
      if (n.id.toString() === selectedElement.data.id.toString()) {
        const updatedRaw = { ...n.data.raw_data, bpmn_shape: newShape };
        return { ...n, type: newShape, data: { ...n.data, raw_data: updatedRaw } };
      }
      return n;
    }));

    setIsShapeModalOpen(false);
    reportChanges(true);
    notify.success("Forma BPMN modificada en memoria.");
  };

  const handleDeleteElement = () => {
    if (!selectedElement || viewingOldVersion) return;
    
    if (selectedElement.type === 'status') {
      const statusIdStr = selectedElement.data.id.toString();
      
      // 🔥 FIX: Guardamos SOLO el string. Evita dobles iteraciones y errores 404 al guardar
      deletedStatusIdsRef.current.add(statusIdStr);
      
      setNodes((nds) => nds.filter((n) => n.id.toString() !== statusIdStr));
      setEdges((eds) => eds.filter((e) => e.source.toString() !== statusIdStr && e.target.toString() !== statusIdStr));
    } else {
      const transIdStr = selectedElement.data.id.toString();
      
      deletedTransitionIdsRef.current.add(transIdStr);
      
      setEdges((eds) => eds.filter((e) => e.id.toString() !== transIdStr));
    }

    setSelectedElement(null);
    reportChanges(true);
    notify.success("Elemento removido de la vista. Guarda para consolidar.");
  };

  const handleSaveAction = async (e) => {
    e.preventDefault();
    if (viewingOldVersion) return;
    try {
      const payload = { ...newAction };
      if (payload.action_type === 'CHANGE_OWNER') payload.target_field = 'assigned_to';
      else if (!['COPY_FIELD', 'CREATE_RECORD', 'SEND_NOTIFICATION'].includes(payload.action_type)) {
          payload.action_value = payload.action_type === 'UPDATE_VALUE' ? payload.action_value : '';
          payload.function_code = payload.action_type === 'CUSTOM_FUNCTION' ? payload.function_code : '';
          payload.action_config = {};
      }
      if (editingActionId) await api.put(`/api/v1/transitions/actions/${editingActionId}`, payload);
      else await api.post(`/api/v1/transitions/${selectedElement.data.id}/actions`, payload);
      notify.success("Acción guardada.");
      closeActionModal(); loadTransitionDetails(selectedElement.data.id);
    } catch (error) { notify.error("Error al guardar la regla."); }
  };

  const handleDeleteAction = async (actionId) => {
    if (viewingOldVersion) return;
    const isConfirmed = await confirm({ title: 'Eliminar', message: '¿Seguro de eliminar esta automatización?', confirmText: 'Sí, eliminar', variant: 'danger' });
    if (!isConfirmed) return;
    try { await api.delete(`/api/v1/transitions/actions/${actionId}`); notify.success("Acción eliminada."); loadTransitionDetails(selectedElement.data.id); } 
    catch (error) { notify.error("Error al eliminar la acción."); }
  };

  const handleSaveValidation = async (e) => {
    e.preventDefault();
    if (viewingOldVersion) return;
    try {
       if (editingValidationId) await api.put(`/api/v1/transitions/validations/${editingValidationId}`, newValidation);
       else await api.post(`/api/v1/transitions/${selectedElement.data.id}/validations`, newValidation);
       notify.success("Regla guardada.");
       closeValidationModal(); loadTransitionDetails(selectedElement.data.id);
    } catch(err) { notify.error("Error al guardar validación."); }
  };

  const handleDeleteValidation = async (id) => {
     if (viewingOldVersion) return;
     try { 
       await api.delete(`/api/v1/transitions/validations/${id}`); 
       notify.success("Regla eliminada."); 
       loadTransitionDetails(selectedElement.data.id); 
     } catch(err) { 
       notify.error("Error al eliminar validación."); 
     }
  };

  const openEditActionModal = (action) => {
     setNewAction({ action_type: action.action_type, target_field: action.target_field || '', action_value: action.action_value || '', function_code: action.function_code || '', action_config: action.action_config || {} });
     setEditingActionId(action.id); setIsAddingAction(true);
  };
  
  const openEditValidationModal = (validation) => {
     setNewValidation({ target_field: validation.target_field || '', operator: validation.operator || '==', validation_value: validation.validation_value || '', error_message: validation.error_message || '' });
     setEditingValidationId(validation.id); setIsAddingValidation(true);
  };

  const closeActionModal = () => { 
     setIsAddingAction(false); 
     setEditingActionId(null); 
     setNewAction(defaultActionState);
     if (selectedElement?.type === 'transition') setIsActionsListOpen(true);
  };
  
  const closeValidationModal = () => { 
     setIsAddingValidation(false); 
     setEditingValidationId(null); 
     setNewValidation(defaultValidationState);
     if (selectedElement?.type === 'transition') setIsValidationsListOpen(true);
  };

  const handleCloseAttempt = async () => {
    if (hasLocalChanges) {
        const isConfirmed = await confirm({ title: 'Cambios sin guardar', message: '¿Seguro que deseas descartarlos y salir?', confirmText: 'Descartar', variant: 'danger' });
        if (isConfirmed) { reportChanges(false); closeCanvas(); }
    } else { reportChanges(false); closeCanvas(); }
  };

  const handleLoadVersion = (versionId, isCurrent) => {
    setCurrentVersionId(versionId); setViewingOldVersion(!isCurrent); setSelectedElement(null); setShowVersions(false);
    notify.info(isCurrent ? "Viendo la versión actual." : "Viendo una versión antigua. Solo lectura.");
  };

  const getActionLabel = (type) => { const labels = { UPDATE_VALUE: 'Cambiar Valor', CUSTOM_FUNCTION: 'Low-Code', SET_REQUIRED: 'Obligatorio', SET_OPTIONAL: 'Opcional', SET_READONLY: 'Bloquear', SET_EDITABLE: 'Desbloquear', SET_HIDDEN: 'Ocultar', SET_VISIBLE: 'Mostrar', SEND_NOTIFICATION: 'Disparar Alerta', CHANGE_OWNER: 'Cambiar Propietario', COPY_FIELD: 'Copiar Campo', CREATE_RECORD: 'Crear Registro' }; return labels[type] || type; };
  const getActionIcon = (type) => {
     if (type === 'CHANGE_OWNER') return <User size={12} className="text-purple-500"/>;
     if (type === 'COPY_FIELD') return <Copy size={12} className="text-teal-500"/>;
     if (type === 'CREATE_RECORD') return <Database size={12} className="text-emerald-500"/>;
     if (type === 'SEND_NOTIFICATION') return <BellRing size={12} className="text-amber-500"/>;
     if (type === 'CUSTOM_FUNCTION') return <Code size={12} className="text-green-500"/>;
     return <Zap size={12} className="text-blue-500"/>;
  };

  return (
  <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-950/50 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
    
    <BlueprintHeader
      selectedBlueprint={selectedBlueprint} viewingOldVersion={viewingOldVersion} currentVersionId={currentVersionId} versions={versions}
      handleCloseAttempt={handleCloseAttempt} 
      handleRestoreVersion={() => handleRestoreVersion(setCurrentVersionId, setViewingOldVersion)}
      setCurrentVersionId={setCurrentVersionId} setViewingOldVersion={setViewingOldVersion} selectedElement={selectedElement}
      setIsShapeModalOpen={setIsShapeModalOpen} aiImageInputRef={aiImageInputRef}
      handleGenerateFromImage={() => {}}
      handleCreateNewVersion={() => handleCreateNewVersion(setCurrentVersionId)}
      fetchVersions={() => fetchVersions(setShowVersions)}
      handleExportBlueprint={handleExportBlueprint} fileInputRef={fileInputRef}
      handleImportBlueprint={(e) => handleImportBlueprint(e, () => fetchBlueprintData(setSelectedElement, setRenameValue, setEditSlaHours, selectedElementRef))}
      showVersions={showVersions} setShowVersions={setShowVersions} loadingVersions={loadingVersions} handleLoadVersion={handleLoadVersion}
      setIsActionsListOpen={setIsActionsListOpen} 
      setIsValidationsListOpen={setIsValidationsListOpen}
      transitionActions={transitionActions} 
      transitionValidations={transitionValidations}
      onSaveAllChanges={() => saveBlueprintChanges(() => fetchBlueprintData(setSelectedElement, setRenameValue, setEditSlaHours, selectedElementRef))}
      hasUnsavedChanges={hasLocalChanges}
    />

    <div className="flex flex-1 overflow-hidden relative z-0">
      <BlueprintSidebar
        viewingOldVersion={viewingOldVersion} newStatus={newStatus} setNewStatus={setNewStatus} handleCreateStatus={handleCreateStatus}
        selectedElement={selectedElement} renameValue={renameValue} setRenameValue={setRenameValue}
        handleRenameElement={handleRenameElement} isRenaming={isRenaming} editSlaHours={editSlaHours} setEditSlaHours={setEditSlaHours}
        activeTab={activeTab} setActiveTab={setActiveTab} transitionActions={transitionActions}
        getActionIcon={getActionIcon} getActionLabel={getActionLabel} allModules={allModules}
        openEditActionModal={openEditActionModal} handleDeleteAction={handleDeleteAction} setIsAddingAction={setIsAddingAction}
        transitionValidations={transitionValidations} openEditValidationModal={openEditValidationModal} handleDeleteValidation={handleDeleteValidation}
        setIsAddingValidation={setIsAddingValidation} handleDeleteElement={handleDeleteElement}
      />

        <div className="flex-1 relative bg-gray-50/50 dark:bg-gray-950 shadow-inner">
          <ReactFlow 
            nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} 
            nodeTypes={nodeTypes} nodesDraggable={!viewingOldVersion} nodesConnectable={!viewingOldVersion} elementsSelectable={true}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={(e,n) => { 
               setSelectedElement({ type: 'status', data: n.data.raw_data }); 
               setRenameValue(n.data.raw_data.name); setEditSlaHours(n.data.raw_data.sla_hours || ""); 
               closeActionModal(); closeValidationModal();
            }}
            onEdgeClick={(e, edge) => { 
               setSelectedElement({ type: 'transition', data: edge.data.raw_data }); 
               setRenameValue(edge.data.raw_data.name); loadTransitionDetails(edge.data.raw_data.id); 
               closeActionModal(); closeValidationModal();
            }} 
            onPaneClick={() => { setSelectedElement(null); setTransitionActions([]); setTransitionValidations([]); closeActionModal(); closeValidationModal(); }} 
            fitView attributionPosition="bottom-right"
          >
            <Background color={isDarkMode ? '#4b5563' : '#ccc'} gap={16} size={1} />
            <Controls className="dark:bg-gray-800 dark:text-white dark:border-gray-700 shadow-md" />
          </ReactFlow>
        </div>
      </div>

      {pendingConnection && createPortal(
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
               <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900 dark:text-white">Conectar Estados</h3>
                  <button onClick={() => setPendingConnection(null)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
               </div>
               <form onSubmit={handleCreateTransition} className="p-6">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nombre de la transición</label>
                  <input type="text" autoFocus required placeholder="Ej: Aprobar Documento" value={newTransitionName} onChange={e => setNewTransitionName(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all shadow-sm" />
                  <div className="flex justify-end gap-3 mt-6">
                     <button type="button" onClick={() => setPendingConnection(null)} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
                     <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors active:scale-95">Conectar</button>
                  </div>
               </form>
            </div>
         </div>, document.body
      )}

      <ValidationModal isOpen={isAddingValidation} onClose={closeValidationModal} onSave={handleSaveValidation} newValidation={newValidation} setNewValidation={setNewValidation} moduleFields={moduleFields} />
      <ActionModal isOpen={isAddingAction} onClose={closeActionModal} onSave={handleSaveAction} newAction={newAction} setNewAction={setNewAction} editingActionId={editingActionId} moduleFields={moduleFields} moduleSections={moduleSections} allModules={allModules} allForms={allForms} targetModuleFields={targetModuleFields} companyUsers={companyUsers} companyRoles={companyRoles} companyProfiles={companyProfiles} moduleId={moduleId} blueprintId={currentVersionId} selectedElement={selectedElement} />
      <ShapeSelectorModal isOpen={isShapeModalOpen} onClose={() => setIsShapeModalOpen(false)} selectedElement={selectedElement} onChangeShape={handleChangeShape} />

      {isActionsListOpen && createPortal(
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99998] p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-blue-200 dark:border-blue-800/50 overflow-hidden flex flex-col max-h-[80vh]">
               <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10">
                  <h3 className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2"><Zap size={18} className="fill-blue-500"/> Acciones Automáticas</h3>
                  <button onClick={() => setIsActionsListOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
               </div>
               <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
                  {transitionActions.length > 0 ? (
                     transitionActions.map(action => (
                        <div key={action.id} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-4 rounded-xl flex justify-between items-center shadow-sm group">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-white dark:bg-gray-900 rounded-lg shadow-sm">{getActionIcon(action.action_type)}</div>
                              <div>
                                 <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{getActionLabel(action.action_type)}</p>
                                 <p className="text-xs text-gray-500">
                                    {action.action_type === 'CREATE_RECORD' ? `Destino: ${allModules.find(m=>m.id==action.action_config?.module_id)?.name || '?'}` : 
                                     action.action_type === 'COPY_FIELD' ? `${action.action_value} ➔ ${action.target_field}` :
                                     action.target_field?.startsWith('section_') ? `Sección ID ${action.target_field.replace('section_','')}` : action.target_field}
                                 </p>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => { openEditActionModal(action); setIsActionsListOpen(false); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteAction(action.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 size={16} /></button>
                           </div>
                        </div>
                     ))
                  ) : (
                     <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center"><p className="text-sm text-gray-400 font-medium">Ninguna acción configurada para esta transición.</p></div>
                  )}
               </div>
               <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <button onClick={() => { setIsAddingAction(true); setIsActionsListOpen(false); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"><Plus size={16} /> Añadir Nueva Acción</button>
               </div>
            </div>
         </div>, document.body
      )}

      {isValidationsListOpen && createPortal(
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99998] p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-red-200 dark:border-red-800/50 overflow-hidden flex flex-col max-h-[80vh]">
               <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-red-50/50 dark:bg-red-900/10">
                  <h3 className="font-bold text-red-900 dark:text-red-400 flex items-center gap-2"><ShieldAlert size={18} className="fill-red-500"/> Reglas de Validación (Bloqueos)</h3>
                  <button onClick={() => setIsValidationsListOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
               </div>
               <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
                  {transitionValidations.length > 0 ? (
                     transitionValidations.map(val => (
                        <div key={val.id} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-4 rounded-xl flex justify-between items-center shadow-sm group">
                           <div>
                              <p className="text-sm font-bold text-red-900 dark:text-red-400">Si [{val.target_field}] {val.operator} {val.validation_value ? `"${val.validation_value}"` : ''}</p>
                              <p className="text-xs text-gray-500 mt-1">Mensaje: "{val.error_message}"</p>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => { openEditValidationModal(val); setIsValidationsListOpen(false); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 size={16} /></button>
                              <button onClick={async () => {
                                const isConfirmed = await confirm({
                                    title: 'Eliminar Validación',
                                    message: '¿Estás seguro de eliminar este bloqueo?',
                                    confirmText: 'Sí, eliminar',
                                    variant: 'danger'
                                });
                                if (isConfirmed) handleDeleteValidation(val.id);
                              }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 size={16} /></button>                           </div>
                        </div>
                     ))
                  ) : (
                     <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center"><p className="text-sm text-gray-400 font-medium">No hay bloqueos configurados.</p></div>
                  )}
               </div>
               <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <button onClick={() => { setIsAddingValidation(true); setIsValidationsListOpen(false); }} className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"><Plus size={16} /> Añadir Regla de Bloqueo</button>
               </div>
            </div>
         </div>, document.body
      )}

    </div>
  );
};

export default BlueprintCanvas;