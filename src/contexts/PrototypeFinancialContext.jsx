/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { prototypeStorage, FINANCIAL_CONTEXTS, PROTOTYPE_EVENTS } from '../services/prototypeStorage';

const PrototypeFinancialContext = createContext({
    financialContext: FINANCIAL_CONTEXTS.INDIVIDUAL,
    setFinancialContext: () => {},
    activeFamilyId: null,
    setActiveFamilyId: () => {},
    activeFamilySpace: null,
    familySpaces: [],
    familyMembers: [],
    hasFamilySpace: false,
    blockedNotice: null,
    triggerBlockedAction: () => {},
    closeBlockedNotice: () => {}
});

export const usePrototypeFinancial = () => {
    const context = useContext(PrototypeFinancialContext);
    if (!context) {
        return {
            financialContext: prototypeStorage.getActiveFinancialContext(),
            setFinancialContext: () => {},
            activeFamilyId: prototypeStorage.getActiveFamilyId(),
            setActiveFamilyId: () => {},
            activeFamilySpace: null,
            familySpaces: [],
            familyMembers: [],
            hasFamilySpace: false,
            blockedNotice: null,
            triggerBlockedAction: () => {},
            closeBlockedNotice: () => {}
        };
    }
    return context;
};

export const PrototypeFinancialProvider = ({ children }) => {
    const [financialContext, setFinancialContextState] = useState(() => {
        return prototypeStorage.getActiveFinancialContext();
    });

    const [activeFamilyId, setActiveFamilyIdState] = useState(() => {
        return prototypeStorage.getActiveFamilyId();
    });

    const [familySpaces, setFamilySpaces] = useState(() => {
        return prototypeStorage.getFamilySpaces();
    });

    const [blockedNotice, setBlockedNotice] = useState(null);

    // Sincronização reativa quando storage é alterado localmente
    useEffect(() => {
        const syncState = () => {
            const currentContext = prototypeStorage.getActiveFinancialContext();
            const currentFamilyId = prototypeStorage.getActiveFamilyId();
            const currentSpaces = prototypeStorage.getFamilySpaces();

            setFinancialContextState(currentContext);
            setFamilySpaces(currentSpaces);

            // Validação do espaço ativo: se o id salvo não existir mais entre os espaços, trata com segurança
            if (currentFamilyId && !currentSpaces.some(s => s.id === currentFamilyId)) {
                if (currentSpaces.length > 0) {
                    prototypeStorage.setActiveFamilyId(currentSpaces[0].id);
                    setActiveFamilyIdState(currentSpaces[0].id);
                } else {
                    prototypeStorage.setActiveFamilyId(null);
                    setActiveFamilyIdState(null);
                }
            } else {
                setActiveFamilyIdState(currentFamilyId);
            }
        };

        syncState();

        const handleContextChange = () => syncState();
        const handleSpacesChange = () => syncState();

        window.addEventListener(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED, handleContextChange);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED, handleSpacesChange);

        return () => {
            window.removeEventListener(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED, handleContextChange);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED, handleSpacesChange);
        };
    }, []);

    const setFinancialContext = useCallback((newContext) => {
        prototypeStorage.setActiveFinancialContext(newContext);
        setFinancialContextState(newContext);
    }, []);

    const setActiveFamilyId = useCallback((id) => {
        prototypeStorage.setActiveFamilyId(id);
        setActiveFamilyIdState(id);
    }, []);

    const triggerBlockedAction = useCallback((notice) => {
        setBlockedNotice(notice);
    }, []);

    const closeBlockedNotice = useCallback(() => {
        setBlockedNotice(null);
    }, []);

    const activeFamilySpace = useMemo(() => {
        if (!activeFamilyId) {
            return familySpaces[0] || null;
        }
        return familySpaces.find(s => s.id === activeFamilyId) || familySpaces[0] || null;
    }, [activeFamilyId, familySpaces]);

    const familyMembers = useMemo(() => {
        if (!activeFamilySpace?.id) return [];
        return prototypeStorage.getFamilyMembers(activeFamilySpace.id);
    }, [activeFamilySpace]);

    const value = useMemo(() => ({
        financialContext,
        setFinancialContext,
        activeFamilyId: activeFamilySpace?.id || null,
        setActiveFamilyId,
        activeFamilySpace,
        familySpaces,
        familyMembers,
        hasFamilySpace: familySpaces.length > 0,
        blockedNotice,
        triggerBlockedAction,
        closeBlockedNotice
    }), [
        financialContext,
        setFinancialContext,
        activeFamilySpace,
        setActiveFamilyId,
        familySpaces,
        familyMembers,
        blockedNotice,
        triggerBlockedAction,
        closeBlockedNotice
    ]);

    return (
        <PrototypeFinancialContext.Provider value={value}>
            {children}
        </PrototypeFinancialContext.Provider>
    );
};
