import React, { useState, useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';
import { ptBR, enUS, es, fr } from 'date-fns/locale';
import { ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIAS_DESPESA } from '../utils/categories';
import { getYearlyStats } from '../services/transactionService';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import LoadingDots from '../components/LoadingDots';

const Statistics = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonthNum = currentDate.getMonth() + 1;
    const monthPrefix = format(currentDate, 'yyyy-MM');

    // Transações do mês atual para montar o gráfico de pizza
    const { transactions } = useTransactions(monthPrefix);
    const { t, formatCurrency, locale } = useI18n();

    const [yearlyStats, setYearlyStats] = useState([]);
    const [loadingYearly, setLoadingYearly] = useState(true);

    useEffect(() => {
        if (currentUser) {
            getYearlyStats(currentUser.uid, currentYear).then(data => {
                setYearlyStats(data);
                setLoadingYearly(false);
            });
        }
    }, [currentUser, currentYear]);

    // --- PIP CHART LOGIC (MÊS ATUAL) ---
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
        // Ordena para colocar os maiores gastos primeiro visualmente
        const sortedCats = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a);
        sortedCats.forEach(([catId, amount]) => {
            const category = CATEGORIAS_DESPESA.find(c => c.id === catId) || { color: '#999' };
            const pct = (amount / totalExpenses) * 100;
            conicStops.push(`${category.color} ${cumPercent}% ${cumPercent + pct}%`);
            cumPercent += pct;
        });
    }

    const pieChartBg = totalExpenses > 0
        ? `conic-gradient(${conicStops.join(', ')})`
        : 'var(--glass-border)';

    // --- BAR CHART LOGIC (ANO) ---
    // Encontrar o valor maximo absoluto para escalar as barras (considerando saldos positivos e negativos altos)
    const maxBarValue = Math.max(...yearlyStats.map(s => Math.abs(s.balance)), 1);
    const dateLocales = { pt: ptBR, en: enUS, es: es, fr: fr };

    return (
        <div className="page-container animate-fade-in" style={{ paddingBottom: '100px', animation: 'fadeIn 0.4s forwards' }}>
            <header style={{ marginBottom: '24px', textAlign: 'center', paddingTop: 'env(safe-area-inset-top, 10px)' }}>
                <h1 style={{ fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: '700' }}>{t('statistics')}</h1>
            </header>

            {/* Gráfico Anual de Saldos */}
            <section className="glass-panel" style={{ padding: '24px 16px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '24px' }}>{t('monthly_balances_current_year', { defaultValue: 'Saldos Mensais (ano vigente)' })} ({currentYear})</h3>

                {loadingYearly ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                        <LoadingDots />
                    </div>
                ) : (
                    <div style={{ position: 'relative', height: '180px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', position: 'relative', zIndex: 1 }}>
                            {yearlyStats.map((stat) => {
                                const isCurrent = stat.month === currentMonthNum;
                                const isNegative = stat.balance < 0;
                                const absValue = Math.abs(stat.balance);

                                // Escala baseada na metade superior (ou inferior) do gráfico (que é 50% de 180px)
                                const fillPercentage = Math.min((absValue / maxBarValue) * 100, 100);
                                const minHeight = 2; // pixel minimo pra aparecer cor

                                const barColor = isNegative ? 'var(--danger-color)' : 'var(--primary-color)';
                                const barOpacity = isCurrent ? 1 : 0.4;

                                return (
                                    <div key={stat.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '28px', height: '100%' }}>
                                        {/* Metade Positiva Superior (flex-end para barra crescer de baixo pra cima) */}
                                        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            {!isNegative && isCurrent && (
                                                <span style={{ fontSize: '0.65rem', fontWeight: '700', color: barColor, marginBottom: '2px', whiteSpace: 'nowrap' }}>
                                                    +{(stat.balance / 1000).toFixed(1)}k
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

                                        {/* Espaçador central representando a linha do zero */}
                                        <div style={{ height: '4px', width: '100%' }}></div>

                                        {/* Metade Negativa Inferior (flex-start para barra crescer de cima pra baixo) */}
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
                                                <span style={{ fontSize: '0.65rem', fontWeight: '700', color: barColor, marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                    {(stat.balance / 1000).toFixed(1)}k
                                                </span>
                                            )}
                                        </div>

                                        {/* Letra do Mês fixa na base total */}
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

            <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3 style={{ width: '100%', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
                    {t('expenses_of', { month: format(currentDate, 'MMMM', { locale: dateLocales[locale] || enUS }).replace(/^\w/, c => c.toUpperCase()), defaultValue: 'Despesas do mês' })}
                </h3>

                {totalExpenses > 0 ? (
                    <>
                        <div style={{ position: 'relative', width: '200px', height: '200px', margin: '24px 0', border: 'none', borderRadius: '50%', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
                            <div style={{
                                width: '100%', height: '100%',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                transform: 'translateZ(0)',
                                background: pieChartBg,
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}>
                                <div style={{ width: '130px', height: '130px', background: 'var(--bg-color)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.05)' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('total_spent', { defaultValue: 'Total Gasto' })}</span>
                                    <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--danger-color)', marginTop: '-2px' }}>{formatCurrency(totalExpenses)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Legenda Dinâmica */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                            {Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a).map(([catId, amount]) => {
                                const category = CATEGORIAS_DESPESA.find(c => c.id === catId) || { label: catId, color: '#999', icon: '📌' };
                                const pct = (amount / totalExpenses) * 100;
                                return (
                                    <div key={catId} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-main)', background: 'var(--bg-color)', padding: '6px 12px', borderRadius: '20px', border: `1px solid ${category.color}40`, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: category.color }}></div>
                                        <span>{category.icon} {category.label}</span>
                                        <span style={{ fontWeight: '600', opacity: 0.8 }}>({pct.toFixed(0)}%)</span>
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
