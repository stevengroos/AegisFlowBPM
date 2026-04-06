import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { Star, Plus, Settings2, Trash2, ArrowRight, ArrowLeft, GitMerge, Zap, Save, Code, BellRing, DownloadCloud, UploadCloud, Loader2, CheckCircle2, User, Copy, Database, X, Edit2, ShieldAlert } from 'lucide-react';
import ReactFlow, { Background, Controls, MarkerType, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import Select from 'react-select'; // 🔥 Necesario para Notificaciones Multicast

// 🔥 IMPORTAMOS NUESTRAS NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

const BlueprintCanvas = ({ selectedBlueprint, closeCanvas, moduleId, setHasUnsavedChanges }) => {
  const { notify, confirm } = useNotification(); 

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const [moduleFields, setModuleFields] = useState([]);
  const [moduleSections, setModuleSections] = useState([]); // 🔥 Estado para las secciones
  const [companyUsers, setCompanyUsers] = useState([]);
  const [companyRoles, setCompanyRoles] = useState([]); // 🔥 Estado para roles
  const [companyProfiles, setCompanyProfiles] = useState([]); // 🔥 Estado para perfiles
  
  const [allModules, setAllModules] = useState([]);
  const [allForms, setAllForms] = useState([]);
  const [targetModuleFields, setTargetModuleFields] = useState([]); 

  const [newStatus, setNewStatus] = useState({ name: '', is_initial: false });
  const [selectedElement, setSelectedElement] = useState(null);
  
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  
  // 🔥 ESTADOS PARA PESTAÑAS DEL PANEL LATERAL 🔥
  const [activeTab, setActiveTab] = useState('actions'); // 'actions' o 'validations'

  // 🔥 ESTADOS PARA ACCIONES 🔥
  const [transitionActions, setTransitionActions] = useState([]);
  const [isAddingAction, setIsAddingAction] = useState(false);
  const [editingActionId, setEditingActionId] = useState(null); 
  const [editingValidationId, setEditingValidationId] = useState(null);
  const defaultActionState = { action_type: 'UPDATE_VALUE', target_field: '', action_value: '', function_code: '', action_config: {} };
  const [newAction, setNewAction] = useState(defaultActionState);

  // 🔥 ESTADOS PARA VALIDACIONES 🔥
  const [transitionValidations, setTransitionValidations] = useState([]);
  const [isAddingValidation, setIsAddingValidation] = useState(false);
  const defaultValidationState = { target_field: '', operator: '==', validation_value: '', error_message: '' };
  const [newValidation, setNewValidation] = useState(defaultValidationState);

  const [pendingConnection, setPendingConnection] = useState(null);
  const [newTransitionName, setNewTransitionName] = useState('');

  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  // FIX BUCLE INFINITO
  const selectedElementRef = useRef(selectedElement);
  useEffect(() => {
    selectedElementRef.current = selectedElement;
  }, [selectedElement]);

  const reportChanges = useCallback((hasPendingChanges) => {
      if (setHasUnsavedChanges) {
          setHasUnsavedChanges(hasPendingChanges);
      }
  }, [setHasUnsavedChanges]);

  const isEditingName = selectedElement && renameValue !== selectedElement.data.name;
  const isWritingNewStatus = newStatus.name.trim().length > 0;
  const hasLocalChanges = isEditingName || isWritingNewStatus || isAddingAction || isAddingValidation;

  useEffect(() => { reportChanges(hasLocalChanges); }, [hasLocalChanges, reportChanges]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasLocalChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasLocalChanges]);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 🔥 CARGA DE TODOS LOS CATÁLOGOS NECESARIOS 🔥
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
        
        setModuleFields(fieldsRes.data.filter(f => f.is_active));
        setCompanyUsers(usersRes.data);
        setAllModules(modRes.data);
        setAllForms(formsRes.data);
        setCompanyRoles(rolesRes.data);
        setCompanyProfiles(profilesRes.data);

        // Extraer secciones de los formularios activos de este módulo
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

  useEffect(() => {
     if (newAction.action_type === 'CREATE_RECORD' && newAction.action_config?.module_id) {
         api.get(`/api/v1/fields/?module_id=${newAction.action_config.module_id}`)
            .then(res => setTargetModuleFields(res.data.filter(f => f.is_active)))
            .catch(err => console.error(err));
     } else {
         setTargetModuleFields([]);
     }
  }, [newAction.action_config?.module_id]);

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

  const fetchBlueprintData = useCallback(async () => {
    try {
      const [statusesRes, transRes] = await Promise.all([
        api.get(`/api/v1/statuses/?blueprint_id=${selectedBlueprint.id}`),
        api.get(`/api/v1/transitions/?blueprint_id=${selectedBlueprint.id}`)
      ]);

      const currentDarkMode = document.documentElement.classList.contains('dark');

      setNodes(currentNodes => {
         return statusesRes.data.map((status, index) => {
           const existingNode = currentNodes.find(n => n.id === status.id.toString());
           return {
             id: status.id.toString(),
             data: { 
               label: (
                 <div className="font-bold text-sm text-gray-900 dark:text-gray-100 px-2 py-1">
                   {status.name} {status.is_initial && <Star size={12} className="inline text-yellow-500 fill-yellow-500 mb-1 ml-1"/>}
                 </div>
               ), raw_data: status 
             },
             position: existingNode ? existingNode.position : { x: index * 250 + 50, y: index * 100 + 50 },
             type: 'default',
             style: { border: currentDarkMode ? '2px solid #4b5563' : '2px solid #e5e7eb', borderRadius: '12px', backgroundColor: currentDarkMode ? '#1f2937' : 'white', minWidth: '150px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }
           };
         });
      });

      setEdges(transRes.data.map(t => ({
        id: t.id.toString(), source: t.from_status_id.toString(), target: t.to_status_id.toString(), label: t.name, data: { raw_data: t }, 
        labelStyle: { fill: currentDarkMode ? '#f3f4f6' : '#374151', fontWeight: 800, fontSize: 11, fontFamily: 'monospace' },
        labelBgStyle: { fill: currentDarkMode ? '#374151' : 'white', fillOpacity: 0.9, rx: 4, ry: 4 },
        labelBgPadding: [4, 4],
        markerEnd: { type: MarkerType.ArrowClosed, color: currentDarkMode ? '#60a5fa' : '#2563eb', width: 20, height: 20 },
        style: { stroke: currentDarkMode ? '#60a5fa' : '#2563eb', strokeWidth: 2.5 }, animated: true,
      })));
      
      const currentSelected = selectedElementRef.current;
      if (currentSelected) {
         if (currentSelected.type === 'status') {
             const updatedStatus = statusesRes.data.find(s => s.id === currentSelected.data.id);
             if (updatedStatus) {
                 setSelectedElement({ type: 'status', data: updatedStatus });
                 setRenameValue(updatedStatus.name);
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
  }, [selectedBlueprint.id, notify]); 

  useEffect(() => { fetchBlueprintData(); }, [fetchBlueprintData]);

  useEffect(() => {
    if (nodes.length === 0) return;
    setNodes((currentNodes) => currentNodes.map((node) => ({
        ...node, style: { ...node.style, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '2px solid #4b5563' : '2px solid #e5e7eb' },
    })));
    setEdges((currentEdges) => currentEdges.map((edge) => ({
        ...edge, labelStyle: { fill: isDarkMode ? '#f3f4f6' : '#374151', fontWeight: 800, fontSize: 11, fontFamily: 'monospace' }, labelBgStyle: { fill: isDarkMode ? '#374151' : 'white', fillOpacity: 0.9 }, markerEnd: { type: MarkerType.ArrowClosed, color: isDarkMode ? '#60a5fa' : '#2563eb' }, style: { stroke: isDarkMode ? '#60a5fa' : '#2563eb', strokeWidth: 2.5 },
    })));
  }, [isDarkMode]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onConnect = (connection) => {
    setPendingConnection(connection);
    setNewTransitionName('');
  };

  const handleCreateTransition = async (e) => {
    e.preventDefault();
    if (!newTransitionName.trim() || !pendingConnection) return;
    try {
      await api.post('/api/v1/transitions/', { 
          name: newTransitionName, from_status_id: parseInt(pendingConnection.source), to_status_id: parseInt(pendingConnection.target), blueprint_id: selectedBlueprint.id 
      });
      notify.success("Transición creada exitosamente.");
      setPendingConnection(null); setNewTransitionName(''); fetchBlueprintData();
    } catch (error) { notify.error("Error al crear la transición."); }
  };

  const handleCreateStatus = async (e) => {
    e.preventDefault();
    if (!newStatus.name.trim()) return notify.warning("Escribe un nombre para el estado.");
    try {
      await api.post('/api/v1/statuses/', { ...newStatus, blueprint_id: selectedBlueprint.id });
      notify.success("Nuevo estado agregado al lienzo.");
      setNewStatus({ name: '', is_initial: false }); fetchBlueprintData();
    } catch (error) { notify.error("Error al crear el estado."); }
  };

  const handleRenameElement = async () => {
    if (!selectedElement || !renameValue || renameValue === selectedElement.data.name) return;
    setIsRenaming(true);
    try {
      if (selectedElement.type === 'status') await api.put(`/api/v1/statuses/${selectedElement.data.id}`, { name: renameValue });
      else await api.put(`/api/v1/transitions/${selectedElement.data.id}`, { name: renameValue });
      notify.success("Elemento renombrado.");
      fetchBlueprintData();
    } catch (error) { notify.error("Error al renombrar el elemento."); } finally { setIsRenaming(false); }
  };

  const handleDeleteElement = async () => {
    if (!selectedElement) return;
    const isConfirmed = await confirm({
      title: `Eliminar ${selectedElement.type === 'status' ? 'Estado' : 'Transición'}`,
      message: `¿Estás seguro de que deseas eliminar "${selectedElement.data.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar', variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
      if (selectedElement.type === 'status') await api.delete(`/api/v1/statuses/${selectedElement.data.id}`);
      else await api.delete(`/api/v1/transitions/${selectedElement.data.id}`);
      notify.success(`${selectedElement.type === 'status' ? 'Estado' : 'Transición'} eliminado.`);
      setSelectedElement(null); fetchBlueprintData();
    } catch (error) { notify.error(error.response?.data?.detail || "Error al eliminar el elemento. Revisa sus dependencias."); }
  };

  // 🔥 LÓGICA DE GUARDADO DE ACCIONES 🔥
  const handleSaveAction = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newAction };
      
      if (payload.action_type === 'CHANGE_OWNER') {
          payload.target_field = 'assigned_to';
          // El action_value ya viene seteado (puede ser un ID o "role_x" o "profile_x")
      } else if (payload.action_type === 'COPY_FIELD' || payload.action_type === 'CREATE_RECORD') {
          // Ya seteados
      } else if (payload.action_type === 'SEND_NOTIFICATION') {
          // El action_value es el mensaje, target_field es el título
          // La config viene del Select múltiple
      } else {
          payload.action_value = payload.action_type === 'UPDATE_VALUE' ? payload.action_value : '';
          payload.function_code = payload.action_type === 'CUSTOM_FUNCTION' ? payload.function_code : '';
          payload.action_config = {};
      }

      if (editingActionId) {
         await api.put(`/api/v1/transitions/actions/${editingActionId}`, payload);
         notify.success("Acción actualizada.");
      } else {
         await api.post(`/api/v1/transitions/${selectedElement.data.id}/actions`, payload);
         notify.success("Nueva acción agregada a la transición.");
      }

      closeActionModal();
      loadTransitionDetails(selectedElement.data.id);
    } catch (error) { notify.error("Error al guardar la regla."); }
  };

  // 🔥 LÓGICA DE GUARDADO DE VALIDACIONES 🔥
  const handleSaveValidation = async (e) => {
    e.preventDefault();
    try {
       if (editingValidationId) {
           await api.put(`/api/v1/transitions/validations/${editingValidationId}`, newValidation);
           notify.success("Regla de validación actualizada.");
       } else {
           await api.post(`/api/v1/transitions/${selectedElement.data.id}/validations`, newValidation);
           notify.success("Regla de validación agregada.");
       }
       closeValidationModal();
       loadTransitionDetails(selectedElement.data.id);
    } catch(err) { notify.error("Error al guardar validación."); }
  };

  const handleDeleteValidation = async (id) => {
     try {
        await api.delete(`/api/v1/transitions/validations/${id}`);
        notify.success("Regla de validación eliminada.");
        loadTransitionDetails(selectedElement.data.id);
     } catch(err) { notify.error("Error al eliminar validación."); }
  };

  const openEditActionModal = (action) => {
     setNewAction({
         action_type: action.action_type, target_field: action.target_field || '', action_value: action.action_value || '', function_code: action.function_code || '', action_config: action.action_config || {}
     });
     setEditingActionId(action.id); setIsAddingAction(true);
  };

  const openEditValidationModal = (validation) => {
     setNewValidation({
         target_field: validation.target_field || '', 
         operator: validation.operator || '==', 
         validation_value: validation.validation_value || '', 
         error_message: validation.error_message || ''
     });
     setEditingValidationId(validation.id); 
     setIsAddingValidation(true);
  };

  const handleDeleteAction = async (actionId) => {
    const isConfirmed = await confirm({
      title: 'Eliminar Acción', message: '¿Estás seguro de que deseas eliminar esta automatización?', confirmText: 'Sí, eliminar', variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/api/v1/transitions/actions/${actionId}`);
      notify.success("Acción eliminada.");
      loadTransitionDetails(selectedElement.data.id);
    } catch (error) { notify.error("Error al intentar eliminar la acción."); }
  };

  const closeActionModal = () => { setIsAddingAction(false); setEditingActionId(null); setNewAction(defaultActionState); };
  const closeValidationModal = () => { setIsAddingValidation(false); setEditingValidationId(null); setNewValidation(defaultValidationState); };

  const handleCloseAttempt = async () => {
    if (hasLocalChanges) {
        const isConfirmed = await confirm({
            title: 'Cambios sin guardar', message: 'Tienes cambios en progreso que no se han guardado (nombres, nuevos estados o configuración de acciones). ¿Seguro que deseas descartarlos y salir?', confirmText: 'Descartar y salir', variant: 'danger'
        });
        if (isConfirmed) { reportChanges(false); closeCanvas(); }
    } else { reportChanges(false); closeCanvas(); }
  };

  const handleAddMappingRow = () => {
      const currentConfig = { ...newAction.action_config };
      if (!currentConfig.mapping) currentConfig.mapping = {};
      const mappedKeys = Object.keys(currentConfig.mapping);
      const availableTarget = targetModuleFields.find(f => !mappedKeys.includes(f.api_name || f.label));
      
      if(availableTarget) {
         currentConfig.mapping[availableTarget.api_name || availableTarget.label] = { type: 'static', value: '' };
         setNewAction({ ...newAction, action_config: currentConfig });
      } else { notify.info("Ya mapeaste todos los campos disponibles en el formulario destino."); }
  };

  const handleUpdateMappingRow = (oldTargetKey, newTargetKey, type, value) => {
      const currentConfig = { ...newAction.action_config };
      const map = { ...currentConfig.mapping };
      if (oldTargetKey !== newTargetKey) delete map[oldTargetKey];
      map[newTargetKey] = { type, value };
      currentConfig.mapping = map;
      setNewAction({ ...newAction, action_config: currentConfig });
  };

  const handleRemoveMappingRow = (targetKey) => {
      const currentConfig = { ...newAction.action_config };
      delete currentConfig.mapping[targetKey];
      setNewAction({ ...newAction, action_config: currentConfig });
  };

  const getActionLabel = (type) => {
    const labels = { UPDATE_VALUE: 'Cambiar Valor', CUSTOM_FUNCTION: 'Low-Code', SET_REQUIRED: 'Obligatorio', SET_OPTIONAL: 'Opcional', SET_READONLY: 'Bloquear', SET_EDITABLE: 'Desbloquear', SET_HIDDEN: 'Ocultar', SET_VISIBLE: 'Mostrar', SEND_NOTIFICATION: 'Disparar Alerta', CHANGE_OWNER: 'Cambiar Propietario', COPY_FIELD: 'Copiar Campo', CREATE_RECORD: 'Crear Registro' };
    return labels[type] || type;
  };

  const getActionIcon = (type) => {
     if (type === 'CHANGE_OWNER') return <User size={12} className="text-purple-500"/>;
     if (type === 'COPY_FIELD') return <Copy size={12} className="text-teal-500"/>;
     if (type === 'CREATE_RECORD') return <Database size={12} className="text-emerald-500"/>;
     if (type === 'SEND_NOTIFICATION') return <BellRing size={12} className="text-amber-500"/>;
     if (type === 'CUSTOM_FUNCTION') return <Code size={12} className="text-green-500"/>;
     return <Zap size={12} className="text-blue-500"/>;
  };

  const handleExportBlueprint = async () => {
    try {
       const [sRes, tRes] = await Promise.all([
          api.get(`/api/v1/statuses/?blueprint_id=${selectedBlueprint.id}`),
          api.get(`/api/v1/transitions/?blueprint_id=${selectedBlueprint.id}`)
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
       const a = document.createElement('a'); a.href = url; a.download = `flujo_${selectedBlueprint.name.replace(/\s+/g, '_').toLowerCase()}.json`; a.click(); URL.revokeObjectURL(url);
       notify.success("Exportación completada.");
    } catch(err) { notify.error("Error al exportar el flujo."); }
  };

  // 🔥 Estilos para el MultiSelect de Notificaciones 🔥
  const customSingleSelectStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.75rem', padding: '0.1rem', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black', '&:hover': { borderColor: isDarkMode ? '#4b5563' : '#9ca3af' } }),
    singleValue: (provided) => ({ ...provided, color: isDarkMode ? '#f9fafb' : '#111827' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', zIndex: 99999 }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
  };

  // 🔥 Estilos para el MultiSelect de Notificaciones 🔥
  const customMultiSelectStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.75rem', padding: '0.1rem', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }),
    
    // 🔥 SOLUCIÓN: Forzamos a que el portal del menú flote por encima del modal 🔥
    menuPortal: base => ({ ...base, zIndex: 999999 }), 
    
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
    multiValue: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#374151' : '#eff6ff', borderRadius: '0.5rem' }),
    multiValueLabel: (provided) => ({ ...provided, color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontWeight: 'bold' }),
    multiValueRemove: (provided) => ({ ...provided, color: isDarkMode ? '#9ca3af' : '#6b7280', ':hover': { backgroundColor: isDarkMode ? '#ef4444' : '#fee2e2', color: isDarkMode ? 'white' : '#ef4444' } }),
  };
  // 🔥 Helper para el Multicast: Generar opciones para el Select 🔥
  const notificationOptions = [
    { label: 'Usuarios Específicos', options: companyUsers.map(u => ({ value: `user_${u.id}`, label: `👤 ${u.first_name ? u.first_name + ' ' + (u.last_name || '') : u.email}` })) },
    { label: 'Roles (Jerarquía)', options: companyRoles.map(r => ({ value: `role_${r.id}`, label: `🏢 Rol: ${r.name}` })) },
    { label: 'Perfiles (Permisos)', options: companyProfiles.map(p => ({ value: `profile_${p.id}`, label: `🛡️ Perfil: ${p.name}` })) }
  ];

  // Extraer lo seleccionado del action_config al formato de react-select
  const getSelectedNotificationTargets = () => {
     const cfg = newAction.action_config || {};
     let selected = [];
     if(cfg.notify_users) selected = [...selected, ...cfg.notify_users.map(id => notificationOptions[0].options.find(o => o.value === `user_${id}`))];
     if(cfg.notify_roles) selected = [...selected, ...cfg.notify_roles.map(id => notificationOptions[1].options.find(o => o.value === `role_${id}`))];
     if(cfg.notify_profiles) selected = [...selected, ...cfg.notify_profiles.map(id => notificationOptions[2].options.find(o => o.value === `profile_${id}`))];
     return selected.filter(Boolean);
  };

  const handleNotificationTargetsChange = (selectedOptions) => {
     const cfg = { notify_users: [], notify_roles: [], notify_profiles: [] };
     selectedOptions.forEach(opt => {
        const [type, id] = opt.value.split('_');
        if(type === 'user') cfg.notify_users.push(parseInt(id));
        if(type === 'role') cfg.notify_roles.push(parseInt(id));
        if(type === 'profile') cfg.notify_profiles.push(parseInt(id));
     });
     setNewAction({ ...newAction, action_config: cfg });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-950/50 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
      
      <div className="bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={handleCloseAttempt} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Volver y guardar cambios">
              <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><GitMerge size={18} className="text-blue-500" /> Editor de Flujo: {selectedBlueprint.name}</h2>
            <p className="text-[11px] text-gray-500 font-medium tracking-wide uppercase mt-0.5">Blueprint & Automatizaciones</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border-r border-gray-200 dark:border-gray-700 pr-3 mr-1 gap-2">
             <button onClick={handleExportBlueprint} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Exportar Flujo JSON">
                <DownloadCloud size={18} />
             </button>
             <button disabled className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed rounded-lg" title="Importar (Próximamente)">
                <UploadCloud size={18} />
             </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative z-0">
        <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-10 overflow-y-auto custom-scrollbar shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Plus size={14}/> Nuevo Estado</h3>
               <form onSubmit={handleCreateStatus} className="space-y-4">
                 <div>
                   <input type="text" required value={newStatus.name} onChange={(e) => setNewStatus({...newStatus, name: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="Ej: En Progreso" />
                 </div>
                 <div className="flex items-center gap-2 px-1">
                   <input type="checkbox" checked={newStatus.is_initial} onChange={(e) => setNewStatus({...newStatus, is_initial: e.target.checked})} className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                   <label className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Definir como Estado Inicial</label>
                 </div>
                 <button type="submit" className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg font-bold transition-all shadow-sm">Agregar al Lienzo</button>
               </form>
            </div>

            {selectedElement ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                 <div className="p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Settings2 size={14} /> Propiedades</h3>
                    <div className="flex items-center gap-2">
                       <div className="relative flex-1">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                             {selectedElement.type === 'transition' ? <ArrowRight size={14} className="text-blue-500"/> : <Star size={14} className="text-amber-500"/>}
                          </div>
                          <input 
                             type="text" 
                             value={renameValue} 
                             onChange={(e) => setRenameValue(e.target.value)}
                             onKeyDown={(e) => e.key === 'Enter' && handleRenameElement()}
                             className="w-full pl-9 pr-3 py-2 text-sm font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded-lg outline-none transition-all"
                          />
                       </div>
                       {renameValue !== selectedElement.data.name && (
                          <button onClick={handleRenameElement} disabled={isRenaming} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm disabled:opacity-50">
                             {isRenaming ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                          </button>
                       )}
                    </div>
                 </div>

                 {selectedElement.type === 'transition' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                       {/* 🔥 PESTAÑAS 🔥 */}
                       <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
                          <button onClick={() => setActiveTab('actions')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors ${activeTab === 'actions' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                             <Zap size={14}/> Acciones
                          </button>
                          <button onClick={() => setActiveTab('validations')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-1.5 transition-colors ${activeTab === 'validations' ? 'border-b-2 border-red-500 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                             <ShieldAlert size={14}/> Validaciones
                          </button>
                       </div>

                       {/* CONTENIDO PESTAÑAS */}
                       <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                           
                           {activeTab === 'actions' && (
                              <div className="space-y-4">
                                 {transitionActions.length > 0 ? (
                                   <div className="space-y-2">
                                     {transitionActions.map(action => (
                                       <div key={action.id} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-2.5 rounded-xl flex justify-between items-center shadow-sm group">
                                         <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="p-1.5 bg-white dark:bg-gray-900 rounded shadow-sm shrink-0">
                                               {getActionIcon(action.action_type)}
                                            </div>
                                            <div className="truncate pr-2">
                                               <p className="text-[10px] font-bold text-gray-900 dark:text-gray-100 truncate">{getActionLabel(action.action_type)}</p>
                                               <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                 {action.action_type === 'CREATE_RECORD' ? `Destino: ${allModules.find(m=>m.id==action.action_config?.module_id)?.name || '?'}` : 
                                                  action.action_type === 'CHANGE_OWNER' ? 'Asignación' :
                                                  action.action_type === 'CUSTOM_FUNCTION' ? 'Script Python' : 
                                                  action.action_type === 'COPY_FIELD' ? `${action.action_value} ➔ ${action.target_field}` :
                                                  action.target_field?.startsWith('section_') ? `Sección ID ${action.target_field.replace('section_','')}` : action.target_field}
                                               </p>
                                            </div>
                                         </div>
                                         <div className="flex gap-1 shrink-0">
                                            <button onClick={() => openEditActionModal(action)} className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-500 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDeleteAction(action.id)} className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 size={14} /></button>
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center"><p className="text-[11px] text-gray-400 font-medium">Ninguna acción post-transición.</p></div>
                                 )}
                                 <button onClick={() => setIsAddingAction(true)} className="w-full bg-white dark:bg-gray-900 border border-dashed border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm">
                                   <Plus size={14} /> Añadir Acción
                                 </button>
                              </div>
                           )}

                           {activeTab === 'validations' && (
                              <div className="space-y-4">
                                 {transitionValidations.length > 0 ? (
                                   <div className="space-y-2">
                                     {transitionValidations.map(val => (
                                       <div key={val.id} className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-2.5 rounded-xl flex justify-between items-start shadow-sm group">
                                         <div className="flex flex-col overflow-hidden">
                                            <p className="text-[10px] font-bold text-red-900 dark:text-red-400 mb-0.5 truncate">
                                               Si [{val.target_field}] {val.operator} {val.validation_value ? `"${val.validation_value}"` : ''}
                                            </p>
                                            <p className="text-[9px] text-red-600/80 dark:text-red-300/60 font-medium leading-tight">➔ Desbloquear transición</p>
                                         </div>
                                         <div className="flex gap-1 shrink-0">
                                          <button onClick={() => openEditValidationModal(val)} className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-600 p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-all"><Edit2 size={14} /></button>
                                          <button onClick={() => handleDeleteValidation(val.id)} className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-600 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-all"><Trash2 size={14} /></button>                                       </div>
                                       </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center"><p className="text-[11px] text-gray-400 font-medium">No hay bloqueos. La transición es libre.</p></div>
                                 )}
                                 <button onClick={() => setIsAddingValidation(true)} className="w-full bg-white dark:bg-gray-900 border border-dashed border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm">
                                   <ShieldAlert size={14} /> Añadir Validación
                                 </button>
                              </div>
                           )}

                       </div>
                    </div>
                 )}

                 <div className="p-5 border-t border-gray-100 dark:border-gray-800 shrink-0 mt-auto">
                   <button onClick={handleDeleteElement} className="w-full flex justify-center items-center gap-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">
                     <Trash2 size={16} /> Quitar del Lienzo
                   </button>
                 </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                 <GitMerge size={40} className="mb-4 opacity-20"/>
                 <p className="text-sm font-medium">Selecciona un Estado o una Transición (Flecha) en el lienzo para ver sus propiedades.</p>
              </div>
            )}
        </div>

        <div className="flex-1 relative bg-gray-50/50 dark:bg-gray-950 shadow-inner">
          <ReactFlow 
            nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} 
            onNodeClick={(e,n) => { 
               const statusData = n.data.raw_data;
               setSelectedElement({ type: 'status', data: statusData }); 
               setRenameValue(statusData.name);
               closeActionModal(); closeValidationModal();
            }} 
            onEdgeClick={(e, edge) => { 
               const transData = edge.data.raw_data;
               setSelectedElement({ type: 'transition', data: transData }); 
               setRenameValue(transData.name);
               loadTransitionDetails(transData.id); 
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

      {/* 🔥 MODAL: NOMBRAR NUEVA CONEXIÓN 🔥 */}
      {pendingConnection && createPortal(
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
               <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900 dark:text-white">Conectar Estados</h3>
                  <button onClick={() => setPendingConnection(null)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
               </div>
               <form onSubmit={handleCreateTransition} className="p-6">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nombre de la transición</label>
                  <input 
                     type="text" autoFocus required placeholder="Ej: Aprobar Documento" value={newTransitionName} onChange={e => setNewTransitionName(e.target.value)} 
                     className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all shadow-sm"
                  />
                  <div className="flex justify-end gap-3 mt-6">
                     <button type="button" onClick={() => setPendingConnection(null)} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
                     <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors active:scale-95">Conectar</button>
                  </div>
               </form>
            </div>
         </div>, document.body
      )}

      {/* 🔥 MODAL: NUEVA VALIDACIÓN (BLOQUEO) 🔥 */}
      {isAddingValidation && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-200 dark:border-gray-800">
             <div className="p-5 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center bg-red-50/50 dark:bg-red-900/10">
               <h3 className="font-bold text-red-900 dark:text-red-400 flex items-center gap-2"><ShieldAlert size={18}/> Regla de Validación (Bloqueo)</h3>
               <button onClick={closeValidationModal} className="text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/50 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
             </div>
             <form id="validation-form" onSubmit={handleSaveValidation} className="p-6 space-y-5">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bloquear la transición si el campo...</label>
                   <Select 
                      options={moduleFields.map(f => ({ value: f.api_name || f.label, label: f.label }))}
                      value={newValidation.target_field ? { value: newValidation.target_field, label: moduleFields.find(f => (f.api_name || f.label) === newValidation.target_field)?.label || newValidation.target_field } : null}
                      onChange={(opt) => setNewValidation({...newValidation, target_field: opt.value})}
                      placeholder="Buscar campo..."
                      styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                   />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Condición de Desbloqueo</label>
                      <select required value={newValidation.operator} onChange={e => setNewValidation({...newValidation, operator: e.target.value})} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-red-500 shadow-sm">
                         <option value="IS_EMPTY">Está Vacío</option>
                         <option value="NOT_EMPTY">No está Vacío</option>
                         <option value="==">Es igual a...</option>
                         <option value="!=">Es diferente de...</option>
                         <option value="CONTAINS">Contiene texto...</option>
                         <option value=">">Es mayor a (Numérico)...</option>
                         <option value="<">Es menor a (Numérico)...</option>
                      </select>
                   </div>
                   {!['IS_EMPTY', 'NOT_EMPTY'].includes(newValidation.operator) && (
                      <div className="animate-in fade-in zoom-in-95">
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Valor</label>
                         <input type="text" required placeholder="Ej: Rechazado" value={newValidation.validation_value} onChange={e => setNewValidation({...newValidation, validation_value: e.target.value})} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-red-500 shadow-sm" />
                      </div>
                   )}
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mensaje de Error para el Usuario</label>
                   <textarea rows={2} required placeholder="Ej: No puedes avanzar sin adjuntar el documento de identidad." value={newValidation.error_message} onChange={e => setNewValidation({...newValidation, error_message: e.target.value})} className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-red-500 shadow-sm resize-none custom-scrollbar" />
                </div>
             </form>
             <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
               <button type="button" onClick={closeValidationModal} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
               <button type="submit" form="validation-form" className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95">Guardar Bloqueo</button>
             </div>
          </div>
        </div>, document.body
      )}

      {/* 🔥 MODAL: ACCIONES DE TRANSICIÓN 🔥 */}
      {isAddingAction && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
               <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <Zap size={18} className="text-blue-500 fill-blue-500"/> {editingActionId ? 'Editar Acción' : 'Configurar Nueva Acción'}
               </h3>
               <button onClick={closeActionModal} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>
            
            <form id="action-form" onSubmit={handleSaveAction} className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                <div>
                   <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Tipo de Acción</label>
                   <select value={newAction.action_type} onChange={e => setNewAction({...defaultActionState, action_type: e.target.value})} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm transition-colors">
                     <optgroup label="Súper Acciones">
                        <option value="CHANGE_OWNER">Asignar Registro (Round Robin)</option>
                        <option value="COPY_FIELD">Copiar Valor de Campo</option>
                        <option value="CREATE_RECORD">Crear Registro en otro Módulo</option>
                     </optgroup>
                     <optgroup label="Datos y Lógica">
                        <option value="UPDATE_VALUE">Sobrescribir Valor Fijo</option>
                        <option value="CUSTOM_FUNCTION">Script Low-Code (Python)</option>
                        <option value="SEND_NOTIFICATION">Notificaciones (Multicast)</option>
                     </optgroup>
                     <optgroup label="Reglas de Interfaz (UI)">
                        <option value="SET_REQUIRED">Hacer Campo Obligatorio</option>
                        <option value="SET_OPTIONAL">Quitar Obligatoriedad</option>
                        <option value="SET_READONLY">Bloquear Campo (Solo Lectura)</option>
                        <option value="SET_EDITABLE">Desbloquear Campo</option>
                        <option value="SET_HIDDEN">Ocultar (Campo o Sección)</option>
                        <option value="SET_VISIBLE">Mostrar (Campo o Sección)</option>
                     </optgroup>
                   </select>
                </div>

                {/* 🔥 ROUND ROBIN Y ASIGNACIONES 🔥 */}
                {newAction.action_type === 'CHANGE_OWNER' && (
                   <div className="animate-in fade-in duration-200 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-5 rounded-xl">
                      <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-2 flex items-center gap-1.5"><User size={14}/> Destino de Asignación</label>
                      <Select 
                         options={[
                            { label: 'Usuarios', options: companyUsers.map(u => ({ value: u.id.toString(), label: ` ${u.first_name ? u.first_name + ' ' + (u.last_name || '') : u.email}` })) },
                            { label: 'Roles (Round Robin)', options: companyRoles.map(r => ({ value: `role_${r.id}`, label: ` Rol: ${r.name}` })) },
                            { label: 'Perfiles (Round Robin)', options: companyProfiles.map(p => ({ value: `profile_${p.id}`, label: ` Perfil: ${p.name}` })) }
                         ]}
                         value={newAction.action_value ? { value: newAction.action_value, label: newAction.action_value } : null} // React-select es flexible si le pasas un objecto
                         onChange={(opt) => setNewAction({...newAction, action_value: opt.value})}
                         placeholder="Buscar destinatario..."
                         styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                      />
                      <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-2 italic">Si eliges Rol o Perfil, el sistema asignará los casos equitativamente uno a uno a los miembros del grupo.</p>
                   </div>
                )}

                {/* 🔥 NOTIFICACIONES MULTICAST 🔥 */}
                {newAction.action_type === 'SEND_NOTIFICATION' && (
                   <div className="animate-in fade-in duration-200 space-y-4">
                     <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-5 rounded-xl">
                        <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-2 flex items-center gap-1.5"><BellRing size={14}/> Destinatarios (Multicast)</label>
                        <Select 
                           isMulti 
                           options={notificationOptions} 
                           value={getSelectedNotificationTargets()} 
                           onChange={handleNotificationTargetsChange} 
                           placeholder="Buscar usuarios, roles o perfiles..." 
                           styles={customMultiSelectStyles} 
                           menuPortalTarget={document.body} 
                           menuPosition={'fixed'} 
                           menuShouldScrollIntoView={false}
                        />
                        <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 mt-2 italic">Si no seleccionas a nadie, se notificará únicamente al creador del registro.</p>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Título de la Alerta</label>
                       <input type="text" placeholder="Ej: Aprobado por Gerencia" required value={newAction.target_field} onChange={e => setNewAction({...newAction, target_field: e.target.value})} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mensaje (Opcional)</label>
                       <textarea rows={2} placeholder="Ej: Ya puedes continuar con el proceso." value={newAction.action_value} onChange={e => setNewAction({...newAction, action_value: e.target.value})} className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm resize-none custom-scrollbar" />
                     </div>
                   </div>
                )}

                {/* 🔥 CONTROL DE UI (INCLUYE SECCIONES) 🔥 */}
                {['UPDATE_VALUE', 'SET_REQUIRED', 'SET_OPTIONAL', 'SET_READONLY', 'SET_EDITABLE', 'SET_HIDDEN', 'SET_VISIBLE'].includes(newAction.action_type) && (
                   <div className="animate-in fade-in duration-200">
                     <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">¿A qué elemento de este registro aplica?</label>
                     <Select 
                        options={(() => {
                           let opts = [];
                           if (['SET_HIDDEN', 'SET_VISIBLE'].includes(newAction.action_type) && moduleSections.length > 0) {
                              opts.push({ label: 'Secciones Completas', options: moduleSections.map(s => ({ value: `section_${s.id}`, label: `🗂️ Sección: ${s.title}` })) });
                           }
                           opts.push({ label: 'Campos Individuales', options: moduleFields.map(f => ({ value: f.api_name || f.label, label: `📝 Campo: ${f.label}` })) });
                           return opts;
                        })()}
                        value={newAction.target_field ? { value: newAction.target_field, label: newAction.target_field.startsWith('section_') ? `Sección ID ${newAction.target_field.split('_')[1]}` : newAction.target_field } : null}
                        onChange={(opt) => setNewAction({...newAction, target_field: opt.value})}
                        placeholder="Buscar campo o sección..."
                        styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                     />
                   </div>
                )}

                {/* RESTO DE ACCIONES (Copiar, Crear Registro, Low Code) SE MANTIENE IGUAL */}
                {newAction.action_type === 'COPY_FIELD' && (
                   <div className="animate-in fade-in duration-200 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                      <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Copiar Desde (Origen)</label>
                         <Select 
                            options={moduleFields.map(f => ({ value: f.api_name || f.label, label: f.label }))}
                            value={newAction.action_value ? { value: newAction.action_value, label: moduleFields.find(f => (f.api_name || f.label) === newAction.action_value)?.label } : null}
                            onChange={(opt) => setNewAction({...newAction, action_value: opt.value})}
                            placeholder="Buscar Origen..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                         />
                      </div>
                      <div className="flex justify-center text-gray-400 mt-6 sm:mt-0"><ArrowRight size={24} className="rotate-90 sm:rotate-0"/></div>
                      <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Pegar En (Destino)</label>
                         <Select 
                            options={moduleFields.map(f => ({ value: f.api_name || f.label, label: f.label }))}
                            value={newAction.target_field ? { value: newAction.target_field, label: moduleFields.find(f => (f.api_name || f.label) === newAction.target_field)?.label } : null}
                            onChange={(opt) => setNewAction({...newAction, target_field: opt.value})}
                            placeholder="Buscar Destino..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                         />
                      </div>
                   </div>
                )}

                {newAction.action_type === 'CREATE_RECORD' && (
                   <div className="animate-in fade-in duration-200 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase mb-2 flex items-center gap-1.5"><Database size={14}/> Módulo Destino</label>
                           <Select 
                              options={allModules.filter(m => m.id !== moduleId).map(m => ({ value: m.id, label: m.name }))}
                              value={newAction.action_config?.module_id ? { value: newAction.action_config.module_id, label: allModules.find(m => m.id === parseInt(newAction.action_config.module_id))?.name } : null}
                              onChange={(opt) => setNewAction({...newAction, action_config: { module_id: opt.value, form_id: '', mapping: {} }})}
                              placeholder="Buscar módulo..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                           />
                        </div>
                        {newAction.action_config?.module_id && (
                           <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Formulario a usar</label>
                              <Select 
                                 options={allForms.filter(f => f.module_id == newAction.action_config.module_id).map(form => ({ value: form.id, label: form.name }))}
                                 value={newAction.action_config?.form_id ? { value: newAction.action_config.form_id, label: allForms.find(f => f.id === parseInt(newAction.action_config.form_id))?.name } : null}
                                 onChange={(opt) => setNewAction({...newAction, action_config: { ...newAction.action_config, form_id: opt.value }})}
                                 placeholder="Buscar Formulario..." styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable
                              />
                           </div>
                        )}
                      </div>

                      {newAction.action_config?.form_id && targetModuleFields.length > 0 && (
                         <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                               <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2"><Copy size={16}/> Mapeo de Campos</label>
                               <button type="button" onClick={handleAddMappingRow} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"><Plus size={14}/> Añadir Campo</button>
                            </div>
                            
                            <div className="space-y-3">
                               {Object.keys(newAction.action_config.mapping || {}).length === 0 && <p className="text-sm text-gray-400 italic text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">No hay campos mapeados. El registro se creará vacío.</p>}
                               {Object.entries(newAction.action_config.mapping || {}).map(([targetKey, configData]) => (
                                  <div key={targetKey} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm group">
                                     <select value={targetKey} onChange={e => handleUpdateMappingRow(targetKey, e.target.value, configData.type, configData.value)} className="w-full text-sm font-semibold bg-transparent border-b border-gray-300 dark:border-gray-600 outline-none text-gray-900 dark:text-white pb-1 focus:border-blue-500">
                                        {targetModuleFields.map(f => <option key={f.id} value={f.api_name || f.label}>{f.label}</option>)}
                                     </select>
                                     <div className="hidden sm:flex text-gray-400"><ArrowLeft size={16}/></div>
                                     <div className="flex items-center gap-2">
                                        <select value={configData.type} onChange={e => handleUpdateMappingRow(targetKey, targetKey, e.target.value, '')} className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 outline-none text-gray-700 dark:text-gray-300 font-medium">
                                           <option value="static">Fijo</option>
                                           <option value="dynamic">Dinámico</option>
                                        </select>
                                        {configData.type === 'static' ? (
                                           <input type="text" placeholder="Escribe un valor..." value={configData.value} onChange={e => handleUpdateMappingRow(targetKey, targetKey, 'static', e.target.value)} className="flex-1 text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 outline-none text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500" />
                                        ) : (
                                           <select value={configData.value} onChange={e => handleUpdateMappingRow(targetKey, targetKey, 'dynamic', e.target.value)} className="flex-1 text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 outline-none text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500">
                                              <option value="">Copiar desde campo actual...</option>
                                              {moduleFields.map(f => <option key={`map-src-${f.id}`} value={f.api_name || f.label}>{f.label}</option>)}
                                           </select>
                                        )}
                                     </div>
                                     <button type="button" onClick={() => handleRemoveMappingRow(targetKey)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                  </div>
                               ))}
                            </div>
                         </div>
                      )}
                   </div>
                )}

                {newAction.action_type === 'UPDATE_VALUE' && (
                   <div className="animate-in fade-in duration-200">
                     <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Nuevo Valor (Puedes usar {'{NOW}'} para la fecha actual)</label>
                     <input type="text" required placeholder="Ej: Aprobado, o {NOW}" value={newAction.action_value} onChange={e => setNewAction({...newAction, action_value: e.target.value})} className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm" />
                   </div>
                )}

                {newAction.action_type === 'CUSTOM_FUNCTION' && (
                   <div className="animate-in fade-in duration-200">
                     <label className="block text-xs font-bold text-green-600 dark:text-green-500 uppercase mb-2 flex items-center gap-1.5"><Code size={14}/> Script en Python</label>
                     <textarea required rows={6} placeholder='case["data"]["prioridad"] = "Alta"' value={newAction.function_code} onChange={e => setNewAction({...newAction, function_code: e.target.value})} className="w-full px-4 py-3 bg-gray-900 text-green-400 font-mono text-sm border border-gray-800 rounded-xl outline-none focus:border-green-500 shadow-inner resize-y custom-scrollbar" />
                   </div>
                )}
            </form>
            
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex justify-end gap-3">
               <button type="button" onClick={closeActionModal} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
               <button type="submit" form="action-form" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2"><Save size={16}/> Guardar Regla</button>
            </div>
          </div>
        </div>, document.body
      )}

    </div>
  );
};

export default BlueprintCanvas;