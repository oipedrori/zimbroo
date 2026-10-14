import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

  // Apenas contas reais (Google) acessam o app principal; sessões anônimas pertencem exclusivamente a /prototipo.
  return (currentUser && !currentUser.isAnonymous) ? children : <Navigate to="/onboarding" />;
};

const AppRoutes = () => {
  const { currentUser } = useAuth();
  const isMainUser = currentUser && !currentUser.isAnonymous;

  return (
    <React.Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)' }}>
        <LoadingDots />
      </div>
    }>
      <Routes>
        <Route path="/onboarding" element={isMainUser ? <Navigate to="/" /> : <Onboarding />} />

        {/* Rota Pública do Protótipo (Isolada, sem login, armazenamento local) */}
        <Route path="/prototipo" element={<PrototypeProvider><PrototypeContainer /></PrototypeProvider>}>
          <Route index element={<Home />} />
          <Route path="limits" element={<Limits />} />
          <Route path="wallet" element={<Wallet />} />
        </Route>

        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Home />} />
          <Route path="limits" element={<Limits />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="notion-callback" element={<Home />} />
          <Route path="mic" element={<Home />} />
        </Route>
      </Routes>
    </React.Suspense>
  );
};

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <InstallProvider>
          <InstallPrompt />
          <CookieNotice />
          <NotificationHandler />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </InstallProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
