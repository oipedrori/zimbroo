import React, { useState, useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useLimits } from '../hooks/useLimits';
import { format } from 'date-fns';
import { CATEGORIAS_DESPESA } from '../utils/categories';
import { Plus, Trash2, X, Users, Shield } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { usePrototype } from '../contexts/PrototypeContext';
import { usePrototypeFinancial } from '../contexts/PrototypeFinancialContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { haptic } from '../utils/haptic';

const Limits = () => {
    const { isPrototype } = usePrototype();
    const { financialContext, activeFamilySpace, triggerBlockedAction } = usePrototypeFinancial();
    const currentYear = new Date().getFullYear();
    const monthPrefix = format(new Date(), 'yyyy-MM');
    const { transactions } = useTransactions(monthPrefix);
    const {
        limits: hookLimits,
        individualLimits,
        familyLimits,
        setLimits: hookSetLimits
    } = useLimits(currentYear);

    // Estado local para o aplicativo principal (preservando o funcionamento original)
    const [legacyLimits, setLegacyLimits] = useState(() => {
        if (isPrototype) return {};
        const saved = localStorage.getItem('zimbroo_limits');
        return saved ? JSON.parse(saved) : {};
    });

    const [isAdding, setIsAdding] = useState(false);
    const [selectedCat, setSelectedCat] = useState('');
    const [limitValue, setLimitValue] = useState('');
    const [familyReadOnlyNotice, setFamilyReadOnlyNotice] = useState(false);

    const { t, formatCurrency } = useI18n();

    // Sincroniza apenas no aplicativo principal para não poluir nem gravar chaves erradas no protótipo
    useEffect(() => {
        if (!isPrototype) {
            localStorage.setItem('zimbroo_limits', JSON.stringify(legacyLimits));
        }
    }, [legacyLimits, isPrototype]);

    // Resolução de limites e despesas conforme o ambiente e contexto
    const activeLimits = isPrototype ? hookLimits : legacyLimits;

    const expensesByCategory = (txList) => {
        return txList
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + t.amount;
                return acc;
            }, {});
    };

    const handleAddLimit = (e) => {
        e.preventDefault();
        if (selectedCat && limitValue) {
            const parsedVal = parseFloat(limitValue);
            if (isPrototype) {
                if (financialContext !== 'individual') {
                    haptic.light();
                    triggerBlockedAction({
                        title: 'Adicionar Limite no Modo ' + (financialContext === 'family' ? 'Familiar' : 'Ambos'),
                        message: 'A edição e cadastro de limites familiares serão integrados na Etapa 5. Para configurar limites individuais, alterne para o contexto Individual.',
                        allowSwitch: true
                    });
                    setIsAdding(false);
                    return;
                }
                hookSetLimits({
                    ...individualLimits,
                    [selectedCat]: parsedVal
                });
            } else {
                setLegacyLimits(prev => ({
                    ...prev,
                    [selectedCat]: parsedVal
                }));
            }
            setIsAdding(false);
            setLimitValue('');
            setSelectedCat('');
        }
    };

    const handleRemoveLimit = (catId) => {
        if (isPrototype) {
            if (financialContext !== 'individual') {
                haptic.light();
                setFamilyReadOnlyNotice(true);
                return;
            }
            const updated = { ...individualLimits };
            delete updated[catId];
            hookSetLimits(updated);
        } else {
            setLegacyLimits(prev => {
                const newLimits = { ...prev };
                delete newLimits[catId];
                return newLimits;
            });
        }
    };

    // Sub-componente para renderizar um bloco de limites com Donut/Cards
    const renderLimitsBlock = ({ title, limitsObj, txList, allowMutate = true, emptyMessage }) => {
        const catExpenses = expensesByCategory(txList);
        const totalExpenses = Object.values(catExpenses).reduce((acc, val) => acc + val, 0);

        const conicStops = [];
        let cumPercent = 0;
        if (totalExpenses > 0) {
            Object.entries(catExpenses).forEach(([catId, amount]) => {
                const category = CATEGORIAS_DESPESA.find(c => c.id === catId) || { color: '#999' };
                const pct = (amount / totalExpenses) * 100;
                conicStops.push(`${category.color} ${cumPercent}% ${cumPercent + pct}%`);
                cumPercent += pct;
            });
        }

        const pieChartBg = totalExpenses > 0
            ? `conic-gradient(${conicStops.join(', ')})`
            : 'var(--glass-border)';

        const entries = Object.entries(limitsObj || {});

        return (
            <div style={{ marginBottom: '28px' }}>
                {title && (
                    <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>
                        {title}
                    </h2>
                )}

                {/* Gráfico Donut de Despesas deste bloco */}
                {totalExpenses > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                        <div style={{
                            width: '140px', height: '140px',
                            borderRadius: '50%',
                            background: pieChartBg,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center'
                        }}>
                            <div style={{ width: '90px', height: '90px', background: 'var(--bg-color)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('total_spent')}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '-2px' }}>{formatCurrency(totalExpenses)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cards de Limites */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {entries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>{emptyMessage || t('no_limits')}</p>
                        </div>
                    ) : (
                        entries.map(([catId, limitAmount]) => {
                            const category = CATEGORIAS_DESPESA.find(c => c.id === catId) || { label: catId, color: '#999', icon: '📌' };
                            const spent = catExpenses[catId] || 0;
                            const percentage = Math.min((spent / limitAmount) * 100, 100);

                            const isOverLimit = spent > limitAmount;
                            const barColor = isOverLimit ? 'var(--danger-color)' : category.color;
                            const bgColor = isOverLimit ? 'rgba(239, 68, 68, 0.1)' : `${category.color}20`;

                            return (
                                <div key={catId} style={{ background: 'var(--surface-color)', borderRadius: '18px', padding: '16px 18px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', position: 'relative', border: '1px solid var(--glass-border)' }}>
                                    {allowMutate && (
                                        <button 
                                            onClick={() => handleRemoveLimit(catId)} 
                                            style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-muted)', opacity: 0.5, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                            aria-label={`Remover limite de ${category.label}`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                                        <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: bgColor, color: barColor, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem' }}>
                                            {category.icon}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                                                {t(category.label, { defaultValue: category.label })}
                                            </h3>
                                            <p style={{ fontSize: '0.8rem', color: isOverLimit ? 'var(--danger-color)' : 'var(--primary-dark)', fontWeight: '500', margin: '2px 0 0 0' }}>
                                                {isOverLimit ? t('limit_exceeded') : t('utilized', { percentage: percentage.toFixed(1) })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Barra de Progresso */}
                                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-color)', borderRadius: '4px', marginBottom: '10px', overflow: 'hidden' }}>
                                        <div style={{ width: `${percentage}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.5s ease-out' }}></div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' }}>
                                        <span style={{ color: isOverLimit ? 'var(--danger-color)' : 'var(--text-main)' }}>{formatCurrency(spent)}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(limitAmount)}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    // Categorias disponíveis para novos limites
    const availableCategories = CATEGORIAS_DESPESA.filter(c => {
        const currentTargetLimits = (isPrototype && financialContext === 'individual') ? individualLimits : activeLimits;
        return !currentTargetLimits[c.id];
    });

    const isFamiliarWithoutSpace = isPrototype && financialContext === 'family' && !activeFamilySpace;

    return (
        <div className="page-container animate-fade-in" style={{ paddingBottom: '110px' }}>
            <header style={{ paddingTop: '10px', marginBottom: '16px' }}>
                <h1 style={{ fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: '700' }}>{t('limits_title')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{t('limits_subtitle')}</p>
            </header>

            {/* Estado vazio quando Familiar não tem espaço ativo configurado */}
            {isFamiliarWithoutSpace ? (
                <div className="glass-panel" style={{ padding: '36px 20px', textAlign: 'center', margin: '20px 0' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
                        <Users size={26} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
                        Nenhum espaço familiar configurado
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto', lineHeight: '1.5' }}>
                        Para acompanhar os limites do seu espaço familiar, é necessário ter um espaço ativo. A criação de espaços pela interface será disponibilizada na Etapa 5.
                    </p>
                </div>
            ) : (
                <>
                    {/* Botão de Adicionar Limite Individual */}
                    {(!isPrototype || financialContext === 'individual') && !isAdding && availableCategories.length > 0 && (
                        <button
                            onClick={() => setIsAdding(true)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--primary-color)', color: 'var(--btn-text)', fontWeight: '700', marginBottom: '24px', transition: 'transform 0.2s', cursor: 'pointer', border: 'none', boxShadow: '0 8px 20px rgba(var(--primary-rgb), 0.2)' }}
                        >
                            <Plus size={20} />
                            {t('set_new_limit')}
                        </button>
                    )}

                    {/* Formulário de Configuração de Limite (Individual) */}
                    {isAdding && (
                        <form onSubmit={handleAddLimit} className="glass-panel" style={{ padding: '24px', marginBottom: '24px', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsAdding(false)} 
                                    style={{ 
                                        width: '40px', 
                                        height: '40px', 
                                        borderRadius: '12px', 
                                        background: 'var(--surface-color)', 
                                        border: '1px solid var(--glass-border)',
                                        color: 'var(--text-main)', 
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
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
                                                padding: '12px 4px', borderRadius: '16px', border: '1px solid',
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

                    {/* Exibição dos Limites conforme o Contexto Financeiro */}
                    {isPrototype && financialContext === 'both' ? (
                        <>
                            {renderLimitsBlock({
                                title: 'Limites Individuais',
                                limitsObj: individualLimits,
                                txList: transactions.filter(t => t.scope === 'individual'),
                                allowMutate: true,
                                emptyMessage: 'Nenhum limite individual configurado.'
                            })}

                            {activeFamilySpace && renderLimitsBlock({
                                title: `Limites Familiares (${activeFamilySpace.name})`,
                                limitsObj: familyLimits,
                                txList: transactions.filter(t => t.scope === 'family'),
                                allowMutate: false,
                                emptyMessage: `Nenhum limite configurado para o espaço ${activeFamilySpace.name}.`
                            })}
                        </>
                    ) : isPrototype && financialContext === 'family' ? (
                        renderLimitsBlock({
                            title: `Limites Familiares (${activeFamilySpace?.name || 'Família'})`,
                            limitsObj: familyLimits,
                            txList: transactions,
                            allowMutate: false,
                            emptyMessage: `Nenhum limite configurado para o espaço ${activeFamilySpace?.name}.`
                        })
                    ) : (
                        renderLimitsBlock({
                            limitsObj: isPrototype ? individualLimits : legacyLimits,
                            txList: transactions,
                            allowMutate: true
                        })
                    )}
                </>
            )}

            {/* Modal informativo para tentativa de edição de limites familiares */}
            <ConfirmDialog
                isOpen={familyReadOnlyNotice}
                onClose={() => setFamilyReadOnlyNotice(false)}
                title="Limites Familiares"
                message="Os limites do espaço familiar estão em modo de visualização. O formulário para adicionar ou excluir limites familiares será integrado na Etapa 5."
                showIcon={true}
                showCancel={false}
                confirmLabel="Entendi"
                onConfirm={() => setFamilyReadOnlyNotice(false)}
            />
        </div>
    );
};

export default Limits;
