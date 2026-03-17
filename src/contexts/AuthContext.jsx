import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, deleteUser } from 'firebase/auth';
import LoadingDots from '../components/LoadingDots';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Login com Google
    const loginWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
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
        deleteAccount,
        loading
    };



    if (loading) {
        return null; // Don't render anything in AuthProvider while loading, let index.html splash handle it
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
