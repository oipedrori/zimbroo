import React, { useState, useEffect, useRef } from 'react';
import { Plus, Mic, X, Keyboard, Home as HomeIcon, BarChart2, Shield, Wallet as WalletIcon } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import AiPanel from './AiPanel';
import DynamicIslandHint from './DynamicIslandHint';
import TransactionModal from './TransactionModal';
import AiInsightBubble from './AiInsightBubble';
import { useI18n } from '../contexts/I18nContext';
import { haptic } from '../utils/haptic';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';
import { generateInsightMessage } from '../services/geminiService';
import { usePrototype } from '../contexts/PrototypeContext';
import { usePrototypeFinancial } from '../contexts/PrototypeFinancialContext';
import PrototypeScopeGuardModal from './PrototypeScopeGuardModal';
import './Layout.css';

const Layout = () => {
    const { isPrototype } = usePrototype();
    const { financialContext, triggerBlockedAction } = usePrototypeFinancial();
    const [isAiActive, setIsAiActive] = useState(false);
    const [isTextMode, setIsTextMode] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [insightMessage, setInsightMessage] = useState('');
    const location = useLocation();
    const { t } = useI18n();
    const [isBottomNavHiddenFromChild, setIsBottomNavHiddenFromChild] = useState(false);
    const [isFabShrunk, setIsFabShrunk] = useState(false);
    const mainContentRef = useRef(null);
    const lastScrollY = useRef(0);

    const handleAddClick = () => {
        haptic.light();
        setIsManualModalOpen(true);
    };

    const handleVoiceClick = () => {
        haptic.light();
        if (isPrototype) {
            triggerBlockedAction({
                title: 'Comando de Voz com IA',
                message: 'Essa funcionalidade seria uma adição de movimentação por voz com IA. Recurso indisponível nesse protótipo de alta fidelidade.',
                allowSwitch: false
            });
            return;
        }
        handleAiClick('voice');
    };

    const handleTextClick = () => {
        haptic.light();
        if (isPrototype) {
            triggerBlockedAction({
                title: 'Adição por Texto com IA',
                message: 'Essa funcionalidade seria uma adição de movimentação por texto com IA. Recurso indisponível nesse protótipo de alta fidelidade.',
                allowSwitch: false
            });
            return;
        }
        handleAiClick('text');
    };

    // Pegamos a data atual para o hook de transactions, mas de forma simplificada apenas para passar pro balão
    const currentDate = new Date();
    const monthPrefix = format(currentDate, 'yyyy-MM');
    const { transactions } = useTransactions(monthPrefix);

    // Pré-buscar o Insight assim que o app carrega, independente de renderizar o balão
    useEffect(() => {
        let isMounted = true;
        
        if (transactions !== undefined && insightMessage === '') {
            generateInsightMessage(transactions).then(msg => {
                if (isMounted) {
                    setInsightMessage(msg);
                    haptic.light(); // Vibrar levemente quando o pensamento aparece
                }
            });
        }
        
        return () => { isMounted = false; };
    }, [transactions]); // Will fire when transactions are ready
 
    // Scroll listener for FAB scaling
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = mainContentRef.current?.scrollTop || window.scrollY;
            
            // Shrink faster and be more sensitive
            if (currentScrollY > lastScrollY.current && currentScrollY > 20) {
                setIsFabShrunk(true);
            } else if (currentScrollY < lastScrollY.current - 5 || currentScrollY <= 20) {
                // Only enlarge if scrolling up significantly or back to top
                setIsFabShrunk(false);
            }
            
            lastScrollY.current = currentScrollY;
        };

        const container = mainContentRef.current;
        window.addEventListener('scroll', handleScroll, { passive: true });
        if (container) {
            container.addEventListener('scroll', handleScroll, { passive: true });
        }
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (container) container.removeEventListener('scroll', handleScroll);
        };
    }, []);


    useEffect(() => {
        if (location.hash === '#voice' || location.pathname === '/mic') {
            setIsAiActive(true);
            
            // Se for rota /mic, trocamos o ícone dinamicamente para facilitar o bookmark
            if (location.pathname === '/mic') {
                document.title = "Zimbroo Mic";
                const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
                link.type = 'image/png';
                link.rel = 'apple-touch-icon';
                link.href = '/mic-shortcut.png';
                document.getElementsByTagName('head')[0].appendChild(link);
            }

            if (location.hash === '#voice') {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        } else {
            // Restore default title if needed
            document.title = "Zimbroo";
        }
    }, [location.hash, location.pathname]);

    const handleAiClick = (mode = 'voice') => {
        setIsTextMode(mode === 'text');
        setIsAiActive(true);
    };

    const handleCloseAi = () => {
        setIsAiActive(false);
        setIsTextMode(false);
    };

    const NavLinks = [
        { path: '/', icon: <HomeIcon size={20} />, label: t('home', { defaultValue: 'Início' }) },
        { path: '/limits', icon: <Shield size={20} />, label: t('limits', { defaultValue: 'Limites' }) },
    ];

    const isHidden = (
        (location.pathname !== '/' && location.pathname !== '/prototipo' && location.pathname !== '/notion-callback' && location.pathname !== '/mic')
        || isManualModalOpen 
        || isAiActive 
        || isBottomNavHiddenFromChild
    );

    return (
        <div className="app-container">

            {/* O conteúdo das páginas (Home, Stats) será renderizado aqui */}
            <main
                ref={mainContentRef}
                className="main-content"
            >
                <Outlet context={{ setIsAiActive, setIsBottomNavHidden: setIsBottomNavHiddenFromChild }} />
            </main>

            {/* Modal de bloqueio de escopo para contextos Familiar e Ambos */}
            {isPrototype && <PrototypeScopeGuardModal />}

            {/* Camada do Painel de IA */}
            <AiPanel
                isActive={isAiActive}
                isTextMode={isTextMode}
                onClose={handleCloseAi}
                onOpenManualModal={() => setIsManualModalOpen(true)}
                onListeningChange={setIsListening}
            />

            {/* Modal Manual Global Disparado pela IA Panel */}
            <TransactionModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                defaultType="expense"
            />

            {/* Fixed FAB - Now renders globally to allow smooth slide animations */}
            <div className={`bottom-blur-layer ${isHidden ? 'hidden-state' : ''}`} />

            <nav className={`bottom-nav ${isHidden ? 'hidden-state' : ''}`}>
                <div className={`nav-items-wrapper ${isFabShrunk ? 'shrunk' : ''}`}>
                    {isPrototype ? (
                        <>
                            {/* À esquerda: botão de voz */}
                            <button 
                                className="nav-side-btn" 
                                onClick={handleVoiceClick}
                                aria-label="Comando de voz com IA"
                            >
                                <Mic size={24} />
                            </button>

                            {/* No meio (com fundo verde): botão de +, adição manual da movimentação */}
                            <div id="onboarding-ai-fab" className="nav-center-item">
                                <button
                                    className="ai-mic-btn"
                                    onClick={handleAddClick}
                                    aria-label="Adicionar movimentação"
                                    style={{
                                        background: 'var(--primary-gradient)',
                                        color: '#ffffff',
                                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)'
                                    }}
                                >
                                    <Plus size={32} color="white" strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* À direita: botão de teclado */}
                            <button 
                                className="nav-side-btn" 
                                onClick={handleTextClick}
                                aria-label="Digitar texto com IA"
                            >
                                <Keyboard size={24} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                className="nav-side-btn" 
                                onClick={handleAddClick}
                                aria-label={t('add_transaction')}
                            >
                                <Plus size={24} />
                            </button>

                            <div id="onboarding-ai-fab" className="nav-center-item">
                                <button
                                    className={`ai-mic-btn ${isListening ? 'active' : ''}`}
                                    onClick={handleVoiceClick}
                                    aria-label={t('ai_mic_label')}
                                >
                                    <Mic size={32} color="white" strokeWidth={2.5} />
                                </button>
                            </div>

                            <button 
                                className="nav-side-btn" 
                                onClick={handleTextClick}
                                aria-label={t('type_text')}
                            >
                                <Keyboard size={24} />
                            </button>
                        </>
                    )}
                </div>
            </nav>

            {/* Se o painel de IA estiver ativo, mostramos o botão de fechar flutuando aqui caso não queira usar o handleAiClick do layout */}
        </div>
    );
};

export default Layout;
