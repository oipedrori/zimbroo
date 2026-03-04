import React, { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';
import { format } from 'date-fns';

const TransactionModal = ({ isOpen, onClose, defaultType = 'expense', initialData = null, onSuccess }) => {
    const { addTx, updateTx } = useTransactions(format(new Date(), 'yyyy-MM'));
    const [type, setType] = useState(defaultType);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(type === 'expense' ? CATEGORIAS_DESPESA[0].id : CATEGORIAS_RECEITA[0].id);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Customizações para recorrente/parcelado
    const [repeatType, setRepeatType] = useState('none'); // none, recurring, installment
    const [installments, setInstallments] = useState(1);
    const [loading, setLoading] = useState(false);

    // Pre-fill if editing
    React.useEffect(() => {
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

    if (!isOpen) return null;

    const categories = type === 'expense' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;

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
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao adicionar transação");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content animate-slide-up">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2>{initialData ? 'Editar Transação' : 'Nova Transação'}</h2>
                    <button onClick={onClose} style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                        type="button"
                        style={{
                            flex: 1, padding: '10px', borderRadius: 'var(--border-radius-sm)',
                            background: type === 'expense' ? 'var(--danger-color)' : 'var(--bg-color)',
                            color: type === 'expense' ? 'white' : 'var(--text-main)',
                            fontWeight: '500'
                        }}
                        onClick={() => { setType('expense'); setCategory(CATEGORIAS_DESPESA[0].id); }}
                    >
                        Despesa
                    </button>
                    <button
                        type="button"
                        style={{
                            flex: 1, padding: '10px', borderRadius: 'var(--border-radius-sm)',
                            background: type === 'income' ? 'var(--success-color)' : 'var(--bg-color)',
                            color: type === 'income' ? 'white' : 'var(--text-main)',
                            fontWeight: '500'
                        }}
                        onClick={() => { setType('income'); setCategory(CATEGORIAS_RECEITA[0].id); }}
                    >
                        Receita
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Valor (R$)</label>
                        <input
                            type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                            placeholder="0,00" required
                            style={{ width: '100%', padding: '12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', fontSize: '1.2rem' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Descrição</label>
                        <input
                            type="text" value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Ex: Mercado" required
                            style={{ width: '100%', padding: '12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Data</label>
                            <input
                                type="date" value={date} onChange={e => setDate(e.target.value)} required
                                style={{ width: '100%', padding: '12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Categoria</label>
                            <select
                                value={category} onChange={e => setCategory(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                            >
                                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Motor de Recorrência - Visível apenas para despesas por enquanto ou geral */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Repetição</label>
                        <select
                            value={repeatType} onChange={e => setRepeatType(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                        >
                            <option value="none">Não repete (Única vez)</option>
                            <option value="recurring">Mensal (Recorrente todo mês)</option>
                            <option value="installment">Parcelado (Número definido de vezes)</option>
                        </select>
                    </div>

                    {repeatType === 'installment' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Quantas parcelas no total?</label>
                            <input
                                type="number" min="2" max="120" value={installments} onChange={e => setInstallments(e.target.value)} required
                                style={{ width: '100%', padding: '12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                O valor {amount ? `de R$ ${amount}` : 'total'} será cobrado mensalmente por {installments} meses.
                            </p>
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        style={{
                            marginTop: '10px', width: '100%', padding: '16px', background: 'var(--primary-gradient)',
                            color: 'white', borderRadius: 'var(--border-radius-lg)', fontWeight: 'bold', fontSize: '1.1rem'
                        }}
                    >
                        {loading ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Adicionar'}
                    </button>
                </form>
            </div>

            <style>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: flex-end;
        }
        .modal-content {
          width: 100%;
          background: var(--surface-color);
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          padding: 24px;
          padding-bottom: calc(60px + env(safe-area-inset-bottom, 20px));
          max-height: 90vh;
          overflow-y: auto;
        }
      `}</style>
        </div>
    );
};

export default TransactionModal;
