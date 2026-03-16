import React, { useState, useEffect } from 'react';
import LoadingDots from '../components/LoadingDots';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Database, ArrowRight, CheckCircle2, AlertCircle, FileText, Loader2, Link, Lock, TrendingUp, TrendingDown, RefreshCcw, Trash2, HelpCircle } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { getNotionDatabaseInfo, fetchNotionTransactions, orchestratedDiscovery, extractNotionId, findDatabasesOnPage, getNotionWorkspaceInfo } from '../services/notionService';
import { addTransaction } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { haptic } from '../utils/haptic';

const NotionImport = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
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
    const [debugItems, setDebugItems] = useState([]); // Itens crus retornados pelo Notion
    const [workspaceInfo, setWorkspaceInfo] = useState(null);
    const [searchingBackground, setSearchingBackground] = useState(false);
    const [scanningPage, setScanningPage] = useState('');
    const [hasInitialSearchDone, setHasInitialSearchDone] = useState(false);

    // Check if connected on mount
    const NOTION_CLIENT_ID = import.meta.env.VITE_NOTION_CLIENT_ID;
    const NOTION_REDIRECT_URI = window.location.origin + '/notion-callback';

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
                body: JSON.stringify({ 
                    code, 
                    redirect_uri: NOTION_REDIRECT_URI 
                })
            });
            
            let data;
            try {
                data = await response.json();
            } catch (jsonErr) {
                throw new Error("Resposta inválida do servidor (não é JSON).");
            }

            if (data.access_token) {
                setNotionToken(data.access_token);
                localStorage.setItem('zimbroo_notion_token', data.access_token);
                // Remove o code da URL imediatamente
                setSearchParams({});
                // Muda de passo imediatamente para o usuário ver progresso
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
        setError(null);
        setScanningPage('');

        try {
            console.log("Iniciando descoberta automática profunda...");
            const ws = await getNotionWorkspaceInfo(notionToken).catch(() => null);
            setWorkspaceInfo(ws);

            const discovered = await orchestratedDiscovery(notionToken, (pageName) => {
                setScanningPage(pageName);
            });
            
            setDebugItems(discovered);
            const directDbs = discovered.filter(item => item.object === 'database');
            
            // --- AUTO IDENTIFICATION LOGIC ---
            // If we find a database with "despesa" or "gasto" or "expense", auto-assign it
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
            // ----------------------------------

            setFoundDbs(discovered.filter(item => item.object === 'database'));
            haptic.light(); 
        } catch (err) {
            console.error("Discovery Error: ", err);
            setError("Não conseguimos ler suas páginas do Notion. Tente desconectar e conectar novamente.");
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
    }, [notionToken, step, hasInitialSearchDone]);

    const assignDb = (id, role) => {
        const cleanId = id.replace(/-/g, '');
        if (role === 'expense') {
            setExpenseDbId(cleanId);
            localStorage.setItem('zimbroo_notion_expense_db_id', cleanId);
        } else {
            setIncomeDbId(cleanId);
            localStorage.setItem('zimbroo_notion_income_db_id', cleanId);
        }
        setError(null); // Limpa erros ao selecionar
    };

    const handleDisconnect = () => {
        if (window.confirm("Deseja realmente excluir a integração com o Notion?")) {
            localStorage.removeItem('zimbroo_notion_token');
            localStorage.removeItem('zimbroo_notion_expense_db_id');
            localStorage.removeItem('zimbroo_notion_income_db_id');
            setNotionToken('');
            setExpenseDbId('');
            setIncomeDbId('');
            setStep(1);
            setFoundDbs([]);
            setSearchParams({});
            setError(null);
        }
    };

    const handleManualLink = async () => {
        const id = extractNotionId(manualUrl);
        if (!id) {
            setError("Link inválido. Cole a URL completa da página do Notion.");
            return;
        }

        setLoading(true);
        setError(null);
        console.log("[NotionImport] Tentando vincular URL manual:", manualUrl);
        try {
            const id = extractNotionId(manualUrl);
            console.log("[NotionImport] ID Extraído:", id);
            
            console.log("Notion Deep Scan Iniciado para o ID:", id);
            // Tenta buscar bases dentro dessa página
            const childrenDbs = await findDatabasesOnPage(notionToken, id);
            console.log("Resultado scan profundo:", childrenDbs.length, "bases encontradas.");

            if (childrenDbs && childrenDbs.length > 0) {
                let autoAssigned = 0;
                childrenDbs.forEach(db => {
                    const title = (db.title[0]?.plain_text || '').toLowerCase();
                    if (title.includes('despesa') || title.includes('gastos') || title.includes('expense')) {
                        assignDb(db.id, 'expense');
                        autoAssigned++;
                    } else if (title.includes('receita') || title.includes('ganho') || title.includes('income')) {
                        assignDb(db.id, 'income');
                        autoAssigned++;
                    }
                });

                // Adiciona todas as encontradas na lista de visíveis
                setFoundDbs(prev => {
                    const existingIds = new Set(prev.map(d => d.id));
                    const newOnes = childrenDbs.filter(d => !existingIds.has(d.id));
                    return [...newOnes, ...prev];
                });

                if (autoAssigned > 0) {
                    setManualUrl('');
                } else {
                    setError(`Encontramos ${childrenDbs.length} tabelas, mas não conseguimos identificar qual é qual automaticamente. Vincule abaixo:`);
                }
            } else {
                // Se não achou filhos, tenta ver se o ID já é de uma database direta
                try {
                    console.log("Tentando busca direta como Database ID...");
                    const sanitizedId = id.replace(/-/g, '');
                    const directDb = await getNotionDatabaseInfo(notionToken, sanitizedId);
                    if (directDb && directDb.object === 'database') {
                        setFoundDbs(prev => {
                            if (prev.some(d => d.id.replace(/-/g, '') === sanitizedId)) return prev;
                            return [{ ...directDb, id: sanitizedId }, ...prev];
                        });
                        setError("Link identificado como uma base direta! Vincule-a como Despesa ou Receita abaixo.");
                    } else {
                        throw new Error("O link fornecido não parece ser uma base de dados.");
                    }
                } catch (e) {
                    console.error("Direct fetch failed:", e);
                    setError(`Não detectamos bases no ID informado. Se for uma página, certifique-se de que as tabelas de Despesas/Receitas estão dentro dela como blocos reais ou vinculados.`);
                }
            }
        } catch (err) {
            console.error("Critical Manual Link Error:", err);
            setError("Erro ao processar o link. Verifique sua conexão ou permissões no Notion.");
        } finally {
            setLoading(false);
        }
    };

    const startSync = async () => {
        if (!expenseDbId && !incomeDbId) {
            setError("Selecione pelo menos uma base (Despesa ou Receita) para continuar.");
            return;
        }

        setLoading(true);
        setError(null);
        setProgress(0);
        let txsE = [];
        let txsI = [];

        try {
            // Se já tivermos os IDs, vamos direto
            if (expenseDbId) {
                console.log("Buscando despesas...");
                txsE = await fetchNotionTransactions(notionToken, expenseDbId);
            }
            if (incomeDbId) {
                console.log("Buscando receitas...");
                txsI = await fetchNotionTransactions(notionToken, incomeDbId);
            }

            const total = txsE.length + txsI.length;
            if (total === 0) throw new Error("Não encontramos transações pendentes para importar.");

            let current = 0;
            // Batch processing loosely to show progress
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
            console.error("Notion Sync Error:", err);
            setError(err.message || "Erro na sincronização. Verifique suas tabelas no Notion.");
        } finally {
            setLoading(false);
        }
    };

    // Auto-start discovery if connected
    useEffect(() => {
        if (notionToken && step === 2 && !hasInitialSearchDone && !loading) {
            setHasInitialSearchDone(true);
            refreshDatabases();
        }
    }, [notionToken, step]);

    return (
        <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', minHeight: '100vh', paddingBottom: '160px' }}>
            {/* Header */}
            <header style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', gap: '16px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                    <ChevronLeft size={20} />
                </button>
                <h1 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '600', flex: 1 }}>Migrar do Notion</h1>
                {notionToken && (
                    <button
                        onClick={handleDisconnect}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '12px', padding: '8px 12px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Trash2 size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>Excluir</span>
                    </button>
                )}
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
                            Zimbroo + Notion
                        </h2>

                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px', fontSize: '1.05rem' }}>
                            Traga seus registros do Notion para o Zimbroo e centralize seu controle financeiro aqui.
                        </p>

                        <div style={{ background: 'var(--card-bg)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border-color)', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                                    <img src="/notion_logo.png" style={{ width: '28px', height: '28px', objectFit: 'contain' }} alt="Notion" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Migração de Dados</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mão única: Notion → Zimbroo.</p>
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
                                    justifyContent: 'center', gap: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '1rem'
                                }}
                            >
                                <img src="/notion_logo.png" style={{ width: '22px', height: '22px' }} alt="" />
                                {loading ? <LoadingDots style={{ color: 'white' }} /> : 'Migrar meu Notion'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-fade-in">
                        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>
                                Tudo Pronto!
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.5 }}>
                                Identificamos suas tabelas automaticamente. Basta clicar em importar para começar.
                            </p>
                        </div>

                        {/* Status Blocks Re-imagined as Selection Cards */}
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
                            <div 
                                onClick={() => { /* haptic.light(); */ /* scroll to list? */ }}
                                style={{
                                    flex: 1, padding: '24px 16px', borderRadius: '24px', 
                                    background: expenseDbId ? 'var(--danger-light)' : 'var(--surface-color)',
                                    border: `2px solid ${expenseDbId ? 'var(--danger-color)' : 'var(--glass-border)'}`, 
                                    textAlign: 'center', transition: 'all 0.3s ease',
                                    boxShadow: expenseDbId ? '0 10px 20px rgba(239, 68, 68, 0.1)' : 'none',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <TrendingDown size={32} color={expenseDbId ? 'var(--danger-color)' : 'var(--text-muted)'} />
                                <div style={{ fontSize: '0.85rem', fontWeight: '900', color: expenseDbId ? 'var(--danger-color)' : 'var(--text-muted)', letterSpacing: '1px' }}>GASTOS</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: expenseDbId ? 'var(--danger-color)' : 'var(--text-muted)', opacity: 0.8 }}>
                                    {expenseDbId ? 'CONECTADO' : 'SELECIONAR'}
                                </div>
                            </div>
                            
                            <div 
                                onClick={() => { /* haptic.light(); */ }}
                                style={{
                                    flex: 1, padding: '24px 16px', borderRadius: '24px', 
                                    background: incomeDbId ? 'var(--success-light)' : 'var(--surface-color)',
                                    border: `2px solid ${incomeDbId ? 'var(--success-color)' : 'var(--glass-border)'}`, 
                                    textAlign: 'center', transition: 'all 0.3s ease',
                                    boxShadow: incomeDbId ? '0 10px 20px rgba(34, 197, 94, 0.1)' : 'none',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <TrendingUp size={32} color={incomeDbId ? 'var(--success-color)' : 'var(--text-muted)'} />
                                <div style={{ fontSize: '0.85rem', fontWeight: '900', color: incomeDbId ? 'var(--success-color)' : 'var(--text-muted)', letterSpacing: '1px' }}>GANHOS</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: incomeDbId ? 'var(--success-color)' : 'var(--text-muted)', opacity: 0.8 }}>
                                    {incomeDbId ? 'CONECTADO' : 'SELECIONAR'}
                                </div>
                            </div>
                        </div>

                        {loading && !foundDbs.length && (
                            <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
                                <LoadingDots />
                                <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                    Vasculhando seu Notion...
                                </p>
                            </div>
                        )}

                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '32px', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.05)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                <AlertCircle size={20} />
                                <span style={{ fontWeight: '600' }}>{error}</span>
                            </div>
                        )}

                        {foundDbs.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.5, letterSpacing: '1px', marginBottom: '4px' }}>
                                    TABELAS DISPONÍVEIS
                                </label>
                                {foundDbs.map(db => {
                                    const isExpense = expenseDbId === db.id.replace(/-/g, '');
                                    const isIncome = incomeDbId === db.id.replace(/-/g, '');
                                    
                                    return (
                                        <div
                                            key={db.id}
                                            className="animate-fade-in"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                                                background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                                                borderRadius: '24px', width: '100%', transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                                                <img src="/notion_logo.png" style={{ width: '24px', height: '24px' }} alt="" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '6px' }}>
                                                    {db.title[0]?.plain_text || 'Tabela sem nome'}
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button
                                                        onClick={() => assignDb(db.id, 'expense')}
                                                        style={{
                                                            fontSize: '0.7rem', fontWeight: '800', padding: '6px 14px', borderRadius: '10px',
                                                            background: isExpense ? 'var(--danger-color)' : 'rgba(0,0,0,0.05)',
                                                            color: isExpense ? 'white' : 'var(--text-main)',
                                                            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {isExpense ? 'É GASTO ✓' : 'VINCULAR GASTO'}
                                                    </button>
                                                    <button
                                                        onClick={() => assignDb(db.id, 'income')}
                                                        style={{
                                                            fontSize: '0.7rem', fontWeight: '800', padding: '6px 14px', borderRadius: '10px',
                                                            background: isIncome ? 'var(--success-color)' : 'rgba(0,0,0,0.05)',
                                                            color: isIncome ? 'white' : 'var(--text-main)',
                                                            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {isIncome ? 'É GANHO ✓' : 'VINCULAR GANHO'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <button
                            onClick={startSync}
                            disabled={(!expenseDbId && !incomeDbId) || loading}
                            style={{
                                width: '100%', padding: '24px', borderRadius: '24px',
                                background: 'var(--primary-color)', color: 'white',
                                fontWeight: '900', fontSize: '1.2rem', border: 'none',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px',
                                opacity: (!expenseDbId && !incomeDbId) ? 0.6 : 1,
                                boxShadow: (!expenseDbId && !incomeDbId) ? 'none' : '0 12px 24px rgba(0,210,140,0.3)',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {loading ? `${progress}% Importando...` : `Importar Dados de ${new Date().getFullYear()}`}
                        </button>

                        <div style={{ height: '80px' }} aria-hidden="true" />
                    </div>
                )}

                {step === 4 && (
                    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                        <CheckCircle2 size={80} color="#22c55e" style={{ margin: '0 auto 32px' }} />
                        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)' }}>
                            Sucesso!
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1.1rem' }}>
                            {syncStats.expenses + syncStats.incomes} itens importados e sincronização ativa.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '48px' }}>
                            <div style={{ flex: 1, background: 'var(--surface-color)', padding: '16px', borderRadius: '20px' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ef4444' }}>{syncStats.expenses}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>GASTOS</div>
                            </div>
                            <div style={{ flex: 1, background: 'var(--surface-color)', padding: '16px', borderRadius: '20px' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#22c55e' }}>{syncStats.incomes}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>GANHOS</div>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/')}
                            style={{
                                width: '100%', padding: '18px', borderRadius: '18px',
                                background: 'black', color: 'white',
                                fontWeight: '700', fontSize: '1rem', border: 'none'
                            }}
                        >
                            Ver meu Dinheiro →
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
