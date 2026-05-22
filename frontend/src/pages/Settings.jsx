import React, { useState, useEffect } from 'react';
import { ArrowLeft, LayoutGrid, Columns, Zap, Box, Users, Shield, Key, Loader2, ShieldAlert, Lock, FileText, Plug, Smartphone } from 'lucide-react'; 
import api from '../api/axios'; 

import ModuleList from '../components/ModuleList';
import FieldBuilder from '../components/FieldBuilder';
import BlueprintBuilder from '../components/BlueprintBuilder';
import AutomationBuilder from '../components/AutomationBuilder'; 
import TemplateBuilder from '../components/TemplateBuilder';
import IntegrationBuilder from '../components/IntegrationBuilder';
import ChannelBuilder from '../components/ChannelBuilder';


import UsersManager from '../components/UsersManager';
import RolesManager from '../components/RolesManager';
import ProfilesManager from '../components/ProfilesManager';
import GlobalAudit from '../components/GlobalAudit'; 
// 🔥 IMPORTAMOS EL NUEVO COMPONENTE DE POLÍTICAS 🔥
import SecurityPolicies from '../components/SecurityPolicies';
// 🔥 IMPORTAMOS EL NUEVO COMPONENTE DE APP MÓVIL 🔥
import MobileSettings from '../components/MobileSettings';

// 🔥 Importamos notificaciones y portal para un modal genérico opcional
import { useNotification } from '../context/NotificationContext';

