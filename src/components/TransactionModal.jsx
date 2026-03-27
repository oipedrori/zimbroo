import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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
            const rawDate = initialData.date || format(new Date(), 'yyyy-MM-dd');
            setDate(rawDate.includes('T') ? rawDate.split('T')[0] : rawDate);
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
        // Ao fechar (isOpen false), NÃO resetamos imediatamente. 
        // O reset natural acontecerá na próxima vez que abrir (isOpen && !initialData).
    }, [isOpen, initialData, defaultType]);

    // Auto-set recurring for Salary and Subscriptions
    useEffect(() => {
        if (category === 'salario' || category === 'assinaturas') {
            setRepeatType('recurring');
        }
    }, [category]);

    if (!shouldRender && !isOpen) return null;

    const categories = type === 'expense' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;

    const handleDelete = async (option = 'all') => {
        setIsConfirmOpen(false);
        const skipMonth = option === 'skip' ? format(new Date(date), 'yyyy-MM') : null;
        
        // Execute background delete but provide instant feedback
        deleteTx(initialData.id, skipMonth).catch(err => {
            console.error("Delete failed:", err);
            alert("Erro ao excluir movimentação no servidor. O estado foi revertido.");
        });

        haptic.success();
        onSuccess?.();
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Ajuste de valores numéricos (remove pontos de milhar e troca vírgula por ponto decimal)
        const cleanAmount = amount.replace(/\./g, '').replace(',', '.');
        const numericAmount = parseFloat(cleanAmount);
        
        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert(t('invalid_value', { defaultValue: 'Digite um valor válido' }));
            return;
        }

        const txData = {
            type,
            amount: repeatType === 'installment' ? numericAmount / Number(installments) : numericAmount,
            totalAmount: repeatType === 'installment' ? numericAmount : null, // Store total for reference
            description,
            category,
            date,
            repeatType,
            installments: repeatType === 'installment' ? Number(installments) : 1
        };

        // Execute background sync but provide instant feedback
        if (initialData?.id) {
            updateTx(initialData.id, txData).catch(err => {
                console.error("Update failed:", err);
                alert("Erro ao atualizar transação no servidor. O estado foi revertido.");
            });
        } else {
            addTx(txData).catch(err => {
                console.error("Add failed:", err);
                alert("Erro ao adicionar transação no servidor. O estado foi revertido.");
            });
        }

        haptic.success();
        onSuccess?.();
        onClose();
    };

    return createPortal(
        <div className={`modal-overlay ${isAnimating ? 'visible' : ''}`} onClick={onClose}>
            <div className={`modal-content ${isAnimating ? 'slide-up' : 'slide-down'}`} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{initialData ? t('edit_transaction') : t('add_transaction')}</h2>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: 'var(--btn-radius)', 
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
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                    <button
                        type="button"
                        style={{
                            flex: 1, padding: '12px', borderRadius: 'var(--btn-radius)',
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
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('description')}</label>
                        <input
                            type="text" value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="" required
                            className="form-input"
                            style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                            {repeatType === 'installment' ? t('total_value', { defaultValue: 'Valor Total' }) : t('value')} ({getCurrencySymbol()})
                        </label>
                        <input
                            type="text" 
                            inputMode="decimal"
                            value={amount} 
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0,00" required
                            className="form-input"
                            style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none' }}
                        />
                        {repeatType === 'installment' && amount && installments > 1 && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--primary-dark)', marginTop: '8px', fontWeight: '600' }}>
                                ✨ {installments}x {t('of_value', { defaultValue: 'de' })} {getCurrencySymbol()} {(parseFloat(amount.replace(',', '.')) / installments || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {t('month', { defaultValue: 'mês' })}
                            </p>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('date')}</label>
                            <input
                                type="date" value={date} onChange={e => setDate(e.target.value)} required
                                className="form-input"
                                style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none', appearance: 'none', minHeight: '48px' }}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('category')}</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="form-input"
                                style={{ 
                                    color: 'var(--text-main)', 
                                    boxSizing: 'border-box', 
                                    width: '100%', 
                                    padding: '14px', 
                                    borderRadius: 'var(--border-radius-md)', 
                                    background: 'var(--bg-color)', 
                                    fontSize: '1rem', 
                                    outline: 'none', 
                                    appearance: 'none', 
                                    minHeight: '48px',
                                    cursor: 'pointer'
                                }}
                            >
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.icon} {t(c.label, { defaultValue: c.label })}
                                    </option>
                                ))}
                            </select>
                            <div style={{ position: 'absolute', right: '16px', top: '38px', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                                ▼
                            </div>
                        </div>
                    </div>

                    {/* Motor de Recorrência */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('repeat')}</label>
                        <select
                            value={repeatType} onChange={e => setRepeatType(e.target.value)}
                            className="form-input"
                            style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none', appearance: 'none', minHeight: '48px' }}
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
                                className="form-input"
                                style={{ color: 'var(--text-main)', boxSizing: 'border-box', width: '100%', padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-color)', fontSize: '1rem', outline: 'none' }}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                {t('installments_hint', { count: installments, defaultValue: `O valor será cobrado mensalmente por ${installments} meses.` })}
                            </p>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
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
                                    flex: 1, padding: '16px',
                                    border: '1px solid var(--danger-color)', color: 'var(--danger-color)',
                                    background: 'transparent',
                                    borderRadius: 'var(--btn-radius)', fontWeight: '700', fontSize: '1rem',
                                    height: '56px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                {t('delete')}
                            </button>
                        )}

                        <button
                            type="submit" disabled={loading}
                            style={{
                                flex: initialData ? 1.8 : 1, padding: '16px', background: 'var(--primary-gradient)',
                                color: 'var(--btn-text)', borderRadius: 'var(--btn-radius)', fontWeight: 'bold', fontSize: '1.1rem',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', height: '56px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none'
                            }}
                        >
                            {loading ? <LoadingDots style={{ color: 'var(--btn-text)' }} /> : (initialData ? t('save') : t('add'))}
                        </button>
                    </div>
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
          inset: 0;
          background: rgba(0,0,0,0);
          z-index: 10000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0;
          touch-action: none;
          transition: all 0.3s ease;
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
        }
        .modal-overlay.visible {
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        
        .modal-content {
          width: 100%;
          max-width: none;
          background: var(--bg-color);
          border-radius: 32px 32px 0 0;
          padding: 32px 24px 48px;
          max-height: 92vh;
          overflow-y: auto;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
          overscroll-behavior: contain;
          position: relative;
          transform: translateY(100%);
          opacity: 1;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 10002;
        }

        .modal-content.slide-up {
          transform: translateY(0);
        }

        .modal-content.slide-down {
          transform: translateY(100%);
        }

        @media (min-width: 1024px) {
            .modal-overlay {
                align-items: center;
                justify-content: center;
                padding: 24px;
            }
            .modal-content {
                max-width: 620px;
                border-radius: 32px;
                transform: scale(0.9) translateY(20px);
                opacity: 0;
                padding: 32px 24px;
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

        .form-input {
            border: 1px solid var(--glass-border) !important;
            transition: all 0.2s ease-in-out;
        }

        .form-input:focus {
            border-color: var(--primary-color) !important;
            box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
            background: var(--surface-color) !important;
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
        </div>,
        document.body
    );
};

export default TransactionModal;
