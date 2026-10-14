import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { prepareMonthlyTransactions, addTransaction, deleteTransaction, updateTransaction } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { usePrototype } from '../contexts/PrototypeContext';
import { prototypeStorage, PROTOTYPE_EVENTS, FINANCIAL_CONTEXTS } from '../services/prototypeStorage';

// Função utilitária pura para obter transações locais conforme o contexto financeiro ativo
const getScopedPrototypeTransactions = () => {
    const context = prototypeStorage.getActiveFinancialContext();
    const individualTxs = prototypeStorage.getTransactions().map(tx => ({
        ...tx,
        scope: 'individual',
        originLabel: 'Individual'
    }));

    if (context === FINANCIAL_CONTEXTS.INDIVIDUAL) {
        return individualTxs;
    }

    const activeFamilyId = prototypeStorage.getActiveFamilyId();
    let familyTxs = [];
    if (activeFamilyId) {
        const space = prototypeStorage.getFamilySpaceById(activeFamilyId);
        if (space) {
            const members = prototypeStorage.getFamilyMembers(activeFamilyId);
            const memberMap = new Map(members.map(m => [m.id, m.name]));
            familyTxs = prototypeStorage.getFamilyTransactions(activeFamilyId).map(tx => ({
                ...tx,
                scope: 'family',
                originLabel: 'Familiar',
                memberName: memberMap.get(tx.memberId) || ''
            }));
        }
    }

    if (context === FINANCIAL_CONTEXTS.FAMILY) {
        return familyTxs;
    }

    // Contexto 'both' (Ambos): combina transações individuais e familiares sem duplicações
    const combined = [...individualTxs];
    const seenIds = new Set(individualTxs.map(t => t.id));
    for (const fTx of familyTxs) {
        if (!seenIds.has(fTx.id)) {
            combined.push(fTx);
            seenIds.add(fTx.id);
        }
    }

    // Ordenação decrescente consistente por data e criação
    combined.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return combined;
};

