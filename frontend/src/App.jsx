import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// 🔥 IMPORTAMOS NUESTRO CEREBRO, GUARDIÁN Y MARCO 🔥
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

// 🔥 1. IMPORTAMOS EL NUEVO PROVEEDOR DE NOTIFICACIONES 🔥
import { NotificationProvider } from './context/NotificationContext';

// 🚀 MEJORA DE RENDIMIENTO Y SEGURIDAD (Lazy Loading / Code Splitting)
const Login = lazy(() => import('./features/auth/Login')); 

// 🔥 FASE 6: IMPORTAMOS EL RECEPTOR DE SSO (Asumiendo que lo guardaste junto a Login.jsx) 🔥
const SsoSuccess = lazy(() => import('./features/auth/SsoSuccess')); 

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const RecycleBin = lazy(() => import('./components/RecycleBin')); 
const ModuleDataView = lazy(() => import('./pages/ModuleDataView'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Dashboards = lazy(() => import('./pages/Dashboards'));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));

// Un componente visual simple mientras React descarga la pantalla solicitada
const FullScreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* 🔥 2. ENVOLVEMOS LA APLICACIÓN CON EL PROVEEDOR DE NOTIFICACIONES 🔥 */}
        <NotificationProvider>
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              
              {/* RUTAS PÚBLICAS Y REDIRECCIONES */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              
              {/* 🔥 FASE 6: RUTA PARA ATRAPAR EL TOKEN DE SSO 🔥 */}
              <Route path="/sso-success" element={<SsoSuccess />} />

              {/* RUTAS PRIVADAS (Requieren estar logueado y usan el MainLayout) */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/cases/:id" element={
                <ProtectedRoute>
                  <MainLayout>
                    <CaseDetail />
                  </MainLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/modules/:moduleId" element={
                <ProtectedRoute>
                  <MainLayout>
                    <ModuleDataView />
                  </MainLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/profile" element={
                <ProtectedRoute>
                  <MainLayout>
                    <UserProfile />
                  </MainLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/recycle-bin" element={
                <ProtectedRoute>
                  <MainLayout>
                    <RecycleBin />
                  </MainLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/dashboards" element={
                <ProtectedRoute requireDashboard={true}>
                  <MainLayout>
                    <Dashboards />
                  </MainLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/settings/*" element={
                <ProtectedRoute requireSettings={true}>
                  <MainLayout>
                    <Settings />
                  </MainLayout>
                </ProtectedRoute>
              } />

              <Route path="/security-dashboard" element={
                <ProtectedRoute>
                  <MainLayout>
                    <SecurityDashboard />
                  </MainLayout>
                </ProtectedRoute>
              } />


              {/* 🔥 PENTEST FIX: Ruta 404 (Catch-All) */}
              <Route path="*" element={
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
                  <h1 className="text-6xl font-bold mb-4">404</h1>
                  <p className="text-xl mb-6">Página no encontrada</p>
                  <button 
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Volver al inicio
                  </button>
                </div>
              } />

            </Routes>
          </Suspense>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;