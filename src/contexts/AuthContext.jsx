import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../config/firebase';
import { 
    signInWithPopup, 
    signInWithRedirect,
    signInAnonymously,
    getRedirectResult,
    signOut, 
    onAuthStateChanged, 
    deleteUser 
} from 'firebase/auth';
import LoadingDots from '../components/LoadingDots';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Detecta APENAS Android — iOS Safari funciona com popup (ITP bloqueia redirect no Safari)
const isAndroid = () => /Android/i.test(navigator.userAgent);

export const AuthProvider = ({ children }) => {
    const isPrototipoRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/prototipo');
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(() => !isPrototipoRoute);

    // Login com Google: Redirect no mobile, Popup no desktop
    const loginWithGoogle = async () => {
        try {
            // Tenta popup primeiro (funciona no Chrome moderno incluindo Android v100+)
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                // Fallback: redirect (usado quando popup é bloqueado pelo browser)
                console.log("Popup bloqueado, usando redirect como fallback...");
                await signInWithRedirect(auth, googleProvider);
            } else {
                console.error("Erro no login com Google:", error);
                throw error;
            }
        }
    };

    // Login Anônimo: Inicia ou reutiliza uma sessão anônima no Firebase Auth
    const loginAnonymously = async () => {
        if (!auth) throw new Error("Firebase auth não inicializado.");

        // Se já existe uma sessão ativa (seja anônima ou Google), reutiliza
        if (auth.currentUser) {
            console.log("ℹ️ Reutilizando sessão Firebase existente:", auth.currentUser.uid);
            setCurrentUser(auth.currentUser);
            return auth.currentUser;
        }

        try {
            const result = await signInAnonymously(auth);
            console.log("✅ Sessão anônima iniciada com sucesso:", result.user.uid);
            setCurrentUser(result.user);
            return result.user;
        } catch (error) {
            console.error("❌ Erro ao autenticar anonimamente:", error);
            throw error;
        }
    };

    // Logout
    const logout = async () => {
        try {
            if (currentUser) {
                localStorage.removeItem(`zimbroo_txs_${currentUser.uid}`);
            }
            await signOut(auth);
        } catch (error) {
            console.error("Erro no logout:", error);
        }
    };

    // Deletar Conta
    const deleteAccount = async () => {
        if (!currentUser) return;
        try {
            await deleteUser(currentUser);
        } catch (error) {
            console.error("Erro ao deletar conta:", error);
            throw error;
        }
    };

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        let unsubscribe;
        const timeout = setTimeout(() => setLoading(false), 6000);

        const init = async () => {
            // CRÍTICO: aguardar o resultado do redirect ANTES de configurar o listener.
            // Sem isso, onAuthStateChanged dispara com null e o app mostra o onboarding.
            try {
                const result = await getRedirectResult(auth);
                if (result?.user) {
                    console.log("✅ Login via redirect:", result.user.email);
                }
            } catch (e) {
                // Erro esperado quando não há redirect ativo — pode ignorar
                console.log("ℹ️ Sem redirect ativo:", e.code);
            }

            // Auth agora está estabilizado. Configura o listener.
            unsubscribe = onAuthStateChanged(auth, (user) => {
                console.log("👤 Auth state:", user ? user.email : "Não autenticado");
                setCurrentUser(user);
                setLoading(false);
                clearTimeout(timeout);
            }, (error) => {
                console.error("❌ Auth listener error:", error);
                setLoading(false);
                clearTimeout(timeout);
            });
        };

        init();

        return () => {
            unsubscribe?.();
            clearTimeout(timeout);
        };
    }, []);

    const effectiveUser = isPrototipoRoute 
        ? { uid: 'prototipo', displayName: 'Avaliador', email: 'avaliador@prototipo.local' } 
        : currentUser;
    const value = { 
        currentUser: effectiveUser, 
        loginWithGoogle, 
        loginAnonymously, 
        logout, 
        deleteAccount, 
        loading: isPrototipoRoute ? false : loading 
    };

    if (loading && !isPrototipoRoute) {
        return (
            <div style={{ 
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                background: 'var(--bg-color, #0f1710)', 
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: 99999
            }}>
                <LoadingDots color="white" />
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