export const useTransactions = (currentMonth) => { // format 'YYYY-MM'
    const { currentUser } = useAuth();
    const { isPrototype } = usePrototype();

    const [allTransactions, setAllTransactions] = useState(() => {
        if (isPrototype) {
            return getScopedPrototypeTransactions();
        }
        if (!currentUser) return [];
        const cached = localStorage.getItem(`zimbroo_txs_${currentUser.uid}`);
        return cached ? JSON.parse(cached) : [];
    });

    const [transactions, setTransactions] = useState(() => {
        if (!allTransactions.length) return [];
        return prepareMonthlyTransactions(allTransactions, currentMonth);
    });

    const [loading, setLoading] = useState(!isPrototype);
    const [error, setError] = useState(null);

    // Efeito para sincronização em modo Protótipo respeitando o contexto ativo
    useEffect(() => {
        if (!isPrototype) return;

        const syncFromStorage = () => {
            const current = getScopedPrototypeTransactions();
            setAllTransactions(current);
            setTransactions(prepareMonthlyTransactions(current, currentMonth));
            setLoading(false);
            setError(null);
        };

        syncFromStorage();

        window.addEventListener(PROTOTYPE_EVENTS.TXS_CHANGED, syncFromStorage);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED, syncFromStorage);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED, syncFromStorage);
        window.addEventListener(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED, syncFromStorage);
        window.addEventListener(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED, syncFromStorage);

        return () => {
            window.removeEventListener(PROTOTYPE_EVENTS.TXS_CHANGED, syncFromStorage);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED, syncFromStorage);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED, syncFromStorage);
            window.removeEventListener(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED, syncFromStorage);
            window.removeEventListener(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED, syncFromStorage);
        };
    }, [isPrototype, currentMonth]);

    useEffect(() => {
        if (isPrototype || !currentUser) return;

        const q = query(
            collection(db, 'transactions'),
            where("userId", "==", currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allTxs = [];
            snapshot.forEach((doc) => {
                allTxs.push({ id: doc.id, ...doc.data() });
            });
            
            // Salvar no Cache
            localStorage.setItem(`zimbroo_txs_${currentUser.uid}`, JSON.stringify(allTxs));

            const processed = prepareMonthlyTransactions(allTxs, currentMonth);
            setAllTransactions(allTxs);
            setTransactions(processed);
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Real-time sync error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, currentMonth, isPrototype]);

    const addTx = async (data) => {
        if (isPrototype) {
            const context = prototypeStorage.getActiveFinancialContext();
            if (context !== FINANCIAL_CONTEXTS.INDIVIDUAL) {
                throw new Error(`Gravação bloqueada: novas transações no contexto "${context}" serão integradas na Etapa 5.`);
            }
            const added = prototypeStorage.addTransaction(data);
            const current = getScopedPrototypeTransactions();
            setAllTransactions(current);
            setTransactions(prepareMonthlyTransactions(current, currentMonth));
            return added;
        }

        if (!currentUser) return;
        
        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const newTx = { id: tempId, ...data, userId: currentUser.uid, createdAt: new Date().toISOString() };
        
        const previousAll = [...allTransactions];
        const previousProcessed = [...transactions];
        
        setAllTransactions(prev => [newTx, ...prev]);
        setTransactions(prepareMonthlyTransactions([newTx, ...allTransactions], currentMonth));

        try {
            const added = await addTransaction(currentUser.uid, data);
            return added;
        } catch (err) {
            // Rollback
            setAllTransactions(previousAll);
            setTransactions(previousProcessed);
            throw err;
        }
    };

    const updateTx = async (id, data) => {
        if (isPrototype) {
            const individualList = prototypeStorage.getTransactions();
            const isIndividual = individualList.some(tx => tx.id === id);
            if (!isIndividual) {
                throw new Error('Transações familiares não podem ser alteradas nesta etapa.');
            }
            const updated = prototypeStorage.updateTransaction(id, data);
            const current = getScopedPrototypeTransactions();
            setAllTransactions(current);
            setTransactions(prepareMonthlyTransactions(current, currentMonth));
            return updated;
        }

        if (!currentUser) return;

        // Optimistic Update
        const previousAll = [...allTransactions];
        const previousProcessed = [...transactions];

        const updatedAll = allTransactions.map(tx => tx.id === id ? { ...tx, ...data } : tx);
        setAllTransactions(updatedAll);
        setTransactions(prepareMonthlyTransactions(updatedAll, currentMonth));

        try {
            await updateTransaction(currentUser.uid, id, data);
        } catch (err) {
            // Rollback
            setAllTransactions(previousAll);
            setTransactions(previousProcessed);
            throw err;
        }
    };

    const deleteTx = async (id, monthToSkip = null) => {
        if (isPrototype) {
            const individualList = prototypeStorage.getTransactions();
            const isIndividual = individualList.some(tx => tx.id === id);
            if (!isIndividual) {
                throw new Error('Transações familiares não podem ser excluídas nesta etapa.');
            }
            prototypeStorage.deleteTransaction(id, monthToSkip);
            const current = getScopedPrototypeTransactions();
            setAllTransactions(current);
            setTransactions(prepareMonthlyTransactions(current, currentMonth));
            return;
        }

        if (!currentUser) return;

        // Optimistic Update
        const previousAll = [...allTransactions];
        const previousProcessed = [...transactions];

        let updatedAll;
        if (monthToSkip) {
            updatedAll = allTransactions.map(tx => {
                if (tx.id === id) {
                    const excludedMonths = tx.excludedMonths || [];
                    return { ...tx, excludedMonths: [...excludedMonths, monthToSkip] };
                }
                return tx;
            });
        } else {
            updatedAll = allTransactions.filter(tx => tx.id !== id);
        }

        setAllTransactions(updatedAll);
        setTransactions(prepareMonthlyTransactions(updatedAll, currentMonth));

        try {
            await deleteTransaction(currentUser.uid, id, monthToSkip);
        } catch (err) {
            // Rollback
            setAllTransactions(previousAll);
            setTransactions(previousProcessed);
            throw err;
        }
    };

    const refetch = () => {
        if (isPrototype) {
            const current = getScopedPrototypeTransactions();
            setAllTransactions(current);
            setTransactions(prepareMonthlyTransactions(current, currentMonth));
        }
    };

    return { transactions, allTransactions, loading, error, addTx, updateTx, deleteTx, refetch };
};
