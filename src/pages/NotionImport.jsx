import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Database, Search, ArrowRight, CheckCircle2, AlertCircle, Key, FileText, Loader2 } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { getNotionDatabaseInfo, fetchNotionTransactions } from '../services/notionService';
import { addTransaction } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';

const NotionImport = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const [step, setStep] = useState(1); // 1: Info, 2: Secret, 3: DB ID, 4: Sinc, 5: Success
    const [notionSecret, setNotionSecret] = useState('');
    const [notionDbId, setNotionDbId] = useState('');
    const [dbMetadata, setDbMetadata] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);

    const checkToken = async () => {
        setLoading(true);
        setError(null);
        try {
            // Notion API is proxied via /notion-api/
            // Test connection by fetching db info
            if (!notionSecret.startsWith('secret_')) {
                throw new Error('O Token deve começar com secret_');
            }
            setStep(3);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmDb = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getNotionDatabaseInfo(notionSecret, notionDbId);
            setDbMetadata(data);
            setStep(4);
        } catch (err) {
            setError('Banco de Dados não encontrado ou não compartilhado.');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        setError(null);
        try {
            const txs = await fetchNotionTransactions(notionSecret, notionDbId);
            if (txs.length === 0) {
                throw new Error('Nenhuma transação encontrada nesta base.');
            }

            // Sync with Firebase
            for (let i = 0; i < txs.length; i++) {
                const tx = txs[i];
                await addTransaction(currentUser.uid, tx);
                setProgress(Math.round(((i + 1) / txs.length) * 100));
            }

            setStep(5);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container animate-fade-in" style={{ paddingBottom: '40px', position: 'relative', overflow: 'hidden', minHeight: '100dvh' }}>
            <div className="notion-aura"></div>

            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', marginBottom: '32px', position: 'relative', zIndex: 2 }}>
                <button onClick={() => navigate(-1)} style={{ padding: '8px', marginLeft: '-8px' }}>
                    <ChevronLeft size={24} color="var(--text-main)" />
                </button>
                <h1 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '600' }}>Integração Notion</h1>
                <div style={{ width: '40px' }}></div>
            </header>

            <div style={{ position: 'relative', zIndex: 2, maxWidth: '500px', margin: '0 auto' }}>
                {error && (
                    <div className="animate-fade-in" style={{
                        background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                        padding: '16px', borderRadius: '16px', marginBottom: '24px',
                        display: 'flex', gap: '12px', alignItems: 'center'
                    }}>
                        <AlertCircle size={20} />
                        <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{error}</span>
                    </div>
                )}

                {step === 1 && (
                    <div className="animate-fade-in">
                        <div style={{
                            width: '70px', height: '70px', background: '#000', borderRadius: '18px',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                        }}>
                            <Database size={32} color="white" />
                        </div>

                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)', lineHeight: 1.2 }}>
                            Traga seu Hub Financeiro do Notion
                        </h2>

                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px', fontSize: '1.05rem' }}>
                            Sincronize automaticamente seus gastos do Notion com a inteligência do Zimbro.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
                            {[
                                { title: 'Importação Direta', desc: 'Sincronização via API oficial do Notion.' },
                                { title: 'Seguro e Privado', desc: 'Seus tokens ficam salvos apenas localmente.' },
                                { title: 'Mapeamento Inteligente', desc: 'Nome, Valor, Data e Categoria automáticos.' }
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ marginTop: '4px' }}><CheckCircle2 size={18} color="var(--primary-color)" /></div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>{item.title}</h4>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            style={{
                                width: '100%', padding: '18px', borderRadius: '18px',
                                background: 'var(--primary-darker)', color: 'white',
                                fontWeight: '700', fontSize: '1rem', border: 'none',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'
                            }}
                        >
                            Começar Agora <ArrowRight size={20} />
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '12px', color: 'var(--text-main)' }}>
                            Token de Integração
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.95rem' }}>
                            Crie uma integração no <b>developers.notion.com</b> e cole o "Internal Integration Secret" abaixo.
                        </p>

                        <div style={{ position: 'relative', marginBottom: '32px' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <Key size={20} />
                            </div>
                            <input
                                type="password"
                                placeholder="secret_..."
                                value={notionSecret}
                                onChange={(e) => setNotionSecret(e.target.value)}
                                style={{
                                    width: '100%', padding: '18px 18px 18px 50px', borderRadius: '18px',
                                    background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                                    color: 'var(--text-main)', fontSize: '1rem', outline: 'none'
                                }}
                            />
                        </div>

                        <button
                            onClick={checkToken}
                            disabled={!notionSecret || loading}
                            style={{
                                width: '100%', padding: '18px', borderRadius: '18px',
                                background: 'var(--primary-color)', color: 'white',
                                fontWeight: '700', fontSize: '1rem', opacity: !notionSecret ? 0.6 : 1
                            }}
                        >
                            Confirmar Token
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '12px', color: 'var(--text-main)' }}>
                            ID do Banco de Dados
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.95rem' }}>
                            Abra sua base no navegador. O ID é a string alfanumérica entre o último / e o ?.
                        </p>

                        <div style={{ position: 'relative', marginBottom: '32px' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <FileText size={20} />
                            </div>
                            <input
                                type="text"
                                placeholder="32 caracteres de ID..."
                                value={notionDbId}
                                onChange={(e) => setNotionDbId(e.target.value)}
                                style={{
                                    width: '100%', padding: '18px 18px 18px 50px', borderRadius: '18px',
                                    background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                                    color: 'var(--text-main)', fontSize: '1rem', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '16px', borderRadius: '16px', display: 'flex', gap: '12px', marginBottom: '40px' }}>
                            <AlertCircle size={20} color="#ca8a04" style={{ flexShrink: 0 }} />
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#854d0e', lineHeight: 1.4 }}>
                                Lembre-se de clicar em <b>"..." (Menu) &rarr; Connections &rarr; Add Connection</b> e selecionar sua integração no Notion.
                            </p>
                        </div>

                        <button
                            onClick={confirmDb}
                            disabled={!notionDbId || loading}
                            style={{
                                width: '100%', padding: '18px', borderRadius: '18px',
                                background: loading ? 'var(--text-muted)' : 'var(--primary-color)',
                                color: 'white', fontWeight: '700', fontSize: '1rem', opacity: !notionDbId ? 0.6 : 1
                            }}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Verificar Banco de Dados'}
                        </button>
                    </div>
                )}

                {step === 4 && dbMetadata && (
                    <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '80px', height: '80px', background: 'var(--primary-light)', borderRadius: '50%',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 24px',
                            color: 'var(--primary-color)'
                        }}>
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '12px', color: 'var(--text-main)' }}>
                            {dbMetadata.title[0]?.plain_text || 'Base Encontrada!'}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>
                            Pronto para importar suas transações para o Zimbro.
                        </p>

                        {loading ? (
                            <div style={{ width: '100%', marginBottom: '40px' }}>
                                <div style={{ height: '8px', background: 'var(--glass-border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                                    <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary-color)', transition: 'width 0.3s' }}></div>
                                </div>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Sincronizando... {progress}%</span>
                            </div>
                        ) : (
                            <button
                                onClick={handleImport}
                                style={{
                                    width: '100%', padding: '18px', borderRadius: '18px',
                                    background: 'var(--primary-darker)', color: 'white',
                                    fontWeight: '700', fontSize: '1.2rem', border: 'none'
                                }}
                            >
                                Importar Tudo
                            </button>
                        )}
                    </div>
                )}

                {step === 5 && (
                    <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '80px', height: '80px', background: 'var(--primary-color)', borderRadius: '50%',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 24px',
                            color: 'white'
                        }}>
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)' }}>
                            Sucesso!
                        </h2>
                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '40px' }}>
                            Sua base do Notion foi sincronizada. Seu dashboard está atualizado com os novos dados.
                        </p>

                        <button
                            onClick={() => navigate('/')}
                            style={{
                                width: '100%', padding: '18px', borderRadius: '18px',
                                background: 'black', color: 'white',
                                fontWeight: '700', fontSize: '1.1rem', border: 'none'
                            }}
                        >
                            Ver Meus Gastos
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotionImport;
