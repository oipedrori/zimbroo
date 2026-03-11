import React, { useState, useEffect } from 'react';
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

            // Autodestruição após 15 segundos
            hideTimeout = setTimeout(() => {
                handleDismiss();
            }, 15000);
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
                    <div className="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                ) : (
                    preFetchedMessage
                )}
            </div>
            {/* Elementos visuais pontilhados de um balão de pensamento */}
            <div className="thought-dot dot-1"></div>
            <div className="thought-dot dot-2"></div>
        </div>
    );
};

export default AiInsightBubble;
