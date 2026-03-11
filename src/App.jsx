import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import Layout from './components/Layout';
import LoadingDots from './components/LoadingDots';
import './index.css';

// Lazy load pages for performance
const Home = React.lazy(() => import('./pages/Home'));
const Statistics = React.lazy(() => import('./pages/Statistics'));
const Limits = React.lazy(() => import('./pages/Limits'));
const Wallet = React.lazy(() => import('./pages/Wallet'));
const Onboarding = React.lazy(() => import('./pages/Onboarding'));
const Profile = React.lazy(() => import('./pages/Profile'));
const NotionImport = React.lazy(() => import('./pages/NotionImport'));

const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)', color: 'var(--primary-color)' }}>
        <LoadingDots />
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/onboarding" />;
};

const AppRoutes = () => {
  const { currentUser } = useAuth();
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#1B4520',
        color: 'white',
        zIndex: 9999,
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        // animation: 'fadeOut 0.5s ease 1.6s forwards' // Optional, kept logic simple
      }}>
        <img
          src="/Z.png"
          alt="Logo"
          style={{
            width: '80px',
            height: '80px',
            animation: 'softPulse 2s infinite ease-in-out'
          }}
        />
        <style>{`
                    @keyframes softPulse {
                        0% { transform: scale(1); opacity: 0.8; }
                        50% { transform: scale(1.1); opacity: 1; }
                        100% { transform: scale(1); opacity: 0.8; }
                    }
                `}</style>
      </div>
    );
  }

  return (
    <React.Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)' }}>
        <LoadingDots />
      </div>
    }>
      <Routes>
        <Route path="/onboarding" element={currentUser ? <Navigate to="/" /> : <Onboarding />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Home />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="limits" element={<Limits />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notion-import" element={<NotionImport />} />
          <Route path="notion-callback" element={<NotionImport />} />
        </Route>
      </Routes>
    </React.Suspense>
  );
};

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <InstallPrompt />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
