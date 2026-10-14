import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import Layout from './components/Layout';
import LoadingDots from './components/LoadingDots';
import InstallPrompt from './components/InstallPrompt';
import CookieNotice from './components/CookieNotice';
import NotificationHandler from './components/NotificationHandler';
import { InstallProvider } from './contexts/InstallContext';
import { PrototypeProvider } from './contexts/PrototypeContext';
import PrototypeContainer from './components/PrototypeContainer';
import './index.css';

// Helper for lazy loading with retry logic
const lazyWithRetry = (componentImport) => React.lazy(async () => {
  const pageHasBeenForceRefreshed = JSON.parse(window.localStorage.getItem('page-has-been-force-refreshed') || 'false');

  try {
    const component = await componentImport();
    window.localStorage.setItem('page-has-been-force-refreshed', 'false');
    return component;
  } catch (error) {
    if (!pageHasBeenForceRefreshed) {
      window.localStorage.setItem('page-has-been-force-refreshed', 'true');
      return window.location.reload();
    }
    throw error;
  }
});

// Lazy load pages for performance
const Home = lazyWithRetry(() => import('./pages/Home'));
const Limits = lazyWithRetry(() => import('./pages/Limits'));
const Wallet = lazyWithRetry(() => import('./pages/Wallet'));
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'));

const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)', color: 'var(--primary-color)' }}>
        <LoadingDots />
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/onboarding" replace />;
};

// Rota de Onboarding com redirecionamento quando já autenticado
const OnboardingRoute = () => {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/" replace /> : <Onboarding />;
};

// Layout exclusivo do aplicativo principal que monta AuthProvider e NotificationHandler
const MainAppLayout = () => {
  return (
    <AuthProvider>
      <NotificationHandler />
      <Outlet />
    </AuthProvider>
  );
};

const AppRoutes = () => {
  return (
    <React.Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)' }}>
        <LoadingDots />
      </div>
    }>
      <Routes>
        {/* Rota Pública do Protótipo (Totalmente isolada, sem AuthProvider, sem Firebase, gerenciamento de limites na Home) */}
        <Route path="/prototipo" element={<PrototypeProvider><PrototypeContainer /></PrototypeProvider>}>
          <Route index element={<Home />} />
          <Route path="limits" element={<Navigate to="/prototipo" replace />} />
          <Route path="wallet" element={<Wallet />} />
        </Route>

        {/* Rotas do Aplicativo Principal (com Firebase Authentication, Firestore e Notificações) */}
        <Route element={<MainAppLayout />}>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Home />} />
            <Route path="limits" element={<Limits />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="notion-callback" element={<Home />} />
            <Route path="mic" element={<Home />} />
          </Route>
        </Route>
      </Routes>
    </React.Suspense>
  );
};

const AppContent = () => {
  return (
    <>
      <InstallPrompt />
      <CookieNotice />
      <AppRoutes />
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <InstallProvider>
          <AppContent />
        </InstallProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default App;

