import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Database, ArrowRight, CheckCircle2, AlertCircle, FileText, Loader2, Link, Lock, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { getNotionDatabaseInfo, fetchNotionTransactions, searchNotionDatabases, extractNotionId } from '../services/notionService';
import { addTransaction } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';

const NotionImport = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();

    const [notionToken, setNotionToken] = useState(localStorage.getItem('zimbroo_notion_token') || '');
    const [expenseDbId, setExpenseDbId] = useState(localStorage.getItem('zimbroo_notion_expense_db_id') || '');
    const [incomeDbId, setIncomeDbId] = useState(localStorage.getItem('zimbroo_notion_income_db_id') || '');

    const [foundDbs, setFoundDbs] = useState([]);
    const [manualUrl, setManualUrl] = useState('');

    const [step, setStep] = useState(notionToken ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [syncStats, setSyncStats] = useState({ expenses: 0, incomes: 0 });

    // Notion OAuth Config
    const NOTION_CLIENT_ID = import.meta.env.VITE_NOTION_CLIENT_ID;
    const NOTION_REDIRECT_URI = import.meta.env.VITE_NOTION_REDIRECT_URI || (window.location.origin + '/notion-callback');

    useEffect(() => {
        const code = searchParams.get('code');
        if (code && !notionToken) {
            handleExchangeCode(code);
        }
    }, [searchParams]);

    const handleExchangeCode = async (code) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/notion-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const data = await response.json();
            if (data.access_token) {
                setNotionToken(data.access_token);
                localStorage.setItem('zimbroo_notion_token', data.access_token);
                setSearchParams({});

                const dbs = await searchNotionDatabases(data.access_token);
                setFoundDbs(dbs);
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

    const refreshDatabases = async () => {
        setLoading(true);
        try {
            const dbs = await searchNotionDatabases(notionToken);
            setFoundDbs(dbs);
        } catch (e) {
            setError("Não conseguimos localizar as bases.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (notionToken && foundDbs.length === 0 && step === 2) {
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
    };

    const startSync = async () => {
        if (!expenseDbId && !incomeDbId) {
            setError("Selecione pelo menos uma base para importar.");
            return;
        }

        setLoading(true);
        setError(null);
        setProgress(0);
        let totalProcessed = 0;
        let expensesCount = 0;
        let incomesCount = 0;

        try {
            // 1. Process Expenses
            if (expenseDbId) {
                const txs = await fetchNotionTransactions(notionToken, expenseDbId);
                for (let tx of txs) {
                    await addTransaction(currentUser.uid, { ...tx, type: 'expense' });
                    expensesCount++;
                    totalProcessed++;
                    setProgress(Math.min(50, Math.round((totalProcessed / (txs.length * 2)) * 100)));
                }
            }

            // 2. Process Incomes
            if (incomeDbId) {
                const txs = await fetchNotionTransactions(notionToken, incomeDbId);
                for (let tx of txs) {
                    await addTransaction(currentUser.uid, { ...tx, type: 'income' });
                    incomesCount++;
                    totalProcessed++;
                    setProgress(Math.round((totalProcessed / (totalProcessed + txs.length)) * 100));
                }
            }

            setSyncStats({ expenses: expensesCount, incomes: incomesCount });
            setStep(4);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', minHeight: '100vh', paddingBottom: '120px' }}>
            {/* Header */}
            <header style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', gap: '16px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '600' }}>Integração Notion</h1>
            </header>

            <main>
                {step === 1 && (
                    <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '24px', background: 'var(--primary-color)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 24px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                        }}>
                            <Database size={40} color="white" />
                        </div>

                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)', lineHeight: 1.2 }}>
                            Sincronização Bidirecional
                        </h2>

                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px', fontSize: '1.05rem' }}>
                            Mantenha o Zimbroo e o Notion sempre alinhados. O que você gasta em um, aparece no outro.
                        </p>

                        <div style={{ background: 'var(--card-bg)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                                    <img src="/notion_logo.png" style={{ width: '28px', height: '28px', objectFit: 'contain' }} alt="Notion" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>OAuth 2.0 Ativado</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Autorização segura via API Oficial</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const authUrl = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${NOTION_CLIENT_ID}&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}&response_type=code`;
                                    window.location.href = authUrl;
                                }}
                                disabled={loading}
                                style={{
                                    width: '100%', padding: '18px', backgroundColor: 'black', color: 'white',
                                    borderRadius: '16px', border: 'none', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'transform 0.2s',
                                    fontWeight: '700', fontSize: '1rem',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                                }}
                            >
                                <img src="/notion_logo.png" style={{ width: '22px', height: '22px', objectFit: 'contain' }} alt="" />
                                {loading ? 'Carregando...' : 'Conectar Agora'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>
                                    Vincular Tabelas
                                </h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    Selecione qual tabela do Notion é para suas despesas e qual é para suas receitas.
                                </p>
                            </div>
                            <button onClick={refreshDatabases} style={{ padding: '8px', background: 'var(--surface-color)', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                                <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {/* Status de Seleção */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                            <div style={{
                                flex: 1, padding: '16px', borderRadius: '20px', background: expenseDbId ? 'rgba(239, 68, 68, 0.1)' : 'var(--card-bg)',
                                border: `1px solid ${expenseDbId ? '#ef4444' : 'var(--border-color)'}`, textAlign: 'center'
                            }}>
                                <TrendingDown size={20} color={expenseDbId ? '#ef4444' : 'var(--text-muted)'} style={{ marginBottom: '8px' }} />
                                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: expenseDbId ? '#ef4444' : 'var(--text-muted)' }}>DESPESAS</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {expenseDbId ? 'Vinculado' : 'Não selecionado'}
                                </div>
                            </div>
                            <div style={{
                                flex: 1, padding: '16px', borderRadius: '20px', background: incomeDbId ? 'rgba(34, 197, 94, 0.1)' : 'var(--card-bg)',
                                border: `1px solid ${incomeDbId ? '#22c55e' : 'var(--border-color)'}`, textAlign: 'center'
                            }}>
                                <TrendingUp size={20} color={incomeDbId ? '#22c55e' : 'var(--text-muted)'} style={{ marginBottom: '8px' }} />
                                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: incomeDbId ? '#22c55e' : 'var(--text-muted)' }}>RECEITAS</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {incomeDbId ? 'Vinculado' : 'Não selecionado'}
                                </div>
                            </div>
                        </div>

                        {/* Lista de Bases Encontradas */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                            {foundDbs.length > 0 ? foundDbs.map(db => (
                                <div
                                    key={db.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '14px', padding: '16px',
                                        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                                        borderRadius: '20px', textAlign: 'left',
                                        transition: 'all 0.2s', width: '100%'
                                    }}
                                >
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                                        <img src="/notion_logo.png" style={{ width: '22px', height: '22px' }} alt="" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                                            {db.title[0]?.plain_text || 'Sem título'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => assignDb(db.id, 'expense')}
                                                style={{
                                                    fontSize: '0.7rem', fontWeight: '700', padding: '4px 10px', borderRadius: '6px',
                                                    background: expenseDbId === db.id.replace(/-/g, '') ? '#ef4444' : 'var(--surface-color)',
                                                    color: expenseDbId === db.id.replace(/-/g, '') ? 'white' : 'var(--text-muted)',
                                                    border: 'none', cursor: 'pointer'
                                                }}
                                            >
                                                É DESPESA
                                            </button>
                                            <button
                                                onClick={() => assignDb(db.id, 'income')}
                                                style={{
                                                    fontSize: '0.7rem', fontWeight: '700', padding: '4px 10px', borderRadius: '6px',
                                                    background: incomeDbId === db.id.replace(/-/g, '') ? '#22c55e' : 'var(--surface-color)',
                                                    color: incomeDbId === db.id.replace(/-/g, '') ? 'white' : 'var(--text-muted)',
                                                    border: 'none', cursor: 'pointer'
                                                }}
                                            >
                                                É RECEITA
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface-color)', borderRadius: '24px', opacity: 0.6 }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                                    <p>Buscando suas tabelas...</p>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '24px', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px' }}>
                                <AlertCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            onClick={startSync}
                            disabled={(!expenseDbId && !incomeDbId) || loading}
                            style={{
                                width: '100%', padding: '20px', borderRadius: '20px',
                                background: 'var(--primary-color)', color: 'white',
                                fontWeight: '700', fontSize: '1.1rem', border: 'none',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
                                opacity: (!expenseDbId && !incomeDbId) ? 0.6 : 1
                            }}
                        >
                            {loading ? `${progress}% Sincronizando...` : 'Iniciar Importação Completa'}
                        </button>
                    </div>
                )}

                {step === 4 && (
                    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                        <div style={{ marginBottom: '32px' }}>
                            <CheckCircle2 size={80} color="#22c55e" style={{ margin: '0 auto' }} />
                        </div>
                        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)' }}>
                            Tudo Pronto!
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1.1rem' }}>
                            Suas tabelas foram integradas e a sincronização bidirecional está ativa.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '48px' }}>
                            <div style={{ flex: 1, background: 'var(--surface-color)', padding: '16px', borderRadius: '20px' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>{syncStats.expenses}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>DESPESAS</div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--surface-color)', padding: '16px', borderRadius: '20px' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>{syncStats.incomes}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>RECEITAS</div>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/')}
                            style={{
                                width: '100%', padding: '18px', borderRadius: '18px',
                                background: 'var(--primary-darker)', color: 'white',
                                fontWeight: '700', fontSize: '1rem', border: 'none'
                            }}
                        >
                            Ir para Dashboard
                        </button>
                    </div>
                )}
            </main>
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default NotionImport;
