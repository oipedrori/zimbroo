/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { prototypeStorage, FINANCIAL_CONTEXTS, PROTOTYPE_EVENTS } from '../services/prototypeStorage';

const PrototypeFinancialContext = createContext({
    financialContext: FINANCIAL_CONTEXTS.INDIVIDUAL,
    setFinancialContext: () => {},
    onboardingModel: 'both',
    setOnboardingModel: () => {},
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
            onboardingModel: prototypeStorage.getOnboardingModel() || 'both',
            setOnboardingModel: () => {},
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

    const [onboardingModel, setOnboardingModelState] = useState(() => {
        return prototypeStorage.getOnboardingModel() || 'both';
    });

    const [activeFamilyId, setActiveFamilyIdState] = useState(() => {
        return prototypeStorage.getActiveFamilyId();
    });

    const [familySpaces, setFamilySpaces] = useState(() => {
        return prototypeStorage.getFamilySpaces();
    });

    const [membersVersion, setMembersVersion] = useState(0);
    const [invitesVersion, setInvitesVersion] = useState(0);
    const [blockedNotice, setBlockedNotice] = useState(null);

    // Sincronização reativa quando storage é alterado localmente
    useEffect(() => {
        const syncState = () => {
            const currentContext = prototypeStorage.getActiveFinancialContext();
            const currentModel = prototypeStorage.getOnboardingModel() || 'both';
            const currentSpaces = prototypeStorage.getFamilySpaces();
            const currentFamilyId = prototypeStorage.getActiveFamilyId();

            setFinancialContextState(currentContext);
            setOnboardingModelState(currentModel);
            setFamilySpaces(currentSpaces);
            setActiveFamilyIdState(currentFamilyId);
        };

        syncState();

        const handleContextChange = () => syncState();
        const handleModelChange = () => syncState();
        const handleSpacesChange = () => syncState();
        const handleMembersChange = () => setMembersVersion(v => v + 1);
        const handleInvitesChange = () => setInvitesVersion(v => v + 1);

        window.addEventListener(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED, handleContextChange);
        window.addEventListener(PROTOTYPE_EVENTS.ONBOARDING_MODEL_CHANGED, handleModelChange);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED, handleSpacesChange);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED, handleMembersChange);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_INVITES_CHANGED, handleInvitesChange);

        return () => {
            window.removeEventListener(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED, handleContextChange);
            window.removeEventListener(PROTOTYPE_EVENTS.ONBOARDING_MODEL_CHANGED, handleModelChange);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED, handleSpacesChange);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED, handleMembersChange);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_INVITES_CHANGED, handleInvitesChange);
        };
    }, []);

    const setFinancialContext = useCallback((newContext) => {
        prototypeStorage.setActiveFinancialContext(newContext);
        setFinancialContextState(prototypeStorage.getActiveFinancialContext());
    }, []);

    const setOnboardingModel = useCallback((model) => {
        prototypeStorage.setOnboardingModel(model);
        setOnboardingModelState(model);
        if (model === 'individual') {
            prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.INDIVIDUAL);
            setFinancialContextState(FINANCIAL_CONTEXTS.INDIVIDUAL);
        } else if (model === 'family') {
            prototypeStorage.ensureActiveFamilySpace();
            prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
            setFinancialContextState(FINANCIAL_CONTEXTS.FAMILY);
        } else if (model === 'both') {
            prototypeStorage.ensureActiveFamilySpace();
        }
    }, []);

    const setActiveFamilyId = useCallback((id) => {
        prototypeStorage.setActiveFamilyId(id);
        setActiveFamilyIdState(prototypeStorage.getActiveFamilyId());
    }, []);

    const triggerBlockedAction = useCallback((notice) => {
        setBlockedNotice(notice);
    }, []);

    const closeBlockedNotice = useCallback(() => {
        setBlockedNotice(null);
    }, []);

    const activeFamilySpace = useMemo(() => {
        if (!activeFamilyId) return null;
        return familySpaces.find(s => s.id === activeFamilyId) || null;
    }, [activeFamilyId, familySpaces]);

    const familyMembers = useMemo(() => {
        if (!activeFamilySpace?.id) return [];
        return prototypeStorage.getFamilyMembers(activeFamilySpace.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFamilySpace, membersVersion]);

    const familyInvites = useMemo(() => {
        if (!activeFamilySpace?.id) return [];
        return prototypeStorage.getFamilyInvites(activeFamilySpace.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFamilySpace, invitesVersion]);

    const updateSpaceName = useCallback((name) => {
        if (!activeFamilySpace?.id) return;
        return prototypeStorage.updateFamilySpace(activeFamilySpace.id, { name });
    }, [activeFamilySpace]);

    const createInvite = useCallback(({ inviteeName, inviteeEmail, role }) => {
        if (!activeFamilySpace?.id) return;
        return prototypeStorage.createFamilyInvite({
            familyId: activeFamilySpace.id,
            inviteeName,
            inviteeEmail,
            role
        });
    }, [activeFamilySpace]);

    const acceptInvite = useCallback((inviteId) => {
        return prototypeStorage.acceptFamilyInvite(inviteId);
    }, []);

    const revokeInvite = useCallback((inviteId) => {
        return prototypeStorage.revokeFamilyInvite(inviteId);
    }, []);

    const value = useMemo(() => ({
        financialContext,
        setFinancialContext,
        onboardingModel,
        setOnboardingModel,
        activeFamilyId: activeFamilySpace?.id || null,
        setActiveFamilyId,
        activeFamilySpace,
        familySpaces,
        familyMembers,
        familyInvites,
        hasFamilySpace: familySpaces.length > 0,
        updateSpaceName,
        createInvite,
        acceptInvite,
        revokeInvite,
        blockedNotice,
        triggerBlockedAction,
        closeBlockedNotice
    }), [
        financialContext,
        setFinancialContext,
        onboardingModel,
        setOnboardingModel,
        activeFamilySpace,
        setActiveFamilyId,
        familySpaces,
        familyMembers,
        familyInvites,
        updateSpaceName,
        createInvite,
        acceptInvite,
        revokeInvite,
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
