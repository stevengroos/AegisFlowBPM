import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { 
  Shield, Key, Globe, Save, Loader2, Plus, X, AlertTriangle, 
  MonitorSmartphone, Smartphone, Layers, Users, Edit2, Trash2, ArrowLeft 
} from 'lucide-react'; 
import { useNotification } from '../context/NotificationContext';
import SmtpSettings from './SmtpSettings';
import SsoSettings from './SsoSettings';
import AiSettings from './AiSettings';

const DEFAULT_POLICY = {
  name: '', role_id: null, profile_id: null,
  max_login_attempts: 5, temp_lockout_minutes: 15, max_temp_lockouts: 3,
  password_expiration_active: false, password_expiration_days: 90,
  password_history_active: false, password_history_count: 3,
  password_complexity_active: false, pwd_min_length: 8, pwd_max_length: 128,
  pwd_require_uppercase: true, pwd_require_lowercase: true, pwd_require_numbers: true, pwd_require_special: true,
  inactivity_timeout_minutes: 15, max_concurrent_sessions: 3,
  ip_whitelist_active: false, allowed_ips: [],
  mfa_active: false, mfa_required: false
};

const SecurityPolicies = () => {
  const { notify, confirm } = useNotification();
  
  // ESTADOS DE DATOS
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [globalData, setGlobalData] = useState(null);
  const [granularPolicies, setGranularPolicies] = useState([]);
  const [roles, setRoles] = useState([]);
  const [profiles, setProfiles] = useState([]);

  // ESTADOS DE LA VISTA
  const [view, setView] = useState('global'); // 'global' | 'granular_list' | 'granular_form'
  const [formData, setFormData] = useState(DEFAULT_POLICY);
  const [targetType, setTargetType] = useState('role'); // 'role' | 'profile'
  const [ipInput, setIpInput] = useState('');

  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [globalRes, granularRes, rolesRes, profilesRes] = await Promise.all([
        api.get('/api/v1/security/policies', { signal }),
        api.get('/api/v1/security/policies/granular', { signal }),
        api.get('/api/v1/security/roles', { signal }),
        api.get('/api/v1/security/profiles', { signal })
      ]);
      
      setGlobalData(globalRes.data);
      setGranularPolicies(granularRes.data || []);
      setRoles(rolesRes.data || []);
      setProfiles(profilesRes.data || []);
      
      if (view === 'global') setFormData(globalRes.data);
    } catch (error) {
      if (error.name !== 'CanceledError') notify.error("Error al cargar las políticas.");
    } finally {
      setLoading(false);
    }
  }, [notify, view]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // ==========================================
  // MANEJO DEL FORMULARIO
  // ==========================================
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'name' ? value : Number(value))
    }));
  };

  const handleTargetTypeChange = (e) => {
    const newType = e.target.value;
    setTargetType(newType);
    setFormData(prev => ({ ...prev, role_id: null, profile_id: null }));
  };

  const handleTargetIdChange = (e) => {
    const value = e.target.value ? Number(e.target.value) : null;
    setFormData(prev => ({ ...prev, [targetType === 'role' ? 'role_id' : 'profile_id']: value }));
  };

  const handleAddIp = () => {
    const ip = ipInput.trim();
    if (!ip) return;
    if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/.test(ip)) {
      return notify.warning("Formato de IP inválido. Ejemplo: 192.168.1.1 o 10.0.0.0/24");
    }
    if (!formData.allowed_ips.includes(ip)) {
      setFormData(prev => ({ ...prev, allowed_ips: [...prev.allowed_ips, ip] }));
    }
    setIpInput('');
  };

  const handleRemoveIp = (ipToRemove) => {
    setFormData(prev => ({ ...prev, allowed_ips: prev.allowed_ips.filter(ip => ip !== ipToRemove) }));
  };

  // ==========================================
  // GUARDAR Y ELIMINAR
  // ==========================================
  const handleSave = async () => {
    if (view === 'granular_form' && !formData.name.trim()) return notify.warning("Debes ponerle un nombre a la política.");
    if (view === 'granular_form' && !formData.role_id && !formData.profile_id) return notify.warning("Debes seleccionar un Rol o Perfil.");

    setIsSaving(true);
    try {
      if (view === 'global') {
        const response = await api.put('/api/v1/security/policies', formData);
        setGlobalData(response.data);
        setFormData(response.data);
        notify.success("Política global actualizada.");
      } else {
        if (formData.id) {
          await api.put(`/api/v1/security/policies/granular/${formData.id}`, formData);
          notify.success("Política de grupo actualizada.");
        } else {
          await api.post('/api/v1/security/policies/granular', formData);
          notify.success("Nueva política de grupo creada.");
        }
        await fetchData(new AbortController().signal);
        setView('granular_list');
      }
    } catch (error) {
      notify.error(error.response?.data?.detail || "Error al guardar la política.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGranular = async (id, name) => {
    const isConfirmed = await confirm({
      title: 'Eliminar Política',
      message: `¿Eliminar la política '${name}'? Los usuarios afectados volverán a usar la política Global.`,
      confirmText: 'Sí, eliminar', variant: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await api.delete(`/api/v1/security/policies/granular/${id}`);
      notify.success("Política eliminada.");
      fetchData(new AbortController().signal);
    } catch (error) {
      notify.error("Error al eliminar la política.");
    }
  };

  // ==========================================
  // NAVEGACIÓN
  // ==========================================
  const switchToGlobal = () => { setView('global'); setFormData(globalData); };
  const switchToList = () => { setView('granular_list'); };
  const openNewGranular = () => { setTargetType('role'); setFormData({ ...DEFAULT_POLICY, name: 'Nueva Política' }); setView('granular_form'); };
  const openEditGranular = (policy) => { setTargetType(policy.role_id ? 'role' : 'profile'); setFormData(policy); setView('granular_form'); };

  // ==========================================
  // COMPONENTES AUXILIARES
  // ==========================================
  const ToggleSwitch = ({ checked, onChange, name }) => (
    <button type="button" onClick={() => onChange({ target: { name, type: 'checkbox', checked: !checked } })} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  const getGroupName = (policy) => {
    if (policy.role_id) return `Rol: ${roles.find(r => r.id === policy.role_id)?.name || 'Desconocido'}`;
    if (policy.profile_id) return `Perfil: ${profiles.find(p => p.id === policy.profile_id)?.name || 'Desconocido'}`;
    return 'Sin asignar';
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>;

  // ==========================================
  // RENDER: EL FORMULARIO REUTILIZABLE
  // ==========================================
  const renderFormBlocks = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
      
      {/* CABECERA EXCLUSIVA PARA POLÍTICAS GRANULARES */}
      {view === 'granular_form' && (
        <div className="lg:col-span-2 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 p-6">
          <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-400 mb-4 flex items-center gap-2"><Layers size={20}/> Reglas de Asignación</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nombre de la Política</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Ej. Acceso Gerencial" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Aplicar A</label>
              <select value={targetType} onChange={handleTargetTypeChange} className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50">
                <option value="role">Un Rol (Jerarquía)</option>
                <option value="profile">Un Perfil (Permisos)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Seleccione el {targetType === 'role' ? 'Rol' : 'Perfil'}</label>
              <select value={(targetType === 'role' ? formData.role_id : formData.profile_id) || ''} onChange={handleTargetIdChange} className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50">
                <option value="">Seleccione...</option>
                {targetType === 'role' 
                  ? roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                  : profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                }
              </select>
            </div>
          </div>
        </div>
      )}

      {/* BLOQUE 1: FUERZA BRUTA */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-600 dark:text-red-400"><AlertTriangle size={20}/></div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Protección contra Fuerza Bruta</h3>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Intentos Fallidos Permitidos</label>
            <input type="number" min="1" max="10" name="max_login_attempts" value={formData.max_login_attempts} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Tiempo Bloqueo (Min)</label>
              <input type="number" min="1" max="1440" name="temp_lockout_minutes" value={formData.temp_lockout_minutes} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Bloqueos Máximos</label>
              <input type="number" min="1" max="10" name="max_temp_lockouts" value={formData.max_temp_lockouts} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: CONTRASEÑA */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 row-span-2">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg text-amber-600 dark:text-amber-400"><Key size={20}/></div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Políticas de Credenciales</h3>
        </div>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div><p className="font-bold text-sm text-gray-900 dark:text-white">Complejidad Obligatoria</p><p className="text-xs text-gray-500">Formato estricto de claves.</p></div>
            <ToggleSwitch checked={formData.password_complexity_active} onChange={handleChange} name="password_complexity_active" />
          </div>
          {formData.password_complexity_active && (
            <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Mínimo</label><input type="number" min="6" name="pwd_min_length" value={formData.pwd_min_length} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-900 dark:border-gray-700 outline-none" /></div>
                <div><label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Máximo</label><input type="number" min="8" name="pwd_max_length" value={formData.pwd_max_length} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-900 dark:border-gray-700 outline-none" /></div>
              </div>
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" name="pwd_require_uppercase" checked={formData.pwd_require_uppercase} onChange={handleChange} className="rounded text-indigo-600" /> Mayúscula (A-Z)</label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" name="pwd_require_lowercase" checked={formData.pwd_require_lowercase} onChange={handleChange} className="rounded text-indigo-600" /> Minúscula (a-z)</label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" name="pwd_require_numbers" checked={formData.pwd_require_numbers} onChange={handleChange} className="rounded text-indigo-600" /> Número (0-9)</label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" name="pwd_require_special" checked={formData.pwd_require_special} onChange={handleChange} className="rounded text-indigo-600" /> Símbolo Especial</label>
              </div>
            </div>
          )}
          <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />
          <div className="flex items-start justify-between">
            <div><p className="font-bold text-sm text-gray-900 dark:text-white">Expiración de Contraseña</p></div>
            <ToggleSwitch checked={formData.password_expiration_active} onChange={handleChange} name="password_expiration_active" />
          </div>
          {formData.password_expiration_active && (
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Días de Validez</label><input type="number" min="1" name="password_expiration_days" value={formData.password_expiration_days} onChange={handleChange} className="w-full px-4 py-2 border rounded-xl text-sm bg-gray-50 dark:bg-gray-950 dark:border-gray-800 outline-none" /></div>
          )}
          <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />
          <div className="flex items-start justify-between">
            <div><p className="font-bold text-sm text-gray-900 dark:text-white">Historial de Contraseñas</p></div>
            <ToggleSwitch checked={formData.password_history_active} onChange={handleChange} name="password_history_active" />
          </div>
          {formData.password_history_active && (
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">No repetir últimas (X) claves</label><input type="number" min="1" name="password_history_count" value={formData.password_history_count} onChange={handleChange} className="w-full px-4 py-2 border rounded-xl text-sm bg-gray-50 dark:bg-gray-950 dark:border-gray-800 outline-none" /></div>
          )}
        </div>
      </div>

      {/* BLOQUE 3: SESIONES */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400"><MonitorSmartphone size={20}/></div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Sesiones de Usuario</h3>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Sesiones Simultáneas Permitidas</label>
            <input type="number" min="1" name="max_concurrent_sessions" value={formData.max_concurrent_sessions} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Cierre por Inactividad (Minutos)</label>
            <input type="number" min="1" name="inactivity_timeout_minutes" value={formData.inactivity_timeout_minutes} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
        </div>
      </div>

      {/* BLOQUE 4: IP Y RED */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg text-emerald-600 dark:text-emerald-400"><Globe size={20}/></div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Restricción de Red (IP)</h3>
          </div>
          <ToggleSwitch checked={formData.ip_whitelist_active} onChange={handleChange} name="ip_whitelist_active" />
        </div>
        <div className={`transition-all duration-300 ${!formData.ip_whitelist_active ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="Ej. 192.168.1.1" value={ipInput} onChange={(e) => setIpInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddIp()} className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none" />
            <button type="button" onClick={handleAddIp} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-xl flex items-center justify-center"><Plus size={18}/></button>
          </div>
          <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 min-h-[80px] flex flex-wrap gap-2 content-start">
            {formData.allowed_ips.length === 0 ? <span className="text-xs text-gray-400 italic">Sin IPs permitidas.</span> : formData.allowed_ips.map((ip, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 text-xs font-bold font-mono">{ip} <button type="button" onClick={() => handleRemoveIp(ip)} className="hover:text-red-500 ml-1"><X size={12}/></button></span>
            ))}
          </div>
        </div>
      </div>

      {/* BLOQUE 5: MFA */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400"><Smartphone size={20}/></div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Doble Factor de Autenticación (MFA)</h3>
          </div>
          <ToggleSwitch checked={formData.mfa_active} onChange={handleChange} name="mfa_active" />
        </div>
        {formData.mfa_active && (
          <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center mt-4">
            <div><p className="font-bold text-sm text-gray-900 dark:text-white">MFA Obligatorio</p><p className="text-xs text-gray-500">Forzar a este grupo a usar Google Authenticator.</p></div>
            <ToggleSwitch checked={formData.mfa_required} onChange={handleChange} name="mfa_required" />
          </div>
        )}
      </div>
      {/* 🔥 AQUI INCRUSTAMOS LAS CONFIGURACIONES GLOBALES EXTRAS 🔥 */}
      {view === 'global' && (
        <div className="lg:col-span-2">
          <SmtpSettings />
          <AiSettings />
          <SsoSettings /> {/* <-- AQUÍ AGREGAMOS EL BOTÓN ROJO DE SSO */}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      
      {/* TABS DE NAVEGACIÓN */}
      <div className="flex gap-6 border-b border-gray-200 dark:border-gray-800 mb-8">
        <button 
          onClick={switchToGlobal} 
          className={`pb-4 text-sm font-bold flex items-center gap-2 transition-colors ${view === 'global' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <Globe size={18}/> Política Global
        </button>
        <button 
          onClick={switchToList} 
          className={`pb-4 text-sm font-bold flex items-center gap-2 transition-colors ${view.startsWith('granular') ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <Users size={18}/> Políticas por Grupos
        </button>
      </div>

      {/* HEADER DE ACCIÓN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          {view === 'global' && <><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reglas Base de la Empresa</h2><p className="text-sm text-gray-500 mt-1">Aplican a todos los usuarios que no tengan una regla de grupo específica.</p></>}
          {view === 'granular_list' && <><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reglas de Excepción</h2><p className="text-sm text-gray-500 mt-1">Crea políticas estrictas para roles o perfiles específicos.</p></>}
          {view === 'granular_form' && <><h2 className="text-2xl font-bold text-gray-900 dark:text-white">{formData.id ? 'Editar Política' : 'Nueva Política de Grupo'}</h2></>}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {view === 'granular_form' && (
            <button onClick={switchToList} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold text-sm px-4 py-2.5 flex items-center gap-2"><ArrowLeft size={16}/> Cancelar</button>
          )}
          {view === 'granular_list' && (
            <button onClick={openNewGranular} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all"><Plus size={18}/> Crear Política de Grupo</button>
          )}
          {(view === 'global' || view === 'granular_form') && (
            <button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-70">
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar Cambios
            </button>
          )}
        </div>
      </div>

      {/* VISTAS */}
      {view === 'granular_list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {granularPolicies.length === 0 ? (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
              <Layers size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No hay políticas por grupos</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">Actualmente todos los usuarios obedecen a la Política Global. Crea una nueva política para sobrescribir reglas para un Rol o Perfil específico.</p>
            </div>
          ) : (
            granularPolicies.map(policy => (
              <div key={policy.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between group">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{policy.name}</h3>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditGranular(policy)} className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Edit2 size={14}/></button>
                      <button onClick={() => handleDeleteGranular(policy.id, policy.name)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-full mb-4 border border-indigo-100 dark:border-indigo-800/50">
                    <Layers size={12}/> {getGroupName(policy)}
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p className="flex items-center gap-2"><Smartphone size={14} className={policy.mfa_active ? "text-purple-500" : ""}/> MFA: <strong>{policy.mfa_active ? (policy.mfa_required ? 'Obligatorio' : 'Opcional') : 'Apagado'}</strong></p>
                    <p className="flex items-center gap-2"><Key size={14} className={policy.password_complexity_active ? "text-amber-500" : ""}/> Clave Estricta: <strong>{policy.password_complexity_active ? 'Sí' : 'No'}</strong></p>
                    <p className="flex items-center gap-2"><MonitorSmartphone size={14} className="text-blue-500"/> Inactividad: <strong>{policy.inactivity_timeout_minutes} min</strong></p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        renderFormBlocks()
      )}

    </div>
  );
};

export default SecurityPolicies;