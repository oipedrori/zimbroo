/**
 * Lógica pura do Motor de Planejamento (Recorrentes e Parceladas)
 * Analisa as transações e calcula quais valem para o `targetMonth` ('YYYY-MM').
 */
export const prepareMonthlyTransactions = (allTxs, targetMonth) => {
    const [targetY, targetM] = targetMonth.split('-').map(Number);
    const targetDateValue = targetY * 12 + targetM;

    return allTxs.filter(tx => {
        const txDate = tx.date;
        const [y, m] = txDate.split('-').map(Number);
        const txDateValue = y * 12 + m;

        // Verificar se este mês específico foi excluído da recorrência
        if (tx.excludedMonths && tx.excludedMonths.includes(targetMonth)) {
            return false;
        }

        if (tx.repeatType === 'none') {
            return txDate.startsWith(targetMonth);
        }

        if (tx.repeatType === 'recurring') {
            // Recorrente aparece do mês inicial para a frente, mas apenas dentro do mesmo ano
            return targetDateValue >= txDateValue && targetY === y;
        }

        if (tx.repeatType === 'installment') {
            // Começa no mês txDateValue e vai até txDateValue + installments - 1
            return targetDateValue >= txDateValue && targetDateValue < (txDateValue + tx.installments);
        }

        return false;
    }).map(tx => {
        const txCopy = { ...tx };
        
        // Normalizar datas inválidas ou em formato ISO string
        if (txCopy.date && txCopy.date.includes('T')) {
            txCopy.date = txCopy.date.split('T')[0];
        }
        
        // Pós-processamento na cópia para evitar mutação do original
        if (txCopy.repeatType === 'installment') {
            const txDate = txCopy.date;
            const [y, m] = txDate.split('-').map(Number);
            const txDateValue = y * 12 + m;
            const currentParcelAmount = (targetDateValue - txDateValue) + 1;
            txCopy.description = `${txCopy.description} (${currentParcelAmount}/${txCopy.installments})`;
        }

        if (txCopy.repeatType === 'recurring' || txCopy.repeatType === 'installment') {
            const originalDay = txCopy.date.split('-')[2];
            txCopy.virtualDate = `${targetMonth}-${originalDay}`;
        } else {
            txCopy.virtualDate = txCopy.date;
        }
        return txCopy;
    }).sort((a, b) => new Date(b.virtualDate) - new Date(a.virtualDate));
};
