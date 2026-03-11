import React, { useState, useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useAuth } from '../contexts/AuthContext';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR, enUS, es, fr } from 'date-fns/locale';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';
import { useI18n } from '../contexts/I18nContext';
import TransactionModal from '../components/TransactionModal';
import SwipeableItem from '../components/SwipeableItem';
import LoadingDots from '../components/LoadingDots';
import { Plus, ChevronLeft, ChevronRight, User, Pointer, X } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { getYearlyStats } from '../services/transactionService';
import { getEmojiForDescription } from '../utils/emojiUtils';

const Home = () => {
    const { currentUser } = useAuth();
    const { setIsAiActive } = useOutletContext();

    // Controle do Mês Atual no Dashboard
    const [currentDate, setCurrentDate] = useState(new Date());
    const monthPrefix = format(currentDate, 'yyyy-MM');

    const { transactions, loading, refetch, deleteTx } = useTransactions(monthPrefix);
    const { t, formatCurrency, locale } = useI18n();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('expense');
    const [editingTx, setEditingTx] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [isFlipped, setIsFlipped] = useState(false);
    const [isClosingFlipped, setIsClosingFlipped] = useState(false);
    const [yearlyStats, setYearlyStats] = useState([]);
    const [loadingYearly, setLoadingYearly] = useState(true);
    const [swipeDirection, setSwipeDirection] = useState(''); // 'left' or 'right'
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);

    useEffect(() => {
        if (isFlipped) {
            document.body.classList.add('hide-ai-btn');
        } else {
            document.body.classList.remove('hide-ai-btn');
        }
        return () => document.body.classList.remove('hide-ai-btn');
    }, [isFlipped]);

    const closeFlipped = () => {
        setIsClosingFlipped(true);
        setTimeout(() => {
            setIsFlipped(false);
            setIsClosingFlipped(false);
        }, 300);
    };

    // Fetch yearly stats for the back of the card
    React.useEffect(() => {
        if (currentUser) {
            const currentYear = currentDate.getFullYear();
            getYearlyStats(currentUser.uid, currentYear).then(data => {
                setYearlyStats(data);
                setLoadingYearly(false);
            });
        }
    }, [currentUser, currentDate]);

    // Hide AI button when stats are open
    React.useEffect(() => {
        if (isFlipped) {
            setIsAiActive(false);
        }
    }, [isFlipped, setIsAiActive]);

    // Navegação de meses
    // Navegação de meses
    const nextMonth = () => {
        setSwipeDirection('left');
        setCurrentDate(addMonths(currentDate, 1));
    };
    const prevMonth = () => {
        setSwipeDirection('right');
        setCurrentDate(subMonths(currentDate, 1));
    };

    // Swipe handlers
    const minSwipeDistance = 50;

    const [lastX, setLastX] = useState(0);

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setLastX(e.targetTouches[0].clientX);
        // Não ligamos isSwiping aqui para permitir cliques (tap)
    };

    const onTouchMove = (e) => {
        if (!touchStart) return;
        const currentX = e.targetTouches[0].clientX;
        const diff = currentX - touchStart;
        
        // Ativamos o modo swipe apenas se houver um deslocamento mínimo (ex: 10px)
        if (Math.abs(diff) > 10) {
            setIsSwiping(true);
            setSwipeOffset(diff);
            setTouchEnd(currentX);
        }
    };

    const onTouchEnd = () => {
        if (!isSwiping) {
            // Se não chegou a deslizar, apenas resetamos e deixamos o onClick fluir
            setTouchStart(null);
            setTouchEnd(null);
            setSwipeOffset(0);
            return;
        }

        setIsSwiping(false);
        if (!touchStart || !touchEnd) {
            setSwipeOffset(0);
            return;
        }
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            nextMonth();
        } else if (isRightSwipe) {
            prevMonth();
        }
        
        // Pequeno atraso para o reset não parecer brusco caso o mês não mude
        setTimeout(() => setSwipeOffset(0), 10);
        setTouchStart(null);
    };

    // Cálculos do Dashboard
    const incomes = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = incomes - expenses;

    // Filter Logic
    const filteredTransactions = transactions.filter(t => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'income') return t.type === 'income';
        if (activeFilter === 'expense') return t.type === 'expense';
        if (activeFilter === 'variable') return t.repeatType === 'none' || !t.repeatType;
        if (activeFilter === 'installment') return t.repeatType === 'installment';
        if (activeFilter === 'recurring') return t.repeatType === 'recurring';
        return true;
    });

    const handleOpenModal = (type) => {
        setEditingTx(null); // Ensure we are in "new" mode
        setModalType(type);
        setIsModalOpen(true);
    };

    const handleEditTx = (tx) => {
        setEditingTx(tx);
        setIsModalOpen(true);
    };

    const getCategoryTheme = (id, type) => {
        const defaultColor = '#9ca3af';
        const list = type === 'income' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
        const cat = list.find(c => c.id === id);
        return cat ? cat : { label: t('others', { defaultValue: 'Outros' }), color: defaultColor };
    };

    const dateLocales = { pt: ptBR, en: enUS, es: es, fr: fr };
    const monthLabel = format(currentDate, 'MMMM yyyy', { locale: dateLocales[locale] || enUS });
    // Capitaliza o mês
    const formattedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    const isNegative = balance < 0;
    const cardGradient = isNegative
        ? 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)'
        : 'var(--primary-gradient)';

    return (
        <>
            {/* Modal de Estatísticas em Tela Cheia */}
            {isFlipped && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'var(--bg-color)', zIndex: 10000,
                    padding: '24px', display: 'flex', flexDirection: 'column',
                    animation: isClosingFlipped ? 'slideDownModal 0.3s forwards cubic-bezier(0.4, 0, 0.2, 1)' : 'slideUpModal 0.4s cubic-bezier(0.1, 0.7, 0.1, 1)',
                }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.4rem' }}>{t('statistics')}</h2>
                        <button onClick={closeFlipped} style={{ fontSize: '1.5rem', color: 'var(--text-main)', padding: '8px' }}>
                            <X size={24} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
                        <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <h3 style={{ width: '100%', fontSize: '1rem', marginBottom: '24px', textAlign: 'left' }}>{t('expenses_by_category', { defaultValue: 'Despesas por Categoria' })}</h3>
                            {(() => {
                                const expensesByCategory = transactions
                                    .filter(t => t.type === 'expense')
                                    .reduce((acc, t) => {
                                        acc[t.category] = (acc[t.category] || 0) + t.amount;
                                        return acc;
                                    }, {});

                                const totalExpenses = Object.values(expensesByCategory).reduce((acc, val) => acc + val, 0);
                                const conicStops = [];
                                let cumPercent = 0;

                                if (totalExpenses > 0) {
                                    const sortedCats = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a);
                                    sortedCats.forEach(([catId, amount]) => {
                                        const category = CATEGORIAS_DESPESA.find(c => c.id === catId) || { color: '#999' };
                                        const pct = (amount / totalExpenses) * 100;
                                        conicStops.push(`${category.color} ${cumPercent}% ${cumPercent + pct}%`);
                                        cumPercent += pct;
                                    });
                                }

                                const pieBg = totalExpenses > 0 ? `conic-gradient(${conicStops.join(', ')})` : 'var(--glass-border)';

                                return (
                                    <>
                                        <div style={{ width: '180px', height: '180px', borderRadius: '50%', background: pieBg, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', transform: 'translateZ(0)', boxShadow: '0 0 0 1px var(--glass-border)' }}>
                                            <div style={{ width: '120px', height: '120px', background: 'var(--bg-color)', borderRadius: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('total')}</span>
                                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{formatCurrency(totalExpenses)}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '24px' }}>
                                            {Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a).map(([catId, amount]) => {
                                                const cat = CATEGORIAS_DESPESA.find(c => c.id === catId) || { label: catId, color: '#999' };
                                                return (
                                                    <div key={catId} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', background: 'var(--surface-color)', padding: '6px 12px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cat.color }}></div>
                                                        <span>{t(cat.label, { defaultValue: cat.label })}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                );
                            })()}
                        </section>

                        <section className="glass-panel" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '24px' }}>{t('monthly_balances_current_year', { defaultValue: 'Saldos Mensais' })}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '180px', gap: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', position: 'relative' }}>
                                
                                {/* Linha do Eixo 0 */}
                                <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(50% - 8px)', height: '1px', background: 'var(--glass-border)', zIndex: 0 }}></div>
                                
                                {yearlyStats.map((stat, i) => {
                                    const isNegative = stat.balance < 0;
                                    const maxVal = 5000; // Valor máximo para escala visual
                                    const heightPct = Math.max(2, Math.min(50, (Math.abs(stat.balance) / maxVal) * 50)); 
                                    
                                    return (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative', zIndex: 1 }}>
                                            
                                            {/* Container dividido ao meio (50% topo positivo, 50% bottom negativo) */}
                                            <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                
                                                {/* Metade Positiva */}
                                                <div style={{ height: '50%', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                                    {!isNegative && stat.balance > 0 && (
                                                        <div style={{
                                                            width: '100%',
                                                            height: `${heightPct * 2}%`,
                                                            background: 'var(--primary-dark)',
                                                            borderRadius: '4px 4px 0 0',
                                                            opacity: stat.month === (currentDate.getMonth() + 1) ? 1 : 0.4,
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            overflow: 'hidden'
                                                        }}>
                                                            <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.9)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                                                {Math.abs(stat.balance) >= 1000 ? `${(stat.balance/1000).toFixed(1)}k` : stat.balance}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Metade Negativa */}
                                                <div style={{ height: '50%', width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                                                     {isNegative && (
                                                        <div style={{
                                                            width: '100%',
                                                            height: `${heightPct * 2}%`,
                                                            background: 'var(--danger-color)',
                                                            borderRadius: '0 0 4px 4px',
                                                            opacity: stat.month === (currentDate.getMonth() + 1) ? 1 : 0.4,
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            overflow: 'hidden'
                                                        }}>
                                                            <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.9)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                                                {Math.abs(stat.balance) >= 1000 ? `${(Math.abs(stat.balance)/1000).toFixed(1)}k` : Math.abs(stat.balance)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Rótulo do Mês na Base */}
                                            <span style={{ fontSize: '0.7rem', marginTop: '6px', color: 'var(--text-muted)' }}>{stat.label.charAt(0)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>
            )}

            <div
                className={`page-container animate-fade-in`}
                style={{ paddingBottom: '120px', animation: 'slideUp 0.3s forwards' }}
            >
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
                    <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--highlight-color)' }}>
                            <User size={20} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: '700', paddingLeft: '4px' }}>{t('hello', { name: currentUser?.displayName?.split(' ')[0] || t('user', { defaultValue: 'Usuário' }) })}</h1>
                        </div>
                    </Link>
                </header>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '8px' }}>
                    <button onClick={prevMonth} style={{ padding: '8px' }}><ChevronLeft size={24} color="var(--text-main)" /></button>
                    <div
                        key={monthPrefix}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            animation: swipeDirection === 'left' ? 'slideLeftIn 0.3s ease-out' : 'slideRightIn 0.3s ease-out'
                        }}
                    >
                        <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1.2rem', textTransform: 'capitalize' }}>{formattedMonthLabel}</span>
                    </div>
                    <button onClick={nextMonth} style={{ padding: '8px' }}><ChevronRight size={24} color="var(--text-main)" /></button>
                </div>

                <section
                    key={monthPrefix}
                    className="glass-panel"
                    onClick={() => setIsFlipped(true)}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    style={{ 
                        flexShrink: 0, padding: '24px', background: cardGradient, color: 'white', border: 'none', 
                        position: 'relative', overflow: 'hidden', cursor: 'pointer',
                        touchAction: 'pan-y',
                        transform: `translateX(${swipeOffset}px)`,
                        transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.1, 0.7, 0.1, 1)',
                        animation: !isSwiping ? (swipeDirection === 'left' ? 'slideLeftIn 0.3s ease-out' : swipeDirection === 'right' ? 'slideRightIn 0.3s ease-out' : 'none') : 'none'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '8px' }}>{t('monthly_balance')}</p>
                            <h2 style={{ fontSize: 'clamp(1.8rem, 8vw, 2.5rem)', marginBottom: '24px', fontWeight: '700', letterSpacing: '-1px', wordBreak: 'break-word' }}>{formatCurrency(balance)}</h2>
                        </div>
                        <div style={{ position: 'relative', display: 'flex' }}>
                            <Pointer className="pointer-icon pulse-animation" size={18} opacity={0.8} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', opacity: 0.9 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></div>
                                <p style={{ fontSize: '0.8rem', margin: 0 }}>{t('incomes_plural', { defaultValue: 'Receitas' })}</p>
                            </div>
                            <p style={{ fontWeight: '600', fontSize: '1.1rem', margin: 0 }}>{formatCurrency(incomes)}</p>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171' }}></div>
                                <p style={{ fontSize: '0.8rem', margin: 0 }}>{t('expenses_plural', { defaultValue: 'Despesas' })}</p>
                            </div>
                            <p style={{ fontWeight: '600', fontSize: '1.1rem', margin: 0 }}>{formatCurrency(expenses)}</p>
                        </div>
                    </div>

                    {/* Barra de Porcentagem de Gastos */}
                    {incomes > 0 && (
                        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '6px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.min((expenses / incomes) * 100, 100)}%`,
                                    height: '100%',
                                    background: 'white',
                                    borderRadius: '10px',
                                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}></div>
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', opacity: 0.9, minWidth: '35px', textAlign: 'right' }}>
                                {Math.round((expenses / incomes) * 100)}%
                            </span>
                        </div>
                    )}
                </section>

                <section style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>{t('transactions')}</h3>
                    </div>

                    <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', marginBottom: '20px', padding: '4px 0', scrollbarWidth: 'none' }}>
                        {[
                            { id: 'all', label: 'filter_all' },
                            { id: 'income', label: 'filter_incomes' },
                            { id: 'expense', label: 'filter_expenses' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setActiveFilter(f.id)}
                                style={{
                                    whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600',
                                    background: activeFilter === f.id ? 'var(--primary-color)' : 'var(--surface-color)',
                                    color: activeFilter === f.id ? 'white' : 'var(--text-muted)',
                                    border: '1px solid var(--glass-border)', flexShrink: 0
                                }}
                            >
                                {t(f.label)}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                            <LoadingDots />
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
                            <p style={{ color: 'var(--text-muted)' }}>{t('no_transactions')}</p>
                        </div>
                    ) : (
                        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                            {filteredTransactions.map((tx, i) => (
                                <SwipeableItem key={tx.id} onDelete={() => deleteTx(tx.id)} onEdit={() => handleEditTx(tx)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i === transactions.length - 1 ? 'none' : '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: getCategoryTheme(tx.category, tx.type).color + '20', display: 'flex', justifyContent: 'center', alignItems: 'center', color: getCategoryTheme(tx.category, tx.type).color, fontWeight: 'bold', fontSize: '1.2rem' }}>
                                                {getEmojiForDescription(tx.description, getCategoryTheme(tx.category, tx.type).icon)}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <p style={{ fontWeight: '500', margin: 0 }}>{tx.dynamicDescription || tx.description}</p>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{tx.virtualDate.split('-').slice(1).reverse().join('/')}</p>
                                            </div>
                                        </div>
                                        <p style={{ fontWeight: '600', color: tx.type === 'income' ? 'var(--success-color)' : 'var(--danger-color)', margin: 0 }}>
                                            {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                        </p>
                                    </div>
                                </SwipeableItem>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <TransactionModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTx(null); }} defaultType={modalType} initialData={editingTx} onSuccess={refetch} />


            <style>{`
                @keyframes slideInUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes subtlePulse {
                    0%, 90% { transform: scale(1); opacity: 0.8; }
                    95% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.8; }
                }
                .pointer-icon.pulse-animation {
                    animation: subtlePulse 5s infinite ease-in-out;
                }
            `}</style>
        </>
    );
};

export default Home;
