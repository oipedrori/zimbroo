import React from 'react';
import { Plus } from 'lucide-react';
import { getCategoryInfo } from '../utils/categories';
import { haptic } from '../utils/haptic';

const LimitsSection = ({ 
    limits, 
    transactions, 
    formatCurrency, 
    t, 
    setIsLimitModalOpen, 
    setTempLimit,
    isDesktop 
}) => {
    // Calcular o gasto por categoria para o mês atual
    const getSpentForCategory = (catId) => {
        return transactions
            .filter(t => t.type === 'expense' && getCategoryInfo(t.category, 'expense').id === catId)
            .reduce((acc, t) => acc + t.amount, 0);
    };

    const limitEntries = Object.entries(limits).sort((a, b) => {
        const spentA = getSpentForCategory(a[0]);
        const percentA = spentA / a[1];
        const spentB = getSpentForCategory(b[0]);
        const percentB = spentB / b[1];
        return percentB - percentA;
    });

    return (
        <section className="limits-section">            <h3 style={{ 
                fontSize: '1.2rem', 
                fontWeight: '600', 
                marginBottom: '16px',
                marginTop: '24px',
                color: 'var(--text-main)',
                padding: '0'
            }}>
                {t('limits', { defaultValue: 'Limites' })}
            </h3>

            <div className="limits-carousel" style={{
                display: 'flex',
                overflowX: 'auto',
                gap: '12px',
                padding: '4px 20px 0 20px',
                margin: '0 -20px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
            }}>
                <style>{`
                    .limits-carousel::-webkit-scrollbar { display: none; }
                `}</style>

                {limitEntries.map(([catId, limitAmount]) => {
                    const category = getCategoryInfo(catId, 'expense');
                    const spent = getSpentForCategory(catId);
                    const rawPercent = (spent / limitAmount) * 100;
                    const percent = Math.min(rawPercent, 100);
                    const isOverLimit = spent >= limitAmount;
                    const isNearLimit = rawPercent >= 90;

                    let barColor = 'var(--primary)'; // Dark gray default
                    if (isOverLimit) barColor = 'var(--danger-color)'; // Red 100%+
                    else if (isNearLimit) barColor = '#FBBF24'; // Yellow 90%+

                    return (
                        <div 
                            key={catId}
                            className="glass-panel"
                            style={{
                                flexShrink: 0,
                                width: isDesktop ? '220px' : '180px',
                                minHeight: '140px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                background: 'var(--surface-color)',
                                border: `1px solid ${isOverLimit ? 'rgba(239, 68, 68, 0.2)' : 'var(--glass-border)'}`,
                                transition: 'transform 0.2s',
                                cursor: 'pointer'
                            }}
                            onClick={() => {
                                haptic.light();
                                setIsLimitModalOpen(true, catId, limitAmount);
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>{category.icon}</span>
                                <span style={{ 
                                    fontSize: '0.9rem', 
                                    fontWeight: '700', 
                                    color: 'var(--text-main)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {t(category.label, { defaultValue: category.label })}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <p style={{ 
                                    margin: 0, 
                                    fontSize: '1rem', 
                                    fontWeight: '800', 
                                    color: isOverLimit ? 'var(--danger-color)' : 'var(--text-main)' 
                                }}>
                                    {formatCurrency(spent)}
                                </p>
                                <p style={{ 
                                    margin: 0, 
                                    fontSize: '0.75rem', 
                                    fontWeight: '600', 
                                    color: 'var(--text-muted)' 
                                }}>
                                    / {formatCurrency(limitAmount)}
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                <div style={{ 
                                    flex: 1, 
                                    height: '6px', 
                                    background: 'rgba(255, 255, 255, 0.12)', 
                                    borderRadius: '10px', 
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <div style={{
                                        width: `${percent}%`,
                                        height: '100%',
                                        background: barColor,
                                        borderRadius: '10px',
                                        transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }} />
                                </div>
                                <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: '800', 
                                    color: isOverLimit ? 'var(--danger-color)' : isNearLimit ? '#FBBF24' : 'var(--text-muted)',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {Math.round(rawPercent)}%
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Ghost Card: Adicionar limite */}
                <div 
                    className="glass-panel"
                    style={{
                        flexShrink: 0,
                        width: isDesktop ? '220px' : '180px',
                        minHeight: '140px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: 'transparent',
                        border: '2px dashed var(--glass-border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        color: 'var(--text-muted)'
                    }}
                    onClick={() => {
                        haptic.medium();
                        setTempLimit({ categoryId: '', amount: '' });
                        setIsLimitModalOpen(true);
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                        e.currentTarget.style.color = 'var(--primary-color)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                >
                    <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '12px', 
                        background: 'var(--surface-color)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <Plus size={20} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                        {t('add_limit', { defaultValue: 'Adicionar limite' })}
                    </span>
                </div>
            </div>
        </section>
    );
};

export default LimitsSection;
