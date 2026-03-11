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

        // Dismiss imediato via interação global
        const handleGlobalInteraction = () => {
            handleDismiss();
        };

        // Delay para evitar sumir com o próprio clique que abriu o app/tela
        interactionTimeout = setTimeout(() => {
            document.addEventListener('touchstart', handleGlobalInteraction, { passive: true });
            document.addEventListener('mousedown', handleGlobalInteraction, { passive: true });
            document.addEventListener('scroll', handleGlobalInteraction, { passive: true });
        }, 500);

        return () => {
            isMounted = false;
            clearTimeout(hideTimeout);
            clearTimeout(interactionTimeout);
            document.removeEventListener('touchstart', handleGlobalInteraction);
            document.removeEventListener('mousedown', handleGlobalInteraction);
            document.removeEventListener('scroll', handleGlobalInteraction);
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
