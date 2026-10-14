import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { usePrototype } from '../contexts/PrototypeContext';
import { saveUserLimits } from '../services/limitService';
import { prototypeStorage, PROTOTYPE_EVENTS, FINANCIAL_CONTEXTS } from '../services/prototypeStorage';

// Função utilitária para extrair limites individuais e familiares locais
const getScopedPrototypeLimits = (year) => {
    const context = prototypeStorage.getActiveFinancialContext();
    const individualLimits = prototypeStorage.getLimits(year);
    const activeFamilyId = prototypeStorage.getActiveFamilyId();

    let familyLimits = {};
    if (activeFamilyId) {
        familyLimits = prototypeStorage.getFamilyLimits(activeFamilyId, year);
    }

    let activeLimits = individualLimits;
    if (context === FINANCIAL_CONTEXTS.FAMILY) {
        activeLimits = familyLimits;
    } else if (context === FINANCIAL_CONTEXTS.BOTH) {
        activeLimits = individualLimits;
    }

    return {
        activeLimits,
        individualLimits,
        familyLimits,
        hasFamilySpace: Boolean(activeFamilyId)
    };
};

export const useLimits = (year) => {
    const { currentUser } = useAuth();
    const { isPrototype } = usePrototype();

    const [scopedLimits, setScopedLimits] = useState(() => {
        if (isPrototype) {
            return getScopedPrototypeLimits(year);
        }
        if (!currentUser) return { activeLimits: {}, individualLimits: {}, familyLimits: {}, hasFamilySpace: false };
        const fieldKey = year ? `zimbroo_limits_${year}_${currentUser.uid}` : `zimbroo_limits_${currentUser.uid}`;
        const saved = localStorage.getItem(fieldKey);
        const data = saved ? JSON.parse(saved) : {};
        return { activeLimits: data, individualLimits: data, familyLimits: {}, hasFamilySpace: false };
    });

    const [loading, setLoading] = useState(!isPrototype);

    // Efeito de sincronização para o modo Protótipo respeitando contextos
    useEffect(() => {
        if (!isPrototype) return;

        const syncLimits = () => {
            setScopedLimits(getScopedPrototypeLimits(year));
            setLoading(false);
        };

        syncLimits();

        window.addEventListener(PROTOTYPE_EVENTS.LIMITS_CHANGED, syncLimits);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_SETTINGS_CHANGED, syncLimits);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED, syncLimits);
        window.addEventListener(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED, syncLimits);

        return () => {
            window.removeEventListener(PROTOTYPE_EVENTS.LIMITS_CHANGED, syncLimits);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_SETTINGS_CHANGED, syncLimits);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED, syncLimits);
            window.removeEventListener(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED, syncLimits);
        };
    }, [isPrototype, year]);

    useEffect(() => {
        if (isPrototype || !currentUser) return;

        const docRef = doc(db, 'userSettings', currentUser.uid);
        const fieldName = year ? `limits_${year}` : 'limits';
        const fieldKey = year ? `zimbroo_limits_${year}_${currentUser.uid}` : `zimbroo_limits_${currentUser.uid}`;
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data()[fieldName] || {};
                setScopedLimits({ activeLimits: data, individualLimits: data, familyLimits: {}, hasFamilySpace: false });
                localStorage.setItem(fieldKey, JSON.stringify(data));
            } else {
                setScopedLimits({ activeLimits: {}, individualLimits: {}, familyLimits: {}, hasFamilySpace: false });
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to limits: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, year, isPrototype]);

    const setLimits = async (newLimits) => {
        if (isPrototype) {
            const context = prototypeStorage.getActiveFinancialContext();
            if (context === FINANCIAL_CONTEXTS.INDIVIDUAL) {
                prototypeStorage.saveLimits(newLimits, year);
            } else if (context === FINANCIAL_CONTEXTS.FAMILY) {
                const activeFamilyId = prototypeStorage.getActiveFamilyId();
                if (!activeFamilyId) {
                    throw new Error('Nenhum espaço familiar ativo para salvar limites.');
                }
                prototypeStorage.saveFamilyLimits(activeFamilyId, newLimits, year);
            } else {
                throw new Error('No contexto Ambos, a gravação de limites deve especificar o escopo de destino.');
            }
            setScopedLimits(getScopedPrototypeLimits(year));
            return;
        }

        if (!currentUser) return;
        
        // Optimistic Update
        const fieldKey = year ? `zimbroo_limits_${year}_${currentUser.uid}` : `zimbroo_limits_${currentUser.uid}`;
        const previousLimits = { ...scopedLimits.activeLimits };
        setScopedLimits(prev => ({ ...prev, activeLimits: newLimits, individualLimits: newLimits }));
        localStorage.setItem(fieldKey, JSON.stringify(newLimits));

        try {
            await saveUserLimits(currentUser.uid, newLimits, year);
        } catch (error) {
            // Rollback on failure
            setScopedLimits(prev => ({ ...prev, activeLimits: previousLimits, individualLimits: previousLimits }));
            localStorage.setItem(fieldKey, JSON.stringify(previousLimits));
            throw error;
        }
    };

    return {
        limits: scopedLimits.activeLimits,
        individualLimits: scopedLimits.individualLimits,
        familyLimits: scopedLimits.familyLimits,
        hasFamilySpace: scopedLimits.hasFamilySpace,
        setLimits,
        loading
    };
};
