import { useState, useEffect, useCallback } from 'react';
import { getTransactionsByMonth, addTransaction, deleteTransaction, updateTransaction } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';

export const useTransactions = (currentMonth) => { // format 'YYYY-MM'
    const { currentUser } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTransactions = useCallback(async (showLoading = true) => {
        if (!currentUser) return;
        if (showLoading) setLoading(true);
        try {
            const data = await getTransactionsByMonth(currentUser.uid, currentMonth);
            setTransactions(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [currentUser, currentMonth]);

    useEffect(() => {
        fetchTransactions(true);
    }, [fetchTransactions]);

    const addTx = async (data) => {
        if (!currentUser) return;

        // Optimistic UI Update
        const optimisticTx = {
            id: 'temp-' + Date.now(),
            ...data,
            virtualDate: data.date,
            amount: Number(data.amount)
        };
        setTransactions(prev => [optimisticTx, ...prev].sort((a, b) => new Date(b.virtualDate) - new Date(a.virtualDate)));

        try {
            await addTransaction(currentUser.uid, data);
            fetchTransactions(false); // background silent refresh
        } catch (err) {
            fetchTransactions(false); // rollback on error
            throw err;
        }
    };

    const updateTx = async (id, data) => {
        if (!currentUser) return;

        // Optimistic Edit Update
        setTransactions(prev => prev.map(t =>
            t.id === id ? { ...t, ...data, virtualDate: data.date || t.virtualDate } : t
        ));

        try {
            await updateTransaction(currentUser.uid, id, data);
            fetchTransactions(false); // background silent refresh
        } catch (err) {
            fetchTransactions(false); // rollback
            throw err;
        }
    };

    const deleteTx = async (id) => {
        if (!currentUser) return;

        // Optimistic Delete
        setTransactions(prev => prev.filter(t => t.id !== id));

        try {
            await deleteTransaction(currentUser.uid, id);
            fetchTransactions(false); // background silent refresh
        } catch (err) {
            fetchTransactions(false); // rollback
            throw err;
        }
    };

    return { transactions, loading, error, addTx, updateTx, deleteTx, refetch: () => fetchTransactions(true) };
};
