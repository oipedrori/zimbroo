/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, initFirebase } from '../config/firebase';
import { 
    signInWithPopup, 
    signInWithRedirect,
    signInAnonymously,
    getRedirectResult,
    signOut, 
    onAuthStateChanged, 
    deleteUser,
    GoogleAuthProvider
} from 'firebase/auth';
import LoadingDots from '../components/LoadingDots';

const AuthContext = createContext(null);

const PROTOTYPE_USER = {
    uid: 'prototipo',
    displayName: 'Avaliador',
    email: 'avaliador@prototipo.local',
    isAnonymous: false
};

const PROTOTYPE_AUTH_VALUE = {
    currentUser: PROTOTYPE_USER,
    loading: false,
    loginWithGoogle: async () => PROTOTYPE_USER,
    loginAnonymously: async () => PROTOTYPE_USER,
    logout: async () => {},
    deleteAccount: async () => {}
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    // Se invocado fora do AuthProvider (por exemplo, na rota /prototipo isolada),
    // fornece fallback seguro do avaliador sem qualquer dependência do Firebase
    if (!context) {
        return PROTOTYPE_AUTH_VALUE;
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(() => {
        const fb = initFirebase();
        return Boolean(fb?.auth || auth);
    });


    // Login com Google: Redirect no mobile, Popup no desktop
    const loginWithGoogle = async () => {
        const fb = initFirebase();
        const activeAuth = fb?.auth || auth;
        const activeProvider = fb?.googleProvider || googleProvider || new GoogleAuthProvider();
        activeProvider.setCustomParameters?.({ prompt: 'select_account' });

        if (!activeAuth) throw new Error("Firebase auth não inicializado.");

        try {
            // Tenta popup primeiro (funciona no Chrome moderno incluindo Android v100+)
            const result = await signInWithPopup(activeAuth, activeProvider);
            return result.user;
        } catch (error) {
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                // Fallback: redirect (usado quando popup é bloqueado pelo browser)
                console.log("Popup bloqueado, usando redirect como fallback...");
                await signInWithRedirect(activeAuth, activeProvider);
            } else {
                console.error("Erro no login com Google:", error);
                throw error;
            }
        }
    };

    // Login Anônimo: Inicia ou reutiliza uma sessão anônima no Firebase Auth
    const loginAnonymously = async () => {
        const fb = initFirebase();
        const activeAuth = fb?.auth || auth;
        if (!activeAuth) throw new Error("Firebase auth não inicializado.");

        // Se já existe uma sessão ativa (seja anônima ou Google), reutiliza
        if (activeAuth.currentUser) {
            console.log("ℹ️ Reutilizando sessão Firebase existente:", activeAuth.currentUser.uid);
            setCurrentUser(activeAuth.currentUser);
            return activeAuth.currentUser;
        }

        try {
            const result = await signInAnonymously(activeAuth);
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
            const fb = initFirebase();
            const activeAuth = fb?.auth || auth;
            if (activeAuth) {
                await signOut(activeAuth);
            }
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
        const fb = initFirebase();
        const activeAuth = fb?.auth || auth;

        if (!activeAuth) {
            return;
        }

        let unsubscribe;
        const timeout = setTimeout(() => setLoading(false), 6000);

        const init = async () => {
            // CRÍTICO: aguardar o resultado do redirect ANTES de configurar o listener.
            // Sem isso, onAuthStateChanged dispara com null e o app mostra o onboarding.
            try {
                const result = await getRedirectResult(activeAuth);
                if (result?.user) {
                    console.log("✅ Login via redirect:", result.user.email);
                }
            } catch (e) {
                // Erro esperado quando não há redirect ativo — pode ignorar
                console.log("ℹ️ Sem redirect ativo:", e.code);
            }

            // Auth agora está estabilizado. Configura o listener.
            unsubscribe = onAuthStateChanged(activeAuth, (user) => {
                console.log("👤 Auth state:", user ? (user.email || user.uid) : "Não autenticado");
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

    const value = { 
        currentUser, 
        loginWithGoogle, 
        loginAnonymously, 
        logout, 
        deleteAccount, 
        loading 
    };

    if (loading) {
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

