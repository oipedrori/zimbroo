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
import { Plus, ChevronLeft, ChevronRight, User, Pointer, X, Trash2, PieChart, BarChart2, Shield, Mic, Keyboard, Moon, Globe, DollarSign, LogOut } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { getEmojiForDescription } from '../utils/emojiUtils';
import { prepareMonthlyTransactions } from '../services/transactionService';
import ConfirmDialog from '../components/ConfirmDialog';
import { haptic } from '../utils/haptic';

const Home = () => {
    const { currentUser } = useAuth();
    const { setIsAiActive } = useOutletContext();

    // Controle do Mês Atual no Dashboard
    const [currentDate, setCurrentDate] = useState(new Date());
    const monthPrefix = format(currentDate, 'yyyy-MM');

    const { transactions, allTransactions, loading, refetch, deleteTx } = useTransactions(monthPrefix);
    const { t, formatCurrency, locale } = useI18n();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Lock body scroll when any modal or sidebar is open
    useEffect(() => {
        if (isSidebarOpen || isModalOpen || isLimitModalOpen || isConfirmOpen) {
            document.body.style.overflow = 'hidden';
            // Also prevent touchmove for mobile
            document.body.style.touchAction = 'none';
        } else {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [isSidebarOpen, isModalOpen, isLimitModalOpen, isConfirmOpen]);
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
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({});
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState(null);

    // === Bento Desktop Logic ===
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const { logout } = useAuth();
    const { changeLocale, currency, changeCurrency } = useI18n();
    const [theme, setTheme] = useState(localStorage.getItem('zimbroo_theme') || 'system');

    const [limits, setLimits] = useState(() => {
        const saved = localStorage.getItem('zimbroo_limits');
        return saved ? JSON.parse(saved) : {};
    });

    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [tempLimit, setTempLimit] = useState({ categoryId: '', amount: '' });

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        localStorage.setItem('zimbroo_limits', JSON.stringify(limits));
    }, [limits]);

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

    // AI Limit Suggestion Fetcher
    const fetchLimitSuggestion = async (category) => {
        if (!category) return;
        setIsAiLoading(true);
        setAiSuggestion(null);
        
        try {
            const { suggestCategoryLimit } = await import('../services/geminiService');
            const result = await suggestCategoryLimit(category, allTransactions, locale);
            if (result && result.amount) {
                setAiSuggestion(result);
            }
        } catch (err) {
            console.error("Failed to fetch suggestion", err);
        } finally {
            setIsAiLoading(false);
        }
    };

    useEffect(() => {
        if (isLimitModalOpen && tempLimit.categoryId) {
            fetchLimitSuggestion(tempLimit.categoryId);
        }
    }, [tempLimit.categoryId, isLimitModalOpen]);

    // Theme Sync Effect (copied from Profile.jsx logic)
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('theme-dark');
            root.classList.remove('theme-light');
        } else if (theme === 'light') {
            root.classList.add('theme-light');
            root.classList.remove('theme-dark');
        } else {
            root.classList.remove('theme-dark', 'theme-light');
        }
        localStorage.setItem('zimbroo_theme', theme);
    }, [theme]);

    // Calculate yearly stats locally from allTransactions to avoid redundant fetches
    React.useEffect(() => {
        if (allTransactions.length > 0) {
            const currentYear = currentDate.getFullYear();
            const monthlyBalances = [];
            for (let m = 1; m <= 12; m++) {
                const monthPrefix = `${currentYear}-${String(m).padStart(2, '0')}`;
                const monthTxs = prepareMonthlyTransactions(allTransactions, monthPrefix);
                const inc = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
                const exp = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

                monthlyBalances.push({
                    month: m,
                    label: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1],
                    incomes: inc,
                    expenses: exp,
                    balance: inc - exp
                });
            }
            setYearlyStats(monthlyBalances);
            setLoadingYearly(false);
        }
    }, [allTransactions, currentDate]);

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
        // Categorias de despesas específicas devem filtrar pelo tipo expense também
        if (activeFilter === 'variable') return t.type === 'expense' && (t.repeatType === 'none' || !t.repeatType);
        if (activeFilter === 'installment') return t.type === 'expense' && t.repeatType === 'installment';
        if (activeFilter === 'recurring') return t.type === 'expense' && t.repeatType === 'recurring';
        return true;
    });

    const handleOpenModal = (type) => {
        setEditingTx(null); // Ensure we are in "new" mode
        setModalType(type);
        setIsModalOpen(true);
    };

    // Exclusão Centralizada
    const handleConfirmDelete = (tx) => {
        const isRecurring = tx.repeatType !== 'none';
        
        setConfirmConfig({
            title: isRecurring ? t('recurring_delete_title', { defaultValue: 'Movimentação Recorrente' }) : t('confirm_delete', { defaultValue: 'Excluir Movimentação' }),
            message: isRecurring ? t('recurring_delete_msg', { defaultValue: 'Deseja excluir apenas este mês ou toda a série?' }) : t('confirm_delete_msg', { defaultValue: 'Tem certeza que deseja excluir este registro?' }),
            options: isRecurring ? [
                { 
                    label: t('only_this_month', { defaultValue: 'Apenas este mês' }), 
                    value: 'skip',
                    color: 'var(--surface-color)',
                    textColor: 'var(--text-main)'
                },
                { 
                    label: t('all_series', { defaultValue: 'Toda a série' }), 
                    value: 'all',
                    color: 'var(--danger-color)'
                }
            ] : [],
            onConfirm: async (val) => {
                try {
                    const skipMonth = val === 'skip' ? monthPrefix : null;
                    await deleteTx(tx.id, skipMonth);
                    haptic.success();
                    refetch();
                } catch (e) {
                    console.error(e);
                    alert(t('error_deleting', { defaultValue: 'Erro ao excluir' }));
                } finally {
                    setIsConfirmOpen(false);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    const handleEditTx = (tx) => {
        setEditingTx(tx);
        setIsModalOpen(true);
    };

    // --- PIP CHART LOGIC (BENTO) ---
    const expensesByCategory = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
        }, {});

    const totalStatsExpenses = Object.values(expensesByCategory).reduce((acc, val) => acc + val, 0);
    const conicStops = [];
    let cumPercent = 0;

    if (totalStatsExpenses > 0) {
        const sortedCats = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a);
        sortedCats.forEach(([catId, amount]) => {
            const category = CATEGORIAS_DESPESA.find(c => c.id === catId) || { color: '#999' };
            const pct = (amount / totalStatsExpenses) * 100;
            conicStops.push(`${category.color} ${cumPercent}% ${cumPercent + pct}%`);
            cumPercent += pct;
        });
    }
    const pieChartBg = totalStatsExpenses > 0 ? `conic-gradient(${conicStops.join(', ')})` : 'var(--glass-border)';

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
                {/* Header (Now always visible but behaves differently on desktop) */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
                    <div 
                        onClick={() => isDesktop ? setIsSidebarOpen(true) : null}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', cursor: isDesktop ? 'pointer' : 'default' }}
                    >
                        {isDesktop ? (
                             <div className="hover-scale" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--highlight-color)' }}>
                                <User size={20} />
                             </div>
                        ) : (
                            <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--highlight-color)' }}>
                                    <User size={20} />
                                </div>
                            </Link>
                        )}
                        <div>
                            <h1 style={{ fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: '700', paddingLeft: '4px' }}>{t('hello', { name: currentUser?.displayName?.split(' ')[0] || t('user', { defaultValue: 'Usuário' }) })}</h1>
                        </div>
                    </div>
                </header>

                {!isDesktop && (
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
                )}

                {!isDesktop && (
                    <section
                        key={monthPrefix}
                        className="glass-panel"
                        onClick={() => !isDesktop && setIsFlipped(true)}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        style={{ 
                            flexShrink: 0, padding: '24px', background: cardGradient, color: 'white', border: 'none', 
                            position: 'relative', overflow: 'hidden', cursor: isDesktop ? 'default' : 'pointer',
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
                            <div style={{ position: 'relative', display: !isDesktop ? 'flex' : 'none' }}>
                                <Pointer className="pointer-icon" size={18} opacity={0.8} />
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
                )}

                {!isDesktop && (
                    <section style={{ marginTop: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>{t('transactions')}</h3>
                        </div>

                        <div className="filters-row" style={{ display: 'flex', overflowX: 'auto', gap: '10px', marginBottom: '20px', padding: '4px 0', scrollbarWidth: 'none' }}>
                            {[
                                { id: 'all', label: 'filter_all' },
                                { id: 'income', label: 'filter_incomes' },
                                { id: 'expense', label: 'filter_expenses' },
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
                                    <SwipeableItem key={tx.id} onDelete={() => handleConfirmDelete(tx)} onEdit={() => handleEditTx(tx)}>
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
                )}

                {/* --- Bento Grid Desktop Sections --- */}
                {isDesktop && (
                    <div className="desktop-dashboard-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '32px', position: 'relative' }}>
                        
                        <div className="desktop-bento-top" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', alignItems: 'start' }}>
                            
                            {/* Coluna Esquerda: Saldo + Movimentações */}
                            <div className="column-left" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <section
                                    key={`card-${monthPrefix}`}
                                    className="glass-panel"
                                    style={{ 
                                        padding: '32px', background: cardGradient, color: 'white', border: 'none', 
                                        position: 'relative', overflow: 'hidden', borderRadius: '24px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <p style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '8px' }}>{t('monthly_balance')}</p>
                                            <h2 style={{ fontSize: '3rem', marginBottom: '24px', fontWeight: '800', letterSpacing: '-1.5px' }}>{formatCurrency(balance)}</h2>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '32px', opacity: 0.9 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80' }}></div>
                                                <p style={{ fontSize: '0.9rem', margin: 0 }}>{t('incomes_plural', { defaultValue: 'Receitas' })}</p>
                                            </div>
                                            <p style={{ fontWeight: '700', fontSize: '1.3rem', margin: 0 }}>{formatCurrency(incomes)}</p>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f87171' }}></div>
                                                <p style={{ fontSize: '0.9rem', margin: 0 }}>{t('expenses_plural', { defaultValue: 'Despesas' })}</p>
                                            </div>
                                            <p style={{ fontWeight: '700', fontSize: '1.3rem', margin: 0 }}>{formatCurrency(expenses)}</p>
                                        </div>
                                    </div>

                                    {incomes > 0 && (
                                        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ flex: 1, height: '8px', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '10px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.min((expenses / incomes) * 100, 100)}%`,
                                                    height: '100%',
                                                    background: 'white',
                                                    borderRadius: '10px',
                                                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}></div>
                                            </div>
                                            <span style={{ fontSize: '1rem', fontWeight: '800', opacity: 0.9, minWidth: '45px', textAlign: 'right' }}>
                                                {Math.round((expenses / incomes) * 100)}%
                                            </span>
                                        </div>
                                    )}
                                </section>

                                <section className="transactions-section">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)' }}>{t('transactions')}</h3>
                                    </div>

                                    <div className="filters-row" style={{ display: 'flex', overflowX: 'auto', gap: '10px', marginBottom: '20px', padding: '4px 0', scrollbarWidth: 'none' }}>
                                        {[
                                            { id: 'all', label: 'filter_all' },
                                            { id: 'income', label: 'filter_incomes' },
                                            { id: 'variable', label: 'Despesas Móveis' },
                                            { id: 'recurring', label: 'Despesas Recorrentes' },
                                            { id: 'installment', label: 'Despesas Parceladas' }
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setActiveFilter(f.id)}
                                                style={{
                                                    whiteSpace: 'nowrap', padding: '10px 18px', borderRadius: '24px', fontSize: '0.9rem', fontWeight: '600',
                                                    background: activeFilter === f.id ? 'var(--primary-color)' : 'var(--surface-color)',
                                                    color: activeFilter === f.id ? 'white' : 'var(--text-muted)',
                                                    border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)'
                                                }}
                                            >
                                                {t(f.label, { defaultValue: f.label })}
                                            </button>
                                        ))}
                                    </div>

                                    {loading ? (
                                        <LoadingDots />
                                    ) : (
                                        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ maxHeight: '450px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                                                {filteredTransactions.map((tx, i) => (
                                                    <div key={tx.id} onClick={() => handleEditTx(tx)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: i === filteredTransactions.length - 1 ? 'none' : '1px solid var(--glass-border)', transition: 'background 0.2s' }} className="hover-brightness">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                            <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: getCategoryTheme(tx.category, tx.type).color + '20', display: 'flex', justifyContent: 'center', alignItems: 'center', color: getCategoryTheme(tx.category, tx.type).color, fontSize: '1.3rem' }}>
                                                                {getEmojiForDescription(tx.description, getCategoryTheme(tx.category, tx.type).icon)}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <p style={{ fontWeight: '600', margin: 0, color: 'var(--text-main)' }}>{tx.dynamicDescription || tx.description}</p>
                                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{tx.virtualDate.split('-').slice(1).reverse().join('/')}</p>
                                                            </div>
                                                        </div>
                                                        <p style={{ fontWeight: '700', color: tx.type === 'income' ? 'var(--success-color)' : 'var(--danger-color)', margin: 0, fontSize: '1.1rem' }}>
                                                            {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>

                            <div className="column-right" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <section className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <h3 style={{ width: '100%', fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '24px' }}>
                                        {t('expenses_by_category', { defaultValue: 'Gastos por Categoria' })}
                                    </h3>
                                    {totalStatsExpenses > 0 ? (
                                        <>
                                            <div style={{ position: 'relative', width: '220px', height: '220px', marginBottom: '32px', borderRadius: '50%', background: pieChartBg, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}>
                                                <div style={{ width: '150px', height: '150px', background: 'var(--bg-color)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('total')}</span>
                                                    <span style={{ fontSize: '1.3rem', fontWeight: '800' }}>{formatCurrency(totalStatsExpenses)}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', width: '100%' }}>
                                                {Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a).slice(0, 6).map(([catId, amount]) => {
                                                    const cat = CATEGORIAS_DESPESA.find(c => c.id === catId) || { label: catId, color: '#999', icon: '📌' };
                                                    const pct = Math.round((amount / totalStatsExpenses) * 100);
                                                    return (
                                                        <div key={catId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', background: 'var(--surface-color)', padding: '10px 14px', borderRadius: '16px', border: '1px solid var(--glass-border)', justifyContent: 'space-between' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color }}></div>
                                                                <span style={{ fontWeight: '500' }}>{cat.icon} {cat.label}</span>
                                                            </div>
                                                            <span style={{ fontWeight: '700', opacity: 0.8 }}>{pct}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    ) : (
                                        <p style={{ color: 'var(--text-muted)', margin: '60px 0' }}>Sem despesas no mês</p>
                                    )}
                                </section>

                                <section className="glass-panel" style={{ padding: '32px' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '32px' }}>Saldos Mensais</h3>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '220px', gap: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
                                        {yearlyStats.map((stat, i) => {
                                            const maxVal = Math.max(...yearlyStats.map(s => Math.abs(s.balance)), 5000);
                                            const h = Math.max(4, (Math.abs(stat.balance) / maxVal) * 100);
                                            const isCurrent = stat.month === (currentDate.getMonth() + 1);
                                            return (
                                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                                                    <div style={{ 
                                                        width: '100%', height: `${h}%`, 
                                                        background: stat.balance >= 0 ? 'var(--primary-color)' : 'var(--danger-color)',
                                                        borderRadius: '6px 6px 0 0',
                                                        opacity: isCurrent ? 1 : 0.4,
                                                        transition: 'height 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                        position: 'relative'
                                                    }}>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: isCurrent ? 'var(--primary-dark)' : 'var(--text-muted)', fontWeight: isCurrent ? '700' : '500' }}>{stat.label.charAt(0)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        </div>

                        <section className="glass-panel" style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)' }}>Limites de Gastos por Categoria</h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Gerencie seu teto de gastos mensal por área</p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                                <button
                                    onClick={() => {
                                        setTempLimit({ categoryId: CATEGORIAS_DESPESA[0].id, amount: '' });
                                        setIsLimitModalOpen(true);
                                    }}
                                    style={{ 
                                        background: 'var(--surface-color)', padding: '20px', borderRadius: '24px', 
                                        border: '2px dashed var(--primary-color)', color: 'var(--primary-color)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                                        gap: '12px', cursor: 'pointer', transition: 'transform 0.2s',
                                        minHeight: '160px'
                                    }}
                                    className="hover-scale"
                                >
                                    <Plus size={32} />
                                    <span style={{ fontWeight: '700' }}>Adicionar Limite</span>
                                </button>
                                {CATEGORIAS_DESPESA.filter(cat => limits[cat.id]).map((cat) => {
                                    const limitAmount = limits[cat.id];
                                    const spent = expensesByCategory[cat.id] || 0;
                                    const pct = Math.min((spent / limitAmount) * 100, 100);
                                    const isOverLimit = spent > limitAmount;

                                    return (
                                        <div key={cat.id} style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '24px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: cat.color + '20', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem' }}>
                                                        {cat.icon}
                                                    </div>
                                                    <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{t(cat.label, { defaultValue: cat.label })}</span>
                                                </div>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isOverLimit ? 'var(--danger-color)' : 'var(--text-muted)' }}>
                                                    {Math.round((spent / limitAmount) * 100)}%
                                                </span>
                                            </div>

                                            <div style={{ width: '100%', height: '10px', background: 'var(--bg-color)', borderRadius: '5px', overflow: 'hidden' }}>
                                                <div style={{ 
                                                    width: `${pct}%`, height: '100%', 
                                                    background: isOverLimit ? 'var(--danger-color)' : cat.color,
                                                    transition: 'width 1s ease-out'
                                                }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' }}>
                                                <span style={{ color: isOverLimit ? 'var(--danger-color)' : 'var(--text-main)' }}>{formatCurrency(spent)}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(limitAmount)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                )}
            </div>

            {/* --- Fixed Elements (Outside of transformed container) --- */}
            
            {/* Fixed Elements removed as they are now in Layout.jsx */}
            <TransactionModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTx(null); }} defaultType={modalType} initialData={editingTx} onSuccess={refetch} />

            <ConfirmDialog 
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                {...confirmConfig}
            />


            <style>{`
                @keyframes slideInUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .pointer-icon {
                    animation: subtlePulse 5s infinite ease-in-out;
                }
                @keyframes subtlePulse {
                    0%, 90% { transform: scale(1); opacity: 0.8; }
                    95% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.8; }
                }
            `}</style>
                {/* Sidebar Drawer para Desktop */}
                {isDesktop && isSidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <div 
                            onClick={() => setIsSidebarOpen(false)}
                            style={{ 
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                                background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                                zIndex: 11000, animation: 'fadeIn 0.3s forwards' 
                            }}
                        />
                        
                        {/* Drawer Content */}
                        <div style={{
                            position: 'fixed', top: 0, left: 0,
                            width: '360px', height: '100%', background: 'var(--bg-color)',
                            boxShadow: '10px 0 50px rgba(0,0,0,0.15)', zIndex: 11001,
                            animation: 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            padding: '32px', display: 'flex', flexDirection: 'column', overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)' }}>
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>{currentUser?.displayName || 'Perfil'}</h2>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{currentUser?.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsSidebarOpen(false)} style={{ padding: '8px', color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Notion Sync Button */}
                                <button 
                                    style={{ 
                                        background: '#000', color: 'white', padding: '16px 20px', borderRadius: '20px', 
                                        display: 'flex', alignItems: 'center', gap: '14px', border: 'none', cursor: 'pointer',
                                        fontSize: '0.95rem', fontWeight: '600', width: '100%'
                                    }}
                                >
                                    <img src="/notion_logo.png" style={{ width: '20px', height: '20px' }} alt="Notion" />
                                    Sincronizar com Notion
                                </button>

                                {/* Theme Section */}
                                <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', color: 'var(--primary-dark)' }}><Moon size={18} /></div>
                                        <span style={{ fontWeight: '600' }}>{t('theme')}</span>
                                    </div>
                                    <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: '12px', padding: '4px' }}>
                                        {['system', 'light', 'dark'].map(tOption => (
                                            <button 
                                                key={tOption}
                                                onClick={() => setTheme(tOption)}
                                                style={{ 
                                                    flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                                                    fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                                                    background: theme === tOption ? 'var(--primary-color)' : 'transparent',
                                                    color: theme === tOption ? 'white' : 'var(--text-muted)',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {tOption === 'system' ? 'Auto' : tOption === 'light' ? 'Claro' : 'Escuro'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Language/Currency Section */}
                                <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', color: 'var(--primary-dark)' }}><Globe size={18} /></div>
                                            <span style={{ fontWeight: '600' }}>{t('language')}</span>
                                        </div>
                                        <select 
                                            value={locale} 
                                            onChange={(e) => changeLocale(e.target.value)}
                                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                        >
                                            <option value="pt">Português</option>
                                            <option value="en">English</option>
                                            <option value="es">Español</option>
                                            <option value="fr">Français</option>
                                        </select>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                            <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', color: 'var(--primary-dark)' }}><DollarSign size={18} /></div>
                                            <span style={{ fontWeight: '600' }}>Moeda</span>
                                        </div>
                                        <select 
                                            value={currency} 
                                            onChange={(e) => changeCurrency(e.target.value)}
                                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                        >
                                            <option value="BRL">R$ Real</option>
                                            <option value="USD">$ Dollar</option>
                                            <option value="EUR">€ Euro</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Logout */}
                                <button 
                                    onClick={logout}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '14px', padding: '20px', 
                                        background: 'rgba(239, 68, 68, 0.05)', borderRadius: '24px', 
                                        border: '1px solid rgba(239, 68, 68, 0.1)', cursor: 'pointer',
                                        color: 'var(--danger-color)', fontWeight: '700', marginTop: '20px'
                                    }}
                                >
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '10px' }}><LogOut size={20} /></div>
                                    {t('logout')}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Modal Dinâmico de Limite */}
                {isLimitModalOpen && (
                    <>
                        <div 
                            onClick={() => setIsLimitModalOpen(false)}
                            style={{ 
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                                zIndex: 12000, animation: 'fadeIn 0.3s forwards' 
                            }}
                        />
                        <div style={{
                            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: 'min(90%, 400px)', backgroundColor: 'var(--bg-color)', borderRadius: '32px',
                            padding: '32px', zIndex: 12001, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '24px',
                            animation: 'modalOpen 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Novo Limite Mensal</h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Defina quanto você pretende gastar em uma categoria específica.</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '4px' }}>CATEGORIA</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                        {CATEGORIAS_DESPESA.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setTempLimit({ ...tempLimit, categoryId: cat.id })}
                                                title={t(cat.label)}
                                                style={{
                                                    padding: '12px 4px', borderRadius: '16px', border: '2px solid',
                                                    borderColor: tempLimit.categoryId === cat.id ? cat.color : 'transparent',
                                                    background: tempLimit.categoryId === cat.id ? cat.color + '20' : 'var(--surface-color)',
                                                    cursor: 'pointer', transition: 'all 0.2s',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                    position: 'relative', overflow: 'hidden', gap: '4px'
                                                }}
                                            >
                                                <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                                                <span style={{ fontSize: '0.55rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.9, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {t(cat.label, { defaultValue: cat.label }).split(' ')[0]}
                                                </span>
                                                {isAiLoading && tempLimit.categoryId === cat.id && (
                                                    <div className="sparkle-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.1)', animation: 'sparklePulse 1s infinite' }} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <p style={{ marginTop: '10px', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                        {t(CATEGORIAS_DESPESA.find(c => c.id === tempLimit.categoryId)?.label || '') || '---'}
                                    </p>
                                </div>

                                <div style={{ position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '4px' }}>VALOR LIMITE</label>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--text-muted)' }}>R$</div>
                                        <input 
                                            type="number"
                                            value={tempLimit.amount}
                                            onChange={(e) => setTempLimit({ ...tempLimit, amount: e.target.value })}
                                            placeholder="0,00"
                                            style={{
                                                width: '100%', padding: '16px 16px 16px 45px', borderRadius: '16px',
                                                background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                                                color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '700', outline: 'none',
                                                transition: 'all 0.3s'
                                            }}
                                            autoFocus
                                        />

                                        {/* AI Suggestion Bubble */}
                                        {aiSuggestion && !isAiLoading && (
                                            <div 
                                                onClick={() => setTempLimit({ ...tempLimit, amount: aiSuggestion.amount.toString() })}
                                                style={{
                                                    position: 'absolute', bottom: '110%', left: '0', right: '0',
                                                    background: 'var(--primary-color)', color: 'white', padding: '12px 16px',
                                                    borderRadius: '16px 16px 16px 4px', fontSize: '0.85rem', fontWeight: '600',
                                                    boxShadow: '0 10px 25px rgba(var(--primary-rgb), 0.3)', cursor: 'pointer',
                                                    animation: 'bubbleBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                                                    zIndex: 10
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <Mic size={14} />
                                                    <span>Sugestão IA: <strong>R$ {aiSuggestion.amount}</strong></span>
                                                </div>
                                                <p style={{ margin: 0, opacity: 0.9, fontSize: '0.75rem', fontWeight: '500' }}>{aiSuggestion.reason}</p>
                                                <div style={{ position: 'absolute', bottom: '-8px', left: '12px', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid var(--primary-color)' }} />
                                            </div>
                                        )}
                                        {isAiLoading && (
                                            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary-color)', animation: 'spin 1s linear infinite' }}>
                                                <div style={{ width: '20px', height: '20px', border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button 
                                    onClick={() => setIsLimitModalOpen(false)}
                                    style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--surface-color)', border: 'none', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={() => {
                                        if (tempLimit.categoryId && tempLimit.amount) {
                                            setLimits({ ...limits, [tempLimit.categoryId]: parseFloat(tempLimit.amount) });
                                            setIsLimitModalOpen(false);
                                            haptic.medium();
                                        }
                                    }}
                                    style={{ flex: 2, padding: '16px', borderRadius: '16px', background: 'var(--primary-color)', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 20px rgba(var(--primary-rgb), 0.3)' }}
                                >
                                    Salvar Limite
                                </button>
                            </div>
                        </div>

                        <style>{`
                            @keyframes modalOpen {
                                0% { opacity: 0; transform: translate(-50%, -40%) scale(0.95); }
                                100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                            }
                            @keyframes bubbleBounce {
                                0% { transform: translateY(10px) scale(0.8); opacity: 0; }
                                100% { transform: translateY(0) scale(1); opacity: 1; }
                            }
                            @keyframes sparklePulse {
                                0% { transform: scale(0.8); opacity: 0.3; }
                                50% { transform: scale(1.2); opacity: 0.6; }
                                100% { transform: scale(0.8); opacity: 0.3; }
                            }
                        `}</style>
                    </>
                )}
        </>
    );
};

export default Home;
