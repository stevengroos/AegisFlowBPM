import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Clock, CheckCircle, Activity, FileText, ArrowRight, Edit2, Save, Loader2, Trash2, Lock, Link as LinkIcon, Users, History, Link2, LayoutGrid, MessageSquare, AlertTriangle, PenTool, Plus, X, UploadCloud, Download, MapPin, Calculator, MessageCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
// 🔥 Importaciones Arquitectura Limpia 🔥
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/ui/SearchableSelect';
import FileUploadField from '../components/ui/FileUploadField';
import SubformTable from '../features/cases/SubformTable';
import ExportPdfButton from '../components/ExportPdfButton';
import CaseComments from '../features/cases/CaseComments';
import CaseExternalChat from '../features/cases/CaseExternalChat';

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify, confirm } = useNotification();
  const [linkedCases, setLinkedCases] = useState({});
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [caseData, setCaseData] = useState(null);
  const [history, setHistory] = useState([]);
  const [fields, setFields] = useState([]);
  const [sections, setSections] = useState([]); 
  const [statuses, setStatuses] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [blueprints, setBlueprints] = useState([]); 
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('details'); 
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [relationData, setRelationData] = useState({});

  const [companyUsers, setCompanyUsers] = useState([]);
  const [companyRoles, setCompanyRoles] = useState([]); 
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [userData, setUserData] = useState(null);
  const [hasSignaturit, setHasSignaturit] = useState(false); // 🔥 NUEVO ESTADO
  const [signaturesList, setSignaturesList] = useState([]); // 🔥 NUEVO ESTADO PARA EL HISTORIAL DE FIRMAS
  const [isModulePublished, setIsModulePublished] = useState(false);

  const fetchAllData = async (signal) => {
    try {
      setLoading(true);
      const userRes = await api.get('/api/v1/users/me', { signal });
      setUserData(userRes.data);

      const caseRes = await api.get(`/api/v1/cases/${id}`, { signal });
      const currentCase = caseRes.data;
      const moduleId = currentCase.module_id; 

      // 🔥 VERIFICAR SI EL MÓDULO TIENE CHAT B2C (CATÁLOGO O COMPRAS) 🔥
      try {
        // Consultamos la info del módulo y la configuración global de la App al mismo tiempo
        const [moduleRes, settingsRes] = await Promise.all([
          api.get(`/api/v1/modules/${moduleId}`, { signal }),
          api.get(`/api/v1/mobile/settings/mobile`, { signal }).catch(() => ({ data: {} }))
        ]);
        
        const isPublished = moduleRes.data?.mobile_config?.is_published === true;
        // Verificamos si este módulo es el que elegimos en Settings para guardar los pedidos
        const isPurchasesModule = String(settingsRes.data?.purchases_module_id) === String(moduleId);
        
        // Habilitamos el chat si es un catálogo público O si es la bandeja de compras B2C
        setIsModulePublished(isPublished || isPurchasesModule);
      } catch (err) {
        console.error("No se pudo verificar configuración B2C");
      }

      // 🔥 Consultamos si Signaturit está activo
      const sigPromise = api.get(`/api/v1/modules/${moduleId}/integrations/signaturit`, { signal }).catch(() => ({ data: { is_active: false, has_token: false } }));
      // 🔥 Traemos el historial de firmas del registro
      const sigListPromise = api.get(`/api/v1/cases/${id}/signatures`, { signal }).catch(() => ({ data: [] }));

      const [fieldsRes, secRes, statusRes, transRes, blueprintsRes, usersRes, rolesRes, sigRes, sigListRes] = await Promise.all([
        api.get(`/api/v1/fields/?module_id=${moduleId}`, { signal }),
        api.get(`/api/v1/fields/sections?form_id=${currentCase.form_id}`, { signal }),
        api.get('/api/v1/statuses/', { signal }),
        api.get('/api/v1/transitions/', { signal }),
        api.get('/api/v1/blueprints/', { signal }),
        api.get('/api/v1/auth/users', { signal }),
        api.get('/api/v1/security/roles', { signal }),
        sigPromise,
        sigListPromise
      ]);

      let fetchedHistory = [];
      try {
        const historyRes = await api.get(`/api/v1/cases/${id}/history`, { signal });
        fetchedHistory = historyRes.data;
      } catch (hError) {
         if (hError.name !== 'CanceledError') console.error("No se pudo cargar historial");
      }

      const fetchedFields = fieldsRes.data;
      const relData = {};
      
      const loadTargetModuleData = async (targetModuleId) => {
         if (relData[targetModuleId]) return;
         try {
            const [recRes, tFieldsRes] = await Promise.all([
              api.get(`/api/v1/cases/?module_id=${targetModuleId}`, { signal }),
              api.get(`/api/v1/fields/?module_id=${targetModuleId}`, { signal })
            ]);
            const targetFields = tFieldsRes.data;
            const primaryField = targetFields.find(tf => tf.is_primary);
            const primaryKey = primaryField ? (primaryField.api_name || primaryField.label) : null;

            relData[targetModuleId] = recRes.data.map(rec => {
               let displayLabel = `Registro #${rec.id}`; 
               if (primaryKey && rec.data[primaryKey]) displayLabel = `ID: ${rec.id} - ${rec.data[primaryKey]}`;
               return { value: rec.id, label: `${displayLabel} ${rec.status?.name ? `(${rec.status.name})` : ''}` };
            });
         } catch (err) { relData[targetModuleId] = []; }
      };

      // Cargamos relaciones secuencialmente para no saturar
      for (const f of fetchedFields) {
        if (f.field_type === 'relation' && f.options?.target_module_id) {
           await loadTargetModuleData(f.options.target_module_id);
        }
        if (f.field_type === 'subform' && f.subform_config) {
           for (const subCol of f.subform_config) {
              if (subCol.type === 'relation' && subCol.target_module_id) {
                 await loadTargetModuleData(subCol.target_module_id);
              }
           }
        }
      }

      setCaseData(currentCase);
      setHistory(fetchedHistory);
      setFields(fetchedFields);
      setSections(secRes.data);
      setStatuses(statusRes.data);
      setTransitions(transRes.data);
      setBlueprints(blueprintsRes.data);
      setCompanyUsers(usersRes.data);
      setCompanyRoles(rolesRes.data);
      setRelationData(relData);
      setHasSignaturit(sigRes.data?.is_active && sigRes.data?.has_token);
      setSignaturesList(sigListRes.data || []);
      // BÚSQUEDA INVERSA DE REGISTROS RELACIONADOS 
      try {
         setLoadingLinked(true);
         const linkedRes = await api.get(`/api/v1/cases/${id}/linked`, { signal });
         setLinkedCases(linkedRes.data || {});
      } catch (err) {
         if (err.name !== 'CanceledError') console.error("Error al cargar vinculados");
      } finally {
         setLoadingLinked(false);
      }
    } catch (error) {
      if (error.name !== 'CanceledError') {
        console.error("🔥 EL CULPABLE ES:", error); // Lo movimos aquí adentro
        
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
           notify.error("Acceso denegado o registro no encontrado.");
           navigate('/dashboard');
        } else {
           notify.error("Error de conexión al cargar el registro.");
           navigate('/dashboard');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔥 ESTADOS PARA SIGNATURIT (FASE 3) 🔥
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signaturitTemplates, setSignaturitTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sendingSignature, setSendingSignature] = useState(false);
  const [sigConfig, setSigConfig] = useState({
     sourceType: 'template', // 'template' o 'file'
     templateId: '',
     file: null,
     signatureType: 'advanced', // 'advanced' o 'simple'
     deliveryType: 'email', // 'email' o 'url'
     signers: [{ name: '', email: '' }]
  });

  const handleOpenSignatureModal = async () => {
    setIsSignatureModalOpen(true);
    setLoadingTemplates(true);
    try {
      const res = await api.get(`/api/v1/modules/${caseData.module_id}/integrations/signaturit/templates`);
      setSignaturitTemplates(res.data || []);
      // Pre-llenar firmante si ya hay datos en el caso (Opcional, busca correos)
      const foundEmail = Object.values(caseData.data).find(v => typeof v === 'string' && v.includes('@'));
      if (foundEmail) setSigConfig(prev => ({...prev, signers: [{name: 'Cliente', email: foundEmail}]}));
    } catch (e) {
      notify.error("No se pudieron cargar las plantillas. Verifica la integración.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleRemindSignature = async (signatureId) => {
    try {
      await api.post(`/api/v1/cases/${id}/signatures/${signatureId}/remind`);
      notify.success("Recordatorio enviado al cliente.");
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al enviar recordatorio.");
    }
  };

  const handleDownloadSignedDocument = async (signatureId) => {
    try {
      notify.success("Iniciando descarga segura...");
      const response = await api.get(`/api/v1/cases/${id}/signatures/${signatureId}/download`, {
        responseType: 'blob' // ¡Súper importante para descargar archivos!
      });
      
      // Magia del navegador para forzar la descarga del archivo
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Contrato_Firmado_${signatureId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
    } catch (error) {
      notify.error("Error al descargar el documento firmado.");
    }
  };

  const handleCancelSignature = async (signatureId) => {
    const isConfirmed = await confirm({
      title: 'Cancelar Envío de Firma',
      message: '¿Estás seguro? El cliente ya no podrá firmar este documento y se invalidará el enlace.',
      confirmText: 'Sí, cancelar envío',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.post(`/api/v1/cases/${id}/signatures/${signatureId}/cancel`);
      notify.success("El envío ha sido cancelado.");
      // Recargamos los datos para que el estado se actualice visualmente
      fetchAllData(new AbortController().signal); 
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al cancelar.");
    }
  };

  const handleSendToSignaturit = async (e) => {
    e.preventDefault();
    if (sigConfig.sourceType === 'template' && !sigConfig.templateId) return notify.warning("Selecciona una plantilla.");
    if (sigConfig.sourceType === 'file' && !sigConfig.file) return notify.warning("Sube un documento PDF.");
    for (let s of sigConfig.signers) {
      if (!s.name || !s.email) return notify.warning("Completa el nombre y correo de todos los firmantes.");
    }

    setSendingSignature(true);
    try {
      const formData = new FormData();
      formData.append('delivery_type', sigConfig.deliveryType);
      formData.append('signature_type', sigConfig.signatureType);
      formData.append('signers', JSON.stringify(sigConfig.signers));

      if (sigConfig.sourceType === 'template') {
        formData.append('template_id', sigConfig.templateId);
      } else {
        formData.append('file', sigConfig.file);
      }

      const res = await api.post(`/api/v1/cases/${id}/signaturit/send`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      
      setIsSignatureModalOpen(false);
      
      // MAGIA "FIRMAR YO": Abrir la pestaña si se seleccionó URL
      if (sigConfig.deliveryType === 'url' && res.data.signature_url) {
         notify.success("¡Documento listo! Redirigiendo a la sala de firmas...");
         window.open(res.data.signature_url, '_blank');
      } else {
         notify.success("¡Documento enviado a firmar por correo exitosamente!");
      }
      
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al enviar a firma.");
    } finally {
      setSendingSignature(false);
    }
  };

  useEffect(() => { 
    // 🔥 FIX: Resetear la pestaña y el modo edición al navegar a un nuevo caso
    setActiveTab('details');
    setIsEditing(false);
    
    const controller = new AbortController();
    fetchAllData(controller.signal); 
    return () => controller.abort();
  }, [id]);

  const handleStatusChange = async (newStatusId) => {
    try {
      await api.put(`/api/v1/cases/${id}/status`, { new_status_id: newStatusId });
      notify.success("Estado actualizado.");
      await fetchAllData(new AbortController().signal); 
    } catch (error) { 
      notify.error(error.response?.data?.detail || "No se cumplen las reglas para avanzar este estado."); 
    }
  };

  const handleEditClick = () => {
    setEditFormData(caseData.data || {});
    setEditAssignedTo(caseData.assigned_to || ''); 
    setIsEditing(true);
    setActiveTab('details'); 
  };

  const handleCancelEdit = () => {
    setEditFormData({});
    setEditAssignedTo('');
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/api/v1/cases/${id}`, { 
        data: editFormData,
        assigned_to: editAssignedTo ? parseInt(editAssignedTo) : null 
      });
      notify.success("Registro guardado con éxito.");
      setIsEditing(false);
      await fetchAllData(new AbortController().signal); 
    } catch (error) { 
      notify.error("Error al guardar los cambios. Verifica los campos requeridos."); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleDeleteCase = async () => {
    const isConfirmed = await confirm({
      title: 'Eliminar Registro',
      message: '¿Estás seguro de mover este registro a la papelera? Podrás recuperarlo más tarde.',
      confirmText: 'Sí, enviar a papelera',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try { 
      await api.delete(`/api/v1/cases/${id}`); 
      notify.success("Registro movido a la papelera.");
      navigate(`/modules/${caseData.module_id}`); 
    } catch (error) {
      notify.error("Error al eliminar el registro.");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500"><Loader2 className="animate-spin mr-2" size={40} /></div>;
  if (!caseData || !userData) return null;

  const currentStatusObj = statuses.find(s => s.id === caseData.status_id);
  const currentStatusName = currentStatusObj ? currentStatusObj.name : caseData.status_id;
  const availableTransitions = transitions.filter(t => t.from_status_id === caseData.status_id);
  const isFlowActive = caseData.status_id && availableTransitions.length > 0;
  
  let activeTriggerField = null;
  if (currentStatusObj && currentStatusObj.blueprint_id) {
    const activeBp = blueprints.find(bp => bp.id === currentStatusObj.blueprint_id);
    if (activeBp && activeBp.trigger_field) activeTriggerField = activeBp.trigger_field;
  }

  const formFields = fields.filter(f => f.form_id === caseData.form_id).sort((a,b) => a.order - b.order);
  const currentOwner = companyUsers.find(u => u.id === caseData.assigned_to);
  const ownerName = currentOwner ? (currentOwner.first_name ? `${currentOwner.first_name} ${currentOwner.last_name || ''}` : currentOwner.email) : 'Sin asignar';

  // ==========================================
  // 🔥 FASE 2: CALCULADORA DE SLA 🔥
  // ==========================================
  const getSlaStatus = () => {
     if (!caseData || !caseData.status_id) return null;
     // Aquí usamos 'statuses' que es el estado local de este componente
     const status = statuses.find(s => s.id === caseData.status_id);
     if (!status || !status.sla_hours) return null; 

     const startTime = new Date(caseData.entered_status_at || caseData.created_at);
     const deadline = new Date(startTime.getTime() + (status.sla_hours * 60 * 60 * 1000));
     const now = new Date();

     const timeRemaining = deadline - now;
     const hoursRemaining = timeRemaining / (1000 * 60 * 60);

     if (timeRemaining < 0) return { state: 'breached', label: 'SLA Vencido', hours: Math.abs(hoursRemaining).toFixed(1) };
     if (hoursRemaining <= (status.sla_hours * 0.2)) return { state: 'warning', label: 'Por vencer', hours: hoursRemaining.toFixed(1) };
     
     return { state: 'good', label: 'A tiempo', hours: hoursRemaining.toFixed(1) };
  };

  // ==========================================
  // 🔥 LÓGICA ZERO TRUST (RBAC) 🔥
  // ==========================================
  let canEdit = userData.is_superadmin;
  let canDelete = userData.is_superadmin;

  if (!userData.is_superadmin && userData.permissions) {
    const modPerms = userData.permissions.modules?.[caseData.module_id] || {};
    const targetUserId = caseData.assigned_to || caseData.created_by;
    const isOwner = (userData.id === caseData.created_by) || (userData.id === caseData.assigned_to);
    
    const myUser = companyUsers.find(u => u.id === userData.id);
    const targetUser = companyUsers.find(u => u.id === targetUserId);
    const myRole = myUser ? companyRoles.find(r => r.id === myUser.role_id) : null;
    const targetRole = targetUser ? companyRoles.find(r => r.id === targetUser.role_id) : null;
    
    const myRank = myRole ? myRole.rank : null;
    const targetRank = targetRole ? targetRole.rank : null;

    let isSameRank = false; let isSubordinate = false;
    if (myRank !== null && targetRank !== null) {
        if (myRank === targetRank && !isOwner) isSameRank = true;
        if (myRank < targetRank) isSubordinate = true;
    }
    
    if (isOwner && modPerms.edit_own) canEdit = true;
    else if (isSameRank && modPerms.edit_same_rank) canEdit = true;
    else if (isSubordinate && modPerms.edit_subordinates) canEdit = true;

    if (isOwner && modPerms.delete_own) canDelete = true;
    else if (isSameRank && modPerms.delete_same_rank) canDelete = true;
    else if (isSubordinate && modPerms.delete_subordinates) canDelete = true;
  }
  
  const showTransitions = canEdit && availableTransitions.length > 0;

  const calculateVisualFormula = (formulaStr, currentData) => {
      if (!formulaStr) return '';
      try {
          let expr = formulaStr;
          const vars = expr.match(/\[(.*?)\]/g) || [];
          vars.forEach(v => {
              const key = v.replace('[', '').replace(']', '');
              const val = currentData[key] || 0;
              expr = expr.replace(v, val);
          });
          // eslint-disable-next-line no-eval
          const result = eval(expr);
          return isNaN(result) ? '...' : Number(result).toFixed(2);
      } catch (e) { return '...'; }
  };

  // Renderizador Dinámico de Campos
  const renderField = (field) => {
    const fieldKey = field.api_name || field.label; 
    const uiRules = caseData.ui_rules?.[fieldKey] || {};
    if (uiRules.hidden) return null;

    const isRequired = uiRules.required !== undefined ? uiRules.required : field.required;
    let isReadOnly = uiRules.readonly === true;
    let isTriggerLock = false;
    if (isFlowActive && fieldKey === activeTriggerField) { isReadOnly = true; isTriggerLock = true; }

    const value = isEditing ? editFormData[fieldKey] : caseData.data[fieldKey];
    const isFullWidth = field.field_type === 'textarea' || field.field_type === 'subform';

    // MODO LECTURA
    if (!isEditing) {
      return (
        <div key={field.id} className={`flex flex-col gap-1.5 border-b border-gray-100 dark:border-gray-800/60 pb-3 ${isFullWidth ? 'col-span-full' : ''}`}>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            {field.field_type === 'relation' && <LinkIcon size={12} className="text-blue-500" />} {field.label}
          </span>
          {field.field_type === 'file' || field.field_type === 'image' ? (
             <FileUploadField type={field.field_type} value={value || ''} onChange={() => {}} disabled={true} />
          ) : field.field_type === 'relation' && value ? (
             <button onClick={() => navigate(`/cases/${value}`)} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline text-left flex items-center gap-1.5"><LinkIcon size={14}/> Ir al Registro vinculado</button>
          
          
          ) : field.field_type === 'user_relation' && value ? (
             <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
               <Users size={14}/> 
               {(() => {
                  const u = companyUsers.find(user => String(user.id) === String(value));
                  return u ? (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email) : `Usuario ID: ${value}`;
               })()}
             </span>

          ) : field.field_type === 'url' && value ? (
             <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"><Link2 size={14}/> {value}</a>
          ) : field.field_type === 'map' && value ? (
             <a href={`https://www.google.com/maps/search/?api=1&query=${value}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1.5"><MapPin size={14}/> Ver en Google Maps ({value})</a>
          ) : field.field_type === 'formula' ? (
             <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><Calculator size={14}/> {value !== undefined ? value : '--'}</span>
          ) : field.field_type === 'subform' ? (
             <SubformTable field={field} value={value || []} relationData={relationData} isEditing={false} />
          ) : (
             <span className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
               {value !== undefined && value !== "" && value !== false ? String(value) : <span className="text-gray-400 dark:text-gray-600 italic">--</span>}
             </span>
          )}
        </div>
      );
    }

    // MODO EDICIÓN
    const inputClasses = `w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none text-sm text-gray-900 dark:text-white ${isReadOnly ? 'opacity-60 cursor-not-allowed border-transparent px-0 bg-transparent font-medium' : 'focus:ring-2 focus:ring-blue-500 hover:border-blue-400'}`;

    return (
      <div key={field.id} className={`flex flex-col gap-1.5 ${isFullWidth ? 'col-span-full' : ''}`}>
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          {field.field_type === 'relation' && <LinkIcon size={12} className="text-blue-500" />} 
          {field.label} 
          {isRequired && !isReadOnly && <span className="text-red-500">*</span>}
          {isReadOnly && <Lock size={12} className={isTriggerLock ? "text-amber-500 ml-auto" : "text-gray-400 ml-auto"} />}
        </label>
        
        {field.field_type === 'select' ? <select required={isRequired} disabled={isReadOnly} value={value || ''} onChange={(e) => setEditFormData({...editFormData, [fieldKey]: e.target.value})} className={inputClasses}><option value="">Seleccione...</option>{field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}</select> 
        
        : field.field_type === 'relation' ? <SearchableSelect placeholder="Buscar registro..." value={value || ''} onChange={(val) => setEditFormData({...editFormData, [fieldKey]: val})} disabled={isReadOnly} options={relationData[field.options?.target_module_id] || []} /> 
        
        /* 🔥 NUEVO: EDICIÓN DE RELACIÓN CON USUARIOS 🔥 */
        : field.field_type === 'user_relation' ? (
          <SearchableSelect 
             placeholder="Buscar usuario..." 
             value={value || ''} 
             onChange={(val) => setEditFormData({...editFormData, [fieldKey]: val})} 
             disabled={isReadOnly} 
             options={(() => {
                let filtered = companyUsers;
                const rId = field.options?.role_id;
                const pId = field.options?.profile_id;
                if (rId) filtered = filtered.filter(u => String(u.role_id) === String(rId));
                if (pId) filtered = filtered.filter(u => String(u.profile_id) === String(pId));
                return filtered.map(u => ({ value: u.id, label: u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email }));
             })()} 
          />
        )

        : field.field_type === 'textarea' ? <textarea required={isRequired} disabled={isReadOnly} value={value || ''} onChange={(e) => setEditFormData({...editFormData, [fieldKey]: e.target.value})} rows={3} className={inputClasses} />
        : field.field_type === 'checkbox' ? <input type="checkbox" disabled={isReadOnly} checked={value || false} onChange={(e) => setEditFormData({...editFormData, [fieldKey]: e.target.checked})} className={`w-5 h-5 rounded text-blue-600 focus:ring-blue-500 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} /> 
        
        /* 🔥 AQUÍ ESTÁN TUS DOS CAMPOS NUEVOS 🔥 */
        : field.field_type === 'map' ? (
          <div className="flex gap-2">
             <input type="text" required={isRequired} disabled={isReadOnly} value={value || ''} onChange={(e) => setEditFormData({...editFormData, [fieldKey]: e.target.value})} className={inputClasses} placeholder="Latitud, Longitud" />
             <button type="button" disabled={isReadOnly} onClick={() => {
                 if (navigator.geolocation) {
                     navigator.geolocation.getCurrentPosition((pos) => {
                         setEditFormData({...editFormData, [fieldKey]: `${pos.coords.latitude}, ${pos.coords.longitude}`});
                     });
                 }
             }} className="p-2.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl disabled:opacity-50 border border-red-100 shrink-0 transition-colors"><MapPin size={20}/></button>
          </div>
        ) : field.field_type === 'formula' ? (
          <div className="relative">
             <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
             <input type="text" disabled value={calculateVisualFormula(field.options, editFormData)} className={`${inputClasses} pl-9 bg-emerald-50/30 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-200 dark:border-emerald-800/50 cursor-not-allowed`} placeholder="Calculado automáticamente" />
          </div>
        )
        
        : field.field_type === 'file' || field.field_type === 'image' ? (
             <FileUploadField 
                type={field.field_type} 
                value={value || ''} 
                onChange={(url) => setEditFormData({...editFormData, [fieldKey]: url})} 
                disabled={isReadOnly}
                expectedFields={formFields.filter(f => !['file', 'image', 'subform', 'url'].includes(f.field_type)).map(f => f.api_name || f.label)}
                onDataExtracted={(aiData) => setEditFormData(prev => ({ ...prev, ...aiData }))}
             />
        )
        : field.field_type === 'url' ? <div className="relative"><Link2 className={`absolute left-3 top-1/2 -translate-y-1/2 ${isReadOnly ? 'hidden' : 'text-gray-400'}`} size={16} /><input type="url" required={isRequired} disabled={isReadOnly} value={value || ''} onChange={(e) => setEditFormData({...editFormData, [fieldKey]: e.target.value})} className={`${inputClasses} ${isReadOnly ? '' : 'pl-9'}`} placeholder="https://" /></div>
        : field.field_type === 'subform' ? <SubformTable field={field} value={value || []} onChange={val => setEditFormData({...editFormData, [fieldKey]: val})} relationData={relationData} isEditing={!isReadOnly} />
        : <input type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : field.field_type === 'email' ? 'email' : 'text'} required={isRequired} disabled={isReadOnly} value={value || ''} onChange={(e) => setEditFormData({...editFormData, [fieldKey]: e.target.value})} className={inputClasses} />}
      </div>
    );
  };

  // 🔥 Quitamos <Layout> porque el App.jsx ya lo envuelve 🔥
  return (
    <>
      <div className="sticky -top-8 -mx-8 px-8 pt-8 pb-4 mb-8 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 z-40 transition-colors shadow-sm dark:shadow-none">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/modules/${caseData.module_id}`)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition"><ArrowLeft size={20} /></button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">Registro #{caseData.id}</h1>
              <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5"><CheckCircle size={12}/> {currentStatusName || 'Sin Estado'}</span>
              
              {/* 🔥 FASE 2: INDICADOR DE SLA EN EL HEADER 🔥 */}
              {(() => {
                 const sla = getSlaStatus();
                 if (!sla) return null;
                 
                 if (sla.state === 'breached') {
                   return (
                     <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest animate-pulse" title={`Vencido por ${sla.hours} horas`}>
                       <AlertTriangle size={12} /> SLA Roto
                     </span>
                   );
                 }
                 if (sla.state === 'warning') {
                   return (
                     <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/20 text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest" title={`Quedan ${sla.hours} horas`}>
                       <Clock size={12} /> En Riesgo
                     </span>
                   );
                 }
                 return null;
              })()}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isEditing && caseData.status_id && showTransitions && (
            <div className="w-64 mr-2 pr-4 border-r border-gray-200 dark:border-gray-800 flex items-center">
              {/* 🔥 REEMPLAZAMOS LOS BOTONES POR EL SELECT2 🔥 */}
              <SearchableSelect 
                 placeholder="Transicionar a..." 
                 value="" 
                 onChange={(val) => { if(val) handleStatusChange(val); }} 
                 disabled={false} 
                 options={availableTransitions.map(t => ({ value: t.to_status_id, label: t.name }))} 
              />
            </div>
          )}

          {!isEditing ? (
            <>
              {canDelete && <button onClick={handleDeleteCase} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Mover a papelera"><Trash2 size={18} /></button>}
              {/* 🔥 BOTÓN ENVIAR A FIRMA (SOLO SI ESTÁ CONFIGURADO) 🔥 */}
              {hasSignaturit && (
                  <button onClick={handleOpenSignatureModal} className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 hover:text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
                     <PenTool size={16}/> Firmar
                  </button>
              )}
              {/* 🔥 AQUÍ INYECTAMOS NUESTRO BOTÓN MÁGICO 🔥 */}
              <ExportPdfButton moduleId={caseData.module_id} recordId={caseData.id} />

              {canEdit && <button onClick={handleEditClick} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"><Edit2 size={16} /> Editar</button>}
            </>
          ) : (
            <>
              <button onClick={handleCancelEdit} disabled={saving} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-70">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar</button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="flex gap-8 border-b border-gray-200 dark:border-gray-800 mb-8 px-2">
          <button onClick={() => setActiveTab('details')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'}`}>
            <FileText size={16} /> Información del Registro
          </button>
          <button onClick={() => setActiveTab('history')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'history' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'}`}>
            <History size={16} /> Línea de Tiempo
          </button>
          <button onClick={() => setActiveTab('comments')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'comments' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'}`}>
            <MessageSquare size={16} /> Comentarios
          </button>
          {/* 🔥 NUEVA PESTAÑA: CHAT CON CLIENTE (SOLO SI ES MÓDULO B2C) 🔥 */}
          {isModulePublished && (
            <button onClick={() => setActiveTab('external_chat')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'external_chat' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'}`}>
              <MessageCircle size={16} /> Chat B2C
            </button>
          )}
          {/* 🔥 NUEVA PESTAÑA CONDICIONADA 🔥 */}
          {hasSignaturit && (
            <button onClick={() => setActiveTab('signatures')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'signatures' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'}`}>
              <PenTool size={16} /> Firmas Digitales
            </button>
          )}
          {/*  NUEVA PESTAÑA CONDICIONADA SI HAY REGISTROS VINCULADOS  */}
          {Object.keys(linkedCases).length > 0 && (
            <button onClick={() => setActiveTab('linked')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'linked' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'}`}>
              <LinkIcon size={16} /> Relacionados ({Object.values(linkedCases).flat().length})
            </button>
          )}
        </div>

        {activeTab === 'details' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6 pb-10">
            
            <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800/60 p-6 md:p-8">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><LayoutGrid size={16} className="text-blue-500"/> Información del Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div className="flex flex-col gap-1 border-b border-gray-100 dark:border-gray-800/60 pb-3">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Users size={12}/> Propietario</span>
                  {!isEditing ? (
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">{ownerName}</span>
                  ) : (
                    <SearchableSelect placeholder="Buscar usuario..." value={editAssignedTo} onChange={(val) => setEditAssignedTo(val)} disabled={false} options={companyUsers.map(u => ({ value: u.id, label: u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email }))} />
                  )}
                </div>
                <div className="flex flex-col gap-1 border-b border-gray-100 dark:border-gray-800/60 pb-3">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Clock size={12}/> Fecha de Creación</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{new Date(caseData.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {(sections.length > 0 ? sections : [{ id: null, title: 'Información General', columns: 2 }]).map((section, sIdx) => {
               const sFields = formFields.filter(f => f.section_id === section.id || (!f.section_id && section.id === null));
               if (sFields.length === 0) return null;
               
               const gridClass = section.columns === 1 ? 'grid-cols-1' : section.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

               return (
                 <div key={section.id || sIdx} className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800/60 p-6 md:p-8">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">{section.title}</h3>
                    <div className={`grid gap-x-12 gap-y-6 ${gridClass}`}>
                       {sFields.map(renderField)}
                    </div>
                 </div>
               );
            })}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
            <div className="bg-white dark:bg-gray-900/50 p-8 rounded-2xl border border-gray-100 dark:border-gray-800/60 max-w-3xl mx-auto">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-2">
                <Activity size={20} className="text-gray-400" /> Historial de Cambios
              </h2>
              
              <div className="space-y-8">
                {history.length > 0 ? history.map((log, index) => {
                  
                  const logUser = companyUsers.find(u => u.id === log.user_id);
                  const logUserName = logUser ? (logUser.first_name ? `${logUser.first_name} ${logUser.last_name || ''}` : logUser.email) : `Usuario Eliminado (ID: ${log.user_id})`;

                  let fieldChanges = [];
                  if (log.action === 'UPDATE_DATA' && log.old_v?.data && log.new_v?.data) {
                     Object.keys(log.new_v.data).forEach(key => {
                        const oldVal = log.old_v.data[key];
                        const newVal = log.new_v.data[key];
                        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                           const fieldDef = fields.find(f => f.api_name === key || f.label === key);
                           fieldChanges.push({
                              label: fieldDef ? fieldDef.label : key,
                              old: oldVal === "" || oldVal === null || oldVal === undefined ? "Vacío" : (typeof oldVal === 'object' ? 'Datos complejos' : String(oldVal)),
                              new: newVal === "" || newVal === null || newVal === undefined ? "Vacío" : (typeof newVal === 'object' ? 'Datos complejos' : String(newVal))
                           });
                        }
                     });
                  }

                  return (
                    <div key={log.id} className="flex gap-5">
                      <div className="relative flex flex-col items-center">
                        <div className={`w-3.5 h-3.5 mt-1 rounded-full ring-4 ring-white dark:ring-gray-900 z-10 shrink-0 ${index === 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                        {index !== history.length - 1 && <div className="absolute top-4 bottom-[-2rem] w-[2px] bg-gray-200 dark:bg-gray-800 z-0"></div>}
                      </div>
                      
                      <div className="flex-1 pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{log.action === 'CREATE_CASE' ? 'Registro Creado' : log.action === 'UPDATE_DATA' ? 'Actualización de Datos' : 'Cambio de Estado'}</p>
                          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800/80 px-2 py-1 rounded-md">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-1.5"><Users size={14}/> Por: <span className="font-bold text-gray-900 dark:text-gray-200">{logUserName}</span></p>
                        
                        {log.action === 'UPDATE_STATUS' && log.new_v && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-4 rounded-xl text-sm text-gray-700 dark:text-gray-300 flex items-center gap-3">
                            <ArrowRight size={16} className="text-blue-500 shrink-0"/>
                            <span>Avanzó al estado <span className="font-bold text-gray-900 dark:text-white px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 ml-1">{statuses.find(s => s.id == log.new_v.status_id)?.name || `Estado ID: ${log.new_v.status_id}`}</span></span>
                          </div>
                        )}

                        {log.action === 'UPDATE_DATA' && fieldChanges.length > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden mt-2">
                             <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700/50 bg-gray-100/50 dark:bg-gray-800 text-xs font-bold text-gray-500 uppercase tracking-wider">Campos Modificados</div>
                             <div className="p-4 space-y-3">
                                {fieldChanges.map((change, i) => (
                                   <div key={i} className="flex flex-col text-sm">
                                      <span className="font-bold text-gray-900 dark:text-gray-200 mb-1">{change.label}</span>
                                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700/50">
                                         <span className="line-through opacity-70 truncate max-w-[120px] sm:max-w-[200px]">{change.old}</span>
                                         <ArrowRight size={14} className="text-blue-500 shrink-0"/>
                                         <span className="font-medium text-emerald-600 dark:text-emerald-400 truncate">{change.new}</span>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-10">
                    <History className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No hay actividad registrada para mostrar.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* 🔥 RENDERIZAR EL COMPONENTE DE CHAT 🔥 */}
        {activeTab === 'comments' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10 max-w-3xl mx-auto">
            <CaseComments caseId={id} currentUser={userData} />
          </div>
        )}
        {/* 🔥 RENDERIZAR EL CHAT EXTERNO B2C 🔥 */}
        {activeTab === 'external_chat' && isModulePublished && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10 max-w-4xl mx-auto">
            <CaseExternalChat caseId={id} currentUser={userData} />
          </div>
        )}
        {/* 🔥 PESTAÑA DE REGISTROS VINCULADOS (MAGIA RELACIONAL) 🔥 */}
        {activeTab === 'linked' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10 max-w-4xl mx-auto space-y-6">
             {loadingLinked ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={32}/></div>
             ) : (
                Object.entries(linkedCases).map(([moduleName, casesList]) => (
                   <div key={moduleName} className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center gap-2">
                         <LayoutGrid className="text-blue-500" size={18}/>
                         <h3 className="font-bold text-gray-900 dark:text-white text-base">Registros de {moduleName}</h3>
                         <span className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full font-bold">{casesList.length}</span>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                         {casesList.map(c => (
                            <div key={c.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-between group">
                               <div>
                                  <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                     Registro #{c.id}
                                     <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                        Estado: {statuses.find(s => s.id === c.status_id)?.name || 'N/A'}
                                     </span>
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">Creado: {new Date(c.created_at).toLocaleDateString()}</p>
                               </div>
                               <button onClick={() => navigate(`/cases/${c.id}`)} className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Ver Detalles <ArrowRight size={14}/>
                               </button>
                            </div>
                         ))}
                      </div>
                   </div>
                ))
             )}
          </div>
        )}
        {/* 🔥 RENDERIZAR EL TABLERO DE FIRMAS 🔥 */}
        {activeTab === 'signatures' && hasSignaturit && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <PenTool size={20} className="text-emerald-500" /> Seguimiento de Firmas
               </h2>
               <button onClick={handleOpenSignatureModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95">
                 <Plus size={16}/> Nueva Solicitud
               </button>
            </div>

            {signaturesList.length === 0 ? (
               <div className="bg-white dark:bg-gray-900/50 p-12 rounded-2xl border border-gray-100 dark:border-gray-800/60 text-center">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"><FileText size={32} /></div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">No hay documentos enviados</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Envía un contrato o documento para hacer el seguimiento aquí.</p>
               </div>
            ) : (
               <div className="space-y-4">
                  {signaturesList.map(sig => (
                     <div key={sig.id} className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                           <div className="flex items-center gap-3 mb-2">
                              <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                 {sig.request_type === 'template' ? <LayoutGrid size={12}/> : <FileText size={12}/>}
                                 {sig.request_type === 'template' ? 'Plantilla' : 'Documento PDF'}
                              </span>
                              <span className="text-xs text-gray-500 font-mono">ID: {sig.signaturit_id.split('-')[0]}...</span>
                           </div>
                           <p className="text-sm text-gray-900 dark:text-white font-medium flex items-center gap-1.5 mb-1">
                              <Clock size={14} className="text-gray-400"/> Creado el {new Date(sig.created_at).toLocaleString()}
                           </p>
                           <div className="mt-3">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Destinatarios:</p>
                              <div className="flex flex-wrap gap-2">
                                 {(sig.signers_data || []).map((signer, idx) => (
                                    <span key={idx} className="text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 px-2 py-1 rounded-md flex items-center gap-1.5">
                                       <Users size={12}/> {signer.name || signer.email}
                                    </span>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="flex flex-col items-start md:items-end gap-2 shrink-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800 pt-4 md:pt-0">
                           {/* ESTADO DINÁMICO */}
                           {['completed', 'document_signed'].includes(sig.status) ? (
                              <div className="flex flex-col items-start md:items-end gap-2">
                                  <span className="bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                     <CheckCircle size={16} /> Completado y Firmado
                                  </span>
                                  {/* 🔥 NUEVO BOTÓN DE DESCARGA 🔥 */}
                                  <button onClick={() => handleDownloadSignedDocument(sig.id)} className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-sm mt-1 active:scale-95">
                                     <Download size={14}/> Descargar PDF Firmado
                                  </button>
                              </div>
                           ) : ['declined', 'error'].includes(sig.status) ? (
                              <span className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                 <AlertTriangle size={16} /> Rechazado / Error
                              </span>
                           ) : sig.status === 'canceled' ? (
                              <span className="bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                 <X size={16} /> Envío Cancelado
                              </span>
                           ) : (
                              <span className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 animate-pulse">
                                 <Loader2 size={16} className="animate-spin" /> Pendiente (Enviado)
                              </span>
                           )}
                           
                           {/* Acciones adicionales si no está completado ni cancelado */}
                           {['in_queue', 'ready', 'document_opened'].includes(sig.status) && (
                              <div className="flex flex-wrap items-center gap-3 mt-2 md:justify-end">
                                 <button onClick={() => handleRemindSignature(sig.id)} className="text-[11px] font-bold text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                                    <ArrowRight size={12}/> Recordar
                                 </button>
                                 <button onClick={() => handleCancelSignature(sig.id)} className="text-[11px] font-bold text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                                    <X size={12}/> Cancelar Envío
                                 </button>
                              </div>
                           )}
                           
                        </div>
                     </div>
                  ))}
               </div>
            )}
          </div>
        )}
      </div>
      {/* 🔥 MODAL DE ENVÍO A SIGNATURIT 🔥 */}
      {isSignatureModalOpen && createPortal(
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-emerald-200 dark:border-emerald-800/50 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-1 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/10">
              <h3 className="font-bold text-emerald-900 dark:text-emerald-400 flex items-center gap-2"><PenTool size={18} className="text-emerald-500" /> Solicitar Firma</h3>
              <button onClick={() => !sendingSignature && setIsSignatureModalOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleSendToSignaturit} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              
             {/* TIPO DE ORIGEN */}
              <div className="flex gap-2 bg-gray-100 dark:bg-gray-950 p-1.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-inner">
                <button 
                  type="button" 
                  onClick={() => setSigConfig({
                    ...sigConfig, 
                    sourceType: 'template', 
                    deliveryType: 'email', // 🔥 Forzamos correo al volver a plantillas
                    signers: [{ name: '', email: '' }] // Reseteamos firmantes
                  })} 
                  className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${sigConfig.sourceType === 'template' ? 'bg-white dark:bg-gray-800 shadow-sm text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-gray-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-transparent'}`}
                >
                  <FileText size={16}/> Usar Plantilla
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setSigConfig({...sigConfig, sourceType: 'file'})} 
                  className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${sigConfig.sourceType === 'file' ? 'bg-white dark:bg-gray-800 shadow-sm text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-gray-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-transparent'}`}
                >
                  <UploadCloud size={16}/> Subir PDF Manual
                </button>
              </div>

              {sigConfig.sourceType === 'template' ? (
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Plantilla de Signaturit</label>
                   {loadingTemplates ? <p className="text-sm text-emerald-600 dark:text-emerald-500 flex items-center gap-2 animate-pulse"><Loader2 size={16} className="animate-spin"/> Cargando plantillas...</p> : (
                     /* 🔥 SELECT2 (SearchableSelect) MÁGICO 🔥 */
                     <SearchableSelect 
                        placeholder="Buscar plantilla..." 
                        value={sigConfig.templateId} 
                        onChange={val => setSigConfig({...sigConfig, templateId: val})} 
                        disabled={false} 
                        options={signaturitTemplates.map(t => ({ value: t.id, label: t.name }))} 
                     />
                   )}
                 </div>
              ) : (
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Documento a Firmar (PDF)</label>
                   <div className="border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl p-4 text-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                     <input type="file" accept=".pdf" onChange={e => setSigConfig({...sigConfig, file: e.target.files[0]})} className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-emerald-100 dark:file:bg-emerald-900/50 file:text-emerald-700 dark:file:text-emerald-400 cursor-pointer" />
                   </div>
                 </div>
              )}

              {/* CONFIGURACIÓN DE FIRMA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-6">
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Validez Legal</label>
                   <select value={sigConfig.signatureType} onChange={e => setSigConfig({...sigConfig, signatureType: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all">
                      <option value="advanced">Firma Avanzada (Biométrica)</option>
                      <option value="simple">Firma Simple (Check)</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Modo de Entrega</label>
                   <select 
                      value={sigConfig.deliveryType} 
                      onChange={e => {
                        const mode = e.target.value;
                        if(mode === 'url') {
                           setSigConfig({
                              ...sigConfig, 
                              deliveryType: mode, 
                              signers: [{name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Mi Usuario', email: userData.email}]
                           });
                        } else {
                           setSigConfig({...sigConfig, deliveryType: mode});
                        }
                      }} 
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                   >
                      <option value="email">Por Correo Electrónico</option>
                      {/* 🔥 SOLO MOSTRAMOS ESTA OPCIÓN SI ES SUBIDA MANUAL 🔥 */}
                      {sigConfig.sourceType === 'file' && (
                         <option value="url">"Firmar Yo" (Embebido Presencial)</option>
                      )}
                   </select>
                 </div>
              </div>

              {/* FIRMANTES */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                 <div className="flex justify-between items-center mb-4">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Users size={14}/> Firmantes Requeridos</label>
                    {sigConfig.deliveryType === 'email' && (
                       <button type="button" onClick={() => setSigConfig({...sigConfig, signers: [...sigConfig.signers, {name: '', email: ''}]})} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg transition-colors"><Plus size={14}/> Añadir Firmante</button>
                    )}
                 </div>
                 <div className="space-y-3">
                    {sigConfig.signers.map((s, idx) => (
                       <div key={idx} className="flex gap-2 items-center bg-gray-50 dark:bg-gray-950 p-2 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                          <input type="text" placeholder="Nombre completo" required value={s.name} onChange={e => { const newS = [...sigConfig.signers]; newS[idx].name = e.target.value; setSigConfig({...sigConfig, signers: newS})}} className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all" />
                          <input type="email" placeholder="Correo electrónico" required value={s.email} onChange={e => { const newS = [...sigConfig.signers]; newS[idx].email = e.target.value; setSigConfig({...sigConfig, signers: newS})}} className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all" />
                          {sigConfig.deliveryType === 'email' && sigConfig.signers.length > 1 && (
                             <button type="button" onClick={() => { const newS = [...sigConfig.signers]; newS.splice(idx, 1); setSigConfig({...sigConfig, signers: newS})}} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                          )}
                       </div>
                    ))}
                 </div>
                 {sigConfig.deliveryType === 'url' && <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 p-3 rounded-xl flex items-center gap-2"><Link2 size={14}/> Se abrirá el documento en otra pestaña para que firmes presencialmente ahora mismo.</p>}
              </div>

            </form>
            
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-end gap-3 shrink-0">
               <button type="button" onClick={() => setIsSignatureModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancelar</button>
               <button onClick={handleSendToSignaturit} disabled={sendingSignature} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-70">
                 {sendingSignature ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />} Enviar Documento
               </button>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
};

export default CaseDetail;