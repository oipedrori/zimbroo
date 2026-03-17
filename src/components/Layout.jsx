import React, { useState, useEffect } from 'react';
import { Plus, Mic, X, Keyboard, Home as HomeIcon, BarChart2, Shield, Wallet as WalletIcon } from 'lucide-react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import AiPanel from './AiPanel';
import DynamicIslandHint from './DynamicIslandHint';
import TransactionModal from './TransactionModal';
import AiInsightBubble from './AiInsightBubble';
import { useI18n } from '../contexts/I18nContext';
import { haptic } from '../utils/haptic';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';
import { generateInsightMessage } from '../services/geminiService';
import './Layout.css';

const Layout = () => {
    const [isAiActive, setIsAiActive] = useState(false);
    const [isTextMode, setIsTextMode] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [showAiInsight, setShowAiInsight] = useState(true);
    const [insightMessage, setInsightMessage] = useState('');
    const location = useLocation();
    const { t } = useI18n();

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
        { path: '/statistics', icon: <BarChart2 size={20} />, label: t('statistics', { defaultValue: 'Estatísticas' }) },
        { path: '/limits', icon: <Shield size={20} />, label: t('limits', { defaultValue: 'Limites' }) },
        { path: '/wallet', icon: <WalletIcon size={20} />, label: t('wallet', { defaultValue: 'Carteira' }) },
    ];

    return (
        <div className="app-container">

            {/* O conteúdo das páginas (Home, Stats) será renderizado aqui */}
            <main
                className="main-content"
            >
                <Outlet context={{ setIsAiActive }} />
            </main>

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
            <div className={`bottom-blur-layer ${(location.pathname !== '/' && location.pathname !== '/notion-callback' && location.pathname !== '/mic' || isManualModalOpen || isAiActive) ? 'hidden-state' : ''}`} />

            <nav className={`bottom-nav ${(location.pathname !== '/' && location.pathname !== '/notion-callback' && location.pathname !== '/mic' || isManualModalOpen || isAiActive) ? 'hidden-state' : ''}`}>
                {showAiInsight && location.pathname === '/' && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 3000 }}>
                        <AiInsightBubble 
                            preFetchedMessage={insightMessage} 
                            onClose={() => setShowAiInsight(false)} 
                        />
                    </div>
                )}
                
                <div className="nav-items-wrapper">
                    <button 
                        className="nav-side-btn" 
                        onClick={() => setIsManualModalOpen(true)}
                        aria-label={t('add_transaction')}
                    >
                        <Plus size={24} />
                    </button>

                    <div className="nav-center-item">
                        <button
                            className={`ai-mic-btn ${isListening ? 'active' : ''}`}
                            onClick={() => handleAiClick('voice')}
                            aria-label={t('ai_mic_label')}
                        >
                            <Mic size={32} color="white" strokeWidth={2.5} />
                        </button>
                    </div>

                    <button 
                        className="nav-side-btn" 
                        onClick={() => handleAiClick('text')}
                        aria-label={t('type_text')}
                    >
                        <Keyboard size={24} />
                    </button>
                </div>
            </nav>

            {/* Se o painel de IA estiver ativo, mostramos o botão de fechar flutuando aqui caso não queira usar o handleAiClick do layout */}
        </div>
    );
};

export default Layout;
