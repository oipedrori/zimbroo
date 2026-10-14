import React, { useState, useEffect, useMemo } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useAuth } from '../contexts/AuthContext';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR, enUS, es, fr } from 'date-fns/locale';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, getCategoryInfo } from '../utils/categories';
import { useI18n } from '../contexts/I18nContext';
import TransactionModal from '../components/TransactionModal';
import SwipeableItem from '../components/SwipeableItem';
import LoadingDots from '../components/LoadingDots';
import ProfileContent from '../components/ProfileContent';
import NotionImportContent from '../components/NotionImportContent';
import { Plus, ChevronLeft, ChevronRight, User, Users, Pointer, X, Trash2, PieChart, BarChart2, Shield, Mic, Keyboard, Moon, Globe, DollarSign, LogOut, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import TransactionCard from '../components/TransactionCard';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmojiForDescription } from '../utils/emojiUtils';
import { prepareMonthlyTransactions } from '../services/transactionService';
import ConfirmDialog from '../components/ConfirmDialog';
import { haptic } from '../utils/haptic';
import BudgetPieChart from '../components/BudgetPieChart';
import LimitsSection from '../components/LimitsSection';
import { useLimits } from '../hooks/useLimits';
import Onboarding from '../components/Onboarding';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import { usePrototype } from '../contexts/PrototypeContext';
import { usePrototypeFinancial } from '../contexts/PrototypeFinancialContext';
import PrototypeContextSelector from '../components/PrototypeContextSelector';

