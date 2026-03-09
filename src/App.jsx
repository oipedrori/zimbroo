import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Statistics from './pages/Statistics'; // Added Statistics import
import Limits from './pages/Limits';
import Wallet from './pages/Wallet';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import NotionImport from './pages/NotionImport';
import InstallPrompt from './components/InstallPrompt';
import './index.css';

const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)', color: 'var(--primary-color)' }}>
        Carregando...
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
    <Routes>
      <Route path="/onboarding" element={currentUser ? <Navigate to="/" /> : <Onboarding />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Home />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="limits" element={<Limits />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notion-import" element={<NotionImport />} />
      </Route>
    </Routes>
  );
};

function App() {
  useEffect(() => {
    const theme = localStorage.getItem('zimbroo_theme') || 'system';
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
    } else if (theme === 'light') {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
    } else {
      root.classList.remove('theme-dark', 'theme-light');
    }
  }, []);

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
