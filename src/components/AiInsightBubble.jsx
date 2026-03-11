import React, { useState, useEffect } from 'react';
import './AiInsightBubble.css';

const AiInsightBubble = ({ transactions, balance, expenses, incomes, onClose }) => {
    const [isVisible, setVisible] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Lógica de texto: no máximo 2 frases.
        let selectedMessage = "Pronto para organizar suas finanças hoje? É só apertar e falar.";

        if (transactions && transactions.length > 0) {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const yYear = yesterday.getFullYear();
            const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
            const yDay = String(yesterday.getDate()).padStart(2, '0');
            const yesterdayStr = `${yYear}-${yMonth}-${yDay}`; // Formato virtualDate YYYY-MM-DD
            
            const spentYesterday = transactions.some(t => t.type === 'expense' && t.virtualDate === yesterdayStr);
            const hasPastExpenses = transactions.some(t => t.type === 'expense' && t.virtualDate <= yesterdayStr);
            
            // Cenário 2: Alerta de orçamento
            if (incomes > 0 && expenses >= incomes * 0.8) {
                selectedMessage = "Notei que você já gastou 80% do orçamento. Que tal segurar os gastos extras hoje?";
            } 
            // Cenário 1: Dias sem gastar
            else if (hasPastExpenses && !spentYesterday) {
                selectedMessage = "Nenhum gasto registrado ontem! Seu saldo do mês agradece.";
            }
        }

        setMessage(selectedMessage);

        // Animação de Entrada: brotar
        const showTimeout = setTimeout(() => {
            setVisible(true);
        }, 300);

        // Autodestruição após 4 a 5 segundos
        const hideTimeout = setTimeout(() => {
            handleDismiss();
        }, 4800);

        // Dismiss imediato via interação global
        const handleGlobalInteraction = () => {
            handleDismiss();
        };

        // Delay para evitar sumir com o próprio clique que abriu o app/tela
        const interactionTimeout = setTimeout(() => {
            document.addEventListener('touchstart', handleGlobalInteraction, { passive: true });
            document.addEventListener('mousedown', handleGlobalInteraction, { passive: true });
            document.addEventListener('scroll', handleGlobalInteraction, { passive: true });
        }, 500);

        return () => {
            clearTimeout(showTimeout);
            clearTimeout(hideTimeout);
            clearTimeout(interactionTimeout);
            document.removeEventListener('touchstart', handleGlobalInteraction);
            document.removeEventListener('mousedown', handleGlobalInteraction);
            document.removeEventListener('scroll', handleGlobalInteraction);
        };
    }, [transactions, expenses, incomes]);

    const handleDismiss = () => {
        setVisible(false);
        // Espera a animação de "desinflar/fade" terminar (aprox 300ms) para notificar o pai
        setTimeout(() => {
            if(onClose) onClose();
        }, 300);
    };

    return (
        <div className={`ai-insight-bubble ${isVisible ? 'visible' : 'hidden'}`} onClick={(e) => { e.stopPropagation(); handleDismiss(); }}>
            <div className="bubble-content">
                {message}
            </div>
            <div className="bubble-pointer"></div>
        </div>
    );
};

export default AiInsightBubble;
