import React, { useState, useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';
import { CATEGORIAS_DESPESA } from '../utils/categories';
import { Plus, Trash2, X } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const Limits = () => {
    const monthPrefix = format(new Date(), 'yyyy-MM');
    const { transactions } = useTransactions(monthPrefix);

    // Store limits in local state/storage for MVP
    const [limits, setLimits] = useState(() => {
        const saved = localStorage.getItem('zimbroo_limits');
        return saved ? JSON.parse(saved) : {};
    });

    const [isAdding, setIsAdding] = useState(false);
    const [selectedCat, setSelectedCat] = useState('');
    const [limitValue, setLimitValue] = useState('');

    const { t, formatCurrency } = useI18n();

    useEffect(() => {
        localStorage.setItem('zimbroo_limits', JSON.stringify(limits));
    }, [limits]);

    const expensesByCategory = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
        }, {});

    const handleAddLimit = (e) => {
        e.preventDefault();
        if (selectedCat && limitValue) {
            setLimits(prev => ({
                ...prev,
                [selectedCat]: parseFloat(limitValue)
            }));
            setIsAdding(false);
            setLimitValue('');
            setSelectedCat('');
        }
    };

    const handleRemoveLimit = (catId) => {
        setLimits(prev => {
            const newLimits = { ...prev };
            delete newLimits[catId];
            return newLimits;
        });
    };

    // Filter categories that don't have a limit yet
    const availableCategories = CATEGORIAS_DESPESA.filter(c => !limits[c.id]);

    // Calculate pie chart colors and stops
    const totalExpenses = Object.values(expensesByCategory).reduce((acc, val) => acc + val, 0);
    const conicStops = [];
    let cumPercent = 0;

    if (totalExpenses > 0) {
        Object.entries(expensesByCategory).forEach(([catId, amount]) => {
            const category = CATEGORIAS_DESPESA.find(c => c.id === catId) || { color: '#999' };
            const pct = (amount / totalExpenses) * 100;
            conicStops.push(`${category.color} ${cumPercent}% ${cumPercent + pct}%`);
            cumPercent += pct;
        });
    }

    const pieChartBg = totalExpenses > 0
        ? `conic-gradient(${conicStops.join(', ')})`
        : 'var(--glass-border)';

    return (
        <div className="page-container animate-fade-in" style={{ paddingBottom: '110px' }}>
            <header style={{ paddingTop: '10px', marginBottom: '16px' }}>
                <h1 style={{ fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: '700' }}>{t('limits_title')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{t('limits_subtitle')}</p>
            </header>

            {/* Pie Chart Representation */}
            {totalExpenses > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '160px', height: '160px',
                        borderRadius: '50%',
                        background: pieChartBg,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        {/* Inner Hole for Donut Look */}
                        <div style={{ width: '100px', height: '100px', background: 'var(--bg-color)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('total_spent')}</span>
                            <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '-4px' }}>{formatCurrency(totalExpenses)}</span>
                        </div>
                    </div>
                </div>
            )}

            {!isAdding ? (
                availableCategories.length > 0 && (
                    <button
                        onClick={() => setIsAdding(true)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--primary-color)', color: 'white', fontWeight: '700', marginBottom: '24px', transition: 'transform 0.2s', cursor: 'pointer', border: 'none', boxShadow: '0 8px 20px rgba(var(--primary-rgb), 0.2)' }}
                    >
                        <Plus size={20} />
                        {t('set_new_limit')}
                    </button>
                )
            ) : (
                <form onSubmit={handleAddLimit} className="glass-panel" style={{ padding: '20px', marginBottom: '24px', position: 'relative' }}>
                    <button type="button" onClick={() => setIsAdding(false)} style={{ position: 'absolute', top: '10px', right: '10px', color: 'var(--text-muted)' }}><X size={20} /></button>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>{t('config_limit')}</h3>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '12px', marginLeft: '4px' }}>{t('category').toUpperCase()}</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
                            {availableCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCat(cat.id)}
                                    style={{
                                        padding: '12px 4px', borderRadius: '16px', border: '2px solid',
                                        borderColor: selectedCat === cat.id ? cat.color : 'transparent',
                                        background: selectedCat === cat.id ? cat.color + '20' : 'var(--bg-color)',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                                    <span style={{ fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.9, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {t(cat.label, { defaultValue: cat.label }).split(' ')[0]}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {selectedCat && (
                            <p style={{ marginTop: '10px', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                {t(CATEGORIAS_DESPESA.find(c => c.id === selectedCat)?.label || '')}
                            </p>
                        )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('limit_value')}</label>
                        <input
                            required
                            type="number"
                            step="0.01"
                            value={limitValue}
                            onChange={(e) => setLimitValue(e.target.value)}
                            placeholder="Ex: 500"
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                        />
                    </div>

                    <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--primary-color)', color: 'var(--text-main)', fontWeight: 'bold' }}>
                        {t('save_limit')}
                    </button>
                </form>
            )}

            {/* Gallery of Limits */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.keys(limits).length === 0 && !isAdding && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <p>{t('no_limits')}</p>
                    </div>
                )}

                {Object.entries(limits).map(([catId, limitAmount]) => {
                    const category = CATEGORIAS_DESPESA.find(c => c.id === catId) || { label: catId, color: '#999', icon: '📌' };
                    const spent = expensesByCategory[catId] || 0;
                    const percentage = Math.min((spent / limitAmount) * 100, 100);

                    const isOverLimit = spent > limitAmount;
                    const barColor = isOverLimit ? 'var(--danger-color)' : category.color;
                    const bgColor = isOverLimit ? 'rgba(239, 68, 68, 0.1)' : `${category.color}20`;

                    return (
                        <div key={catId} style={{ background: 'var(--surface-color)', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', position: 'relative' }}>
                            <button onClick={() => handleRemoveLimit(catId)} style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-muted)', opacity: 0.5 }}>
                                <Trash2 size={16} />
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: bgColor, color: barColor, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem' }}>
                                    {category.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>{t(category.label, { defaultValue: category.label })}</h3>
                                    <p style={{ fontSize: '0.8rem', color: isOverLimit ? 'var(--danger-color)' : 'var(--primary-dark)', fontWeight: '500' }}>
                                        {isOverLimit ? t('limit_exceeded') : t('utilized', { percentage: percentage.toFixed(1) })}
                                    </p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div style={{ width: '100%', height: '8px', background: 'var(--bg-color)', borderRadius: '4px', marginBottom: '12px', overflow: 'hidden' }}>
                                <div style={{ width: `${percentage}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.5s ease-out' }}></div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '600' }}>
                                <span style={{ color: isOverLimit ? 'var(--danger-color)' : 'var(--text-main)' }}>{formatCurrency(spent)}</span>
                                <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(limitAmount)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Limits;
