import React, { useState, useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';
import { format } from 'date-fns';
import { useI18n } from '../contexts/I18nContext';
import { haptic } from '../utils/haptic';
import LoadingDots from './LoadingDots';
import ConfirmDialog from './ConfirmDialog';

const TransactionModal = ({ isOpen, onClose, defaultType = 'expense', initialData = null, onSuccess }) => {
    const { addTx, updateTx, deleteTx } = useTransactions(format(new Date(), 'yyyy-MM'));
    const [type, setType] = useState(defaultType);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(type === 'expense' ? CATEGORIAS_DESPESA[0].id : CATEGORIAS_RECEITA[0].id);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Customizações para recorrente/parcelado
    const [repeatType, setRepeatType] = useState('none'); // none, recurring, installment
    const [installments, setInstallments] = useState(1);
    const [loading, setLoading] = useState(false);
    const { t, getCurrencySymbol } = useI18n();

    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({});

    // Pre-fill if editing
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setTimeout(() => setIsAnimating(true), 10);
            document.body.classList.add('modal-open');
        } else {
            setIsAnimating(false);
            const timeout = setTimeout(() => {
                setShouldRender(false);
            }, 300); // match transition duration
            document.body.classList.remove('modal-open');
            return () => clearTimeout(timeout);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && initialData) {
            setType(initialData.type || defaultType);
            setAmount(initialData.amount ? String(initialData.amount).replace('.', ',') : '');
            setDescription(initialData.description || '');
            setCategory(initialData.category || (initialData.type === 'expense' ? CATEGORIAS_DESPESA[0].id : CATEGORIAS_RECEITA[0].id));

            // Extract original date, not virtualDate, for editing
            setDate(initialData.date || format(new Date(), 'yyyy-MM-dd'));
            setRepeatType(initialData.repeatType || 'none');
            setInstallments(initialData.installments || 1);
        } else if (isOpen && !initialData) {
            // Reset to defaults on open for new tx
            setType(defaultType);
            setAmount('');
            setDescription('');
            setCategory(defaultType === 'expense' ? CATEGORIAS_DESPESA[0].id : CATEGORIAS_RECEITA[0].id);
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setRepeatType('none');
            setInstallments(1);
        }
    }, [isOpen, initialData, defaultType]);

    if (!shouldRender && !isOpen) return null;

    const categories = type === 'expense' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;

    const handleDelete = async (option = 'all') => {
        setLoading(true);
        try {
            const skipMonth = option === 'skip' ? format(new Date(date), 'yyyy-MM') : null;
            await deleteTx(initialData.id, skipMonth);
            haptic.success();
            onSuccess?.();
            onClose();
        } catch (e) {
            console.error(e);
            alert("Erro ao excluir transação");
        } finally {
            setLoading(false);
            setIsConfirmOpen(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Ajuste de valores numéricos
            const numericAmount = parseFloat(amount.replace(',', '.'));
            if (isNaN(numericAmount) || numericAmount <= 0) {
                alert("Digite um valor válido");
                setLoading(false);
                return;
            }

            const txData = {
                type,
                amount: numericAmount,
                description,
                category,
                date,
                repeatType,
                installments: repeatType === 'installment' ? Number(installments) : 1
            };

            if (initialData?.id) {
                await updateTx(initialData.id, txData);
            } else {
                await addTx(txData);
            }

            onSuccess?.();
            haptic.success();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao adicionar transação");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`modal-overlay ${isAnimating ? 'visible' : ''}`} onClick={onClose}>
            <div className={`modal-content ${isAnimating ? 'slide-up' : 'slide-down'}`} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem' }}>{initialData ? t('edit_transaction') : t('add_transaction')}</h2>
                    <button onClick={onClose} style={{ fontSize: '1.2rem', color: 'var(--text-muted)', padding: '4px' }}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                    <button
                        type="button"
                        style={{
                            flex: 1, padding: '12px', borderRadius: 'var(--border-radius-md)',
                            background: type === 'expense' ? 'var(--danger-color)' : 'var(--bg-color)',
                            color: type === 'expense' ? 'white' : 'var(--text-main)',
                            fontWeight: '600', transition: 'all 0.2s'
                        }}
                        onClick={() => { setType('expense'); setCategory(CATEGORIAS_DESPESA[0].id); }}
                    >
                        {t('expense')}
                    </button>
                    <button
                        type="button"
                        style={{
                            flex: 1, padding: '12px', borderRadius: 'var(--border-radius-md)',
                            background: type === 'income' ? 'var(--success-color)' : 'var(--bg-color)',
                            color: type === 'income' ? 'white' : 'var(--text-main)',
                            fontWeight: '600', transition: 'all 0.2s'
                        }}
                        onClick={() => { setType('income'); setCategory(CATEGORIAS_RECEITA[0].id); }}
                    >
                        {t('income')}
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('value')} ({getCurrencySymbol()})</label>
                        <input
                            type="text" 
                            inputMode="decimal"
                            value={amount} 
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0,00" required
                            style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('description')}</label>
                        <input
                            type="text" value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="" required
                            style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('date')}</label>
                            <input
                                type="date" value={date} onChange={e => setDate(e.target.value)} required
                                style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none', appearance: 'none', minHeight: '48px' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                            {categories.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setCategory(c.id)}
                                    style={{
                                        padding: '12px 4px', borderRadius: '16px', border: '2px solid',
                                        borderColor: category === c.id ? c.color : 'transparent',
                                        background: category === c.id ? c.color + '20' : 'var(--bg-color)',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        gap: '4px', overflow: 'hidden'
                                    }}
                                >
                                    <span style={{ fontSize: '1.4rem' }}>{c.icon}</span>
                                    <span style={{ fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.9, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {t(c.label, { defaultValue: c.label }).split(' ')[0]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Motor de Recorrência */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('repeat')}</label>
                        <select
                            value={repeatType} onChange={e => setRepeatType(e.target.value)}
                            style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none', appearance: 'none', minHeight: '48px' }}
                        >
                            <option value="none">{t('none')}</option>
                            <option value="recurring">{t('recurring')}</option>
                            <option value="installment">{t('installment')}</option>
                        </select>
                    </div>

                    {repeatType === 'installment' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('installments_amount')}</label>
                            <input
                                type="number" min="2" max="120" value={installments} onChange={e => setInstallments(e.target.value)} required
                                style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none' }}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                {t('installments_hint', { count: installments, defaultValue: `O valor será cobrado mensalmente por ${installments} meses.` })}
                            </p>
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        style={{
                            marginTop: '10px', width: '100%', padding: '16px', background: 'var(--primary-gradient)',
                            color: 'white', borderRadius: 'var(--border-radius-lg)', fontWeight: 'bold', fontSize: '1.1rem',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', height: '56px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        {loading ? <LoadingDots style={{ color: 'white' }} /> : (initialData ? t('save') : t('add'))}
                    </button>

                    {initialData && (
                        <button
                            type="button"
                            onClick={() => {
                                const isRecurring = repeatType !== 'none';
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
                                    onConfirm: (val) => {
                                        console.log("Deletion confirmed with option:", val);
                                        handleDelete(val || 'all');
                                    }
                                });
                                setIsConfirmOpen(true);
                            }}
                            style={{
                                marginTop: '4px', width: '100%', padding: '12px',
                                border: '1px solid var(--danger-color)', color: 'var(--danger-color)',
                                borderRadius: 'var(--border-radius-lg)', fontWeight: '600', fontSize: '1rem'
                            }}
                        >
                            {t('delete_transaction', { defaultValue: 'Excluir Movimentação' })}
                        </button>
                    )}
                </form>
            </div>

            <ConfirmDialog 
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                {...confirmConfig}
            />

            <style>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0);
          z-index: 10000;
          display: flex;
          align-items: flex-end;
          touch-action: none;
          transition: background 0.3s ease;
        }
        .modal-overlay.visible {
          background: rgba(0,0,0,0.6);
        }
        @media (min-width: 1024px) {
            .modal-overlay {
                align-items: center;
                justify-content: center;
            }
        }
        .modal-content {
          width: 100%;
          background: var(--bg-color); /* Usando bg-color que é opaco */
          border-top-left-radius: 32px;
          border-top-right-radius: 32px;
          padding: 24px;
          padding-top: 32px;
          padding-bottom: calc(40px + env(safe-area-inset-bottom, 20px));
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
          overscroll-behavior: contain;
          position: relative;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.1, 0.7, 0.1, 1);
        }
        .modal-content.slide-up {
          transform: translateY(0);
        }
        .modal-content.slide-down {
          transform: translateY(100%);
        }
        @media (min-width: 1024px) {
            .modal-content {
                width: 620px;
                border-radius: 32px;
                transform: scale(0.9) translateY(20px);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .modal-content.slide-up {
                transform: scale(1) translateY(0);
                opacity: 1;
            }
            .modal-content.slide-down {
                transform: scale(0.9) translateY(20px);
                opacity: 0;
            }
            .modal-content::before {
                display: none;
            }
        }
        .modal-content::before {
            content: '';
            position: absolute;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            width: 40px;
            height: 4px;
            background: var(--glass-border);
            border-radius: 2px;
        }

        body.modal-open .glass-panel,
        body.modal-open .bottom-blur-layer {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }
      `}</style>
        </div>
    );
};

export default TransactionModal;
