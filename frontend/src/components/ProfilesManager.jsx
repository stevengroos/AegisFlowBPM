import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Key, Plus, Trash2, Edit2, Loader2, Save, X, Shield, Box, Settings, Search, ChevronLeft, ChevronRight, Folder, ChevronDown, ChevronUp, Eye, EyeOff, Lock, Users } from 'lucide-react';

import { useNotification } from '../context/NotificationContext';

const defaultPermissions = {
  modules: {}, 
  settings: {
    manage_modules: false, manage_forms: false, manage_blueprints: false,
    manage_automations: false, manage_dashboards: false, view_audit: false,        
    view_recycle_bin: false, manage_users: false, manage_roles: false, manage_security: false
  }
};

const ProfilesManager = () => {
  const { notify, confirm } = useNotification();

  const [profiles, setProfiles] = useState([]);
  const [modules, setModules] = useState([]);
  const [categories, setCategories] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const profilesPerPage = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false); 
  
  // 🔥 FASE 1: Añadimos is_external al estado del formulario
  const [formData, setFormData] = useState({ name: '', is_external: false, permissions: JSON.parse(JSON.stringify(defaultPermissions)) });

  // 🔥 ESTADOS PARA EL ACORDEÓN Y LOS CAMPOS (FLS) 🔥
  const [expandedModule, setExpandedModule] = useState(null);
  const [activeModTab, setActiveModTab] = useState('records'); // 'records' o 'fields'
  const [fieldsCache, setFieldsCache] = useState({});
  const [loadingFields, setLoadingFields] = useState(false);

  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [profilesRes, modulesRes, catsRes] = await Promise.all([
        api.get('/api/v1/security/profiles', { signal }),
        api.get('/api/v1/modules/', { signal }),
        api.get('/api/v1/modules/categories/', { signal }) 
      ]);
      setProfiles(profilesRes.data || []);
      setModules(modulesRes.data || []);
      setCategories(catsRes.data || []);
    } catch (error) { 
      if (error.name !== 'CanceledError') notify.error("Error al cargar los datos.");
    } finally { 
      setLoading(false); 
    }
  }, [notify]);

  useEffect(() => { 
    const controller = new AbortController();
    fetchData(controller.signal); 
    return () => controller.abort();
  }, [fetchData]);

  // 🔥 FASE 1: Añadimos field_rules, publish, buy y view_all al estado inicial
  const getInitialModPerms = () => ({
    view: true, view_same_rank: false, create: false, edit_own: false, 
    edit_same_rank: false, edit_subordinates: false, delete_own: false, 
    delete_same_rank: false, delete_subordinates: false, field_rules: {},
    view_all: false, publish: false, buy: false // 🔥 Nuevas llaves para la App B2C
  });

  const handleOpenCreate = () => {
    const initialModPerms = {};
    modules.forEach(m => { initialModPerms[m.id] = getInitialModPerms(); });

    setFormData({ name: '', is_external: false, permissions: { ...defaultPermissions, modules: initialModPerms } });
    setEditingId(null); setHasChanges(false); setIsFormOpen(true);
    setExpandedModule(null);
  };

  const handleEdit = (profile) => {
    const mergedModPerms = { ...(profile.permissions?.modules || {}) };
    modules.forEach(m => {
      if (!mergedModPerms[m.id]) { mergedModPerms[m.id] = getInitialModPerms(); }
    });

    setFormData({
      name: profile.name,
      is_external: profile.is_external || false,
      permissions: {
        settings: { ...defaultPermissions.settings, ...(profile.permissions?.settings || {}) },
        modules: mergedModPerms
      }
    });
    setEditingId(profile.id); setHasChanges(false); setIsFormOpen(true);
    setExpandedModule(null);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) return notify.warning("El nombre del perfil es obligatorio.");

    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/v1/security/profiles/${editingId}`, formData);
        notify.success("Perfil actualizado con éxito.");
      } else {
        await api.post('/api/v1/security/profiles', formData);
        notify.success("Nuevo perfil creado exitosamente.");
      }
      setHasChanges(false); setIsFormOpen(false);
      fetchData(new AbortController().signal);
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al guardar el perfil."); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const isConfirmed = await confirm({ title: 'Eliminar Perfil', message: `¿Seguro que deseas eliminar "${name}"?`, confirmText: 'Sí, eliminar', variant: 'danger' });
    if (!isConfirmed) return;
    try {
      await api.delete(`/api/v1/security/profiles/${id}`);
      notify.success("Perfil eliminado.");
      fetchData(new AbortController().signal);
    } catch (error) { notify.error("No se pudo eliminar el perfil."); }
  };

  const handleCloseAttempt = async () => {
    if (hasChanges) {
      const isConfirmed = await confirm({ title: 'Cambios sin guardar', message: '¿Deseas descartarlos y volver?', confirmText: 'Descartar cambios', variant: 'danger' });
      if (!isConfirmed) return;
    }
    setIsFormOpen(false);
  };

  // ==========================================
  // 🔥 LÓGICA DE PERMISOS Y ACORDEÓN 🔥
  // ==========================================
  const toggleAccordion = async (modId) => {
    if (expandedModule === modId) {
       setExpandedModule(null); return;
    }
    setExpandedModule(modId);
    setActiveModTab('records');

    if (!fieldsCache[modId]) {
       setLoadingFields(true);
       try {
          const res = await api.get(`/api/v1/fields/?module_id=${modId}`);
          
          // 🔥 MAGIA: Deduplicamos los campos por su API Name o Label 🔥
          const uniqueFieldsMap = new Map();
          res.data.forEach(f => {
             const key = f.api_name || f.label;
             if (!uniqueFieldsMap.has(key)) {
                 uniqueFieldsMap.set(key, f);
             }
          });
          
          setFieldsCache(prev => ({ ...prev, [modId]: Array.from(uniqueFieldsMap.values()) }));
       } catch(e) { console.error(e); } 
       finally { setLoadingFields(false); }
    }
  };

  const toggleModPerm = (modId, key) => {
    setHasChanges(true);
    setFormData(prev => ({
      ...prev, permissions: { ...prev.permissions, modules: { ...prev.permissions.modules, [modId]: { ...prev.permissions.modules[modId], [key]: !prev.permissions.modules[modId][key] } } }
    }));
  };

  const setFieldRule = (modId, fieldKey, rule) => {
    setHasChanges(true);
    setFormData(prev => {
      const currentMod = prev.permissions.modules[modId] || getInitialModPerms();
      const currentRules = currentMod.field_rules || {};
      const newRules = { ...currentRules };
      
      if (rule === 'editable') delete newRules[fieldKey]; // Por defecto es editable, borramos para ahorrar espacio JSON
      else newRules[fieldKey] = rule;

      return {
         ...prev, permissions: { ...prev.permissions, modules: { ...prev.permissions.modules, [modId]: { ...currentMod, field_rules: newRules } } }
      };
    });
  };

  const setBulkFieldRule = (modId, rule) => {
    setHasChanges(true);
    const modFields = fieldsCache[modId] || [];
    
    setFormData(prev => {
      const currentMod = prev.permissions.modules[modId] || getInitialModPerms();
      const newRules = { ...currentMod.field_rules };
      
      modFields.forEach(f => {
        const fKey = f.api_name || f.label;
        if (rule === 'editable') delete newRules[fKey]; // Editable es el estado por defecto, lo borramos para limpiar el JSON
        else newRules[fKey] = rule;
      });

      return {
         ...prev, 
         permissions: { 
           ...prev.permissions, 
           modules: { ...prev.permissions.modules, [modId]: { ...currentMod, field_rules: newRules } } 
         }
      };
    });
  };

  const toggleSettingPerm = (key) => {
    setHasChanges(true);
    setFormData(prev => ({
      ...prev, permissions: { ...prev.permissions, settings: { ...prev.permissions.settings, [key]: !prev.permissions.settings[key] } }
    }));
  };

  // ==========================================
  // 🔥 RENDER DE LA LISTA PRINCIPAL 🔥
  // ==========================================
  const filteredProfiles = profiles.filter(profile => profile.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const indexOfLastProfile = currentPage * profilesPerPage;
  const indexOfFirstProfile = indexOfLastProfile - profilesPerPage;
  const currentProfiles = filteredProfiles.slice(indexOfFirstProfile, indexOfLastProfile);
  const totalPages = Math.ceil(filteredProfiles.length / profilesPerPage) || 1;

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;

  if (!isFormOpen) {
    return (
      <div className="p-6 space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Key className="text-amber-500" /> Perfiles y Permisos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Define qué acciones puede realizar un usuario basándose en su jerarquía.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-gray-400" /></div>
              <input type="text" placeholder="Buscar perfil..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all shadow-sm" />
            </div>
            <button onClick={handleOpenCreate} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0">
              <Plus size={18} /> <span className="hidden sm:inline">Nuevo Perfil</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">
                <tr><th className="px-6 py-4">Nombre del Perfil</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {currentProfiles.length > 0 ? (
                  currentProfiles.map(profile => (
                    <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group cursor-default">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl shrink-0 ${profile.is_external ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                            {profile.is_external ? <Users size={18} /> : <Shield size={18} />}
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">{profile.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         {profile.is_external ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"><Users size={12}/> Externo (Portal/App)</span>
                         ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50"><Shield size={12}/> Interno (Staff)</span>
                         )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(profile)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-xl transition-colors"><Edit2 size={16}/></button>
                          <button onClick={() => handleDelete(profile.id, profile.name)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-xl transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="3" className="px-6 py-16 text-center"><Key size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" /><p className="text-sm font-medium text-gray-500 dark:text-gray-400">No has creado ningún perfil todavía.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 🔥 RENDER DEL FORMULARIO Y MATRIZ FLS 🔥
  // ==========================================
  const renderModuleAccordion = (mod) => {
    const isExpanded = expandedModule === mod.id;
    const perms = formData.permissions.modules[mod.id] || getInitialModPerms();
    const modFields = fieldsCache[mod.id] || [];

    return (
      <div key={mod.id} className="border border-gray-200 dark:border-gray-800 rounded-xl mb-3 overflow-hidden bg-white dark:bg-gray-900 shadow-sm transition-all">
        {/* Cabecera del Acordeón */}
        <button onClick={() => toggleAccordion(mod.id)} className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
           <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isExpanded ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}><Box size={16}/></div>
              <span className={`font-bold ${isExpanded ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{mod.name}</span>
           </div>
           {isExpanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
        </button>

        {/* Contenido Expandido */}
        {isExpanded && (
          <div className="p-0 animate-in slide-in-from-top-2 duration-200">
             
             {/* Pestañas (Registros vs Campos) */}
             <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-4">
                <button onClick={() => setActiveModTab('records')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeModTab === 'records' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Permisos de Registros</button>
                <button onClick={() => setActiveModTab('fields')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeModTab === 'fields' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Seguridad de Campos (FLS)</button>
             </div>

             <div className="p-5">
                {activeModTab === 'records' && (
                  formData.is_external ? (
                    // 🔥 UI SIMPLIFICADA PARA CLIENTES DE LA APP (B2C) 🔥
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-emerald-50/40 dark:bg-emerald-900/10 p-5 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border-b border-emerald-100 dark:border-emerald-800/30 pb-1.5">
                            Visibilidad en la App
                          </h4>
                          <label className="flex items-center gap-2 cursor-pointer mt-2">
                            <input type="checkbox" checked={perms.view_all || false} onChange={() => toggleModPerm(mod.id, 'view_all')} className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                            <span className="text-sm font-bold text-gray-900 dark:text-white">Ver Catálogo Público (Todos)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={perms.view || false} onChange={() => toggleModPerm(mod.id, 'view')} className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ver Mis Operaciones (Propios)</span>
                          </label>
                       </div>
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border-b border-emerald-100 dark:border-emerald-800/30 pb-1.5">
                            Acciones Permitidas
                          </h4>
                          {/* Permiso para Vendedores */}
                          <label className="flex items-center gap-2 cursor-pointer mt-2">
                            <input type="checkbox" checked={perms.publish || false} onChange={() => toggleModPerm(mod.id, 'publish')} className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                            <span className="text-sm font-bold text-gray-900 dark:text-white">Publicar Ofertas (Vender)</span>
                          </label>

                          {/* Permiso para Compradores */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={perms.buy || false} onChange={() => toggleModPerm(mod.id, 'buy')} className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                            <span className="text-sm font-bold text-gray-900 dark:text-white">Realizar Compras (Comprar)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-emerald-50 dark:border-emerald-900/20">
                            <input type="checkbox" checked={perms.edit_own || false} onChange={() => toggleModPerm(mod.id, 'edit_own')} className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Modificar mis publicaciones (Editar)</span>
                          </label>
                       </div>
                    </div>
                  ) : (
                    // 🛡️ UI COMPLEJA PARA STAFF INTERNO (B2B / JERARQUÍA) 🛡️
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-1">Ver y Crear</h4>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={perms.view || false} onChange={() => toggleModPerm(mod.id, 'view')} className="rounded border-gray-300 text-blue-500 focus:ring-blue-500" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ver Propios</span></label>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={perms.view_same_rank || false} onChange={() => toggleModPerm(mod.id, 'view_same_rank')} className="rounded border-gray-300 text-blue-500 focus:ring-blue-500" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ver Mismo Rango</span></label>
                          <label className="flex items-center gap-2 cursor-pointer mt-2 pt-2 border-t border-gray-100 dark:border-gray-800"><input type="checkbox" checked={perms.create || false} onChange={() => toggleModPerm(mod.id, 'create')} className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" /><span className="text-sm font-bold text-gray-900 dark:text-white">Crear Nuevos</span></label>
                       </div>
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-1">Editar (Modificar)</h4>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={perms.edit_own || false} onChange={() => toggleModPerm(mod.id, 'edit_own')} className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Editar Propios</span></label>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={perms.edit_same_rank || false} onChange={() => toggleModPerm(mod.id, 'edit_same_rank')} className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Editar Mismo Rango</span></label>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={perms.edit_subordinates || false} onChange={() => toggleModPerm(mod.id, 'edit_subordinates')} className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Editar Inferiores</span></label>
                       </div>
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 pb-1">Eliminar</h4>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={perms.delete_own || false} onChange={() => toggleModPerm(mod.id, 'delete_own')} className="rounded border-gray-300 text-red-500 focus:ring-red-500" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Eliminar Propios</span></label>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={perms.delete_same_rank || false} onChange={() => toggleModPerm(mod.id, 'delete_same_rank')} className="rounded border-gray-300 text-red-500 focus:ring-red-500" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Eliminar Mismo Rango</span></label>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={perms.delete_subordinates || false} onChange={() => toggleModPerm(mod.id, 'delete_subordinates')} className="rounded border-gray-300 text-red-500 focus:ring-red-500" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Eliminar Inferiores</span></label>
                       </div>
                    </div>
                  )
                )}

                {activeModTab === 'fields' && (
                  <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                     {loadingFields ? (
                        <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={24}/></div>
                     ) : modFields.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-400">Este módulo no tiene campos configurados aún.</div>
                     ) : (
                        <table className="w-full text-left text-sm">
                           <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 text-[10px] uppercase tracking-wider text-gray-500">
                              <tr>
                                 <th className="px-4 py-3">Nombre del Campo</th>
                                 <th className="px-4 py-3">
                                    <div className="flex flex-col items-center gap-2">
                                       <span>Visible & Editable (Defecto)</span>
                                       <button type="button" onClick={() => setBulkFieldRule(mod.id, 'editable')} className="text-[9px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded transition-colors shadow-sm">Marcar Todos</button>
                                    </div>
                                 </th>
                                 <th className="px-4 py-3">
                                    <div className="flex flex-col items-center gap-2">
                                       <span>Solo Lectura (Read-Only)</span>
                                       <button type="button" onClick={() => setBulkFieldRule(mod.id, 'readonly')} className="text-[9px] font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded transition-colors shadow-sm">Marcar Todos</button>
                                    </div>
                                 </th>
                                 <th className="px-4 py-3">
                                    <div className="flex flex-col items-center gap-2">
                                       <span>Oculto (Hidden)</span>
                                       <button type="button" onClick={() => setBulkFieldRule(mod.id, 'hidden')} className="text-[9px] font-bold bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded transition-colors shadow-sm">Marcar Todos</button>
                                    </div>
                                 </th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {modFields.map(field => {
                                 const fKey = field.api_name || field.label;
                                 const currentRule = (perms.field_rules || {})[fKey] || 'editable';

                                 return (
                                    <tr key={field.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                       <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{field.label} <span className="text-[10px] text-gray-400 font-mono ml-2">[{fKey}]</span></td>
                                       
                                       <td className="px-4 py-3 text-center">
                                          <input type="radio" name={`rule_${mod.id}_${fKey}`} checked={currentRule === 'editable'} onChange={() => setFieldRule(mod.id, fKey, 'editable')} className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 border-gray-300 cursor-pointer" />
                                       </td>
                                       <td className="px-4 py-3 text-center bg-amber-50/20 dark:bg-amber-900/10">
                                          <input type="radio" name={`rule_${mod.id}_${fKey}`} checked={currentRule === 'readonly'} onChange={() => setFieldRule(mod.id, fKey, 'readonly')} className="w-4 h-4 text-amber-500 focus:ring-amber-500 border-gray-300 cursor-pointer" />
                                       </td>
                                       <td className="px-4 py-3 text-center bg-red-50/20 dark:bg-red-900/10">
                                          <input type="radio" name={`rule_${mod.id}_${fKey}`} checked={currentRule === 'hidden'} onChange={() => setFieldRule(mod.id, fKey, 'hidden')} className="w-4 h-4 text-red-500 focus:ring-red-500 border-gray-300 cursor-pointer" />
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     )}
                  </div>
                )}
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 flex flex-col h-full animate-in slide-in-from-right-4 duration-300 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={handleCloseAttempt} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors shadow-sm border border-gray-200 dark:border-gray-700"><ChevronLeft size={18}/></button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Key size={18} className="text-amber-500"/> {editingId ? 'Editar Perfil' : 'Nuevo Perfil'}</h2>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50">
           {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar Perfil
        </button>
      </div>

      <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
        
        {/* 🔥 TIPO DE PERFIL (INTERNO VS EXTERNO) Y NOMBRE 🔥 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-800/30 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
           <div>
             <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Tipo de Perfil</label>
             <div className="grid grid-cols-2 gap-3">
                 <button 
                    type="button" onClick={() => { setFormData({...formData, is_external: false}); setHasChanges(true); }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${!formData.is_external ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-500 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-400' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                 >
                    <Shield size={20} /> <span className="text-xs font-bold">Interno (Staff)</span>
                 </button>
                 <button 
                    type="button" onClick={() => { setFormData({...formData, is_external: true}); setHasChanges(true); }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${formData.is_external ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm ring-1 ring-emerald-500 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                 >
                    <Users size={20} /> <span className="text-xs font-bold">Externo (App/Portal)</span>
                 </button>
              </div>
           </div>
           <div className="flex flex-col justify-center">
             <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Nombre del Perfil <span className="text-red-500">*</span></label>
             <input type="text" required placeholder={formData.is_external ? "Ej: Agricultor (Productor)" : "Ej: Analista de Ventas"} value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setHasChanges(true); }} className="w-full px-4 py-3 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white font-bold shadow-sm transition-all" />
           </div>
        </div>

        {/* MÓDULOS EN ACORDEÓN */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2"><Box size={16} className="text-blue-500" /> Permisos de Acceso a Módulos</h3>
          
          {categories.map(cat => {
             const catMods = modules.filter(m => m.category_id === cat.id).sort((a, b) => a.order - b.order);
             if (catMods.length === 0) return null;
             return (
                <div key={cat.id} className="mb-6">
                   <h4 className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Folder size={14}/> {cat.name}</h4>
                   {catMods.map(renderModuleAccordion)}
                </div>
             );
          })}

          {/* MÓDULOS SUELTOS */}
          {(() => {
             const orphanedMods = modules.filter(m => !m.category_id).sort((a, b) => a.order - b.order);
             if (orphanedMods.length === 0) return null;
             return (
                <div className="mb-6">
                   {categories.length > 0 && <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Box size={14}/> Otros Módulos</h4>}
                   {orphanedMods.map(renderModuleAccordion)}
                </div>
             );
          })()}
        </div>

        {/* PERMISOS DE CONFIGURACIÓN (SÓLO SI ES INTERNO) */}
        {!formData.is_external && (
          <div className="animate-in fade-in duration-300">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
              <Settings size={16} className="text-gray-500 dark:text-gray-400" /> Permisos de Configuración (Administrativos)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.manage_modules || false} onChange={() => toggleSettingPerm('manage_modules')} className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Módulos</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Crear, editar o eliminar módulos.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.manage_forms || false} onChange={() => toggleSettingPerm('manage_forms')} className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Formularios</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Diseñar campos (Drag & Drop).</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.manage_dashboards || false} onChange={() => toggleSettingPerm('manage_dashboards')} className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Dashboards</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Gestionar reportes analíticos.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.manage_blueprints || false} onChange={() => toggleSettingPerm('manage_blueprints')} className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Blueprints</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Crear flujos de estados y transiciones.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.manage_automations || false} onChange={() => toggleSettingPerm('manage_automations')} className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Automatizaciones</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Crear reglas globales y scripts.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.view_audit || false} onChange={() => toggleSettingPerm('view_audit')} className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Auditoría</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Ver histórico de actividades.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.view_recycle_bin || false} onChange={() => toggleSettingPerm('view_recycle_bin')} className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Papelera</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Ver registros eliminados.</p>
                </div>
              </label>

              {/* PERMISOS DE SEGURIDAD SEPARADOS */}
              <label className="flex items-start gap-3 p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.manage_users || false} onChange={() => toggleSettingPerm('manage_users')} className="mt-1 w-4 h-4 rounded border-blue-300 dark:border-blue-600 dark:bg-gray-900 text-blue-500 focus:ring-blue-500 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Gestión de Usuarios</p>
                  <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5 leading-tight">Invitar, bloquear y resetear sesiones.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-amber-50/50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.manage_roles || false} onChange={() => toggleSettingPerm('manage_roles')} className="mt-1 w-4 h-4 rounded border-amber-300 dark:border-amber-600 dark:bg-gray-900 text-amber-500 focus:ring-amber-500 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Roles y Perfiles</p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 leading-tight">Crear jerarquías y matrices de permisos.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-red-50/50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50 cursor-pointer hover:border-red-300 dark:hover:border-red-700 transition-colors">
                <input type="checkbox" checked={formData.permissions.settings.manage_security || false} onChange={() => toggleSettingPerm('manage_security')} className="mt-1 w-4 h-4 rounded border-red-300 dark:border-red-600 dark:bg-gray-900 text-red-500 focus:ring-red-500 cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">Políticas y Panel de Seguridad</p>
                  <p className="text-[11px] text-red-500/80 dark:text-red-400/80 mt-0.5 leading-tight">Configurar MFA, redes y acceso a analítica forense.</p>
                </div>
              </label>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilesManager;