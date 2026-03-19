import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR, enUS, es, fr } from 'date-fns/locale';
import { useI18n } from '../contexts/I18nContext';
import { getCategoryInfo } from '../utils/categories';
import { haptic } from '../utils/haptic';

const BudgetPieChart = ({ transactions = [], currentDate = new Date() }) => {
    const { t, formatCurrency, locale } = useI18n();
    const [selectedSlice, setSelectedSlice] = useState(null);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const dateLocales = { pt: ptBR, en: enUS, es: es, fr: fr };

    // Agrupar despesas por categoria
    const expensesByCategory = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const catInfo = getCategoryInfo(t.category, 'expense');
            acc[catInfo.id] = (acc[catInfo.id] || 0) + t.amount;
            return acc;
        }, {});

    const totalExpenses = Object.values(expensesByCategory).reduce((acc, val) => acc + val, 0);

    // Preparar segmentos do gráfico
    const segments = [];
    let currentStart = 0;
    const sortedEntries = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a);

    sortedEntries.forEach(([catId, amount]) => {
        const pct = (amount / totalExpenses) * 100;
        const color = getCategoryInfo(catId, 'expense').color;
        segments.push({
            catId,
            amount,
            pct,
            color,
            start: currentStart,
            end: currentStart + pct
        });
        currentStart += pct;
    });

    // Função auxiliar para desenhar arcos SVG
    const describeArc = (startPct, endPct) => {
        const radius = 80;
        const cx = 100;
        const cy = 100;

        const startRad = (startPct / 100) * Math.PI * 2 - Math.PI / 2;
        const endRad = (endPct / 100) * Math.PI * 2 - Math.PI / 2;

        const x1 = cx + radius * Math.cos(startRad);
        const y1 = cy + radius * Math.sin(startRad);
        const x2 = cx + radius * Math.cos(endRad);
        const y2 = cy + radius * Math.sin(endRad);

        const largeArcFlag = endPct - startPct <= 50 ? "0" : "1";

        return [
            "M", x1, y1,
            "A", radius, radius, 0, largeArcFlag, 1, x2, y2,
            "L", cx, cy,
            "Z"
        ].join(" ");
    };

    if (totalExpenses === 0) {
        return (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>{t('no_data_stats', { defaultValue: 'Nenhum gasto este mês' })}</p>
            </div>
        );
    }

    return (
        <div className="budget-pie-chart" style={{
            display: 'flex',
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: isDesktop ? 'center' : 'center',
            justifyContent: 'center',
            gap: isDesktop ? '40px' : '32px',
            width: '100%'
        }}>
            {/* SVG Pie Chart */}
            <div className="pie-chart-svg-wrapper" style={{ 
                position: 'relative', 
                width: isDesktop ? '320px' : '220px', 
                height: isDesktop ? '320px' : '220px', 
                flexShrink: 0 
            }}>
                <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ overflow: 'visible' }}>
                    {segments.map(seg => {
                        const isSelected = selectedSlice === seg.catId;
                        const toRad = deg => (deg * Math.PI) / 180;
                        const midAngle = toRad((seg.start + seg.pct / 2) / 100 * 360 - 90);
                        const popOutDist = 20;
                        const tx = isSelected ? Math.cos(midAngle) * popOutDist : 0;
                        const ty = isSelected ? Math.sin(midAngle) * popOutDist : 0;
                        const scale = isSelected ? 1.15 : 1;

                        return (
                            <path
                                key={seg.catId}
                                d={describeArc(seg.start, seg.end)}
                                fill={seg.color}
                                className="pie-slice"
                                onClick={() => {
                                    haptic.light();
                                    setSelectedSlice(isSelected ? null : seg.catId);
                                }}
                                style={{
                                    transformOrigin: '100px 100px',
                                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                                    filter: isSelected ? `drop-shadow(0px 8px 16px rgba(0,0,0,0.4))` : 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        );
                    })}
                    {/* Donut Hole */}
                    <circle cx="100" cy="100" r="58" fill="var(--bg-color)" />
                    {/* Central Text */}
                    <text x="100" y="95" textAnchor="middle" style={{ fontSize: isDesktop ? '10px' : '8px', fill: 'var(--text-muted)', fontWeight: '600' }}>
                        {selectedSlice
                            ? segments.find(s => s.catId === selectedSlice)?.pct.toFixed(0) + '%'
                            : t('total_spent', { defaultValue: 'Total Gasto' })
                        }
                    </text>
                    <text x="100" y="112" textAnchor="middle" style={{ fontSize: isDesktop ? '14px' : '12px', fontWeight: '800', fill: 'var(--text-main)' }}>
                        {selectedSlice
                            ? formatCurrency(segments.find(s => s.catId === selectedSlice)?.amount || 0)
                            : formatCurrency(totalExpenses)
                        }
                    </text>
                </svg>
            </div>

            {/* Legend Chips */}
            <div className="pie-chart-legend" style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: isDesktop ? 'flex-start' : 'center',
                maxWidth: isDesktop ? '500px' : '100%',
                flex: 1
            }}>
                {segments.map(seg => {
                    const category = getCategoryInfo(seg.catId, 'expense');
                    const isActive = selectedSlice === seg.catId;
                    return (
                        <div
                            key={seg.catId}
                            onClick={() => {
                                haptic.light();
                                setSelectedSlice(selectedSlice === seg.catId ? null : seg.catId);
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '0.75rem', color: 'var(--text-main)',
                                background: isActive ? `${seg.color}22` : 'var(--bg-color)',
                                padding: '4px 12px', borderRadius: '20px',
                                border: `1px solid ${isActive ? seg.color : 'var(--glass-border)'}`,
                                boxShadow: isActive ? `0 4px 12px ${seg.color}30` : '0 1px 3px rgba(0,0,0,0.05)',
                                cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                fontWeight: isActive ? '700' : '500',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: seg.color, flexShrink: 0 }}></div>
                            <span>{category.icon} {t(category.label, { defaultValue: category.label })}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BudgetPieChart;
