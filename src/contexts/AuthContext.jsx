import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../config/firebase';
import { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Login com Google
    const loginWithGoogle = async () => {
        try {
            await signInWithRedirect(auth, googleProvider);
            // Em mobile/PWA a página vai recarregar;
            // a captura do login será tratada pelo onAuthStateChanged na inicialização.
        } catch (error) {
            console.error("Erro no login com Google:", error);
            throw error;
        }
    };

    // Tentar pegar os erros de redirecionamento, se houver:
    useEffect(() => {
        getRedirectResult(auth).catch((error) => {
            console.error("Erro no retorno de redirecionamento do Auth:", error);
        });
    }, []);

    // Logout
    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro no logout:", error);
        }
    };

    // Monitorar estado da autenticação
    useEffect(() => {
        console.log("🎬 AuthProvider useEffect triggered (auth exists:", !!auth, ")");

        // Safety timeout: if auth state doesn't resolve in 5s, let the app mount anyway
        const timeout = setTimeout(() => {
            if (loading) {
                console.warn("⏳ Auth resolution timeout reached. Forcing loading false.");
                setLoading(false);
            }
        }, 5000);

        if (!auth) {
            console.warn("⚠️ Auth service not available, skipping listener.");
            setLoading(false);
            clearTimeout(timeout);
            return;
        }

        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                console.log("👤 Auth state changed:", user ? user.email : "No user");
                setCurrentUser(user);
                setLoading(false);
                clearTimeout(timeout);
            }, (error) => {
                console.error("❌ Auth listener error:", error);
                setLoading(false);
                clearTimeout(timeout);
            });
            return () => {
                unsubscribe();
                clearTimeout(timeout);
            };
        } catch (err) {
            console.error("❌ Auth listener critical failure:", err);
            setLoading(false);
            clearTimeout(timeout);
        }
    }, [auth]); // added auth as dependency just in case it re-initializes


    const value = {
        currentUser,
        loginWithGoogle,
        logout,
        loading
    };

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'var(--primary-darkest)',
                color: 'white',
                fontFamily: 'sans-serif'
            }}>
                <div className="loader" style={{ marginBottom: '20px' }}></div>
                <p>Zimbro App</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Iniciando serviços...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
