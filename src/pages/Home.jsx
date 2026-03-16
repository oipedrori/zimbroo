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
import { Plus, ChevronLeft, ChevronRight, User, MousePointer2, X, Trash2, PieChart, BarChart2, Shield, Mic, Keyboard, Moon, Globe, DollarSign, LogOut } from 'lucide-react';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import { getEmojiForDescription } from '../utils/emojiUtils';
import { prepareMonthlyTransactions } from '../services/transactionService';
import ConfirmDialog from '../components/ConfirmDialog';
import { haptic } from '../utils/haptic';

const Home = () => {
    const { currentUser, logout, deleteAccount } = useAuth();
    const { setIsAiActive } = useOutletContext();
    const { t, formatCurrency, locale, changeLocale, currency, changeCurrency } = useI18n();
    const navigate = useNavigate();

    // --- State Declarations ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarClosing, setIsSidebarClosing] = useState(false);
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
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [theme, setTheme] = useState(localStorage.getItem('zimbroo_theme') || 'system');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [tempLimit, setTempLimit] = useState({ categoryId: '', amount: '' });
    const [limits, setLimits] = useState(() => {
        const saved = localStorage.getItem('zimbroo_limits');
        return saved ? JSON.parse(saved) : {};
    });
    const [chartType, setChartType] = useState('bar'); // 'bar' or 'line'

    // --- Derived Variables ---
    const monthPrefix = format(currentDate, 'yyyy-MM');
    const { transactions, allTransactions, loading, refetch, deleteTx } = useTransactions(monthPrefix);

    // Lock body scroll when any modal or sidebar is open
    useEffect(() => {
        if (isSidebarOpen || isModalOpen || isLimitModalOpen || isConfirmOpen) {
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.height = '100dvh';
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100dvh';
            document.body.style.touchAction = 'none';
            document.body.classList.add('modal-open');
        } else {
            document.documentElement.style.overflow = '';
            document.documentElement.style.height = '';
            document.body.style.overflow = '';
            document.body.style.height = '';
            document.body.style.touchAction = '';
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.documentElement.style.overflow = '';
            document.documentElement.style.height = '';
            document.body.style.overflow = '';
            document.body.style.height = '';
            document.body.style.touchAction = '';
            document.body.classList.remove('modal-open');
        };
    }, [isSidebarOpen, isModalOpen, isLimitModalOpen, isConfirmOpen]);

    // --- Effects & Handlers ---

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

    const closeSidebar = () => {
        setIsSidebarClosing(true);
        setTimeout(() => {
            setIsSidebarOpen(false);
            setIsSidebarClosing(false);
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
            console.error("Notion Exchange Error:", err);
            setError(err.message || "Erro ao conectar com o Notion. Tente novamente.");
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
                        <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{t('statistics')}</h2>
                        <button 
                            onClick={closeFlipped} 
                            style={{ 
                                width: '44px', 
                                height: '44px', 
                                borderRadius: '50%', 
                                background: 'var(--surface-color)', 
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-main)', 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
                        <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <h3 style={{ width: '100%', fontSize: '1.2rem', fontWeight: '700', marginBottom: '24px', textAlign: 'left' }}>{t('expenses_by_category', { defaultValue: 'Despesas por Categoria' })}</h3>
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
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '24px' }}>{t('monthly_balances_current_year', { defaultValue: 'Saldos Mensais' })}</h3>
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

            {!isFlipped && (
                <div
                    className={`page-container animate-fade-in`}
                    style={{ paddingBottom: isDesktop ? '120px' : '180px', animation: 'slideUp 0.3s forwards' }}
                >
                {/* Header (Now always visible but behaves differently on desktop) */}
                <header style={{ 
                    display: 'flex', 
                    flexDirection: isDesktop ? 'row' : 'column',
                    justifyContent: 'space-between', 
                    alignItems: isDesktop ? 'center' : 'flex-start', 
                    paddingTop: '10px', 
                    marginBottom: isDesktop ? '24px' : '8px',
                    gap: isDesktop ? '0' : '8px'
                }}>
                    <div 
                        onClick={() => setIsSidebarOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    >
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)' }}>
                            <User size={22} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                             <h1 style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: '700', margin: 0 }}>
                                {(() => {
                                    const hour = new Date().getHours();
                                    const greetingKey = (hour >= 3 && hour < 12) ? 'good_morning' : 
                                                       (hour >= 12 && hour < 18) ? 'good_afternoon' : 'good_night';
                                    return t(greetingKey, { name: currentUser?.displayName?.split(' ')[0] || t('user', { defaultValue: 'Usuário' }) });
                                })()}
                             </h1>
                        </div>
                    </div>

                    {/* Desktop/Mobile Month Navigation */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        background: 'transparent', 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        border: 'none',
                        alignSelf: isDesktop ? 'auto' : 'stretch',
                        justifyContent: isDesktop ? 'flex-start' : 'space-between'
                    }}>
                        <button onClick={() => { haptic.light(); setCurrentDate(subMonths(currentDate, 1)); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                            <ChevronLeft size={20} />
                        </button>
                        <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem', textTransform: 'capitalize', minWidth: '110px', textAlign: 'center' }}>
                            {format(currentDate, 'MMMM yyyy', { locale: { pt: ptBR, en: enUS, es: es, fr: fr }[locale] || ptBR })}
                        </span>
                        <button onClick={() => { haptic.light(); setCurrentDate(addMonths(currentDate, 1)); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </header>

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
                                <MousePointer2 className="pointer-icon" size={18} opacity={0.8} />
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
                                        <div 
                                            style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center', 
                                                padding: '12px 16px', 
                                                borderBottom: i === filteredTransactions.length - 1 ? 'none' : '1px solid var(--glass-border)'
                                            }}
                                        >
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
                    <div className="desktop-dashboard-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '16px', position: 'relative' }}>
                        
                        <div className="desktop-bento-top" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
                            
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

                                <section className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>{t('transactions')}</h3>
                                    </div>

                                    <div className="filters-row" style={{ display: 'flex', overflowX: 'auto', gap: '10px', marginBottom: '24px', padding: '4px 0', scrollbarWidth: 'none' }}>
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
                                                    background: activeFilter === f.id ? 'var(--primary-color)' : 'var(--bg-color)',
                                                    color: activeFilter === f.id ? 'white' : 'var(--text-muted)',
                                                    border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {t(f.label, { defaultValue: f.label })}
                                            </button>
                                        ))}
                                    </div>

                                    {loading ? (
                                        <div style={{ padding: '40px 0' }}><LoadingDots /></div>
                                    ) : (
                                        <div style={{ maxHeight: '450px', overflowY: 'auto', scrollbarWidth: 'thin', margin: '0 -32px' }}>
                                            {filteredTransactions.map((tx, i) => (
                                                <div 
                                                    key={tx.id} 
                                                    onClick={() => handleEditTx(tx)} 
                                                    style={{ 
                                                        cursor: 'pointer', 
                                                        display: 'flex', 
                                                        justifyContent: 'space-between', 
                                                        alignItems: 'center', 
                                                        padding: '16px 32px', 
                                                        borderBottom: i === filteredTransactions.length - 1 ? 'none' : '1px solid var(--glass-border)', 
                                                        transition: 'background 0.2s', 
                                                        marginBottom: i === filteredTransactions.length - 1 ? (isDesktop ? '24px' : '80px') : '0'
                                                    }} 
                                                    className="hover-brightness"
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                        <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: getCategoryTheme(tx.category, tx.type).color + '20', display: 'flex', justifyContent: 'center', alignItems: 'center', color: getCategoryTheme(tx.category, tx.type).color, fontSize: '1.3rem' }}>
                                                            {getEmojiForDescription(tx.description, getCategoryTheme(tx.category, tx.type).icon)}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <p style={{ fontWeight: '600', margin: 0, color: 'var(--text-main)' }}>{tx.dynamicDescription || tx.description}</p>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{tx.virtualDate.split('-').slice(1).reverse().join('/')}</p>
                                                                {tx.repeatType && (
                                                                    <span style={{ 
                                                                        fontSize: '0.65rem', 
                                                                        padding: '1px 6px', 
                                                                        borderRadius: '6px', 
                                                                        background: tx.repeatType === 'recurring' ? 'rgba(67, 56, 202, 0.1)' : tx.repeatType === 'installment' ? 'rgba(180, 83, 9, 0.1)' : 'rgba(75, 85, 99, 0.1)',
                                                                        color: tx.repeatType === 'recurring' ? '#4338CA' : tx.repeatType === 'installment' ? '#B45309' : '#4B5563',
                                                                        fontWeight: '700',
                                                                        textTransform: 'uppercase'
                                                                    }}>
                                                                        {tx.repeatType === 'recurring' ? t('tag_recurring') : tx.repeatType === 'installment' ? t('tag_installment') : t('tag_variable')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p style={{ fontWeight: '700', color: tx.type === 'income' ? 'var(--success-color)' : 'var(--danger-color)', margin: 0, fontSize: '1.1rem' }}>
                                                        {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                                    </p>
                                                </div>
                                            ))}
                                            {filteredTransactions.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                                    Nenhuma transação encontrada
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </section>
                            </div>

                            <div className="column-right" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <section className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <h3 style={{ width: '100%', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '24px' }}>
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
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '12px', width: '100%', marginTop: 'auto' }}>
                                        {Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a).slice(0, 4).map(([catId, amount]) => {
                                            const cat = CATEGORIAS_DESPESA.find(c => c.id === catId) || { label: catId, color: '#999', icon: '📌' };
                                            const pct = Math.round((amount / totalStatsExpenses) * 100);
                                            return (
                                                <div key={catId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', background: 'var(--surface-color)', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--glass-border)', justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: cat.color + '15', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                                                        </div>
                                                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{t(cat.label, { defaultValue: cat.label })}</span>
                                                    </div>
                                                    <span style={{ fontWeight: '800', color: cat.color }}>{formatCurrency(amount)} ({pct}%)</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {Object.keys(expensesByCategory).length > 4 && (
                                        <button onClick={() => navigate('/statistics')} style={{ marginTop: '16px', background: 'transparent', border: 'none', color: 'var(--primary-color)', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                                            {t('view_all')}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <p style={{ color: 'var(--text-muted)', margin: '60px 0' }}>Sem despesas no mês</p>
                            )}
                        </section>

                        <section className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Limites Ativos</h3>
                                <button
                                    onClick={() => {
                                        setTempLimit({ categoryId: CATEGORIAS_DESPESA[0].id, amount: '' });
                                        setIsLimitModalOpen(true);
                                    }}
                                    style={{ 
                                        padding: '8px 14px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white',
                                        fontSize: '0.85rem', fontWeight: '700', border: 'none', cursor: 'pointer'
                                    }}
                                >
                                    Novo Limite
                                </button>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxHeight: '350px', overflowY: 'auto' }}>
                                {CATEGORIAS_DESPESA.filter(cat => limits[cat.id]).length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px', border: '1px solid var(--glass-border)', borderRadius: '24px', background: 'var(--surface-color)' }}>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0' }}>Nenhum limite configurado</p>
                                    </div>
                                ) : (
                                    CATEGORIAS_DESPESA.filter(cat => limits[cat.id]).slice(0, 3).map((cat) => {
                                        const limitAmount = limits[cat.id];
                                        const spent = expensesByCategory[cat.id] || 0;
                                        const pct = Math.min((spent / limitAmount) * 100, 100);
                                        const isOverLimit = spent > limitAmount;

                                        return (
                                            <div key={cat.id} style={{ background: 'var(--surface-color)', padding: '16px', borderRadius: '20px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>{cat.icon} {t(cat.label)}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>{formatCurrency(limitAmount)}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: isOverLimit ? 'var(--danger-color)' : 'var(--text-muted)' }}>
                                                        {Math.round((spent / limitAmount) * 100)}%
                                                    </span>
                                                </div>
                                                <div style={{ width: '100%', height: '6px', background: 'var(--bg-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: isOverLimit ? 'var(--danger-color)' : cat.color, transition: 'width 1s ease-out' }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Saldos Mensais Row (Full Width Bottom) */}
                <section className="glass-panel" style={{ padding: '32px', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Evolução de Saldos Mensais</h3>
                        
                        <div style={{ display: 'flex', background: 'var(--bg-color)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            <button 
                                onClick={() => { haptic.light(); setChartType('bar'); }}
                                style={{ 
                                    padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', border: 'none',
                                    background: chartType === 'bar' ? 'var(--primary-color)' : 'transparent',
                                    color: chartType === 'bar' ? 'white' : 'var(--text-muted)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Barras
                            </button>
                            <button 
                                onClick={() => { haptic.light(); setChartType('line'); }}
                                style={{ 
                                    padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', border: 'none',
                                    background: chartType === 'line' ? 'var(--primary-color)' : 'transparent',
                                    color: chartType === 'line' ? 'white' : 'var(--text-muted)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Linha
                            </button>
                        </div>
                    </div>

                    <div style={{ position: 'relative', height: '240px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', paddingBottom: '32px' }}>
                        {chartType === 'bar' ? (
                            yearlyStats.map((stat, i) => {
                                const maxVal = Math.max(...yearlyStats.map(s => Math.abs(s.balance)), 5000);
                                const h = Math.max(4, (Math.abs(stat.balance) / maxVal) * 100);
                                const isCurrent = stat.month === (currentDate.getMonth() + 1);
                                return (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                                        <span style={{ 
                                            position: 'absolute', bottom: `${h + 2}%`, fontSize: '0.7rem', fontWeight: '700', 
                                            color: stat.balance >= 0 ? 'var(--primary-dark)' : 'var(--danger-color)',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {formatCurrency(stat.balance).split(',')[0]}
                                        </span>
                                        <div style={{ 
                                            width: '100%', height: `${h}%`, 
                                            background: stat.balance >= 0 ? 'var(--primary-color)' : 'var(--danger-color)',
                                            borderRadius: '8px 8px 0 0',
                                            opacity: isCurrent ? 1 : 0.4,
                                            boxShadow: isCurrent ? '0 0 20px rgba(var(--primary-rgb), 0.2)' : 'none',
                                            transition: 'height 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        }} />
                                        <span style={{ fontSize: '0.8rem', color: isCurrent ? 'var(--primary-dark)' : 'var(--text-muted)', fontWeight: isCurrent ? '700' : '500' }}>
                                            {format(new Date(2024, stat.month - 1, 1), 'MMM', { locale: { pt: ptBR, en: enUS, es: es, fr: fr }[locale] || ptBR }).substring(0, 3).toUpperCase()}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                <svg width="100%" height="100%" viewBox="0 0 1000 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                                    <path 
                                        d={`M ${yearlyStats.map((stat, i) => {
                                            const maxVal = Math.max(...yearlyStats.map(s => Math.abs(s.balance)), 5000);
                                            const x = (i / (yearlyStats.length - 1)) * 1000;
                                            const y = 80 - (stat.balance / maxVal) * 60;
                                            return `${x},${y}`;
                                        }).join(' L ')}`}
                                        fill="none" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ transition: 'all 0.5s ease', opacity: 0.8 }}
                                    />
                                    {yearlyStats.map((stat, i) => {
                                        const maxVal = Math.max(...yearlyStats.map(s => Math.abs(s.balance)), 5000);
                                        const x = (i / (yearlyStats.length - 1)) * 1000;
                                        const y = 80 - (stat.balance / maxVal) * 60;
                                        const isCurrent = stat.month === (currentDate.getMonth() + 1);
                                        return (
                                            <g key={i}>
                                                <text 
                                                    x={x} y={y - 10} textAnchor="middle" 
                                                    style={{ fontSize: '10px', fontWeight: '700', fill: stat.balance >= 0 ? 'var(--primary-dark)' : 'var(--danger-color)' }}
                                                >
                                                    {formatCurrency(stat.balance).split(',')[0]}
                                                </text>
                                                <circle 
                                                    cx={x} cy={y} r={isCurrent ? 4 : 2.5} 
                                                    fill={isCurrent ? 'var(--primary-color)' : 'var(--bg-color)'} 
                                                    stroke="var(--primary-color)" strokeWidth="1.5"
                                                    style={{ transition: 'all 0.3s' }}
                                                />
                                            </g>
                                        );
                                    })}
                                </svg>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0 0' }}>
                                    {yearlyStats.map((stat, i) => (
                                        <span key={i} style={{ fontSize: '0.75rem', color: stat.month === (currentDate.getMonth() + 1) ? 'var(--primary-dark)' : 'var(--text-muted)', fontWeight: '600', width: '35px', textAlign: 'center' }}>
                                            {format(new Date(2024, stat.month - 1, 1), 'MMM', { locale: { pt: ptBR, en: enUS, es: es, fr: fr }[locale] || ptBR }).substring(0, 3).toUpperCase()}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
                </div>
            )}

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
                @keyframes slideOutLeft {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(-100%); opacity: 0; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes slideOutDown {
                    from { transform: translateY(0); }
                    to { transform: translateY(100%); }
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
                {/* Sidebar Drawer */}
                {isSidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <div 
                            onClick={closeSidebar}
                            style={{ 
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                                background: 'rgba(27, 69, 32, 0.4)', backdropFilter: 'blur(8px)',
                                zIndex: 11000, 
                                transition: 'all 0.3s ease',
                                animation: isSidebarClosing ? 'fadeOut 0.3s forwards' : 'fadeIn 0.3s forwards' 
                            }}
                        />
                        
                        {/* Drawer Content */}
                        <div style={{
                            position: 'fixed', 
                            top: isDesktop ? 0 : 'auto', 
                            bottom: 0, 
                            left: 0,
                            right: isDesktop ? 'auto' : 0,
                            width: isDesktop ? '360px' : '100%', 
                            height: isDesktop ? '100%' : 'auto', 
                            maxHeight: isDesktop ? 'none' : '90dvh',
                            background: 'var(--bg-color)',
                            boxShadow: '0 -10px 50px rgba(0,0,0,0.15)', 
                            zIndex: 11001,
                            borderRadius: isDesktop ? '0' : '32px 32px 0 0',
                            animation: isDesktop 
                                ? (isSidebarClosing ? 'slideOutLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards')
                                : (isSidebarClosing ? 'slideOutDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'),
                            padding: isDesktop ? '32px' : '32px 24px 120px 24px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            overflowY: 'auto',
                            overscrollBehavior: 'contain',
                            borderTop: isDesktop ? 'none' : '1px solid var(--glass-border)'
                        }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                 {/* User info now links to Profile */}
                                 <Link 
                                     to="/profile" 
                                     onClick={closeSidebar}
                                     style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none', color: 'inherit' }}
                                 >
                                     <div style={{ width: '50px', height: '50px', border: '1px solid var(--glass-border)', borderRadius: '16px', background: 'var(--surface-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)' }}>
                                         <User size={24} />
                                     </div>
                                     <div>
                                         <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>{currentUser?.displayName || 'Perfil'}</h2>
                                         <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{currentUser?.email}</p>
                                     </div>
                                 </Link>
                                 <button 
                                    onClick={closeSidebar} 
                                    style={{ 
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '50%',
                                        background: 'var(--surface-color)',
                                        border: '1px solid var(--glass-border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        flexShrink: 0
                                    }}
                                >
                                    <X size={24} />
                                </button>
                         </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Notion Sync Button */}
                                <button 
                                    onClick={() => { closeSidebar(); navigate('/notion-import'); }}
                                    style={{ 
                                        background: '#000', color: 'white', padding: '16px 20px', borderRadius: '20px', 
                                        display: 'flex', alignItems: 'center', gap: '14px', border: 'none', cursor: 'pointer',
                                        fontSize: '0.95rem', fontWeight: '600', width: '100%'
                                    }}
                                >
                                    <img src="/notion_logo.png" style={{ width: '20px', height: '20px' }} alt="Notion" />
                                    Integração Notion
                                </button>

                                {/* Theme Section */}
                                <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '24px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ width: '36px', height: '36px', flexShrink: 0, background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Moon size={18} /></div>
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
                                            <div style={{ width: '36px', height: '36px', flexShrink: 0, background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={18} /></div>
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
                                            <div style={{ width: '36px', height: '36px', flexShrink: 0, background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={18} /></div>
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

                                {/* Logout & Delete Account Area */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto', paddingTop: '40px', paddingBottom: '40px' }}>
                                    <button 
                                        onClick={logout}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', 
                                            background: 'rgba(239, 68, 68, 0.05)', borderRadius: '20px', 
                                            border: '1px solid rgba(239, 68, 68, 0.1)', cursor: 'pointer',
                                            color: 'var(--danger-color)', fontWeight: '700'
                                        }}
                                    >
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '10px' }}><LogOut size={20} /></div>
                                        {t('logout')}
                                    </button>

                                    <button 
                                        onClick={() => setShowDeleteConfirm(true)}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', 
                                            background: 'transparent', borderRadius: '20px', 
                                            border: '1px solid var(--glass-border)', cursor: 'pointer',
                                            color: 'var(--danger-color)', fontWeight: '600', fontSize: '0.9rem'
                                        }}
                                    >
                                        <div style={{ padding: '8px', borderRadius: '10px' }}><Trash2 size={20} /></div>
                                        Excluir Conta
                                    </button>

                                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', opacity: 0.6 }}>v1.8.4</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', opacity: 0.8 }}>Feito no Brasil 🇧🇷</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Delete Account Confirmation Overlay */}
                <ConfirmDialog
                    isOpen={showDeleteConfirm}
                    onClose={() => setShowDeleteConfirm(false)}
                    title="Tem certeza?"
                    requireConfirm="DELETE"
                    message="Esta ação excluirá todos os seus dados permanentemente e não pode ser desfeita. Para confirmar, digite DELETE no campo abaixo."
                    confirmLabel={isDeleting ? "Excluindo..." : "Sim, excluir minha conta"}
                    type="danger"
                    onConfirm={async () => {
                        setIsDeleting(true);
                        try {
                            await deleteAccount();
                        } catch (e) {
                            alert(e.message);
                        } finally {
                            setIsDeleting(false);
                            setShowDeleteConfirm(false);
                        }
                    }}
                />

                {/* Modal Dinâmico de Limite */}
                {isLimitModalOpen && (
                    <>
                        <div 
                            onClick={() => setIsLimitModalOpen(false)}
                            style={{ 
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                                background: 'rgba(27, 69, 32, 0.4)', backdropFilter: 'blur(8px)',
                                zIndex: 12000, transition: 'all 0.3s ease' 
                            }}
                        />
                        <div style={{
                            position: 'fixed', 
                            bottom: isDesktop ? 'auto' : 0, 
                            top: isDesktop ? '50%' : 'auto',
                            left: isDesktop ? '50%' : 0,
                            right: isDesktop ? 'auto' : 0,
                            transform: isDesktop ? 'translate(-50%, -50%)' : 'translateY(0)',
                            width: isDesktop ? 'min(90%, 550px)' : '100%', 
                            backgroundColor: 'var(--bg-color)', 
                            borderRadius: isDesktop ? '32px' : '32px 32px 0 0',
                            padding: isDesktop ? '32px' : '32px 24px 48px', 
                            zIndex: 12001, 
                            boxShadow: isDesktop ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '0 -10px 40px rgba(0,0,0,0.2)',
                            border: '1px solid var(--glass-border)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '24px',
                            animation: isDesktop ? 'modalOpen 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                        }}>
                            {!isDesktop && (
                                <div style={{ 
                                    position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
                                    width: '40px', height: '4px', background: 'var(--glass-border)', borderRadius: '2px'
                                }} />
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Novo Limite Mensal</h2>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Defina quanto você pretende gastar em uma categoria específica.</p>
                                </div>
                                <button 
                                    onClick={() => setIsLimitModalOpen(false)}
                                    style={{ 
                                        width: '44px', height: '44px', borderRadius: '50%', 
                                        background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                                        color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '4px' }}>CATEGORIA</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
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
                            @keyframes slideUp {
                                from { transform: translateY(100%); }
                                to { transform: translateY(0); }
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
            </div>
        )}
    </>
);
};

export default Home;
