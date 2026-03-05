import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

const DynamicIslandHint = () => {
    const [isVisible, setIsVisible] = useState(false);
    const location = useLocation();

    useEffect(() => {
        setIsVisible(false);

        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 10000); // Demora 10s para aparecer

        const hideTimer = setTimeout(() => {
            setIsVisible(false);
        }, 15000); // Fica 5s na tela e some

        return () => {
            clearTimeout(timer);
            clearTimeout(hideTimer);
        };
    }, [location.pathname]);

    useEffect(() => {
        const handleInteraction = () => {
            if (isVisible) setIsVisible(false);
        };

        window.addEventListener('scroll', handleInteraction, { passive: true });
        window.addEventListener('touchstart', handleInteraction, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, [isVisible]);

    const isHome = location.pathname === '/';
    const message = isHome ? "Estatísticas" : "Home";
    const Icon = isHome ? ChevronDown : ChevronUp;

    return (
        <div style={{
            position: 'absolute',
            top: 'env(safe-area-inset-top, 16px)',
            left: '50%',
            background: 'var(--surface-color)',
            border: '1px solid var(--glass-border)',
            borderRadius: '100px',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 100,
            pointerEvents: 'none',
            fontSize: '0.85rem',
            color: 'var(--text-main)',
            fontWeight: '600',
            transform: isVisible ? 'translate(-50%, 0) scale(1)' : 'translate(-50%, -150%) scale(0.9)',
            opacity: isVisible ? 1 : 0,
            transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
            {isHome && <Icon size={16} color="var(--primary-color)" style={{ animation: isVisible ? 'bounceUpDown 2s infinite' : 'none' }} />}
            <span>{message}</span>
            {!isHome && <Icon size={16} color="var(--primary-color)" style={{ animation: isVisible ? 'bounceUpDown 2s infinite' : 'none' }} />}

            <style>{`
                @keyframes bounceUpDown {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(4px); }
                }
            `}</style>
        </div>
    );
};

export default DynamicIslandHint;
