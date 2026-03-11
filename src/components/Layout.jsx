import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Mic, X } from 'lucide-react';
import AiPanel from './AiPanel';
import DynamicIslandHint from './DynamicIslandHint';
import TransactionModal from './TransactionModal';
import AiInsightBubble from './AiInsightBubble';
import { useI18n } from '../contexts/I18nContext';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';
import './Layout.css';

const Layout = () => {
    const [isAiActive, setIsAiActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [showAiInsight, setShowAiInsight] = useState(true);
    const location = useLocation();
    const { t } = useI18n();

    // Pegamos a data atual para o hook de transactions, mas de forma simplificada apenas para passar pro balão
    const currentDate = new Date();
    const monthPrefix = format(currentDate, 'yyyy-MM');
    const { transactions } = useTransactions(monthPrefix);

    useEffect(() => {
        if (location.hash === '#voice') {
            setIsAiActive(true);
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }, [location.hash]);

    const handleAiClick = () => {
        setIsAiActive(!isAiActive);
    };

    return (
        <div className="app-container" style={{ overflow: 'hidden', position: 'relative' }}>

            {/* O conteúdo das páginas (Home, Stats) será renderizado aqui */}
            <main
                className="main-content"
                style={{
                    willChange: 'transform'
                }}
            >
                <Outlet context={{ setIsAiActive }} />
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

            {location.pathname === '/' && <div className="bottom-blur-layer" />}

            {/* Navegação Simplificada - Botão Místico de IA e Balão */}
            {location.pathname === '/' && !isManualModalOpen && !isAiActive && (
                <nav className="bottom-nav">
                    {showAiInsight && (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 3000 }}>
                            <AiInsightBubble 
                                transactions={transactions} 
                                onClose={() => setShowAiInsight(false)} 
                            />
                        </div>
                    )}
                    <div className="nav-center-item">
                        <button
                            className={`ai-mic-btn ${isAiActive ? 'active' : ''} ${isListening ? 'listening' : ''}`}
                            onClick={handleAiClick}
                            aria-label={t('ai_mic_label')}
                        >
                            <div className="mystical-aura"></div>
                            <img src="/Z.png" alt="Zimbroo" />
                        </button>
                    </div>
                </nav>
            )}

            {/* Se o painel de IA estiver ativo, mostramos o botão de fechar flutuando aqui caso não queira usar o handleAiClick do layout */}
            {isAiActive && (
                <nav className="bottom-nav" style={{ zIndex: 5001 }}>
                    <div className="nav-center-item">
                        <button
                            className={`ai-mic-btn active ${isListening ? 'listening' : ''}`}
                            onClick={handleAiClick}
                        >
                            <div className="mystical-aura"></div>
                            <X size={32} color="#ffffff" strokeWidth={2.5} />
                        </button>
                    </div>
                </nav>
            )}
        </div>
    );
};

export default Layout;
