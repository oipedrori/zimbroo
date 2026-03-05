import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

const DynamicIslandHint = () => {
    const [isVisible, setIsVisible] = useState(false);
    const location = useLocation();

    useEffect(() => {
        // Reset visibility when route changes
        setIsVisible(false);

        // Show hint after 3 seconds of being on a page
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 3000);

        // Hide hint after 8 seconds total
        const hideTimer = setTimeout(() => {
            setIsVisible(false);
        }, 8000);

        return () => {
            clearTimeout(timer);
            clearTimeout(hideTimer);
        };
    }, [location.pathname]);

    // Listen to scroll/touch to immediately hide the banner
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

    if (!isVisible) return null;

    const isHome = location.pathname === '/';
    const message = isHome ? "Deslize para baixo" : "Deslize para cima";
    const Icon = isHome ? ChevronDown : ChevronUp;

    return (
        <div style={{
            position: 'absolute',
            top: 'env(safe-area-inset-top, 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-color)',
            border: '1px solid var(--glass-border)',
            borderRadius: '100px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 100,
            pointerEvents: 'none',
            fontSize: '0.85rem',
            color: 'var(--text-main)',
            fontWeight: '500',
            animation: 'dynamicIslandDrop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
        }}>
            {isHome && <Icon size={16} color="var(--primary-color)" style={{ animation: 'bounceUpDown 2s infinite' }} />}
            <span>{message}</span>
            {!isHome && <Icon size={16} color="var(--primary-color)" style={{ animation: 'bounceUpDown 2s infinite' }} />}

            <style>{`
                @keyframes dynamicIslandDrop {
                    0% { transform: translate(-50%, -150%) scale(0.8); opacity: 0; }
                    100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
                }
                @keyframes bounceUpDown {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(4px); }
                }
            `}</style>
        </div>
    );
};

export default DynamicIslandHint;
