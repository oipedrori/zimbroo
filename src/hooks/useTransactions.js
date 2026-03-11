import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { prepareMonthlyTransactions, addTransaction, deleteTransaction, updateTransaction } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';

export const useTransactions = (currentMonth) => { // format 'YYYY-MM'
    const { currentUser } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [allTransactions, setAllTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

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
        if (!currentUser) return;
        try {
            await addTransaction(currentUser.uid, data);
        } catch (err) {
            throw err;
        }
    };

    const updateTx = async (id, data) => {
        if (!currentUser) return;
        try {
            await updateTransaction(currentUser.uid, id, data);
        } catch (err) {
            throw err;
        }
    };

    const deleteTx = async (id, monthToSkip = null) => {
        if (!currentUser) return;
        try {
            await deleteTransaction(currentUser.uid, id, monthToSkip);
        } catch (err) {
            throw err;
        }
    };

    return { transactions, allTransactions, loading, error, addTx, updateTx, deleteTx, refetch: () => {} };
};
