import React, { useState, useEffect } from 'react';
import LoadingDots from './LoadingDots';
import './AiInsightBubble.css';

const AiInsightBubble = ({ preFetchedMessage, onClose }) => {
    const [isVisible, setVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let hideTimeout;
        let showTimeout;
        
        // Mostrar o balão na tela com os pontinhos carregando logo no começo
        showTimeout = setTimeout(() => setVisible(true), 300);

        if (preFetchedMessage) {
            setIsLoading(false);

            // Autodestruição após 10 segundos
            hideTimeout = setTimeout(() => {
                handleDismiss();
            }, 10000);
        }

        return () => {
            clearTimeout(hideTimeout);
            clearTimeout(showTimeout);
        };
    }, [preFetchedMessage]);

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
                    <LoadingDots />
                ) : (
                    preFetchedMessage
                )}
            </div>
        </div>
    );
};

export default AiInsightBubble;
