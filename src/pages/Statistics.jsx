import React, { useState, useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';
import { ptBR, enUS, es, fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { getCategoryInfo } from '../utils/categories';
import { getYearlyStats } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import LoadingDots from '../components/LoadingDots';

// Cores fixas e bem distintas para o pie chart — independentes das cores de categorias
const PIE_COLORS = {
    alimentacao:   '#F97316', // laranja vivo
    comunicacao:   '#6366F1', // índigo vibrante
    doacao:        '#EC4899', // rosa choque
    educacao:      '#3B82F6', // azul forte
    equipamentos:  '#14B8A6', // teal saturado
    impostos:      '#78716C', // marrom acinzentado
    investimento:  '#D946EF', // fúcsia vivo
    lazer:         '#EF4444', // vermelho
    moradia:       '#0EA5E9', // céu azul
    pet:           '#FB923C', // laranja pêssego
    saude:         '#A855F7', // violeta forte
    seguro:        '#06B6D4', // ciano
    transporte:    '#22C55E', // verde
    vestuario:     '#F59E0B', // âmbar-ouro
    higiene:       '#84CC16', // limão-verde
    indeterminado: '#94A3B8', // cinza azulado
    outros:        '#6B7280', // cinza
};

function getPieColor(catId) {
    return PIE_COLORS[catId] || '#94A3B8';
}

const Statistics = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonthNum = currentDate.getMonth() + 1;
    const monthPrefix = format(currentDate, 'yyyy-MM');

    const { transactions } = useTransactions(monthPrefix);
    const { t, formatCurrency, locale, currency } = useI18n();

    const [yearlyStats, setYearlyStats] = useState([]);
    const [loadingYearly, setLoadingYearly] = useState(true);
    const [selectedSlice, setSelectedSlice] = useState(null);

    useEffect(() => {
        if (currentUser) {
            getYearlyStats(currentUser.uid, currentYear).then(data => {
                setYearlyStats(data);
                setLoadingYearly(false);
            });
        }
    }, [currentUser, currentYear]);

    // --- PIE CHART LOGIC ---
    const expensesByCategory = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            // Garante que variações como 'Alimentação', 'alimentação', 'alimentacao' caiam no mesmo balde
            const catId = getCategoryInfo(t.category, 'expense').id;
            acc[catId] = (acc[catId] || 0) + t.amount;
            return acc;
        }, {});

    const totalExpenses = Object.values(expensesByCategory).reduce((acc, val) => acc + val, 0);
    const sortedCats = totalExpenses > 0
        ? Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a)
        : [];

    // Build segments with start/end angles for SVG (interactive approach)
    let cumPercent = 0;
    const segments = sortedCats.map(([catId, amount]) => {
        const pct = (amount / totalExpenses) * 100;
        const start = cumPercent;
        const end = cumPercent + pct;
        cumPercent += pct;
        return { catId, amount, pct, start, end, color: getPieColor(catId) };
    });

    // SVG path helper: arc from startPct to endPct on a circle
    function describeArc(startPct, endPct, r = 90, cx = 100, cy = 100) {
        const toRad = deg => (deg * Math.PI) / 180;
        const startAngle = toRad((startPct / 100) * 360 - 90);
        // Resolve o problema de sumir quando tem 100% (-0.001 evita sobreposição exata que quebra o SVG)
        const endAngle   = toRad(endPct === 100 ? (endPct - 0.001) / 100 * 360 - 90 : (endPct   / 100) * 360 - 90);
        const largeArc   = endPct - startPct > 50 ? 1 : 0;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        if (endPct - startPct === 100) {
            // Full circle special case
            return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
        }
        return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    // --- BAR CHART LOGIC ---
    const maxBarValue = Math.max(...yearlyStats.map(s => Math.abs(s.balance)), 1);
    const dateLocales = { pt: ptBR, en: enUS, es: es, fr: fr };

    // Currency symbol helper
    const currencySymbol = (() => {
        try {
            const formatted = new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'BRL', minimumFractionDigits: 0 }).format(0);
            const match = formatted.match(/[^0-9\s.,]+/);
            return match ? match[0] : 'R$';
        } catch {
            return 'R$';
        }
    })();

    return (
        <div className="page-container animate-fade-in no-scrollbar" style={{ paddingBottom: '110px', animation: 'fadeIn 0.4s forwards' }}>
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .pie-slice { cursor: pointer; }
                .pie-slice:hover { opacity: 0.9; }
            `}</style>

            <header style={{ marginBottom: '24px', textAlign: 'center', paddingTop: 'env(safe-area-inset-top, 10px)' }}>
                <h1 style={{ fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: '700' }}>{t('statistics')}</h1>
            </header>

            {/* Gráfico Anual de Saldos */}
            <section className="glass-panel" style={{ padding: '24px 16px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '24px' }}>
                    {t('monthly_balances_current_year', { defaultValue: 'Saldos Mensais (ano vigente)' })} ({currentYear})
                </h3>

                {loadingYearly ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                        <LoadingDots />
                    </div>
                ) : (
                    // Aumentado para 230px para dar mais espaço às barras e valores
                    <div style={{ position: 'relative', height: '230px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', position: 'relative', zIndex: 1 }}>
                            {yearlyStats.map((stat) => {
                                const isCurrent = stat.month === currentMonthNum;
                                const isNegative = stat.balance < 0;
                                const absValue = Math.abs(stat.balance);

                                const fillPercentage = Math.min((absValue / maxBarValue) * 100, 100);
                                const minHeight = 2;

                                const barColor = isNegative ? 'var(--danger-color)' : 'var(--primary-color)';
                                const barOpacity = isCurrent ? 1 : 0.4;

                                // Formata o valor em k com símbolo de moeda
                                const valueLabel = `${currencySymbol}${(absValue / 1000).toFixed(1)}k`;

                                return (
                                    <div key={stat.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '28px', height: '100%' }}>
                                        {/* Metade Positiva Superior */}
                                        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            {!isNegative && isCurrent && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: '700', color: barColor, marginBottom: '5px', whiteSpace: 'nowrap' }}>
                                                    +{valueLabel}
                                                </span>
                                            )}
                                            {!isNegative && (
                                                <div style={{
                                                    width: '100%',
                                                    height: `${Math.max(fillPercentage, minHeight)}%`,
                                                    background: barColor,
                                                    borderRadius: '4px 4px 0 0',
                                                    opacity: barOpacity,
                                                    transition: 'height 0.5s ease-out'
                                                }}></div>
                                            )}
                                        </div>

                                        {/* Linha zero */}
                                        <div style={{ height: '4px', width: '100%' }}></div>

                                        {/* Metade Negativa Inferior */}
                                        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center' }}>
                                            {isNegative && (
                                                <div style={{
                                                    width: '100%',
                                                    height: `${Math.max(fillPercentage, minHeight)}%`,
                                                    background: barColor,
                                                    borderRadius: '0 0 4px 4px',
                                                    opacity: barOpacity,
                                                    transition: 'height 0.5s ease-out'
                                                }}></div>
                                            )}
                                            {isNegative && isCurrent && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: '700', color: barColor, marginTop: '5px', whiteSpace: 'nowrap' }}>
                                                    {valueLabel}
                                                </span>
                                            )}
                                        </div>

                                        {/* Label do mês */}
                                        <div style={{ position: 'absolute', bottom: '-15px' }}>
                                            <span style={{ fontSize: '0.65rem', color: isCurrent ? 'var(--primary-darkest)' : 'var(--text-muted)', fontWeight: isCurrent ? '700' : '500' }}>
                                                {stat.label.charAt(0)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>

            {/* Gráfico de Pizza */}
            <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3 style={{ width: '100%', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
                    {t('expenses_of', { month: format(currentDate, 'MMMM', { locale: dateLocales[locale] || enUS }).replace(/^\w/, c => c.toUpperCase()), defaultValue: 'Despesas do mês' })}
                </h3>

                {totalExpenses > 0 ? (
                    <>
                        {/* SVG Pie Chart interativo */}
                        <div style={{ position: 'relative', width: '220px', height: '220px', margin: '24px 0' }}>
                            <svg viewBox="0 0 200 200" width="220" height="220" style={{ overflow: 'visible' }}>
                                {segments.map(seg => {
                                    const isSelected = selectedSlice === seg.catId;
                                    // Math for popping the slice out
                                    const toRad = deg => (deg * Math.PI) / 180;
                                    const midAngle = toRad((seg.start + seg.pct / 2) / 100 * 360 - 90);
                                    // Distance to pop out
                                    const popOutDist = 12; 
                                    const tx = isSelected ? Math.cos(midAngle) * popOutDist : 0;
                                    const ty = isSelected ? Math.sin(midAngle) * popOutDist : 0;
                                    // Slight extra scale for emphasis
                                    const scale = isSelected ? 1.05 : 1;

                                    return (
                                        <path
                                            key={seg.catId}
                                            d={describeArc(seg.start, seg.end)}
                                            fill={seg.color}
                                            className="pie-slice"
                                            onClick={() => setSelectedSlice(isSelected ? null : seg.catId)}
                                            style={{ 
                                                transformOrigin: '100px 100px',
                                                transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                                                filter: isSelected ? `drop-shadow(0px 4px 8px rgba(0,0,0,0.3))` : 'none'
                                            }}
                                        />
                                    );
                                })}
                                {/* Buraco central */}
                                <circle cx="100" cy="100" r="58" fill="var(--bg-color)" />
                                {/* Texto central */}
                                <text x="100" y="95" textAnchor="middle" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>
                                    {selectedSlice
                                        ? segments.find(s => s.catId === selectedSlice)?.pct.toFixed(0) + '%'
                                        : t('total_spent', { defaultValue: 'Total Gasto' })
                                    }
                                </text>
                                <text x="100" y="112" textAnchor="middle" style={{ fontSize: '10px', fontWeight: '700', fill: 'var(--danger-color)' }}>
                                    {selectedSlice
                                        ? formatCurrency(segments.find(s => s.catId === selectedSlice)?.amount || 0)
                                        : formatCurrency(totalExpenses)
                                    }
                                </text>
                            </svg>
                        </div>

                        {/* Legenda */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
                            {segments.map(seg => {
                                const category = getCategoryInfo(seg.catId, 'expense');
                                const isActive = selectedSlice === seg.catId;
                                return (
                                    <div
                                        key={seg.catId}
                                        onClick={() => setSelectedSlice(selectedSlice === seg.catId ? null : seg.catId)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '0.85rem', color: 'var(--text-main)',
                                            background: isActive ? `${seg.color}22` : 'var(--bg-color)',
                                            padding: '6px 12px', borderRadius: '20px',
                                            border: `1.5px solid ${isActive ? seg.color : seg.color + '50'}`,
                                            boxShadow: isActive ? `0 0 0 2px ${seg.color}40` : '0 2px 5px rgba(0,0,0,0.05)',
                                            cursor: 'pointer', transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, flexShrink: 0 }}></div>
                                        <span>{category.icon} {t(category.label, { defaultValue: category.label })}</span>
                                        <span style={{ fontWeight: '600', opacity: 0.8 }}>({seg.pct.toFixed(0)}%)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>{t('no_data_stats')}</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default Statistics;
