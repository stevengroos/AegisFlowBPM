import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Key, Plus, Trash2, Edit2, Loader2, Save, X, CheckSquare, Shield, Box, Settings, CheckCheck, Search, ChevronLeft, ChevronRight, Folder } from 'lucide-react';

// 🔥 IMPORTAMOS NUESTRAS NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

// 🔥 FIX: Añadimos los permisos faltantes de Usuarios y Roles 🔥
const defaultPermissions = {
  modules: {}, 
  settings: {
    manage_modules: false,
    manage_forms: false,
    manage_blueprints: false,
    manage_automations: false,
    manage_dashboards: false, 
    view_audit: false,        
    view_recycle_bin: false,
    manage_users: false,     // Nuevo
    manage_roles: false,     // Nuevo
    manage_security: false   // Específico para Políticas
  }
};

const ProfilesManager = () => {
  const { notify, confirm } = useNotification();

  const [profiles, setProfiles] = useState([]);
  const [modules, setModules] = useState([]);
  const [categories, setCategories] = useState([]); // 🔥 NUEVO: Categorías para agrupar
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const profilesPerPage = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false); 
  const [formData, setFormData] = useState({ name: '', permissions: JSON.parse(JSON.stringify(defaultPermissions)) });

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
      if (error.name !== 'CanceledError') {
        notify.error("Error al cargar los perfiles y módulos del sistema.");
      }
    } finally { 
      setLoading(false); 
    }
  }, [notify]);

  useEffect(() => { 
    const controller = new AbortController();
    fetchData(controller.signal); 
    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getInitialModPerms = () => ({
    view: true, 
    view_same_rank: false, 
    create: false, 
    edit_own: false, 
    edit_same_rank: false, 
    edit_subordinates: false, 
    delete_own: false, 
    delete_same_rank: false, 
    delete_subordinates: false
  });

  const handleOpenCreate = () => {
    const initialModPerms = {};
    modules.forEach(m => { initialModPerms[m.id] = getInitialModPerms(); });

    setFormData({ name: '', permissions: { ...defaultPermissions, modules: initialModPerms } });
    setEditingId(null);
    setHasChanges(false);
    setIsFormOpen(true);
  };

  const handleEdit = (profile) => {
    const mergedModPerms = { ...(profile.permissions?.modules || {}) };
    modules.forEach(m => {
      if (!mergedModPerms[m.id]) { mergedModPerms[m.id] = getInitialModPerms(); }
    });

    setFormData({
      name: profile.name,
      permissions: {
        settings: { ...defaultPermissions.settings, ...(profile.permissions?.settings || {}) },
        modules: mergedModPerms
      }
    });
    setEditingId(profile.id);
    setHasChanges(false);
    setIsFormOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) return notify.warning("El nombre del perfil es obligatorio.");

    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/v1/security/profiles/${editingId}`, formData);
        notify.success("Perfil de permisos actualizado con éxito.");
      } else {
        await api.post('/api/v1/security/profiles', formData);
        notify.success("Nuevo perfil creado exitosamente.");
      }
      setHasChanges(false);
      setIsFormOpen(false);
      fetchData(new AbortController().signal);
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al intentar guardar el perfil."); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const isConfirmed = await confirm({
      title: 'Eliminar Perfil',
      message: `¿Seguro que deseas eliminar el perfil "${name}"? Los usuarios que lo tengan asignado perderán sus permisos actuales inmediatamente.`,
      confirmText: 'Sí, eliminar',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/api/v1/security/profiles/${id}`);
      notify.success("El perfil ha sido eliminado.");
      fetchData(new AbortController().signal);
    } catch (error) { 
      notify.error("No se pudo eliminar el perfil. Asegúrate de que no esté siendo utilizado."); 
    }
  };

  const handleCloseAttempt = async () => {
    if (hasChanges) {
      const isConfirmed = await confirm({
        title: 'Cambios sin guardar',
        message: 'Tienes cambios en la matriz de permisos que no han sido guardados. ¿Deseas descartarlos y volver?',
        confirmText: 'Descartar cambios',
        variant: 'danger'
      });
      if (!isConfirmed) return;
    }
    setIsFormOpen(false);
  };

  const toggleModPerm = (modId, key) => {
    setHasChanges(true);
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        modules: {
          ...prev.permissions.modules,
          [modId]: {
            ...prev.permissions.modules[modId],
            [key]: !prev.permissions.modules[modId][key]
          }
        }
      }
    }));
  };

  const toggleAllModPerms = (modId, isChecked) => {
    setHasChanges(true);
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        modules: {
          ...prev.permissions.modules,
          [modId]: {
            view: isChecked,
            view_same_rank: isChecked,
            create: isChecked,
            edit_own: isChecked,
            edit_same_rank: isChecked,
            edit_subordinates: isChecked,
            delete_own: isChecked,
            delete_same_rank: isChecked,
            delete_subordinates: isChecked
          }
        }
      }
    }));
  };

  const toggleSettingPerm = (key) => {
    setHasChanges(true);
    setFormData(prev => ({
      ...prev,
      permissions: { ...prev.permissions, settings: { ...prev.permissions.settings, [key]: !prev.permissions.settings[key] } }
    }));
  };

  // ==========================================
  // RENDERIZADOR DE FILA DE MÓDULO (Con colores corregidos)
  // ==========================================
  const renderModuleRow = (mod) => {
    const perms = formData.permissions.modules[mod.id] || {};
    const isAllChecked = perms.view && perms.view_same_rank && perms.create && perms.edit_own && perms.edit_same_rank && perms.edit_subordinates && perms.delete_own && perms.delete_same_rank && perms.delete_subordinates;

    return (
      <tr key={mod.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <td className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 font-bold text-sm text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] pl-6">
          <span className="flex items-center gap-2"><Box size={14} className="text-gray-400 dark:text-gray-500"/> {mod.name}</span>
        </td>
        <td className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-center"><input type="checkbox" checked={isAllChecked || false} onChange={(e) => toggleAllModPerms(mod.id, e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer" /></td>
        
        <td className="px-4 py-3 text-center bg-blue-50/5 dark:bg-blue-900/10"><input type="checkbox" checked={perms.view || false} onChange={() => toggleModPerm(mod.id, 'view')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-blue-600 dark:text-blue-500 cursor-pointer" /></td>
        <td className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-center bg-blue-50/10 dark:bg-blue-900/20"><input type="checkbox" checked={perms.view_same_rank || false} onChange={() => toggleModPerm(mod.id, 'view_same_rank')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-blue-600 dark:text-blue-500 cursor-pointer" /></td>
        
        <td className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-center bg-emerald-50/10 dark:bg-emerald-900/20"><input type="checkbox" checked={perms.create || false} onChange={() => toggleModPerm(mod.id, 'create')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-emerald-500 cursor-pointer" /></td>
        
        <td className="px-4 py-3 text-center bg-amber-50/5 dark:bg-amber-900/10"><input type="checkbox" checked={perms.edit_own || false} onChange={() => toggleModPerm(mod.id, 'edit_own')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-amber-500 cursor-pointer" /></td>
        <td className="px-4 py-3 text-center bg-amber-50/10 dark:bg-amber-900/20"><input type="checkbox" checked={perms.edit_same_rank || false} onChange={() => toggleModPerm(mod.id, 'edit_same_rank')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-amber-500 cursor-pointer" /></td>
        <td className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-center bg-amber-50/20 dark:bg-amber-900/30"><input type="checkbox" checked={perms.edit_subordinates || false} onChange={() => toggleModPerm(mod.id, 'edit_subordinates')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-amber-500 cursor-pointer" /></td>
        
        <td className="px-4 py-3 text-center bg-red-50/5 dark:bg-red-900/10"><input type="checkbox" checked={perms.delete_own || false} onChange={() => toggleModPerm(mod.id, 'delete_own')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-red-500 cursor-pointer" /></td>
        <td className="px-4 py-3 text-center bg-red-50/10 dark:bg-red-900/20"><input type="checkbox" checked={perms.delete_same_rank || false} onChange={() => toggleModPerm(mod.id, 'delete_same_rank')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-red-500 cursor-pointer" /></td>
        <td className="px-4 py-3 text-center bg-red-50/20 dark:bg-red-900/30"><input type="checkbox" checked={perms.delete_subordinates || false} onChange={() => toggleModPerm(mod.id, 'delete_subordinates')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-red-500 cursor-pointer" /></td>
      </tr>
    );
  };

  const filteredProfiles = profiles.filter(profile => 
    profile.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastProfile = currentPage * profilesPerPage;
  const indexOfFirstProfile = indexOfLastProfile - profilesPerPage;
  const currentProfiles = filteredProfiles.slice(indexOfFirstProfile, indexOfLastProfile);
  const totalPages = Math.ceil(filteredProfiles.length / profilesPerPage) || 1;

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));


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
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input 
                type="text" 
                placeholder="Buscar perfil..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all shadow-sm"
              />
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
                <tr>
                  <th className="px-6 py-4">Nombre del Perfil</th>
                  <th className="px-6 py-4">Módulos Configurables</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {currentProfiles.length > 0 ? (
                  currentProfiles.map(profile => (
                    <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group cursor-default">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
                            <Shield size={18} />
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">{profile.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          <Box size={14} />
                          {Object.keys(profile.permissions?.modules || {}).length} Módulos 
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(profile)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-xl transition-colors">
                            <Edit2 size={16}/> 
                          </button>
                          <button onClick={() => handleDelete(profile.id, profile.name)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-xl transition-colors">
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="px-6 py-16 text-center">
                       <Key size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                       <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                         {searchTerm ? 'No se encontraron perfiles con esa búsqueda.' : 'No has creado ningún perfil todavía.'}
                       </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredProfiles.length > 0 && (
            <div className="bg-gray-50/80 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Mostrando <span className="font-bold text-gray-900 dark:text-white">{indexOfFirstProfile + 1}</span> a <span className="font-bold text-gray-900 dark:text-white">{Math.min(indexOfLastProfile, filteredProfiles.length)}</span> de <span className="font-bold text-gray-900 dark:text-white">{filteredProfiles.length}</span> perfiles
              </p>
              <div className="flex items-center gap-2">
                <button onClick={prevPage} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm bg-gray-50 dark:bg-gray-800" title="Página Anterior">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 px-2">
                  Página {currentPage} de {totalPages}
                </span>
                <button onClick={nextPage} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm bg-gray-50 dark:bg-gray-800" title="Página Siguiente">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    );
  }

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
        <div className="max-w-md">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Nombre del Perfil <span className="text-red-500">*</span></label>
          <input type="text" required placeholder="Ej: Vendedor" value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setHasChanges(true); }} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 text-gray-900 dark:text-white font-medium shadow-sm transition-all" />
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2"><Box size={16} className="text-blue-500" /> Permisos de Módulos (Registros)</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm custom-scrollbar pb-2">
            <table className="w-full text-left whitespace-nowrap bg-white dark:bg-gray-900">
              <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 border-b border-r border-gray-200 dark:border-gray-700 w-48 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 text-gray-500 dark:text-gray-400">Módulo</th>
                  <th className="px-4 py-3 border-b border-r border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400" title="Seleccionar todos"><div className="flex justify-center"><CheckCheck size={14} /></div></th>
                  <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/5">Ver (Propios)</th>
                  <th className="px-4 py-3 border-b border-r border-gray-200 dark:border-gray-700 text-center text-blue-600 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-900/10">Ver (Mismo Rango)</th>
                  <th className="px-4 py-3 border-b border-r border-gray-200 dark:border-gray-700 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10">Crear</th>
                  <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center text-amber-600 dark:text-amber-400 bg-amber-50/10 dark:bg-amber-900/5">Editar (Propios)</th>
                  <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-900/10">Editar (Mismo Rango)</th>
                  <th className="px-4 py-3 border-b border-r border-gray-200 dark:border-gray-700 text-center text-amber-600 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-900/20">Editar (Inferiores)</th>
                  <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center text-red-600 dark:text-red-400 bg-red-50/10 dark:bg-red-900/5">Eliminar (Propios)</th>
                  <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center text-red-600 dark:text-red-400 bg-red-50/20 dark:bg-red-900/10">Eliminar (Mismo Rango)</th>
                  <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center text-red-600 dark:text-red-400 bg-red-50/40 dark:bg-red-900/20">Eliminar (Inferiores)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                
                {/* 1. RENDERIZAR MÓDULOS CON CARPETA */}
                {categories.map(cat => {
                  const catMods = modules.filter(m => m.category_id === cat.id).sort((a, b) => a.order - b.order);
                  if (catMods.length === 0) return null;
                  return (
                    <React.Fragment key={`cat-${cat.id}`}>
                      <tr className="bg-indigo-50/60 dark:bg-indigo-900/30">
                        <td colSpan="11" className="px-4 py-2 border-y border-indigo-100 dark:border-indigo-800/50 sticky left-0 z-10 bg-indigo-50/95 dark:bg-indigo-900/90">
                          <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">
                            <Folder size={14}/> {cat.name}
                          </div>
                        </td>
                      </tr>
                      {catMods.map(renderModuleRow)}
                    </React.Fragment>
                  );
                })}

                {/* 2. RENDERIZAR MÓDULOS SUELTOS */}
                {(() => {
                  const orphanedMods = modules.filter(m => !m.category_id).sort((a, b) => a.order - b.order);
                  if (orphanedMods.length === 0) return null;
                  return (
                    <React.Fragment>
                      {categories.length > 0 && (
                        <tr className="bg-gray-100/80 dark:bg-gray-800/80">
                          <td colSpan="11" className="px-4 py-2 border-y border-gray-200 dark:border-gray-700 sticky left-0 z-10 bg-gray-100/95 dark:bg-gray-800/90">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                              <Box size={14}/> Módulos Sueltos
                            </div>
                          </td>
                        </tr>
                      )}
                      {orphanedMods.map(renderModuleRow)}
                    </React.Fragment>
                  );
                })()}

              </tbody>
            </table>
          </div>
        </div>

        {/* PERMISOS DE CONFIGURACIÓN */}
        <div>
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
      </div>
    </div>
  );
};

export default ProfilesManager;