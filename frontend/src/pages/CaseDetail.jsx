import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Clock, CheckCircle, Activity, FileText, ArrowRight, Edit2, Save, Loader2, Trash2, Lock, Link as LinkIcon, Users, History, Link2, LayoutGrid } from 'lucide-react'; 

// 🔥 Importaciones Arquitectura Limpia 🔥
import { useNotification } from '../context/NotificationContext';
import SearchableSelect from '../components/ui/SearchableSelect';
import FileUploadField from '../components/ui/FileUploadField';
import SubformTable from '../features/cases/SubformTable';

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify, confirm } = useNotification();
  
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

  const fetchAllData = async (signal) => {
    try {
      setLoading(true);
      const userRes = await api.get('/api/v1/users/me', { signal });
      setUserData(userRes.data);

      const caseRes = await api.get(`/api/v1/cases/${id}`, { signal });
      const currentCase = caseRes.data;
      const moduleId = currentCase.module_id; 

      const [fieldsRes, secRes, statusRes, transRes, blueprintsRes, usersRes, rolesRes] = await Promise.all([
        api.get(`/api/v1/fields/?module_id=${moduleId}`, { signal }),
        api.get(`/api/v1/fields/sections?form_id=${currentCase.form_id}`, { signal }),
        api.get('/api/v1/statuses/', { signal }),
        api.get('/api/v1/transitions/', { signal }),
        api.get('/api/v1/blueprints/', { signal }),
        api.get('/api/v1/auth/users', { signal }),
        api.get('/api/v1/security/roles', { signal }) 
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
    } catch (error) {
      if (error.name !== 'CanceledError') {
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

  useEffect(() => { 
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
          ) : field.field_type === 'url' && value ? (
             <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"><Link2 size={14}/> {value}</a>
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
        : field.field_type === 'textarea' ? <textarea required={isRequired} disabled={isReadOnly} value={value || ''} onChange={(e) => setEditFormData({...editFormData, [fieldKey]: e.target.value})} rows={3} className={inputClasses} /> 
        : field.field_type === 'checkbox' ? <input type="checkbox" disabled={isReadOnly} checked={value || false} onChange={(e) => setEditFormData({...editFormData, [fieldKey]: e.target.checked})} className={`w-5 h-5 rounded text-blue-600 focus:ring-blue-500 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} /> 
        : field.field_type === 'file' || field.field_type === 'image' ? <FileUploadField type={field.field_type} value={value || ''} onChange={(url) => setEditFormData({...editFormData, [fieldKey]: url})} disabled={isReadOnly} /> 
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
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isEditing && caseData.status_id && showTransitions && (
            <div className="flex gap-2 mr-2 pr-4 border-r border-gray-200 dark:border-gray-800">
              {availableTransitions.map(transition => (
                <button key={transition.id} onClick={() => handleStatusChange(transition.to_status_id)} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 text-gray-900 dark:text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
                  {transition.name} <ArrowRight size={14} className="text-gray-400"/>
                </button>
              ))}
            </div>
          )}

          {!isEditing ? (
            <>
              {canDelete && <button onClick={handleDeleteCase} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Mover a papelera"><Trash2 size={18} /></button>}
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
      </div>
    </>
  );
};

export default CaseDetail;