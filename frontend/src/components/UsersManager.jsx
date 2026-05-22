import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Users, UserPlus, Mail, Shield, Key, Loader2, Edit2, X, Save, Lock, Trash2, Search, ChevronLeft, ChevronRight, AlertTriangle, Ban, CheckCircle, LogOut, ShieldAlert, Building, UserCheck, Clock } from 'lucide-react'; 
import { useNotification } from '../context/NotificationContext';

const UsersManager = () => {
  const { notify, confirm } = useNotification();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [globalPolicy, setGlobalPolicy] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sendInvite, setSendInvite] = useState(true);

  const [createData, setCreateData] = useState({ email: '', first_name: '', last_name: '', role_id: '', profile_id: '', password: '', is_external: false });  
  const [editData, setEditData] = useState({ first_name: '', last_name: '', role_id: '', profile_id: '', password: '' });
  // 🔥 NUEVOS ESTADOS PARA APROBACIÓN Y TABS
  const [activeTab, setActiveTab] = useState('internal'); 
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveData, setApproveData] = useState({ role_id: '', profile_id: '' });

  const openApproveModal = (user) => {
    setSelectedUser(user);
    setApproveData({ role_id: '', profile_id: '' });
    setIsApproveOpen(true);
  };

  const handleApproveUser = async (e) => {
    e.preventDefault();
    if (!approveData.profile_id) {
      notify.error("Debes asignarle un Perfil para aprobarlo.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        profile_id: parseInt(approveData.profile_id, 10),
        role_id: approveData.role_id ? parseInt(approveData.role_id, 10) : null
      };
      await api.put(`/api/v1/security/users/${selectedUser.id}/approve`, payload);
      notify.success(`¡Usuario ${selectedUser.first_name} aprobado con éxito!`);
      setIsApproveOpen(false);
      fetchData(new AbortController().signal);
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al aprobar usuario.");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, profilesRes, policyRes] = await Promise.all([
        api.get('/api/v1/auth/users', { signal }),
        api.get('/api/v1/security/roles', { signal }),
        api.get('/api/v1/security/profiles', { signal }),
        api.get('/api/v1/security/policies', { signal }) 
      ]);
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
      setProfiles(profilesRes.data || []);
      setGlobalPolicy(policyRes.data || null);
    } catch (error) { 
      if (error.name !== 'CanceledError') {
        notify.error("Error al cargar los datos de seguridad.");
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

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsedRoleId = createData.role_id ? parseInt(createData.role_id, 10) : null;
      const parsedProfileId = createData.profile_id ? parseInt(createData.profile_id, 10) : null;

      // 🔥 Armamos el paquete de datos
      const payload = { 
        ...createData,
        role_id: parsedRoleId,
        profile_id: parsedProfileId,
        send_invite: sendInvite // Agregamos la decisión del switch
      };

      // Si se envía invitación, eliminamos la clave manual del paquete
      if (sendInvite) {
          delete payload.password;
      }

      // Hacemos el POST
      const response = await api.post('/api/v1/security/users/invite', payload);
      
      // 🔥 Usamos el mensaje dinámico que nos devuelve el backend
      notify.success(response.data.message || "Usuario creado con éxito.");
      setActiveTab(createData.is_external ? 'external_active' : 'internal');
      
      setIsCreateOpen(false);
      setCreateData({ email: '', first_name: '', last_name: '', role_id: '', profile_id: '', password: '', is_external: false });
      setSendInvite(true); // Reiniciamos el switch para el próximo usuario
      fetchData(new AbortController().signal);
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al dar de alta al usuario."); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsedRoleId = editData.role_id ? parseInt(editData.role_id, 10) : null;
      const parsedProfileId = editData.profile_id ? parseInt(editData.profile_id, 10) : null;

      const payload = {
        first_name: editData.first_name,
        last_name: editData.last_name,
        role_id: parsedRoleId,
        profile_id: parsedProfileId
      };

      if (editData.password.trim() !== '') {
        payload.password = editData.password;
      }

      await api.put(`/api/v1/security/users/${selectedUser.id}/access`, payload);
      notify.success("Accesos y perfil del usuario actualizados.");
      setIsEditOpen(false);
      fetchData(new AbortController().signal);
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al actualizar la configuración del usuario."); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    const isConfirmed = await confirm({
      title: 'Dar de baja definitiva',
      message: `¿Estás seguro de que deseas eliminar permanentemente a ${userName}? Esta acción borrará su historial de accesos. Para algo temporal, usa "Bloquear".`,
      confirmText: 'Sí, dar de baja',
      variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
        await api.delete(`/api/v1/security/users/${userId}`);
        notify.success("El usuario ha sido dado de baja permanentemente.");
        fetchData(new AbortController().signal);
    } catch (error) {
        notify.error(error.response?.data?.detail || "Error al intentar dar de baja al usuario.");
    }
  };

  const handleToggleStatus = async (userId, isActive, userName) => {
    const actionText = isActive ? 'Bloquear' : 'Desbloquear';
    const isConfirmed = await confirm({
      title: `${actionText} Acceso`,
      message: isActive
        ? `¿Estás seguro de bloquear a ${userName}? Será desconectado inmediatamente de todos sus dispositivos y no podrá volver a entrar.`
        : `¿Deseas restaurar el acceso de ${userName}? Podrá volver a iniciar sesión con su contraseña actual.`,
      confirmText: `Sí, ${actionText}`,
      variant: isActive ? 'danger' : 'primary'
    });
    if (!isConfirmed) return;
    try {
      await api.put(`/api/v1/security/users/${userId}/toggle-status`);
      notify.success(`Usuario ${isActive ? 'bloqueado' : 'desbloqueado'} con éxito.`);
      fetchData(new AbortController().signal);
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al cambiar el estado del usuario.");
    }
  };

  const handleRevokeSessions = async (userId, userName) => {
    const isConfirmed = await confirm({
      title: 'Forzar Cierre de Sesión',
      message: `Esto desconectará a ${userName} de todos sus dispositivos de forma inmediata. Tendrá que volver a introducir su contraseña para entrar.`,
      confirmText: 'Sí, cerrar sesiones',
      variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.post(`/api/v1/security/users/${userId}/revoke-sessions`);
      notify.success(`Se han cerrado todas las sesiones de ${userName}.`);
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al revocar las sesiones.");
    }
  };

  const handleRevokeMfa = async (userId, userName) => {
    const isConfirmed = await confirm({
      title: 'Revocar Doble Factor (MFA)',
      message: `¿Estás seguro de que deseas revocar el MFA de ${userName}? Si el MFA es obligatorio, se le pedirá escanear un nuevo código QR en su próximo inicio de sesión. (Sus sesiones actuales también se cerrarán por seguridad).`,
      confirmText: 'Sí, revocar MFA',
      variant: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.post(`/api/v1/security/users/${userId}/revoke-mfa`);
      notify.success(`MFA revocado exitosamente para ${userName}.`);
      fetchData(new AbortController().signal);
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al intentar revocar el MFA.");
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditData({ 
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role_id: user.role_id ? user.role_id.toString() : '', 
      profile_id: user.profile_id ? user.profile_id.toString() : '',
      password: '' 
    });
    setIsEditOpen(true);
  };

  // 🔥 NUEVO: Validador en tiempo real de la contraseña 🔥
  const getPasswordValidation = (password) => {
    if (!globalPolicy || !globalPolicy.password_complexity_active) return null;
    
    return {
      length: password.length >= (globalPolicy.pwd_min_length || 6),
      uppercase: globalPolicy.pwd_require_uppercase ? /[A-Z]/.test(password) : null,
      lowercase: globalPolicy.pwd_require_lowercase ? /[a-z]/.test(password) : null,
      numbers: globalPolicy.pwd_require_numbers ? /[0-9]/.test(password) : null,
      special: globalPolicy.pwd_require_special ? /[^A-Za-z0-9]/.test(password) : null,
    };
  };

  const renderPasswordChecklist = (password) => {
    const validation = getPasswordValidation(password);
    if (!validation) return null; 

    const Requirement = ({ met, label }) => {
      if (met === null) return null; 
      return (
        <div className={`flex items-center gap-1.5 text-[10px] font-bold transition-colors duration-300 ${met ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>
          <CheckCircle size={12} className={met ? 'opacity-100' : 'opacity-30'} />
          <span>{label}</span>
        </div>
      );
    };

    return (
      <div className="grid grid-cols-2 gap-y-2 mt-3 p-3 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800">
        <Requirement met={validation.length} label={`Mínimo ${globalPolicy.pwd_min_length} caracteres`} />
        <Requirement met={validation.uppercase} label="Una mayúscula" />
        <Requirement met={validation.lowercase} label="Una minúscula" />
        <Requirement met={validation.numbers} label="Un número" />
        <Requirement met={validation.special} label="Un símbolo (!@#...)" />
      </div>
    );
  };

  // 🔥 FILTRO ACTUALIZADO CON TABS
  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    const matchesSearch = fullName.includes(term) || email.includes(term);

    if (!matchesSearch) return false;

    if (activeTab === 'internal') return !user.is_external;
    if (activeTab === 'external_active') return user.is_external && user.is_active;
    if (activeTab === 'external_pending') return user.is_external && !user.is_active;
    return true;
  });

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-gray-800/60 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Users className="text-blue-500" /> Usuarios de la Empresa</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Administra quién tiene acceso a la plataforma, sus permisos y credenciales.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400" />
            </div>
            <input 
              type="text" placeholder="Buscar nombre o email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
            />
          </div>
          <button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0">
            <UserPlus size={18} /> <span className="hidden sm:inline">Crear Usuario</span>
          </button>
        </div>
      </div>
      {/* 🔥 TABS DE NAVEGACIÓN */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 gap-6">
        <button onClick={() => setActiveTab('internal')} className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === 'internal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Shield size={16}/> Staff Interno
        </button>
        <button onClick={() => setActiveTab('external_active')} className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === 'external_active' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <UserCheck size={16}/> Clientes App
        </button>
        <button onClick={() => setActiveTab('external_pending')} className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all relative ${activeTab === 'external_pending' ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Clock size={16}/> Solicitudes
          {users.filter(u => u.is_external && !u.is_active).length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1 animate-pulse">
              {users.filter(u => u.is_external && !u.is_active).length}
            </span>
          )}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">
            {activeTab !== 'external_pending' && <th className="px-6 py-4">Rol (Jerarquía)</th>}
            {activeTab !== 'external_pending' && <th className="px-6 py-4">Perfil (Permisos)</th>}
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {currentUsers.length > 0 ? (
                currentUsers.map(user => (
                  <tr key={user.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group cursor-default ${!user.is_active ? 'opacity-70 bg-red-50/20 dark:bg-red-900/10' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">{user.first_name || 'Sin Nombre'} {user.last_name || ''}</span>
                        {user.is_superadmin && <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Admin</span>}
                        {!user.is_active && <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">Bloqueado</span>}
                      </div>
                      <div className="text-xs font-medium text-gray-500 flex items-center gap-1 mt-0.5"><Mail size={12} className="opacity-70"/> {user.email}</div>
                    </td>
                    {activeTab !== 'external_pending' && (
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {user.role_id ? (
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-800/50 font-medium">
                          <Shield size={14}/> {roles.find(r => r.id === user.role_id)?.name}
                        </span>
                      ) : <span className="text-gray-400 italic font-medium px-2.5 py-1">Sin Rol</span>}
                    </td>)}
                    {activeTab !== 'external_pending' && (

                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {user.profile_id ? (
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500 px-2.5 py-1 rounded-lg border border-amber-100 dark:border-amber-800/50 font-medium">
                          <Key size={14}/> {profiles.find(p => p.id === user.profile_id)?.name}
                        </span>
                      ) : <span className="text-gray-400 italic font-medium px-2.5 py-1">Sin Perfil</span>}
                    </td>)}
                    <td className="px-6 py-4 text-right">
                      {activeTab === 'external_pending' ? (
                      <button onClick={() => openApproveModal(user)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95">
                        Revisar y Aprobar
                      </button>
                    ) : (
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {user.is_active && !user.is_superadmin && (
                           <button onClick={() => handleRevokeMfa(user.id, user.first_name)} className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 p-2 rounded-xl transition-colors" title="Revocar Doble Factor (MFA)"><ShieldAlert size={16}/></button>
                        )}

                        <button onClick={() => handleRevokeSessions(user.id, user.first_name)} className="text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 p-2 rounded-xl transition-colors" title="Cerrar sesiones activas"><LogOut size={16}/></button>
                        
                        {!user.is_superadmin && (
                           <button onClick={() => handleToggleStatus(user.id, user.is_active, user.first_name)} className={`p-2 rounded-xl transition-colors ${user.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30' : 'text-red-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30'}`} title={user.is_active ? "Bloquear Acceso" : "Desbloquear Acceso"}>
                              {user.is_active ? <Ban size={16}/> : <CheckCircle size={16}/>}
                           </button>
                        )}

                        <button onClick={() => openEditModal(user)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-xl transition-colors" title="Editar Accesos"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteUser(user.id, user.first_name)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-xl transition-colors" title="Eliminar definitivamente"><Trash2 size={16}/></button>
                      </div>
                    )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center">
                    <Users size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No se encontraron usuarios que coincidan con "{searchTerm}".</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredUsers.length > 0 && (
          <div className="bg-gray-50/80 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Mostrando <span className="font-bold text-gray-900 dark:text-white">{indexOfFirstUser + 1}</span> a <span className="font-bold text-gray-900 dark:text-white">{Math.min(indexOfLastUser, filteredUsers.length)}</span> de <span className="font-bold text-gray-900 dark:text-white">{filteredUsers.length}</span> usuarios
            </p>
            <div className="flex items-center gap-2">
              <button onClick={prevPage} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm bg-gray-50 dark:bg-gray-800"><ChevronLeft size={16} /></button>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 px-2">Página {currentPage} de {totalPages}</span>
              <button onClick={nextPage} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm bg-gray-50 dark:bg-gray-800"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CREAR USUARIO */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><UserPlus size={18} className="text-blue-500"/> Alta de Nuevo Usuario</h3>
              <button onClick={() => setIsCreateOpen(false)} disabled={isSaving} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors disabled:opacity-50"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nombre</label>
                  <input type="text" required value={createData.first_name} onChange={e => setCreateData({...createData, first_name: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Apellido</label>
                  <input type="text" required value={createData.last_name} onChange={e => setCreateData({...createData, last_name: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email Corporativo</label>
                <input type="email" required value={createData.email} onChange={e => setCreateData({...createData, email: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" placeholder="usuario@empresa.com" />
              </div>
              {/* 🔥 NUEVO: TIPO DE USUARIO (INTERNO VS EXTERNO) 🔥 */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                 <button 
                    type="button"
                    onClick={() => setCreateData({...createData, is_external: false})}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${!createData.is_external ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-blue-500' : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                 >
                    <Shield size={20} />
                    <span className="text-xs font-bold">Staff / Back-office</span>
                 </button>
                 <button 
                    type="button"
                    onClick={() => setCreateData({...createData, is_external: true})}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${createData.is_external ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500' : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                 >
                    <Users size={20} />
                    <span className="text-xs font-bold">Cliente / App (B2C)</span>
                 </button>
              </div>
              {/* 🔥 NUEVO: SWITCH DE INVITACIÓN POR CORREO 🔥 */}
              <label className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${sendInvite ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50' : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'}`}>
                <input 
                   type="checkbox" 
                   checked={sendInvite} 
                   onChange={(e) => setSendInvite(e.target.checked)} 
                   className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                     <Mail size={14} className={sendInvite ? 'text-blue-500' : 'text-gray-400'} /> 
                     Enviar invitación automática por Email
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                     Recomendado (ISO 27001). El usuario configurará su propia contraseña al entrar al enlace.
                  </span>
                </div>
              </label>

              {/* BLOQUE DE CONTRASEÑA MODIFICADO */}
              <div className={`transition-all duration-300 ${sendInvite ? 'opacity-40 grayscale-[50%] pointer-events-none' : ''}`}>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Lock size={12} className="text-amber-500"/> Contraseña Manual</span>
                  {globalPolicy?.password_complexity_active && !sendInvite && (
                    <span className="text-[9px] text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle size={10} /> Alta Complejidad Activa
                    </span>
                  )}
                </label>
                <input 
                  type="text" 
                  required={!sendInvite} // 🔥 Solo es obligatorio si el switch está apagado
                  disabled={sendInvite}  // 🔥 Lo bloqueamos físicamente
                  minLength={globalPolicy?.pwd_min_length || 6} 
                  placeholder={sendInvite ? "Se generará automáticamente..." : "Escribe la contraseña..."} 
                  value={createData.password} 
                  onChange={e => setCreateData({...createData, password: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-amber-50/30 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50 font-mono transition-all shadow-sm" 
                />
                
                {/* Ocultamos los requisitos si usamos correo para limpiar la vista */}
                {!sendInvite && renderPasswordChecklist(createData.password)}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Shield size={12} className="text-blue-500"/> Rol (Jerarquía) 
                    {!createData.is_external && <span className="text-red-500 text-sm">*</span>}
                  </label>
                  <select 
                    required={!createData.is_external} 
                    value={createData.role_id} 
                    onChange={e => setCreateData({...createData, role_id: e.target.value})} 
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
                  >
                    {/* Si es Staff, la opción vacía está deshabilitada. Si es externo, sí puede elegir "Sin Rol" */}
                    <option value="" disabled={!createData.is_external}>
                      {!createData.is_external ? "Selecciona un Rol..." : "Sin Rol (Opcional)"}
                    </option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Key size={12} className="text-emerald-500"/> Perfil (Permisos) 
                    {!createData.is_external && <span className="text-red-500 text-sm">*</span>}
                  </label>
                  <select 
                    required={!createData.is_external} 
                    value={createData.profile_id} 
                    onChange={e => setCreateData({...createData, profile_id: e.target.value})} 
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
                  >
                    <option value="" disabled={!createData.is_external}>
                      {!createData.is_external ? "Selecciona un Perfil..." : "Sin Perfil (Opcional)"}
                    </option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800 mt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2">
                   {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                   Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUARIO */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
               <div>
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Edit2 size={18} className="text-blue-500"/> Editar Accesos</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">{selectedUser?.email}</p>
               </div>
               <button onClick={() => setIsEditOpen(false)} disabled={isSaving} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors disabled:opacity-50"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-6 space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nombre</label>
                  <input type="text" required value={editData.first_name} onChange={e => setEditData({...editData, first_name: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Apellido</label>
                  <input type="text" required value={editData.last_name} onChange={e => setEditData({...editData, last_name: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
                </div>
              </div>

              <div className="bg-amber-50/30 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl">
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Lock size={12} className="text-amber-500"/> Forzar Nueva Contraseña</span>
                  {globalPolicy?.password_complexity_active && (
                    <span className="text-[9px] text-amber-500 font-bold bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle size={10} /> Reglas Activas
                    </span>
                  )}
                </label>
                <input type="text" minLength={globalPolicy?.pwd_min_length || 6} placeholder="Dejar en blanco para no cambiar..." value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})} className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50 font-mono transition-all shadow-sm" />
                
                {editData.password.length > 0 && renderPasswordChecklist(editData.password)}

                <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-2 font-medium flex items-center gap-1"><AlertTriangle size={12}/> El usuario será desconectado si la cambias.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800 mt-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Shield size={12} className="text-blue-500"/> Rol (Jerarquía)</label>
                  <select value={editData.role_id} onChange={e => setEditData({...editData, role_id: e.target.value})} className="w-full px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm">
                    <option value="">Sin Rol</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Key size={12} className="text-emerald-500"/> Perfil (Permisos)</label>
                  <select value={editData.profile_id} onChange={e => setEditData({...editData, profile_id: e.target.value})} className="w-full px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm">
                    <option value="">Sin Perfil</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800 mt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-blue-700 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                  Aplicar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE APROBACIÓN */}
      {isApproveOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-amber-50/50 dark:bg-amber-900/10">
               <div>
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Clock size={18} className="text-amber-500"/> Aprobar Solicitud</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">Revisa los datos enviados desde la App</p>
               </div>
               <button onClick={() => setIsApproveOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 p-1.5 rounded-lg"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleApproveUser} className="p-6 space-y-5">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                 <h4 className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1.5"><Building size={14}/> Datos de Registro</h4>
                 <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="block text-[10px] text-gray-400 uppercase font-bold">Email</span><span className="font-medium dark:text-white">{selectedUser.email}</span></div>

                    {/* 🔥 RENDERIZADO DINÁMICO DE TODOS LOS CAMPOS DEL FORMULARIO 🔥 */}
                    {selectedUser.profile_data && Object.entries(selectedUser.profile_data).map(([key, value]) => (
                       <div key={key}>
                          <span className="block text-[10px] text-gray-400 uppercase font-bold">
                             {key.replace(/_/g, ' ')} {/* Formatea "tipo_de_documento" a "tipo de documento" */}
                          </span>
                          <span className="font-medium dark:text-white">
                             {value !== null && value !== '' ? value.toString() : 'No provisto'}
                          </span>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Perfil Definitivo *</label>
                  <select required value={approveData.profile_id} onChange={e => setApproveData({...approveData, profile_id: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/50">
                    <option value="">Selecciona Perfil...</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Rol (Opcional)</label>
                  <select value={approveData.role_id} onChange={e => setApproveData({...approveData, role_id: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/50">
                    <option value="">Sin Rol</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800 mt-2">
                <button type="button" onClick={() => setIsApproveOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Cancelar</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl shadow-md hover:bg-amber-600 flex items-center gap-2">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Autorizar Acceso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManager;