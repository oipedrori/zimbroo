import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Database, ArrowRight, CheckCircle2, AlertCircle, FileText, Loader2, Link, Lock, TrendingUp, TrendingDown, RefreshCcw, Trash2, HelpCircle } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { getNotionDatabaseInfo, fetchNotionTransactions, searchNotionDatabases, extractNotionId, findDatabasesOnPage, getNotionWorkspaceInfo } from '../services/notionService';
import { addTransaction } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';

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
    const [hasInitialSearchDone, setHasInitialSearchDone] = useState(false);

    // Check if connected on mount
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
        try {
            console.log("Iniciando descoberta automática...");

            // Tenta validar o token primeiro
            const ws = await getNotionWorkspaceInfo(notionToken);
            setWorkspaceInfo(ws);

            const results = await searchNotionDatabases(notionToken);
            setDebugItems(results); // Guarda para o debug do usuário

            // 1. Mostra logo o que veio na busca direta (MUITO mais rápido)
            const directDbs = results.filter(item => item.object === 'database');
            setFoundDbs(directDbs);

            // Já encerra o loading principal aqui para liberar a UI
            setLoading(false);

            // 2. Busca profunda em background (não trava mais o spinner)
            const pages = results.filter(item => item.object === 'page');
            if (pages.length > 0) {
                setSearchingBackground(true);
                const topPages = pages.slice(0, 3); // Apenas as 3 primeiras para ser ultra-rápido
                for (const page of topPages) {
                    const nested = await findDatabasesOnPage(notionToken, page.id).catch(() => []);
                    if (nested.length > 0) {
                        setFoundDbs(prev => {
                            const combined = [...prev, ...nested];
                            // Remove duplicatas
                            const unique = Array.from(new Map(combined.map(d => [d.id, d])).values());

                            // Auto-vínculo para as novas encontradas
                            unique.forEach(db => {
                                const title = (db.title[0]?.plain_text || '').toLowerCase();
                                const isExpense = title.includes('despesa') || title.includes('gasto') || title.includes('expense') || title.includes('saída');
                                const isIncome = title.includes('receita') || title.includes('ganho') || title.includes('income') || title.includes('entrada');
                                if (isExpense && !localStorage.getItem('zimbroo_notion_expense_db_id')) assignDb(db.id, 'expense');
                                if (isIncome && !localStorage.getItem('zimbroo_notion_income_db_id')) assignDb(db.id, 'income');
                            });

                            return unique;
                        });
                    }
                }
                setSearchingBackground(false);
            }

            // A verificação final de erro (vazio) só faz sentido se realmente nada for encontrado após tudo
            // Mas para o usuário não ver erro "falso", só mostramos se realmente não houver nada após o scan rápido
            if (directDbs.length === 0 && results.filter(r => r.object === 'page').length === 0) {
                setError("Nenhum item autorizado encontrado. Clique em 'Excluir' e reconecte marcando os checklists.");
            }

            // 4. Auto-vínculo para as bases diretas (as profundas já vincularam acima)
            directDbs.forEach(db => {
                const title = (db.title[0]?.plain_text || '').toLowerCase();
                const isExpense = title.includes('despesa') || title.includes('gasto') || title.includes('expense') || title.includes('saída');
                const isIncome = title.includes('receita') || title.includes('ganho') || title.includes('income') || title.includes('entrada');
                if (isExpense && !localStorage.getItem('zimbroo_notion_expense_db_id')) assignDb(db.id, 'expense');
                if (isIncome && !localStorage.getItem('zimbroo_notion_income_db_id')) assignDb(db.id, 'income');
            });
        } catch (e) {
            console.error("Erro na descoberta automática:", e);
            setError(`Falha na API: ${e.message || 'Erro desconhecido'}. Tente excluir a conexão no botão vermelho acima e refazer.`);
        } finally {
            setLoading(false);
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
        try {
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
                    const directDb = await getNotionDatabaseInfo(notionToken, id);
                    if (directDb) {
                        setFoundDbs(prev => [directDb, ...prev]);
                        setError("Link identificado como uma base direta! Vincule-a como Despesa ou Receita abaixo.");
                    }
                } catch (e) {
                    console.error("Direct fetch failed:", e);
                    setError(`Não detectamos bases no ID [${id.substring(0, 8)}...]. Tente recriar a conexão e marcar explicitamente as tabelas na tela do Notion.`);
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
            if (expenseDbId) txsE = await fetchNotionTransactions(notionToken, expenseDbId);
            if (incomeDbId) txsI = await fetchNotionTransactions(notionToken, incomeDbId);

            const total = txsE.length + txsI.length;
            if (total === 0) throw new Error("Não encontramos transações para importar nestas bases.");

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
                <h1 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '600', flex: 1 }}>Integração Notion</h1>
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
                            Conecte seu Dashboard Financeiro e mantenha seu Notion sempre atualizado.
                        </p>

                        <div style={{ background: 'var(--card-bg)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border-color)', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                                    <img src="/notion_logo.png" style={{ width: '28px', height: '28px', objectFit: 'contain' }} alt="Notion" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Sincronização Ativa</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mão única ou via dupla configurável.</p>
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
                                {loading ? 'Carregando...' : 'Conectar Agora'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-fade-in">
                        <div style={{ marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>
                                Vincular Tabelas
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                Precisamos saber qual tabela do Notion representa os seus gastos e ganhos.
                            </p>
                        </div>

                        {/* Status Blocks */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                            <div style={{
                                flex: 1, padding: '16px', borderRadius: '20px', background: expenseDbId ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-color)',
                                border: `2px solid ${expenseDbId ? '#ef4444' : 'transparent'}`, textAlign: 'center'
                            }}>
                                <TrendingDown size={20} color={expenseDbId ? '#ef4444' : 'var(--text-muted)'} style={{ marginBottom: '8px' }} />
                                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: expenseDbId ? '#ef4444' : 'var(--text-muted)' }}>GASTOS</div>
                                <div style={{ fontSize: '0.7rem', marginTop: '4px', opacity: 0.6 }}>{expenseDbId ? 'PRONTO' : 'PENDENTE'}</div>
                            </div>
                            <div style={{
                                flex: 1, padding: '16px', borderRadius: '20px', background: incomeDbId ? 'rgba(34, 197, 94, 0.05)' : 'var(--surface-color)',
                                border: `2px solid ${incomeDbId ? '#22c55e' : 'transparent'}`, textAlign: 'center'
                            }}>
                                <TrendingUp size={20} color={incomeDbId ? '#22c55e' : 'var(--text-muted)'} style={{ marginBottom: '8px' }} />
                                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: incomeDbId ? '#22c55e' : 'var(--text-muted)' }}>GANHOS</div>
                                <div style={{ fontSize: '0.7rem', marginTop: '4px', opacity: 0.6 }}>{incomeDbId ? 'PRONTO' : 'PENDENTE'}</div>
                            </div>
                        </div>

                        {/* Automatic Localized Lists */}
                        {/* Discovery Status & Feedback */}
                        {loading && !foundDbs.length && !error && (
                            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
                                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                                <p>Buscando no Notion...</p>
                            </div>
                        )}

                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '24px', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '16px' }}>
                                <AlertCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Automatic Localized Lists */}
                        {foundDbs.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '700', opacity: 0.6, display: 'flex', justifySelf: 'start', marginBottom: '4px' }}>
                                    TABELAS FINANCEIRAS ENCONTRADAS
                                </label>
                                {foundDbs.map(db => (
                                    <div
                                        key={db.id}
                                        className="animate-fade-in"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px',
                                            background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                                            borderRadius: '20px', width: '100%'
                                        }}
                                    >
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f5f5', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            <img src="/notion_logo.png" style={{ width: '20px', height: '20px' }} alt="" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                                {db.title[0]?.plain_text || 'Tabela sem nome'}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <button
                                                    onClick={() => assignDb(db.id, 'expense')}
                                                    style={{
                                                        fontSize: '0.65rem', fontWeight: '800', padding: '4px 10px', borderRadius: '8px',
                                                        background: expenseDbId === db.id.replace(/-/g, '') ? '#ef4444' : 'var(--surface-color)',
                                                        color: expenseDbId === db.id.replace(/-/g, '') ? 'white' : 'var(--text-main)',
                                                        border: 'none', cursor: 'pointer'
                                                    }}
                                                >
                                                    {expenseDbId === db.id.replace(/-/g, '') ? '✓ GASTOS' : 'É GASTO'}
                                                </button>
                                                <button
                                                    onClick={() => assignDb(db.id, 'income')}
                                                    style={{
                                                        fontSize: '0.65rem', fontWeight: '800', padding: '4px 10px', borderRadius: '8px',
                                                        background: incomeDbId === db.id.replace(/-/g, '') ? '#22c55e' : 'var(--surface-color)',
                                                        color: incomeDbId === db.id.replace(/-/g, '') ? 'white' : 'var(--text-main)',
                                                        border: 'none', cursor: 'pointer'
                                                    }}
                                                >
                                                    {incomeDbId === db.id.replace(/-/g, '') ? '✓ GANHO' : 'É GANHO'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {searchingBackground && (
                                    <div style={{ padding: '12px', background: 'var(--primary-light)', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <RefreshCcw size={14} className="animate-spin" />
                                        <span>Procurando tabelas dentro de suas páginas...</span>
                                    </div>
                                )}
                                <button onClick={refreshDatabases} style={{ border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', marginTop: '8px' }}>
                                    <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Buscar mais tabelas
                                </button>
                            </div>
                        )}

                        {!loading && foundDbs.length === 0 && !error && (
                            <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '24px', marginBottom: '32px', textAlign: 'center' }}>
                                <AlertCircle size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Nenhuma tabela encontrada automaticamente.</p>
                                <button onClick={refreshDatabases} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '10px 20px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
                                    <RefreshCcw size={16} /> Tentar Novamente
                                </button>
                            </div>
                        )}

                        {/* Debug Panel for User */}
                        {(debugItems.length > 0 || workspaceInfo) && foundDbs.length === 0 && (
                            <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.03)', marginBottom: '32px', border: '1px dashed var(--border-color)' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', fontWeight: '800', opacity: 0.5 }}>DIAGNÓSTICO DA CONEXÃO:</h4>

                                {workspaceInfo && (
                                    <div style={{ marginBottom: '12px', padding: '10px', background: '#e8f5e9', borderRadius: '10px', fontSize: '0.8rem', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckCircle2 size={16} />
                                        <span>Conectado ao Workspace: <b>{workspaceInfo?.workspace_name || 'Privado'}</b></span>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {debugItems.length > 0 ? debugItems.map((item, idx) => (
                                        <div key={idx} style={{ fontSize: '0.65rem', padding: '4px 8px', background: 'white', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                            {item.object === 'page' ? '📄 ' : '📊 '}
                                            {item.object === 'page'
                                                ? (item.properties?.title?.title?.[0]?.plain_text || item.properties?.Name?.title?.[0]?.plain_text || item.properties?.title?.id || 'Página')
                                                : (item.title?.[0]?.plain_text || 'Database')}
                                        </div>
                                    )) : (
                                        <p style={{ fontSize: '0.75rem', color: '#d32f2f', margin: '4px 0' }}>O Notion não enviou nenhum item autorizado.</p>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.7rem', marginTop: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Se suas tabelas não aparecem acima, você precisa clicar em "Excluir" e reconectar, marcando o checkbox de cada tabela individualmente.
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '700', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Link size={14} /> ADICIONAR COM LINK (PÁGINA OU TABELA)
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Cole a URL da página do Notion aqui..."
                                    value={manualUrl}
                                    onChange={(e) => setManualUrl(e.target.value)}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: '16px',
                                        background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                                        color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none'
                                    }}
                                />
                                <button
                                    onClick={handleManualLink}
                                    disabled={loading}
                                    style={{ padding: '0 20px', borderRadius: '16px', background: 'var(--primary-color)', color: 'white', border: 'none', fontWeight: '700', opacity: loading ? 0.6 : 1 }}
                                >
                                    Vincular
                                </button>
                            </div>
                        </div>


                        {/* Tips */}
                        <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '20px', marginBottom: '32px', display: 'flex', gap: '12px' }}>
                            <HelpCircle size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
                            <p style={{ fontSize: '0.8rem', color: '#1e40af', margin: 0, lineHeight: 1.4 }}>
                                <b>Dica:</b> Se não encontrar nada, certifique-se de que clicou em <b>"Selecionar Páginas"</b> e marcou os checkboxes das suas tabelas durante a autorização.
                            </p>
                        </div>

                        <button
                            onClick={startSync}
                            disabled={(!expenseDbId && !incomeDbId) || loading}
                            style={{
                                width: '100%', padding: '20px', borderRadius: '20px',
                                background: 'var(--primary-color)', color: 'white',
                                fontWeight: '800', fontSize: '1.1rem', border: 'none',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
                                opacity: (!expenseDbId && !incomeDbId) ? 0.6 : 1
                            }}
                        >
                            {loading ? `${progress}% Sincronizando...` : 'Iniciar Importação Inicial'}
                        </button>
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
