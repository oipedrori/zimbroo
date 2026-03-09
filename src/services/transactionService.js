import { collection, doc, addDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotionTransaction } from './notionService';

const TRANSACTIONS_COLLECTION = 'transactions';

/**
 * Adiciona uma nova transação.
 * type: 'expense' | 'income'
 * repeatType: 'none' | 'recurring' | 'installment'
 * installments: number (quantas parcelas)
 */
export const addTransaction = async (userId, data) => {
    const newTx = {
        userId,
        amount: data.amount,
        type: data.type || 'expense',
        category: data.category,
        description: data.description,
        date: data.date, // Formato YYYY-MM-DD
        repeatType: data.repeatType || 'none', // none, recurring, installment
        installments: data.installments || 1, // 1 se for none ou recurring, > 1 se installment
        currentInstallment: data.currentInstallment || 1, // Se for criação manual via app, pode ser a parcela 1/N
        createdAt: new Date().toISOString(),
    };

    try {
        const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), newTx);

        // Notion Sync (Side Effect - doesn't block UI)
        const notionToken = localStorage.getItem('zimbroo_notion_token');
        const notionDbId = localStorage.getItem('zimbroo_notion_db_id');
        if (notionToken && notionDbId) {
            createNotionTransaction(notionToken, notionDbId, newTx)
                .catch(err => console.error("Notion Sync Error:", err));
        }

        return { id: docRef.id, ...newTx };
    } catch (error) {
        console.error("Error adding transaction: ", error);
        throw error;
    }
};

export const deleteTransaction = async (userId, transactionId) => {
    try {
        await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, transactionId));
    } catch (error) {
        console.error("Error deleting transaction: ", error);
        throw error;
    }
};

export const updateTransaction = async (userId, transactionId, data) => {
    try {
        const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);

        const updatedData = {
            amount: data.amount,
            type: data.type,
            category: data.category,
            description: data.description,
            date: data.date,
            repeatType: data.repeatType || 'none',
            installments: data.installments || 1,
            updatedAt: new Date().toISOString()
        };

        await updateDoc(docRef, updatedData);
        return { id: transactionId, ...updatedData };
    } catch (error) {
        console.error("Error updating transaction: ", error);
        throw error;
    }
};

/**
 * Busca todas as transações de um usuário de um mes específico.
 * format month: 'YYYY-MM'
 */
export const getTransactionsByMonth = async (userId, monthPrefix) => {
    try {
        const q = query(
            collection(db, TRANSACTIONS_COLLECTION),
            where("userId", "==", userId)
            // Como não criamos indices complexos ainda, filtramos no frontend ou pegamos só do mês
        );

        const querySnapshot = await getDocs(q);
        const transactions = [];
        querySnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        // Filtro simplificado no cliente (considerando o motor de projeção mensal)
        // Se a transação é 'none' -> ver se date startswith monthPrefix
        // Se a transação é 'recurring' -> ver se date <= ultimo dia do mes verificado
        // Se a transação é 'installment' -> ver se o mês alvo está dentro do período das parcelas

        return prepareMonthlyTransactions(transactions, monthPrefix);
    } catch (error) {
        console.error("Error fetching transactions: ", error);
        throw error;
    }
};

/**
 * Lógica do Motor de Planejamento (Recorrentes e Parceladas)
 * Ele analisa todas as transacoes do usuario e calcula quais valem para o `targetMonth` ('YYYY-MM').
 */
const prepareMonthlyTransactions = (allTxs, targetMonth) => {
    const [targetY, targetM] = targetMonth.split('-').map(Number);
    const targetDateValue = targetY * 12 + targetM; // Facilita comparacao de meses

    return allTxs.filter(tx => {
        const txDate = tx.date; // Ex: '2026-03-01'
        const [y, m] = txDate.split('-').map(Number);
        const txDateValue = y * 12 + m;

        if (tx.repeatType === 'none') {
            return txDate.startsWith(targetMonth);
        }

        if (tx.repeatType === 'recurring') {
            // Recorrente aparece do mes inicial para a frente
            // Para fins do App, poderíamos colocar um end recurrence, mas manteremos infinito para agora
            return targetDateValue >= txDateValue;
        }

        if (tx.repeatType === 'installment') {
            // Comeca no mes txDateValue e vai ate txDateValue + installments - 1
            const isWithinInstallments = targetDateValue >= txDateValue && targetDateValue < (txDateValue + tx.installments);

            // Ajuste cosmético: poderíamos calcular o numero da parcela dinamicamente
            if (isWithinInstallments) {
                // Injetar informação dinâmica da parcela atual na tx para exibir no app
                const currentParcelAmount = (targetDateValue - txDateValue) + 1;
                tx.dynamicDescription = `${tx.description} (${currentParcelAmount}/${tx.installments})`;
            }
            return isWithinInstallments;
        }

        return false;
    }).map(tx => {
        // Normalizar a data virtualmente para cair dentro do mes buscado, caso seja recorrente,
        // para ordenar corretamente nos extratos (por exemplo, assumindo o mesmo dia do mes original)
        if (tx.repeatType === 'recurring' || tx.repeatType === 'installment') {
            const originalDay = tx.date.split('-')[2];
            // Garante que o mes/ano corresponde ao targetMonth
            tx.virtualDate = `${targetMonth}-${originalDay}`;
        } else {
            tx.virtualDate = tx.date;
        }
        return tx;
    }).sort((a, b) => new Date(b.virtualDate) - new Date(a.virtualDate));
};

export const getYearlyStats = async (userId, year) => {
    try {
        const q = query(
            collection(db, TRANSACTIONS_COLLECTION),
            where("userId", "==", userId)
        );

        const querySnapshot = await getDocs(q);
        const allTxs = [];
        querySnapshot.forEach((doc) => {
            allTxs.push({ id: doc.id, ...doc.data() });
        });

        const monthlyBalances = [];
        for (let m = 1; m <= 12; m++) {
            const monthPrefix = `${year}-${String(m).padStart(2, '0')}`;
            const monthTxs = prepareMonthlyTransactions(allTxs, monthPrefix);
            const inc = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
            const exp = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

            monthlyBalances.push({
                month: m,
                label: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1],
                incomes: inc,
                expenses: exp,
                balance: inc - exp
            });
        }
        return monthlyBalances;
    } catch (error) {
        console.error("Error fetching yearly stats: ", error);
        throw error;
    }
};
