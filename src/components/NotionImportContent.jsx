import React, { useState, useEffect } from 'react';
import LoadingDots from './LoadingDots';
import { Database, CheckCircle2, AlertCircle, Trash2, TrendingUp, TrendingDown, ChevronLeft } from 'lucide-react';
import { getNotionDatabaseInfo, fetchNotionTransactions, orchestratedDiscovery, extractNotionId, findDatabasesOnPage, getNotionWorkspaceInfo } from '../services/notionService';
import { addTransaction, deleteAllUserTransactions } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { haptic } from '../utils/haptic';

const NotionImportContent = ({ onFinish, onBack, initialOAuthCode }) => {
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const [notionToken, setNotionToken] = useState(localStorage.getItem('zimbroo_notion_token') || '');
    const [expenseDbId, setExpenseDbId] = useState(localStorage.getItem('zimbroo_notion_expense_db_id') || '');
    const [incomeDbId, setIncomeDbId] = useState(localStorage.getItem('zimbroo_notion_income_db_id') || '');

    const [foundDbs, setFoundDbs] = useState([]);
    const [step, setStep] = useState(notionToken ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [syncStats, setSyncStats] = useState({ expenses: 0, incomes: 0 });
    const [workspaceInfo, setWorkspaceInfo] = useState(null);
    const [scanningPage, setScanningPage] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [hasInitialSearchDone, setHasInitialSearchDone] = useState(false);
    const [manualSecret, setManualSecret] = useState('');

    const NOTION_CLIENT_ID = import.meta.env.VITE_NOTION_CLIENT_ID;
    const NOTION_REDIRECT_URI = window.location.origin + '/notion-callback';

    const handleExchangeCode = async (code) => {
        setLoading(true);
        setStatusMessage('Autenticando com Notion...');
        setError(null);
        try {
            const response = await fetch('/api/notion-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    code, 
                    redirect_uri: NOTION_REDIRECT_URI 
                })
            });
            
            const data = await response.json();

            if (data.access_token) {
                setNotionToken(data.access_token);
                localStorage.setItem('zimbroo_notion_token', data.access_token);
                setStep(2);
            } else {
                throw new Error(data.error || 'Falha na conexão com o Notion');
            }
        } catch (err) {
            setError("Erro ao conectar com o Notion. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const handleManualConnect = async () => {
        if (!manualSecret.trim()) return;
        const cleanSecret = manualSecret.trim();
        if (!cleanSecret.startsWith('secret_')) {
            setError(t('notion_secret_error'));
            return;
        }

        setLoading(true);
        setStatusMessage(t('validating_secret'));
        setError(null);
        try {
            // Test connection by fetching workspace info
            const ws = await getNotionWorkspaceInfo(cleanSecret);
            if (ws) {
                setNotionToken(cleanSecret);
                localStorage.setItem('zimbroo_notion_token', cleanSecret);
                setStep(2);
                haptic.success();
            } else {
                throw new Error(t('notion_validation_error'));
            }
        } catch (err) {
            setError(t('notion_validation_error'));
        } finally {
            setLoading(false);
        }
    };

    // Auto-check for code from prop (passed from Home.jsx)
    useEffect(() => {
        if (initialOAuthCode && !notionToken) {
            handleExchangeCode(initialOAuthCode);
        }
    }, [initialOAuthCode]);

    const refreshDatabases = async () => {
        if (!notionToken) return;
        setLoading(true);
        setStatusMessage('Buscando bases de dados...');
        setError(null);
        setScanningPage('');

        try {
            const ws = await getNotionWorkspaceInfo(notionToken).catch(() => null);
            setWorkspaceInfo(ws);

            const discovered = await orchestratedDiscovery(notionToken, (pageName) => {
                setScanningPage(pageName);
                setStatusMessage(t('scanning_page', { pageName }));
            });
            
            const directDbs = discovered.filter(item => item.object === 'database');
            
            // Auto identification
            const foundExpense = directDbs.find(db => {
                const title = (db.title?.[0]?.plain_text || '').toLowerCase();
                return title.includes('despesa') || title.includes('gasto') || title.includes('expense');
            });
            if (foundExpense) {
                const cleanId = foundExpense.id.replace(/-/g, '');
                setExpenseDbId(cleanId);
                localStorage.setItem('zimbroo_notion_expense_db_id', cleanId);
            }

            const foundIncome = directDbs.find(db => {
                const title = (db.title?.[0]?.plain_text || '').toLowerCase();
                return title.includes('receita') || title.includes('ganho') || title.includes('income');
            });
            if (foundIncome) {
                const cleanId = foundIncome.id.replace(/-/g, '');
                setIncomeDbId(cleanId);
                localStorage.setItem('zimbroo_notion_income_db_id', cleanId);
            }

            setFoundDbs(directDbs);
            haptic.light(); 
        } catch (err) {
            setError("Não conseguimos ler suas páginas. Tente reconectar.");
        } finally {
            setLoading(false);
            setScanningPage('');
        }
    };

    useEffect(() => {
        if (notionToken && step === 2 && !hasInitialSearchDone && !loading) {
            setHasInitialSearchDone(true);
            refreshDatabases();
        }
    }, [notionToken, step]);

    const assignDb = (id, role) => {
        const cleanId = id.replace(/-/g, '');
        if (role === 'expense') {
            setExpenseDbId(cleanId);
            localStorage.setItem('zimbroo_notion_expense_db_id', cleanId);
        } else {
            setIncomeDbId(cleanId);
            localStorage.setItem('zimbroo_notion_income_db_id', cleanId);
        }
        setError(null);
    };

    const handleResetData = async () => {
        if (window.confirm("ISSO APAGARÁ TODAS AS MOVIMENTAÇÕES DO ZIMBROO. Deseja continuar?")) {
            setLoading(true);
            setStatusMessage('Limpando todos os dados...');
            try {
                await deleteAllUserTransactions(currentUser.uid);
                haptic.success();
                setError("Todas as movimentações foram apagadas com sucesso.");
                setTimeout(() => setError(null), 3000);
            } catch (err) {
                setError("Erro ao apagar dados.");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleDisconnect = () => {
        if (window.confirm(t('confirm_disconnect'))) {
            localStorage.removeItem('zimbroo_notion_token');
            localStorage.removeItem('zimbroo_notion_expense_db_id');
            localStorage.removeItem('zimbroo_notion_income_db_id');
            setNotionToken('');
            setExpenseDbId('');
            setIncomeDbId('');
            setHasInitialSearchDone(false);
            setStep(1);
            setFoundDbs([]);
            setError(null);
            haptic.light();
        }
    };

    const startSync = async () => {
        if (!expenseDbId && !incomeDbId) {
            setError("Selecione pelo menos uma base.");
            return;
        }

        setLoading(true);
        setStatusMessage('Preparando importação...');
        setError(null);
        setProgress(0);
        let txsE = [];
        let txsI = [];

        try {
            if (expenseDbId) {
                setStatusMessage(t('fetching_expenses_start'));
                txsE = await fetchNotionTransactions(notionToken, expenseDbId, (count) => {
                    setStatusMessage(t('fetching_expenses', { count }));
                });
            }
            if (incomeDbId) {
                setStatusMessage(t('fetching_incomes_start'));
                txsI = await fetchNotionTransactions(notionToken, incomeDbId, (count) => {
                    setStatusMessage(t('fetching_incomes', { count }));
                });
            }

            const total = txsE.length + txsI.length;
            if (total === 0) throw new Error(t('no_pending_txs'));

            setStatusMessage(t('importing_txs'));
            let current = 0;
            for (let tx of txsE) {
                await addTransaction(currentUser.uid, { ...tx, type: 'expense' });
                current++;
                setProgress(Math.round((current / total) * 100));
            }
            for (let tx of txsI) {
                await addTransaction(currentUser.uid, { ...tx, type: 'income' });
                current++;
                setProgress(Math.round((current / total) * 100));
            }

            setSyncStats({ expenses: txsE.length, incomes: txsI.length });
            setStep(4);
            haptic.success();
        } catch (err) {
            setError(err.message || "Erro na sincronização.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{ padding: '0 4px' }}>
            {/* Inner Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '12px' }}>
                <button
                    onClick={onBack}
                    style={{ background: 'var(--surface-color)', border: '1px solid var(--glass-border)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                    <ChevronLeft size={20} />
                </button>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, flex: 1 }}>{step === 4 ? t('success') : t('notion_import_title')}</h2>
                {notionToken && step !== 4 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleResetData}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '12px', padding: '8px 12px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700' }}
                        >
                            {t('clear_all')}
                        </button>
                        <button
                            onClick={handleDisconnect}
                            style={{ background: 'var(--surface-color)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '8px 12px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            {loading && (
                <div style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-color)', zIndex: 100, borderRadius: '24px', padding: '24px',
                    textAlign: 'center'
                }}>
                    <LoadingDots style={{ marginBottom: '24px', transform: 'scale(1.5)' }} />
                    <p style={{ color: 'var(--text-main)', fontWeight: '700', fontSize: '1.1rem', marginBottom: '8px' }}>
                        {statusMessage}
                    </p>
                    {progress > 0 && (
                        <div style={{ width: '100%', maxWidth: '200px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.3s ease' }} />
                        </div>
                    )}
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>
                        {t('do_not_close_app')}
                    </p>
                </div>
            )}

            {error && <div style={{ color: '#ef4444', marginBottom: '24px', fontSize: '0.85rem', fontWeight: '600', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px' }}>⚠️ {error}</div>}

            {step === 1 && (
                <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '70px', height: '70px', borderRadius: '22px', background: 'var(--primary-color)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 24px',
                        boxShadow: '0 8px 30px rgba(var(--primary-rgb), 0.3)'
                    }}>
                        <Database size={32} color="white" />
                    </div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px' }}>{t('notion_connect_title')}</h3>
                    <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '28px', fontSize: '0.9rem' }}>
                        {t('notion_connect_desc_manual', { type: <strong>{t('notion_internal_integration')}</strong> })}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {t('notion_integration_secret')}
                            </label>
                            <input 
                                type="password"
                                value={manualSecret}
                                onChange={(e) => setManualSecret(e.target.value)}
                                placeholder="secret_..."
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--surface-color)',
                                    color: 'var(--text-main)', border: '1px solid var(--glass-border)', fontSize: '1rem',
                                    outline: 'none', transition: 'border-color 0.2s'
                                }}
                            />
                        </div>

                        <button
                            onClick={handleManualConnect}
                            disabled={loading || !manualSecret.trim()}
                            style={{
                                width: '100%', padding: '18px', backgroundColor: 'white', color: 'black',
                                borderRadius: '20px', border: 'none', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: '12px', cursor: 'pointer', fontWeight: '900', fontSize: '1.1rem',
                                opacity: loading || !manualSecret.trim() ? 0.6 : 1,
                                boxShadow: '0 8px 25px rgba(255,255,255,0.1)'
                            }}
                        >
                            {loading ? <LoadingDots /> : t('notion_connect_manual')}
                        </button>
                    </div>

                    <div style={{ margin: '32px 0', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.3 }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--text-main)' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: '800' }}>{t('notion_or_use_oauth')}</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--text-main)' }} />
                    </div>

                    <button
                        onClick={() => {
                            const authUrl = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}&response_type=code`;
                            window.location.href = authUrl;
                        }}
                        disabled={loading}
                        style={{
                            width: '100%', padding: '14px', backgroundColor: 'transparent', color: 'var(--text-muted)',
                            borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem'
                        }}
                    >
                        <img src="/notion_logo.png" style={{ width: '16px', height: '16px', opacity: 0.6 }} alt="" />
                        {t('notion_continue_oauth')}
                    </button>
                    
                    <style>{`
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            )}

            {step === 2 && (
                <div>
                   <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                        <div 
                            style={{
                                flex: 1, padding: '20px 12px', borderRadius: '20px', 
                                background: expenseDbId ? 'var(--danger-light)' : 'var(--surface-color)',
                                border: `2px solid ${expenseDbId ? 'var(--danger-color)' : 'var(--glass-border)'}`, 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <TrendingDown size={24} color={expenseDbId ? 'var(--danger-color)' : 'var(--text-muted)'} />
                            <div style={{ fontSize: '0.75rem', fontWeight: '900', color: expenseDbId ? 'var(--danger-color)' : 'var(--text-muted)' }}>GASTOS</div>
                        </div>
                        <div 
                            style={{
                                flex: 1, padding: '20px 12px', borderRadius: '20px', 
                                background: incomeDbId ? 'var(--success-light)' : 'var(--surface-color)',
                                border: `2px solid ${incomeDbId ? 'var(--success-color)' : 'var(--glass-border)'}`, 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <TrendingUp size={24} color={incomeDbId ? 'var(--success-color)' : 'var(--text-muted)'} />
                            <div style={{ fontSize: '0.75rem', fontWeight: '900', color: incomeDbId ? 'var(--success-color)' : 'var(--text-muted)' }}>GANHOS</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px', overflowY: 'visible', paddingRight: '4px' }}>
                        {foundDbs.map(db => {
                            const isExpense = expenseDbId === db.id.replace(/-/g, '');
                            const isIncome = incomeDbId === db.id.replace(/-/g, '');
                            return (
                                <div key={db.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', borderRadius: '18px' }}>
                                    <div style={{ flex: 1, fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {db.title[0]?.plain_text || t('unnamed')}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={() => assignDb(db.id, 'expense')} style={{ fontSize: '0.65rem', fontWeight: '800', padding: '6px 8px', borderRadius: '8px', background: isExpense ? 'var(--danger-color)' : 'var(--bg-color)', color: isExpense ? 'white' : 'var(--text-muted)', border: 'none' }}>{t('expense_btn')}</button>
                                        <button onClick={() => assignDb(db.id, 'income')} style={{ fontSize: '0.65rem', fontWeight: '800', padding: '6px 8px', borderRadius: '8px', background: isIncome ? 'var(--success-color)' : 'var(--bg-color)', color: isIncome ? 'white' : 'var(--text-muted)', border: 'none' }}>{t('income_btn')}</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={startSync}
                        disabled={(!expenseDbId && !incomeDbId) || loading}
                        style={{
                            width: '100%', padding: '24px', borderRadius: '20px',
                            background: 'white', color: 'black',
                            fontWeight: '900', fontSize: '1.3rem', border: 'none',
                            opacity: (!expenseDbId && !incomeDbId) ? 0.6 : 1,
                            boxShadow: '0 8px 30px rgba(255,255,255,0.1)'
                        }}
                    >
                        {loading ? `${progress}% ${t('importing_txs')}` : t('import_now')}
                    </button>
                </div>
            )}

            {step === 4 && (
                <div style={{ textAlign: 'center' }}>
                    <CheckCircle2 size={60} color="#22c55e" style={{ margin: '0 auto 24px' }} />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px' }}>{t('success')}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '32px' }}>
                        {t('items_imported', { count: syncStats.expenses + syncStats.incomes })}
                    </p>
                    <button
                        onClick={onFinish}
                        style={{ width: '100%', padding: '18px', borderRadius: '18px', background: 'white', color: 'black', fontWeight: '800', border: 'none' }}
                    >
                        {t('done')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotionImportContent;
