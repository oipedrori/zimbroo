import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AiPanel from './AiPanel';
import DynamicIslandHint from './DynamicIslandHint';
import TransactionModal from './TransactionModal';
import './Layout.css';

const Layout = () => {
    const [isAiActive, setIsAiActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        // iOS PWA shortcuts sometimes strip query params, so we use hash #voice
        if (location.hash === '#voice') {
            setIsAiActive(true);
            // Remove hash cleanly without triggering a reload
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }, [location.hash]);

    const handleAiClick = () => {
        setIsAiActive(!isAiActive);
    };

    // Swipe Navigation Logic tracking finger vertically
    const [touchStart, setTouchStart] = useState(null);
    const [currentPull, setCurrentPull] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [disableTransition, setDisableTransition] = useState(false);

    const minSwipeDistance = 120; // threshold for navigating

    const onTouchStart = (e) => {
        if (isAnimating) return;
        setTouchStart(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e) => {
        if (!touchStart || isAnimating) return;

        const currentY = e.targetTouches[0].clientY;
        const dy = currentY - touchStart;

        // Block pull down if the user is scrolling down a list, only allow if at the very top
        const isAtTop = e.currentTarget.scrollTop <= 0;

        if (location.pathname === '/' && dy > 0 && isAtTop) {
            // No Home, puxar pra baixo
            setCurrentPull(dy * 0.6);
        } else if (location.pathname === '/statistics' && dy < 0) {
            // Nos Graficos, puxar pra cima
            setCurrentPull(dy * 0.6);
        }
    };

    const onTouchEnd = () => {
        if (!touchStart || isAnimating) return;

        if (location.pathname === '/' && currentPull > minSwipeDistance) {
            triggerNavigation('/statistics', window.innerHeight);
        } else if (location.pathname === '/statistics' && currentPull < -minSwipeDistance) {
            triggerNavigation('/', -window.innerHeight);
        } else {
            // Snap back
            setIsAnimating(true);
            setCurrentPull(0);
            setTimeout(() => {
                setIsAnimating(false);
            }, 250);
        }
        setTouchStart(null);
    };

    const triggerNavigation = (path, exitPull) => {
        setIsAnimating(true);
        setCurrentPull(exitPull);

        setTimeout(() => {
            navigate(path);

            setDisableTransition(true);
            setCurrentPull(-exitPull); // start from other side

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setDisableTransition(false);
                    setCurrentPull(0); // slide to center
                    setTimeout(() => setIsAnimating(false), 250);
                });
            });
        }, 200);
    };

    const mainTransitionStyle = disableTransition || (touchStart !== null && !isAnimating && currentPull !== 0)
        ? 'none'
        : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';

    return (
        <div className="app-container" style={{ overflow: 'hidden', position: 'relative' }}>

            <DynamicIslandHint />

            {/* O conteúdo das páginas (Home, Stats) será renderizado aqui */}
            <main
                className="main-content"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                    transform: `translateY(${currentPull}px)`,
                    transition: mainTransitionStyle,
                    willChange: 'transform'
                }}
            >
                <Outlet />
            </main>

            {/* Camada do Painel de IA */}
            <AiPanel
                isActive={isAiActive}
                onClose={() => setIsAiActive(false)}
                onOpenManualModal={() => setIsManualModalOpen(true)}
                onListeningChange={setIsListening}
            />

            {/* Modal Manual Global Disparado pela IA Panel */}
            <TransactionModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                defaultType="expense"
            />

            {/* Removed Loader overlay as we now use active sliding */}

            {/* Bottom Blur Effect */}
            <div className="bottom-blur-layer" />

            {/* Navegação Simplificada - Apenas Botão Central (Home) */}
            {location.pathname === '/' && (
                <nav className="bottom-nav">
                    {/* Botão Central de IA */}
                    <div className="nav-center-item">
                        <button
                            className={`ai-mic-btn ${isAiActive ? 'active' : ''}`}
                            onClick={handleAiClick}
                            aria-label="Ativar Inteligência Artificial"
                        >
                            {isListening && <div className="aura listening"></div>}
                            <div className="mic-glow"></div>
                            <Plus size={32} color="#ffffff" strokeWidth={2.5} style={{ transition: 'transform 0.3s', transform: isAiActive ? 'rotate(45deg)' : 'rotate(0)' }} />
                        </button>
                    </div>
                </nav>
            )}
        </div>
    );
};

export default Layout;
