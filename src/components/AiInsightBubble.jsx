import React, { useState, useEffect, useRef } from 'react';
import { generateInsightMessage } from '../services/geminiService';
import './AiInsightBubble.css';

const AiInsightBubble = ({ transactions, onClose }) => {
    const [isVisible, setVisible] = useState(false);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const hasFetched = useRef(false);

    useEffect(() => {
        let isMounted = true;
        let hideTimeout;
        let interactionTimeout;

        const fetchMessage = async () => {
            if (hasFetched.current) return;
            hasFetched.current = true;
            
            setIsLoading(true);
            // Mostrar o balão na tela com os pontinhos carregando
            setTimeout(() => setVisible(true), 300);

            const insight = await generateInsightMessage(transactions);
            if (!isMounted) return;

            setMessage(insight);
            setIsLoading(false);

            // Autodestruição após 6 segundos de aparecer a mensagem para ler com calma
            hideTimeout = setTimeout(() => {
                handleDismiss();
            }, 6000);
        };

        fetchMessage();

        return () => {
            isMounted = false;
            clearTimeout(hideTimeout);
        };
    }, [transactions]);

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
                {isLoading ? (
                    <div className="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                ) : (
                    message
                )}
            </div>
            {/* Elementos visuais pontilhados de um balão de pensamento */}
            <div className="thought-dot dot-1"></div>
            <div className="thought-dot dot-2"></div>
        </div>
    );
};

export default AiInsightBubble;