const Settings = () => {
  const { confirm } = useNotification();
  const [activeMenu, setActiveMenu] = useState('modules'); 
  const [activeModule, setActiveModule] = useState(null);
  const [activeTab, setActiveTab] = useState('fields'); 

  // 🔥 NUEVO: ESTADO GLOBAL DE CAMBIOS SIN GUARDAR 🔥
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchUser = async () => {
      try {
        const res = await api.get('/api/v1/users/me', { signal: controller.signal });
        setUserData(res.data);
        
        const isSuper = res.data.is_superadmin;
        const perms = res.data.permissions?.settings || {};
        
        if (!isSuper && !perms.manage_modules && perms.manage_security) {
          setActiveMenu('users');
        }
      } catch (error) {
        if (error.name !== 'CanceledError') console.error("Error cargando usuario", error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchUser();
    
    return () => controller.abort();
  }, []);

  // 🔥 NUEVO: Función segura para intentar cambiar de pestaña/módulo 🔥
  const handleAttemptNavigation = async (targetAction, targetValue) => {
    if (hasUnsavedChanges) {
      const isConfirmed = await confirm({
        title: 'Cambios sin guardar',
        message: 'Tienes cambios pendientes en el diseño que se perderán si sales ahora. ¿Deseas descartarlos y continuar?',
        confirmText: 'Descartar cambios y salir',
        variant: 'danger'
      });
      if (!isConfirmed) return;
    }

    // Si confirmamos (o no había cambios), reseteamos el escudo y navegamos
    setHasUnsavedChanges(false);

    if (targetAction === 'tab') setActiveTab(targetValue);
    if (targetAction === 'module') {
      setActiveModule(targetValue);
      setActiveTab('fields');
    }
    if (targetAction === 'back') setActiveModule(null);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  const isSuperAdmin = userData?.is_superadmin;
  const canManageModules = isSuperAdmin || userData?.permissions?.settings?.manage_modules;
  const canManageSecurity = isSuperAdmin || userData?.permissions?.settings?.manage_security;

  if (activeModule && canManageModules) {
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
        <div className="mb-6 flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
          {/* 🔥 USO DE LA NAVEGACIÓN SEGURA 🔥 */}
          <button 
            onClick={() => handleAttemptNavigation('back')} 
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            title="Volver a módulos"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Constructor: <span className="text-blue-600 dark:text-blue-400">{activeModule?.name}</span>
          </h1>
        </div>

        <div className="flex gap-2 sm:gap-6 border-b border-gray-200 dark:border-gray-800 mb-6 px-2 overflow-x-auto no-scrollbar shrink-0">
          {/* 🔥 USO DE LA NAVEGACIÓN SEGURA 🔥 */}
          <button 
            onClick={() => handleAttemptNavigation('tab', 'fields')} 
            className={`pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'fields' 
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white' 
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <LayoutGrid size={16} /> <span className="hidden sm:inline">Formulario (Campos)</span><span className="sm:hidden">Campos</span>
          </button>
          
          <button 
            onClick={() => handleAttemptNavigation('tab', 'statuses')} 
            className={`pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'statuses' 
                ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-500' 
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Columns size={16} /> <span className="hidden sm:inline">Blueprint (Transiciones)</span><span className="sm:hidden">Blueprint</span>
          </button>

          <button 
            onClick={() => handleAttemptNavigation('tab', 'automations')} 
            className={`pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'automations' 
                ? 'border-amber-500 dark:border-amber-400 text-amber-600 dark:text-amber-400' 
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Zap size={16} className={activeTab === 'automations' ? "" : "text-amber-500"} /> <span className="hidden sm:inline">Automatizaciones</span><span className="sm:hidden">Auto</span>
          </button>
          {/* 🔥 NUEVA PESTAÑA: PLANTILLAS (PDFs) 🔥 */}
          <button 
            onClick={() => handleAttemptNavigation('tab', 'templates')} 
            className={`pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'templates' 
                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-500' 
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FileText size={16} className={activeTab === 'templates' ? "" : "text-indigo-500"} /> <span className="hidden sm:inline">Plantillas (PDFs)</span><span className="sm:hidden">PDFs</span>
          </button>
          {/* 🔥 NUEVA PESTAÑA: INTEGRACIONES 🔥 */}
          <button 
            onClick={() => handleAttemptNavigation('tab', 'integrations')} 
            className={`pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'integrations' 
                ? 'border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-500' 
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Plug size={16} className={activeTab === 'integrations' ? "" : "text-emerald-500"} /> <span className="hidden sm:inline">Integraciones (iPaaS)</span><span className="sm:hidden">iPaaS</span>
          </button>
          {/* 🔥 NUEVA PESTAÑA: CANALES / APP B2C 🔥 */}
          <button 
            onClick={() => handleAttemptNavigation('tab', 'channels')} 
            className={`pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'channels' 
                ? 'border-fuchsia-600 dark:border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-500' 
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Smartphone size={16} className={activeTab === 'channels' ? "" : "text-fuchsia-500"} /> <span className="hidden sm:inline">Catálogo (App Móvil)</span><span className="sm:hidden">App</span>
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
            {activeTab === 'fields' ? (
                <FieldBuilder moduleId={activeModule.id} setHasUnsavedChanges={setHasUnsavedChanges} />
            ) : activeTab === 'automations' ? (
                <AutomationBuilder moduleId={activeModule.id} setHasUnsavedChanges={setHasUnsavedChanges} />
            ) : activeTab === 'templates' ? (
                <TemplateBuilder moduleId={activeModule.id} setHasUnsavedChanges={setHasUnsavedChanges} />
            ) : activeTab === 'integrations' ? (
                <IntegrationBuilder moduleId={activeModule.id} setHasUnsavedChanges={setHasUnsavedChanges} />
            ) : activeTab === 'channels' ? ( // 🔥 NUESTRO NUEVO COMPONENTE B2C
                <ChannelBuilder moduleId={activeModule.id} setHasUnsavedChanges={setHasUnsavedChanges} />
            ) : (
                <BlueprintBuilder moduleId={activeModule.id} setHasUnsavedChanges={setHasUnsavedChanges} /> 
            )}
        </div>
      </div>
    );
  }

  // VISTA 1 (Se mantiene igual, solo pasamos la navegación segura a ModuleList)
  return (
    <div className="flex flex-col md:flex-row gap-8 h-full animate-in fade-in duration-300">
      <div className="w-full md:w-64 shrink-0 space-y-6">
        {canManageModules && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">Sistema</h3>
            <div className="space-y-1">
              <button 
                onClick={() => setActiveMenu('modules')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  activeMenu === 'modules' 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Box size={18} /> Personalización (Módulos)
              </button>
              
              {/* 🔥 NUEVO BOTÓN: APP MÓVIL Y B2C 🔥 */}
              <button 
                onClick={() => setActiveMenu('mobile_app')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  activeMenu === 'mobile_app' 
                    ? 'bg-fuchsia-50 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Smartphone size={18} /> App Móvil & B2C
              </button>
            </div>
          </div>
        )}
        {canManageSecurity && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">Seguridad y Acceso</h3>
            <div className="space-y-1">
              {/* 🔥 NUEVO BOTÓN PARA LAS POLÍTICAS DE SEGURIDAD 🔥 */}
              <button 
                onClick={() => setActiveMenu('policies')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeMenu === 'policies' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              ><Lock size={18} /> Políticas Globales</button>
              
              <button 
                onClick={() => setActiveMenu('users')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeMenu === 'users' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              ><Users size={18} /> Usuarios</button>
              <button 
                onClick={() => setActiveMenu('roles')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeMenu === 'roles' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              ><Shield size={18} /> Roles (Jerarquía)</button>
              <button 
                onClick={() => setActiveMenu('profiles')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeMenu === 'profiles' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              ><Key size={18} /> Perfiles (Permisos)</button>
              <button 
                onClick={() => setActiveMenu('audit')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeMenu === 'audit' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              ><ShieldAlert size={18} /> Auditoría Global</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
        {/* 🔥 RENDERIZADO CONDICIONAL DE LOS COMPONENTES 🔥 */}
        {activeMenu === 'modules' && canManageModules && <ModuleList onSelectModule={(mod) => handleAttemptNavigation('module', mod)} />}
        
        {/* 🔥 RENDERIZAMOS EL NUEVO COMPONENTE B2C 🔥 */}
        {activeMenu === 'mobile_app' && canManageModules && <MobileSettings />}
        {/* 🔥 NUESTRO NUEVO COMPONENTE 🔥 */}
        {activeMenu === 'policies' && canManageSecurity && <SecurityPolicies />}
        
        {activeMenu === 'users' && canManageSecurity && <UsersManager />}
        {activeMenu === 'roles' && canManageSecurity && <RolesManager />}
        {activeMenu === 'profiles' && canManageSecurity && <ProfilesManager />}
        {activeMenu === 'audit' && canManageSecurity && <GlobalAudit />}
        
        {!canManageModules && !canManageSecurity && (
            <div className="flex h-full flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <Shield size={48} className="mb-4 opacity-30" />
              <p className="font-bold text-lg text-gray-700 dark:text-gray-300">Acceso Restringido</p>
              <p className="text-sm mt-1">No tienes permisos de administrador en esta sección.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Settings;