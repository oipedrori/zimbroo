import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../config/firebase';
import { 
    signInWithPopup, 
    signInWithRedirect,
    getRedirectResult,
    signOut, 
    onAuthStateChanged, 
    deleteUser 
} from 'firebase/auth';
import LoadingDots from '../components/LoadingDots';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Detecta mobile/Android (onde popups são bloqueados pelo Chrome)
const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Login com Google: Redirect no mobile, Popup no desktop
    const loginWithGoogle = async () => {
        try {
            if (isMobile()) {
                // No Android/mobile: redireciona para o Google (volta via getRedirectResult)
                await signInWithRedirect(auth, googleProvider);
            } else {
                const result = await signInWithPopup(auth, googleProvider);
                return result.user;
            }
        } catch (error) {
            console.error("Erro no login com Google:", error);
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

    const value = { currentUser, loginWithGoogle, logout, deleteAccount, loading };

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