const Home = () => {
    const { currentUser, logout, deleteAccount } = useAuth();
    const { isPrototype } = usePrototype();
    const { financialContext, activeFamilySpace, triggerBlockedAction, onboardingModel } = usePrototypeFinancial();
    const [familyTxNotice, setFamilyTxNotice] = useState(null);
    const { setIsAiActive, setIsBottomNavHidden } = useOutletContext();
    const { t, formatCurrency, locale, changeLocale, currency, changeCurrency } = useI18n();
    const navigate = useNavigate();
    const isAnimatingMonth = React.useRef(false);


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            setPendingNotionCode(code);
            setSidebarView('notion');
            setIsSidebarOpen(true);
            // Clean URL immediately
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // --- State Declarations ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarClosing, setIsSidebarClosing] = useState(false);
    const [sidebarView, setSidebarView] = useState('settings'); // 'settings' or 'notion'
    const [pendingNotionCode, setPendingNotionCode] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('expense');
    const [editingTx, setEditingTx] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [showFilterTotal, setShowFilterTotal] = useState(null); // { id, amount }
    const [yearlyStats, setYearlyStats] = useState([]);
    const [loadingYearly, setLoadingYearly] = useState(true);
    const [swipeDirection, setSwipeDirection] = useState(''); // 'left' or 'right'
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({});
    const [theme, setTheme] = useState(localStorage.getItem('zimbroo_theme') || 'system');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [isLimitActionOpen, setIsLimitActionOpen] = useState(false);
    const [isLimitModalClosing, setIsLimitModalClosing] = useState(false);
    const [isClosingFlipped, setIsClosingFlipped] = useState(false);

    const closeFlipped = () => {
        setIsClosingFlipped(true);
        setTimeout(() => {
            setIsFlipped(false);
            setIsClosingFlipped(false);
        }, 300);
    };

    const closeLimitModal = () => {
        setIsLimitModalClosing(true);
        setTimeout(() => {
            setIsLimitModalOpen(false);
            setIsLimitModalClosing(false);
        }, 300);
    };

    const [selectedLimitCat, setSelectedLimitCat] = useState(null);
    const [tempLimit, setTempLimit] = useState({ categoryId: '', amount: '' });
    const currentYear = currentDate.getFullYear();
    const { limits, setLimits } = useLimits(currentYear);
    const [chartType, setChartType] = useState('bar'); // 'bar' or 'line'
    const [isFlipped, setIsFlipped] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Freemium
    const { isPremium, loading: subLoading } = useSubscription();
    const [showPaywall, setShowPaywall] = useState(false);
    const [showValues, setShowValues] = useState(localStorage.getItem('zimbroo_default_show_values') !== 'false');

    useEffect(() => {
        const hasCompleted = localStorage.getItem('hasCompletedOnboarding');
        if (hasCompleted !== 'true') {
            if (isPrototype) {
                localStorage.setItem('hasCompletedOnboarding', 'true');
            } else {
                setShowOnboarding(true);
            }
        }
    }, [isPrototype]);

    useEffect(() => {
        if (setIsBottomNavHidden) {
            setIsBottomNavHidden(isFlipped);
        }
    }, [isFlipped, setIsBottomNavHidden]);

    // --- Derived Variables ---
    const monthPrefix = format(currentDate, 'yyyy-MM');
    const { transactions, allTransactions, loading, refetch, deleteTx } = useTransactions(monthPrefix);

    // Lock body scroll and blur background when any modal or sidebar is open
    useEffect(() => {
        if (isSidebarOpen || isModalOpen || isLimitModalOpen || isConfirmOpen || isLimitActionOpen) {
            document.body.classList.add('no-scroll');
        } else {
            document.body.classList.remove('no-scroll');
        }

        if (isSidebarOpen) {
            document.body.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
        }

        return () => {
            document.body.classList.remove('modal-open');
            document.body.classList.remove('sidebar-open');
        };
    }, [isSidebarOpen, isModalOpen, isLimitModalOpen, isConfirmOpen, isLimitActionOpen]);

    // Auto-hide filter total bubble after 10s
    useEffect(() => {
        if (showFilterTotal) {
            const timer = setTimeout(() => {
                setShowFilterTotal(null);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [showFilterTotal]);

    // Hide Bottom Nav globally via layout context when any modal is open
    useEffect(() => {
        if (setIsBottomNavHidden) {
            setIsBottomNavHidden(isModalOpen || isLimitModalOpen || isLimitActionOpen || isConfirmOpen || isSidebarOpen);
        }
    }, [isModalOpen, isLimitModalOpen, isLimitActionOpen, isConfirmOpen, isSidebarOpen, setIsBottomNavHidden]);

    // --- Effects & Handlers ---


    const currentActualYear = new Date().getFullYear();

    const handleYearChange = (newYear) => {
        if (!isPremium && newYear < currentActualYear) {
            setShowPaywall(true);
            return;
        }
        haptic.medium();
        if (newYear !== currentYear) {
            setLoadingYearly(true);
            setCurrentYear(newYear);
        }
    };

    const handleNextYear = () => {
        handleYearChange(currentYear + 1);
    };

    const handlePrevYear = () => {
        handleYearChange(currentYear - 1);
    };

    const closeSidebar = () => {
        setIsSidebarClosing(true);
        setTimeout(() => {
            setIsSidebarOpen(false);
            setIsSidebarClosing(false);
        }, 300);
    };

    const handleReturnToToday = () => {
        if (isAnimatingMonth.current) return;

        const today = new Date();
        const targetMonthValue = today.getFullYear() * 12 + today.getMonth();

        const step = () => {
            setCurrentDate(prev => {
                const currentMonthValue = prev.getFullYear() * 12 + prev.getMonth();
                const todayMonthValue = targetMonthValue;

                if (currentMonthValue === todayMonthValue) {
                    isAnimatingMonth.current = false;
                    return prev;
                }

                isAnimatingMonth.current = true;
                haptic.light();

                const nextDate = currentMonthValue < todayMonthValue
                    ? addMonths(prev, 1)
                    : subMonths(prev, 1);

                setTimeout(step, 40); // 40ms for a "fast-scroll" feel
                return nextDate;
            });
        };

        step();
    };

    // AI Limit Suggestion removed as per user request

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

    // Excluir lógica duplicada ou redundante aqui se necessário

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

    // Desembolso Imediato vs Cartão / Parcelas (Etapa 7 & 8)
    const immediateExpenses = transactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
        .reduce((acc, t) => acc + t.amount, 0);

    const cashBalance = incomes - immediateExpenses;

    const futureCommitments = useMemo(() => {
        if (!isPrototype) return 0;
        const [curY, curM] = monthPrefix.split('-').map(Number);
        const curDateVal = curY * 12 + curM;

        let totalPending = 0;
        for (const tx of allTransactions) {
            if (tx.type === 'expense' && tx.repeatType === 'installment' && tx.installments > 1) {
                const [y, m] = (tx.date || '').split('-').map(Number);
                const txDateVal = y * 12 + m;
                const endVal = txDateVal + tx.installments - 1;
                if (endVal > curDateVal) {
                    const startPending = Math.max(curDateVal + 1, txDateVal);
                    const remainingInstallments = (endVal - startPending) + 1;
                    totalPending += remainingInstallments * tx.amount;
                }
            }
        }
        return totalPending;
    }, [allTransactions, isPrototype, monthPrefix]);

    const handleFilterClick = (filterId) => {
        haptic.light();
        if (activeFilter === filterId && filterId !== 'all') {
            // Se clicar no já ativo, calcula o total
            const total = filteredTransactions.reduce((acc, t) => acc + t.amount, 0);
            setShowFilterTotal({ id: filterId, amount: total });
        } else {
            setActiveFilter(filterId);
            setShowFilterTotal(null); // Reset bubble when changing filter
        }
    };

    // Filter Logic
    const filteredTransactions = transactions.filter(t => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'income') return t.type === 'income';
        // O filtro "Despesas" (ID: expense) agora mostra apenas as despesas móveis (não recorrentes/parceladas)
        if (activeFilter === 'expense' || activeFilter === 'variable') return t.type === 'expense' && (t.repeatType === 'none' || !t.repeatType);
        if (activeFilter === 'installment') return t.type === 'expense' && t.repeatType === 'installment';
        if (activeFilter === 'recurring') return t.repeatType === 'recurring';
        return true;
    });

    const handleOpenModal = (type) => {
        if (isPrototype && financialContext === 'family' && !activeFamilySpace) {
            haptic.light();
            triggerBlockedAction({
                title: 'Espaço Familiar Não Configurado',
                message: 'Você ainda não possui um espaço familiar ativo para registrar movimentações familiares. Configure um espaço familiar no perfil ou selecione o contexto Individual.',
                allowSwitch: true
            });
            return;
        }
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
        .filter(t => t.type === 'expense' && t.category !== 'pagamento_fatura' && t.paymentMethod !== 'bill_payment')
        .reduce((acc, t) => {
            const catId = getCategoryInfo(t.category, 'expense').id;
            acc[catId] = (acc[catId] || 0) + t.amount;
            return acc;
        }, {});

    const totalStatsExpenses = Object.values(expensesByCategory).reduce((acc, val) => acc + val, 0);
    const conicStops = [];
    let cumPercent = 0;

    if (totalStatsExpenses > 0) {
        const sortedCats = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a);
        sortedCats.forEach(([catId, amount]) => {
            const category = getCategoryInfo(catId, 'expense');
            const pct = (amount / totalStatsExpenses) * 100;
            conicStops.push(`${category.color} ${cumPercent}% ${cumPercent + pct}%`);
            cumPercent += pct;
        });
    }
    // const pieChartBg = totalStatsExpenses > 0 ? `conic-gradient(${conicStops.join(', ')})` : 'var(--glass-border)';

    const getCategoryTheme = (id, type) => {
        return getCategoryInfo(id, type);
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

            {isFlipped ? (
                <div className="page-container" style={{ paddingBottom: '120px', animation: isClosingFlipped ? 'slideDownModal 0.3s forwards' : 'slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>{t('statistics', { defaultValue: 'Estatísticas' })}</h2>
                        <button
                            onClick={() => { haptic.light(); closeFlipped(); }}
                            style={{
                                width: '40px', height: '40px', borderRadius: 'var(--btn-radius)', background: 'var(--surface-color)',
                                border: '1px solid var(--glass-border)', color: 'var(--text-main)',
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Pie Chart Section - First */}
                        <section className="glass-panel" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <PieChart size={18} color="var(--primary-color)" />
                                {t('expenses_by_category', { defaultValue: 'Gastos por Categoria' })}
                            </h3>
                            <BudgetPieChart transactions={transactions} currentDate={currentDate} />
                        </section>

                        {/* Bar Chart Section - Second */}
                        <section className="glass-panel" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <BarChart2 size={18} color="var(--primary-color)" />
                                {t('monthly_balance_chart', { defaultValue: 'Balanço Mensal' })}
                            </h3>
                            <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                                {yearlyStats.map((s, i) => {
                                    const maxVal = Math.max(...yearlyStats.map(x => Math.max(x.incomes, x.expenses, 1)), 1);
                                    const isCurrentMonth = s.month === currentDate.getMonth() + 1;
                                    return (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '16px', height: '140px', display: 'flex', alignItems: 'flex-end', gap: '2px', position: 'relative' }}>
                                                <div style={{ width: '8px', height: `${Math.max(2, (s.incomes / maxVal) * 100)}%`, background: 'var(--success-color)', borderRadius: '2px 2px 0 0', opacity: isCurrentMonth ? 1 : 0.4 }}></div>
                                                <div style={{ width: '8px', height: `${Math.max(2, (s.expenses / maxVal) * 100)}%`, background: 'var(--danger-color)', borderRadius: '2px 2px 0 0', opacity: isCurrentMonth ? 1 : 0.4 }}></div>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', fontWeight: isCurrentMonth ? '800' : '500', color: isCurrentMonth ? 'var(--primary-color)' : 'var(--text-muted)' }}>{s.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>
            ) : (
                <div
                    className={`page-container animate-fade-in`}
                    style={{ paddingBottom: '180px', animation: 'slideUp 0.3s forwards' }}
                >
                    {/* Header */}
                    <header style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        paddingTop: '8px',
                        gap: '10px'
                    }}>
                        <div
                            id="onboarding-profile-btn"
                            onClick={() => setIsSidebarOpen(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        >
                            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)' }}>
                                {isPrototype && financialContext === 'family' ? <Users size={22} /> : <User size={22} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h1 style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: '700', margin: 0 }}>
                                    {(() => {
                                        if (isPrototype && financialContext === 'family') {
                                            return activeFamilySpace?.name || 'Família';
                                        }
                                        const hour = new Date().getHours();
                                        const greetingKey = (hour >= 3 && hour < 12) ? 'good_morning' :
                                             (hour >= 12 && hour < 18) ? 'good_afternoon' : 'good_night';
                                        const displayName = isPrototype 
                                            ? t('evaluator', { defaultValue: 'Avaliador' }) 
                                            : (currentUser?.displayName?.split(' ')[0] || t('user', { defaultValue: 'Usuário' }));
                                        return t(greetingKey, { name: displayName });
                                    })()}
                                </h1>
                            </div>
                        </div>

                        {/* 2. Seletor Individual / Familiar (exclusivo do protótipo e apenas se o modelo for 'both') */}
                        {isPrototype && (onboardingModel || 'both') === 'both' && (
                            <div style={{ width: '100%' }}>
                                <PrototypeContextSelector />
                            </div>
                        )}

                        {/* Month Navigation */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'transparent',
                            padding: '6px 12px',
                            borderRadius: 'var(--btn-radius)',
                            border: 'none',
                            alignSelf: 'stretch',
                            justifyContent: 'space-between'
                        }}>
                            <button onClick={() => { haptic.light(); setCurrentDate(subMonths(currentDate, 1)); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                <ChevronLeft size={20} />
                            </button>
                            <span
                                onClick={handleReturnToToday}
                                style={{
                                    fontWeight: '700',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    textTransform: 'capitalize',
                                    minWidth: '110px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}
                            >
                                {format(currentDate, 'MMMM yyyy', { locale: { pt: ptBR, en: enUS, es: es, fr: fr }[locale] || ptBR })}
                            </span>
                            <button onClick={() => { haptic.light(); setCurrentDate(addMonths(currentDate, 1)); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </header>

                    <section
                        id="onboarding-balance-card"
                            key={monthPrefix}
                            className="glass-panel"
                            onClick={() => { haptic.medium(); setIsFlipped(true); }}
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                            style={{
                                flexShrink: 0, padding: '24px', background: cardGradient, color: 'var(--btn-text)', border: 'none',
                                position: 'relative', overflow: 'hidden',
                                touchAction: 'pan-y',
                                cursor: 'pointer',
                                transform: `translateX(${swipeOffset}px)`,
                                transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.1, 0.7, 0.1, 1)',
                                animation: !isSwiping ? (swipeDirection === 'left' ? 'slideLeftIn 0.3s ease-out' : swipeDirection === 'right' ? 'slideRightIn 0.3s ease-out' : 'none') : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '8px' }}>{t('monthly_balance')}</p>
                                    <div style={{ height: '2.5rem', display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                                        <AnimatePresence mode="wait">
                                            <motion.h2
                                                key={showValues ? 'visible' : 'hidden'}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                style={{ fontSize: 'clamp(1.8rem, 8vw, 2.5rem)', margin: 0, fontWeight: '700', letterSpacing: '-1px', wordBreak: 'break-word' }}
                                            >
                                                {showValues ? formatCurrency(balance) : '•••••'}
                                            </motion.h2>
                                        </AnimatePresence>
                                    </div>
                                </div>
                                <div
                                    id="onboarding-stats-btn"
                                    style={{ display: 'flex', gap: '8px' }}>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); haptic.light(); setShowValues(!showValues); }}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            padding: '8px',
                                            borderRadius: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}>
                                        {showValues ? <Eye size={20} /> : <EyeOff size={20} />}
                                    </div>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); haptic.medium(); setIsFlipped(true); }}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            padding: '8px',
                                            borderRadius: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}>
                                        <BarChart2 size={20} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '24px', opacity: 0.9 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        <ArrowUp size={16} color="#4ade80" />
                                        <p style={{ fontSize: '0.8rem', margin: 0 }}>{t('incomes_plural', { defaultValue: 'Receitas' })}</p>
                                    </div>
                                    <AnimatePresence mode="wait">
                                        <motion.p
                                            key={showValues ? 'visible' : 'hidden'}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            style={{ fontWeight: '600', fontSize: '1.1rem', margin: 0 }}
                                        >
                                            {showValues ? formatCurrency(incomes) : '•••••'}
                                        </motion.p>
                                    </AnimatePresence>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        <ArrowDown size={16} color="#f87171" />
                                        <p style={{ fontSize: '0.8rem', margin: 0 }}>{t('expenses_plural', { defaultValue: 'Despesas' })}</p>
                                    </div>
                                    <AnimatePresence mode="wait">
                                        <motion.p
                                            key={showValues ? 'visible' : 'hidden'}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            style={{ fontWeight: '600', fontSize: '1.1rem', margin: 0 }}
                                        >
                                            {showValues ? formatCurrency(expenses) : '•••••'}
                                        </motion.p>
                                    </AnimatePresence>
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

                        {/* Indicadores de Saldo em Caixa e Compromissos Futuros (Etapa 8) */}
                        {isPrototype && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                                marginTop: '12px'
                            }}>
                                <div className="glass-panel" style={{ padding: '12px 14px', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                                        Saldo em Caixa
                                    </span>
                                    <span style={{ fontSize: '1.05rem', fontWeight: '700', color: cashBalance < 0 ? 'var(--danger-color)' : 'var(--text-main)' }}>
                                        {showValues ? formatCurrency(cashBalance) : '•••••'}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                                        À vista, débito e PIX
                                    </span>
                                </div>
                                <div className="glass-panel" style={{ padding: '12px 14px', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                                        Compromissos Futuros
                                    </span>
                                    <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f59e0b' }}>
                                        {showValues ? formatCurrency(futureCommitments) : '•••••'}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                                        Parcelas a vencer
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Seção de Limites */}
                        <div id="onboarding-limits-section">
                            {isPrototype && financialContext === 'family' && !activeFamilySpace ? (
                                <div>
                                    <h3 style={{ 
                                        fontSize: '1.2rem', 
                                        fontWeight: '600', 
                                        marginBottom: '16px',
                                        marginTop: '24px',
                                        color: 'var(--text-main)',
                                        padding: '0'
                                    }}>
                                        Limites
                                    </h3>
                                    <div style={{
                                        padding: '20px 16px',
                                        borderRadius: '16px',
                                        background: 'var(--surface-color)',
                                        border: '1px dashed var(--glass-border)',
                                        textAlign: 'center'
                                    }}>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Nenhum espaço familiar configurado. Para gerenciar limites familiares, configure um espaço familiar ou selecione o contexto <strong>Individual</strong>.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <LimitsSection
                                    title="Limites"
                                    limits={limits}
                                    transactions={transactions}
                                    formatCurrency={formatCurrency}
                                    t={t}
                                    setIsLimitModalOpen={(val, catId, amount) => {
                                        if (val && catId) {
                                            setTempLimit({ categoryId: catId, amount: amount ? amount.toString() : '' });
                                            setIsLimitModalOpen(true);
                                        } else {
                                            setTempLimit({ categoryId: '', amount: '' });
                                            setIsLimitModalOpen(val);
                                        }
                                    }}
                                    setTempLimit={setTempLimit}
                                />
                            )}
                        </div>

                        <section id="onboarding-transactions-list" style={{ marginTop: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', margin: 0 }}>{t('transactions')}</h3>
                            </div>

                            {/* Contêiner de Filtros com Fade */}
                            <div style={{ position: 'relative', width: 'calc(100% + 40px)', margin: '0 -20px 20px -20px' }}>
                                <style>{`
                                .filters-fade-container::after {
                                    content: '';
                                    position: absolute;
                                    top: 0;
                                    right: 0;
                                    width: 40px;
                                    height: 100%;
                                    background: linear-gradient(to right, transparent, var(--bg-color));
                                    pointer-events: none;
                                    z-index: 2;
                                }
                                .filters-fade-container::before {
                                    content: '';
                                    position: absolute;
                                    top: 0;
                                    left: 0;
                                    width: 40px;
                                    height: 100%;
                                    background: linear-gradient(to left, transparent, var(--bg-color));
                                    pointer-events: none;
                                    z-index: 2;
                                    opacity: 0; /* Começa invisível */
                                    transition: opacity 0.3s;
                                }
                            `}</style>
                                <div
                                    className="filters-fade-container"
                                    style={{
                                        display: 'flex',
                                        overflowX: 'auto',
                                        gap: '10px',
                                        padding: '45px 24px 4px 24px', // Aumentado o padding top para o balão não cortar
                                        marginTop: '-41px', // Compensa o padding extra para manter o layout
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        WebkitOverflowScrolling: 'touch'
                                    }}
                                    onScroll={(e) => {
                                        const container = e.currentTarget;
                                        const before = container.parentElement.querySelector('.filters-fade-container::before');
                                        // Hack simples para borda esquerda aparecer ao rolar
                                        if (container.scrollLeft > 10) {
                                            container.classList.add('scrolled');
                                        } else {
                                            container.classList.remove('scrolled');
                                        }
                                    }}
                                >
                                    <style>{`
                                    .filters-fade-container.scrolled::before { opacity: 1 !important; }
                                `}</style>
                                    {[
                                        { id: 'all', label: 'filter_all' },
                                        { id: 'income', label: 'filter_incomes' },
                                        { id: 'expense', label: 'filter_expenses' },
                                        { id: 'installment', label: 'filter_installment' },
                                        { id: 'recurring', label: 'filter_recurring' },
                                    ].map(f => (
                                        <div key={f.id} style={{ position: 'relative', flexShrink: 0 }}>
                                            <button
                                                onClick={() => handleFilterClick(f.id)}
                                                style={{
                                                    whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: 'var(--btn-radius)', fontSize: '0.85rem', fontWeight: '600',
                                                    background: activeFilter === f.id ? 'var(--primary-color)' : 'var(--surface-color)',
                                                    color: activeFilter === f.id ? 'white' : 'var(--text-muted)',
                                                    border: '1px solid var(--glass-border)',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                            >
                                                {t(f.label)}
                                            </button>

                                            <AnimatePresence>
                                                {showFilterTotal?.id === f.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -70, x: '-50%' }}
                                                        animate={{ opacity: 1, y: -70, x: '-50%' }}
                                                        exit={{ opacity: 0, y: -70, x: '-50%' }}
                                                        onClick={() => setShowFilterTotal(null)}
                                                        style={{
                                                            position: 'absolute', left: '50%',
                                                            background: 'var(--surface-color)',
                                                            color: 'var(--text-main)',
                                                            padding: '8px 14px', borderRadius: '12px', fontSize: '0.85rem',
                                                            fontWeight: '700', whiteSpace: 'nowrap', zIndex: 100,
                                                            boxShadow: '0 8px 16px rgba(0,0,0,0.3)', cursor: 'pointer',
                                                            pointerEvents: 'auto',
                                                            border: '1px solid var(--glass-border)',
                                                            backdropFilter: 'blur(10px)',
                                                            WebkitBackdropFilter: 'blur(10px)'
                                                        }}
                                                    >
                                                        Total: {formatCurrency(showFilterTotal.amount)}
                                                        <div style={{
                                                            position: 'absolute', bottom: '-4.5px', left: '50%',
                                                            transform: 'translateX(-50%) rotate(45deg)',
                                                            width: '8px', height: '8px',
                                                            background: 'var(--surface-color)',
                                                            borderRight: '1px solid var(--glass-border)',
                                                            borderBottom: '1px solid var(--glass-border)',
                                                            zIndex: -1
                                                        }} />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {loading ? (
                                <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                                    <LoadingDots />
                                </div>
                            ) : isPrototype && financialContext === 'family' && !activeFamilySpace ? (
                                <div className="glass-panel" style={{ padding: '36px 20px', textAlign: 'center' }}>
                                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
                                        <User size={26} />
                                    </div>
                                    <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
                                        Nenhum espaço familiar configurado
                                    </h4>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto', lineHeight: '1.5' }}>
                                        Para visualizar movimentações familiares, é necessário ter um espaço familiar ativo. A criação de espaços pela interface será disponibilizada na Etapa 5.
                                    </p>
                                </div>
                            ) : filteredTransactions.length === 0 ? (
                                <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
                                    <p style={{ color: 'var(--text-muted)' }}>{t('no_transactions')}</p>
                                </div>
                            ) : (
                                <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                                    {filteredTransactions.map((tx) => {
                                        const isFamilyTx = tx.scope === 'family';
                                        return isFamilyTx ? (
                                            <div 
                                                key={tx.id} 
                                                onClick={() => {
                                                    haptic.light();
                                                    setFamilyTxNotice(tx);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                                title="Transação familiar (somente leitura nesta etapa)"
                                            >
                                                <TransactionCard transaction={tx} />
                                            </div>
                                        ) : (
                                            <SwipeableItem key={tx.id} onDelete={() => handleConfirmDelete(tx)} onEdit={() => handleEditTx(tx)}>
                                                <TransactionCard transaction={tx} />
                                            </SwipeableItem>
                                        );
                                    })}
                                </div>
                            )}
                        </section>


                    {/* --- Fixed Elements (Outside of transformed container) --- */}

                    {/* Fixed Elements removed as they are now in Layout.jsx */}
                    <TransactionModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTx(null); }} defaultType={modalType} initialData={editingTx} onSuccess={refetch} />

                    <ConfirmDialog
                        isOpen={isConfirmOpen}
                        onClose={() => setIsConfirmOpen(false)}
                        {...confirmConfig}
                    />

                    {/* Modal explicativo de Transação Familiar (somente leitura) */}
                    <ConfirmDialog
                        isOpen={Boolean(familyTxNotice)}
                        onClose={() => setFamilyTxNotice(null)}
                        title="Transação Familiar"
                        message={`Esta movimentação pertence ao espaço familiar "${activeFamilySpace?.name || 'Familiar'}"${familyTxNotice?.memberName ? ` (membro: ${familyTxNotice.memberName})` : ''}. As operações de edição e exclusão de movimentações familiares serão implementadas na Etapa 5.`}
                        showIcon={true}
                        showCancel={false}
                        confirmLabel="Entendi"
                        onConfirm={() => setFamilyTxNotice(null)}
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
                .form-input {
                    border: 1px solid var(--glass-border) !important;
                    transition: all 0.2s ease-in-out !important;
                }
                .form-input:focus {
                    border-color: var(--primary-color) !important;
                    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1) !important;
                    background: var(--surface-color) !important;
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
                    {/* Unified Sidebar / Bottom Sheet */}
                    {isSidebarOpen && createPortal(
                        <>
                            {/* Backdrop */}
                            <div
                                onClick={closeSidebar}
                                style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(5, 10, 6, 0.55)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    zIndex: 11000,
                                    transition: 'all 0.3s ease',
                                    animation: isSidebarClosing ? 'fadeOut 0.3s forwards' : 'fadeIn 0.3s forwards'
                                }}
                            />

                            {/* Sheet/Drawer Content */}
                            <div style={{
                                position: 'fixed',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                margin: '0 auto',
                                maxWidth: '480px',
                                width: '100%',
                                height: (sidebarView === 'notion' ? '100%' : 'auto'),
                                maxHeight: (sidebarView === 'notion') ? 'none' : '90dvh',
                                background: 'var(--bg-color)',
                                boxShadow: '0 -10px 50px rgba(0,0,0,0.15)',
                                zIndex: 11001,
                                borderRadius: (sidebarView === 'notion') ? '0' : '32px 32px 0 0',
                                animation: isSidebarClosing ? 'slideOutDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                                padding: (sidebarView === 'notion' ? '24px 24px 40px' : '32px 24px 120px 24px'),
                                display: 'flex',
                                flexDirection: 'column',
                                overflowY: 'auto',
                                overscrollBehavior: 'contain',
                                borderTop: '1px solid var(--glass-border)'
                            }}>
                                {/* Bottom Sheet Handle */}
                                <div style={{
                                    width: '40px', height: '4px', background: 'var(--glass-border)',
                                    borderRadius: '2px', margin: '-16px auto 24px auto', opacity: 0.6
                                }} />

                                {sidebarView === 'settings' ? (
                                    <ProfileContent
                                        onOpenNotion={() => setSidebarView('notion')}
                                        onClose={closeSidebar}
                                        theme={theme}
                                        setTheme={setTheme}
                                    />
                                ) : (
                                    <NotionImportContent
                                        onBack={() => setSidebarView('settings')}
                                        onFinish={() => {
                                            setSidebarView('settings');
                                            closeSidebar();
                                        }}
                                        // Pass the captured code from state instead of reading directly from URL
                                        initialOAuthCode={pendingNotionCode}
                                    />
                                )}
                            </div>
                        </>,
                        document.body
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

                    {/* Menu de Ações do Limite */}
                    <ConfirmDialog
                        isOpen={isLimitActionOpen}
                        onClose={() => setIsLimitActionOpen(false)}
                        title={getCategoryInfo(selectedLimitCat, 'expense')?.label || 'Gerenciar Limite'}
                        message="O que você deseja fazer com este limite?"
                        showIcon={false}
                        showCancel={false}
                        childrenPosition="top"
                        layout="row"
                        wide={true}
                        options={[
                            { label: t('edit', { defaultValue: 'Editar' }), value: 'edit', color: 'var(--primary-gradient)' },
                            { label: t('delete', { defaultValue: 'Excluir' }), value: 'delete', color: 'transparent', border: '1px solid var(--danger-color)', textColor: 'var(--danger-color)' }
                        ]}
                        onConfirm={(val) => {
                            if (val === 'edit') {
                                setTempLimit({ categoryId: selectedLimitCat, amount: limits[selectedLimitCat].toString() });
                                setIsLimitModalOpen(true);
                            } else if (val === 'delete' || val === 'transparent') { // Represents Delete when outlined
                                const newLimits = { ...limits };
                                delete newLimits[selectedLimitCat];
                                setLimits(newLimits);
                                haptic.medium();
                            }
                            setIsLimitActionOpen(false);
                        }}
                    >
                        <div style={{
                            maxHeight: '350px',
                            overflowY: 'auto',
                            paddingRight: '4px'
                        }}>
                            {(() => {
                                const catTxs = transactions.filter(t => {
                                    const info = getCategoryInfo(t.category, t.type);
                                    return info.id === selectedLimitCat;
                                });

                                if (catTxs.length > 0) {
                                    return catTxs.map((tx, idx) => {
                                        const theme = getCategoryTheme(tx.category, tx.type);
                                        return (
                                            <div key={idx} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '12px 0',
                                                borderBottom: 'none'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                    <div style={{
                                                        width: '40px', height: '40px', borderRadius: 'var(--btn-radius)',
                                                        background: theme.color + '20',
                                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                        color: theme.color, fontSize: '1.2rem', flexShrink: 0
                                                    }}>
                                                        {getEmojiForDescription(tx.description, theme.icon)}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600', margin: 0 }}>
                                                            {tx.dynamicDescription || tx.description}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            {format(new Date(tx.virtualDate || tx.date), 'dd MMM', { locale: ptBR })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '1rem', color: 'var(--danger-color)', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                                    - {formatCurrency(tx.amount)}
                                                </span>
                                            </div>
                                        );
                                    });
                                }
                                return <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('no_transactions')}</p>
                            })()}
                        </div>
                    </ConfirmDialog>

                    {/* Modal Dinâmico de Limite */}
                    {isLimitModalOpen && createPortal(
                        <>
                            <div
                                onClick={closeLimitModal}
                                style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(5, 10, 6, 0.55)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    zIndex: 12000, transition: 'all 0.3s ease',
                                    animation: isLimitModalClosing ? 'fadeOut 0.3s forwards' : 'fadeIn 0.3s forwards'
                                }}
                            />
                            <div style={{
                                position: 'fixed',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                margin: '0 auto',
                                maxWidth: '480px',
                                width: '100%',
                                height: 'auto',
                                maxHeight: '90vh',
                                backgroundColor: 'var(--bg-color)',
                                borderRadius: '32px 32px 0 0',
                                padding: '32px 24px 48px',
                                zIndex: 12001,
                                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
                                border: '1px solid var(--glass-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '24px',
                                overflow: 'hidden',
                                animation: isLimitModalClosing ? 'slideOutDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                            }}>
                                <div style={{
                                    position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
                                    width: '40px', height: '4px', background: 'var(--glass-border)', borderRadius: '2px'
                                }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
                                            {tempLimit.categoryId && limits[tempLimit.categoryId] 
                                                ? (isPrototype && financialContext === 'family' ? 'Editar Limite Familiar' : 'Editar Limite Mensal') 
                                                : (isPrototype && financialContext === 'family' ? 'Novo Limite Familiar' : 'Novo Limite Mensal')}
                                        </h2>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            {isPrototype && financialContext === 'family' 
                                                ? `Defina o teto de gastos do espaço ${activeFamilySpace?.name || 'familiar'} para esta categoria.` 
                                                : 'Defina quanto você pretende gastar em uma categoria específica.'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { haptic.light(); closeLimitModal(); }}
                                        style={{
                                            width: '40px', height: '40px', borderRadius: 'var(--btn-radius)',
                                            background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                                            color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '4px' }}>CATEGORIA</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={tempLimit.categoryId}
                                                onChange={(e) => setTempLimit({ ...tempLimit, categoryId: e.target.value })}
                                                className="form-input"
                                                style={{
                                                    color: 'var(--text-main)',
                                                    boxSizing: 'border-box',
                                                    width: '100%',
                                                    padding: '14px',
                                                    borderRadius: '16px',
                                                    background: 'var(--surface-color)',
                                                    fontSize: '1rem',
                                                    outline: 'none',
                                                    appearance: 'none',
                                                    minHeight: '48px',
                                                    cursor: 'pointer',
                                                    border: '1px solid var(--glass-border)'
                                                }}
                                            >
                                                <option value="" disabled>{t('select_category', { defaultValue: 'Selecionar Categoria' })}</option>
                                                {CATEGORIAS_DESPESA.map(cat => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.icon} {t(cat.label, { defaultValue: cat.label })}
                                                    </option>
                                                ))}
                                            </select>
                                            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                                                ▼
                                            </div>
                                        </div>
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
                                                className="form-input"
                                                style={{
                                                    width: '100%', padding: '16px 16px 16px 45px', borderRadius: '16px',
                                                    background: 'var(--surface-color)',
                                                    color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '700', outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    {tempLimit.categoryId && limits[tempLimit.categoryId] ? (
                                        <>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const newLimits = { ...limits };
                                                        delete newLimits[tempLimit.categoryId];
                                                        await setLimits(newLimits);
                                                        closeLimitModal();
                                                        haptic.medium();
                                                    } catch (err) {
                                                        alert(err.message || 'Erro ao excluir limite.');
                                                    }
                                                }}
                                                style={{ flex: 1, padding: '16px', borderRadius: 'var(--btn-radius)', background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', fontWeight: '700', cursor: 'pointer' }}
                                            >
                                                Excluir
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!tempLimit.amount) return;
                                                    try {
                                                        await setLimits(prev => ({ ...prev, [tempLimit.categoryId]: parseFloat(tempLimit.amount) }));
                                                        closeLimitModal();
                                                        haptic.success();
                                                    } catch (err) {
                                                        alert(err.message || 'Erro ao salvar alterações.');
                                                    }
                                                }}
                                                style={{ flex: 2, padding: '16px', borderRadius: 'var(--btn-radius)', background: 'var(--primary-gradient)', border: 'none', color: 'white', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 20px rgba(var(--primary-rgb), 0.2)' }}
                                            >
                                                Salvar Alterações
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                if (!tempLimit.categoryId || !tempLimit.amount) return;
                                                try {
                                                    await setLimits(prev => ({ ...prev, [tempLimit.categoryId]: parseFloat(tempLimit.amount) }));
                                                    closeLimitModal();
                                                    haptic.success();
                                                } catch (err) {
                                                    alert(err.message || 'Erro ao criar limite.');
                                                }
                                            }}
                                            style={{ width: '100%', padding: '16px', borderRadius: 'var(--btn-radius)', background: 'var(--primary-gradient)', border: 'none', color: 'white', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 20px rgba(var(--primary-rgb), 0.2)' }}
                                        >
                                            Criar Limite
                                        </button>
                                    )}
                                </div>
                            </div>

                            <style>{`
                            @keyframes modalOpen {
                                0% { opacity: 0; transform: translate(-50%, -40%) scale(0.95); }
                                100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                            }
                            @keyframes modalClose {
                                0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                                100% { opacity: 0; transform: translate(-50%, -40%) scale(0.95); }
                            }
                            @keyframes slideUp {
                                from { transform: translateY(100%); }
                                to { transform: translateY(0); }
                            }
                            @keyframes slideOutDown {
                                from { transform: translateY(0); }
                                to { transform: translateY(100%); }
                            }
                            @keyframes fadeOut {
                                from { opacity: 1; }
                                to { opacity: 0; }
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
                        </>,
                        document.body
                    )}
                </div>
            )}
            {/* Onboarding Overlay */}
            <AnimatePresence>
                {showOnboarding && (
                    <Onboarding key="onboarding" onComplete={() => setShowOnboarding(false)} />
                )}
            </AnimatePresence>

            <PaywallModal 
                isOpen={showPaywall} 
                onClose={() => setShowPaywall(false)} 
                reason="feature" 
            />
        </>
    );
};

export default Home;

