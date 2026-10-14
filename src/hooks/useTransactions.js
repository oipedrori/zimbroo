import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { prepareMonthlyTransactions, addTransaction, deleteTransaction, updateTransaction } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { usePrototype } from '../contexts/PrototypeContext';
import { prototypeStorage, PROTOTYPE_EVENTS } from '../services/prototypeStorage';

export const useTransactions = (currentMonth) => { // format 'YYYY-MM'
    const { currentUser } = useAuth();
    const { isPrototype } = usePrototype();

    const [allTransactions, setAllTransactions] = useState(() => {
        if (isPrototype) {
            return prototypeStorage.getTransactions();
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

    // Efeito para sincronização em modo Protótipo
    useEffect(() => {
        if (!isPrototype) return;

        const syncFromStorage = () => {
            const current = prototypeStorage.getTransactions();
            setAllTransactions(current);
            setTransactions(prepareMonthlyTransactions(current, currentMonth));
            setLoading(false);
            setError(null);
        };

        syncFromStorage();
        window.addEventListener(PROTOTYPE_EVENTS.TXS_CHANGED, syncFromStorage);
        return () => window.removeEventListener(PROTOTYPE_EVENTS.TXS_CHANGED, syncFromStorage);
    }, [isPrototype, currentMonth]);

    useEffect(() => {
        if (isPrototype || !currentUser) return;

        // Se já temos cache, desativamos o loading visual pesado (opcional)
        // mas mantemos o loading para sincronizar.
        setLoading(true);

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
    }, [currentUser, currentMonth]);

    const addTx = async (data) => {
        if (isPrototype) {
            const added = prototypeStorage.addTransaction(data);
            const current = prototypeStorage.getTransactions();
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
        setTransactions(prev => prepareMonthlyTransactions([newTx, ...allTransactions], currentMonth));

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
            const updated = prototypeStorage.updateTransaction(id, data);
            const current = prototypeStorage.getTransactions();
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
            prototypeStorage.deleteTransaction(id, monthToSkip);
            const current = prototypeStorage.getTransactions();
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
            const current = prototypeStorage.getTransactions();
            setAllTransactions(current);
            setTransactions(prepareMonthlyTransactions(current, currentMonth));
        }
    };

    return { transactions, allTransactions, loading, error, addTx, updateTx, deleteTx, refetch };
};
