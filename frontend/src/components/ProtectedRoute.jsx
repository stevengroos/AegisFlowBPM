import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ 
  children, 
  requireSuperAdmin = false, 
  requireSettings = false,
  requireDashboard = false,
  requireAudit = false
}) => {
  const { user, loading } = useAuth();

  // 1. Mientras carga, mostramos un spinner a pantalla completa
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  // 2. Si no hay usuario, lo mandamos al login sin preguntar
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Extraemos permisos
  const isSuperAdmin = user.is_superadmin;
  const settingsPerms = user.permissions?.settings || {};

  // 4. Verificaciones de Rutas (Ciberseguridad RBAC)
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  if (requireSettings) {
    const hasAnySettingsPerm = isSuperAdmin || Object.values(settingsPerms).some(v => v === true);
    if (!hasAnySettingsPerm) return <Navigate to="/dashboard" replace />;
  }

  if (requireDashboard && !isSuperAdmin && !settingsPerms.manage_dashboards) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAudit && !isSuperAdmin && !settingsPerms.view_audit) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si sobrevive a todas las validaciones, le mostramos la pantalla
  return children;
};

export default ProtectedRoute;