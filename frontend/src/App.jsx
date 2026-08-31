import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// 🔥 NUEVO: IMPORTAMOS EL PROVEEDOR DE SEO (HELMET) 🔥
import { HelmetProvider } from 'react-helmet-async';

// 🔥 IMPORTAMOS EL MOTOR DE IDIOMAS (INTERNACIONALIZACIÓN) 🔥


// 🔥 IMPORTAMOS NUESTRO CEREBRO, GUARDIÁN Y MARCO 🔥
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

// 🔥 1. IMPORTAMOS EL PROVEEDOR DE NOTIFICACIONES 🔥
import { NotificationProvider } from './context/NotificationContext';

// 🔥 NUEVO: IMPORTAMOS EL PROVEEDOR DEL CHAT 🔥
import { SupportChatProvider } from './context/SupportChatContext'; 

// 🔥 NUEVA LANDING PAGE (WEB) 🔥
const LandingPage = lazy(() => import('./pages/LandingPage'));
const CookieBanner = lazy(() => import('./components/CookieBanner')); 
const LegalPage = lazy(() => import('./pages/LegalPage')); 

const StoreHome = lazy(() => import('./pages/StoreHome'));
const StoreProductDetail = lazy(() => import('./pages/StoreProductDetail'));

const SolYLunaLanding = lazy(() => import('./pages/SolYLunaLanding'));
const EwCarsLanding = lazy(() => import('./pages/EwCarsLanding'));

// 🚀 MEJORA DE RENDIMIENTO Y SEGURIDAD (Lazy Loading / Code Splitting)
const Login = lazy(() => import('./features/auth/Login')); 

// 🔥 FASE 6: IMPORTAMOS EL RECEPTOR DE SSO 🔥
const SsoSuccess = lazy(() => import('./features/auth/SsoSuccess')); 

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const RecycleBin = lazy(() => import('./components/RecycleBin')); 
const ModuleDataView = lazy(() => import('./pages/ModuleDataView'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Dashboards = lazy(() => import('./pages/Dashboards'));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));
const SupportInbox = lazy(() => import('./pages/SupportInbox'));
const SetPassword = lazy(() => import('./pages/SetPassword'));

// Un componente visual simple mientras React descarga la pantalla solicitada
const FullScreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    /* 🔥 ENVOLVEMOS TODA LA APLICACIÓN CON EL HELMET PROVIDER 🔥 */
    <HelmetProvider>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            {/* 🔥 NUEVO: ENVOLVEMOS LA APP CON EL CHAT PROVIDER 🔥 */}
            <SupportChatProvider>
              <Suspense fallback={<FullScreenLoader />}>

                <CookieBanner /> {/* NUEVO: Banner de cookies */}
                <Routes>
                  
                  {/* RUTAS PÚBLICAS Y REDIRECCIONES */}
                  {/* 🔥 FIX: Ahora la raíz apunta a nuestra nueva Landing Page en lugar de redirigir al Dashboard 🔥 */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/solyluna" element={<SolYLunaLanding />} />
                  <Route path="/ewcars" element={<EwCarsLanding />} />
                  
                  <Route path="/login" element={<Login />} />
                  {/* 🔥 NUEVAS RUTAS LEGALES 🔥 */}
                  <Route path="/privacidad" element={<LegalPage title="Políticas de Privacidad" lastUpdated="14 de Agosto, 2026" />} />
                  <Route path="/terminos" element={<LegalPage title="Términos y Condiciones" lastUpdated="14 de Agosto, 2026" />} />
                  
                  {/* 🔥 FASE 6: RUTA PARA ATRAPAR EL TOKEN DE SSO 🔥 */}
                  <Route path="/sso-success" element={<SsoSuccess />} />

                  {/* 🔥 NUEVO: RUTA PARA ACEPTAR INVITACIONES POR CORREO 🔥 */}
                  <Route path="/set-password" element={<SetPassword />} />
                  
                  <Route path="/c/:moduleId" element={<StoreHome />} />
                  <Route path="/p/:moduleId/:productId" element={<StoreProductDetail />} />

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

                  <Route path="/support-inbox" element={
                  <ProtectedRoute requireHq={true}> {/* 🔥 NUEVO: Activamos el candado aquí */}
                    <MainLayout>
                      <SupportInbox />
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
            </SupportChatProvider>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </HelmetProvider>
  );
}

export default App;