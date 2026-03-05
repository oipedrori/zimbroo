import React, { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useAuth } from '../contexts/AuthContext';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';
import TransactionModal from '../components/TransactionModal';
import SwipeableItem from '../components/SwipeableItem';
import { Plus, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const Home = () => {
    const { currentUser, logout } = useAuth();

    // Controle do Mês Atual no Dashboard
    const [currentDate, setCurrentDate] = useState(new Date());
    const monthPrefix = format(currentDate, 'yyyy-MM');

    const { transactions, loading, refetch, deleteTx } = useTransactions(monthPrefix);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('expense');
    const [editingTx, setEditingTx] = useState(null);

    // Navegação de meses
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Cálculos do Dashboard
    const incomes = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = incomes - expenses;

    const handleOpenModal = (type) => {
        setEditingTx(null); // Ensure we are in "new" mode
        setModalType(type);
        setIsModalOpen(true);
    };

    const handleEditTx = (tx) => {
        setEditingTx(tx);
        setIsModalOpen(true);
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const getCategoryTheme = (id, type) => {
        const defaultColor = '#9ca3af';
        const list = type === 'income' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
        const cat = list.find(c => c.id === id);
        return cat ? cat : { label: 'Outros', color: defaultColor };
    };

    const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR });
    // Capitaliza o mês
    const formattedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    const isNegative = balance < 0;
    const cardGradient = isNegative
        ? 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)'
        : 'var(--primary-gradient)';

    return (
        <div className="page-container animate-fade-in" style={{ paddingBottom: '120px', animation: 'slideUp 0.3s forwards' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
                <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)' }}>
                        <User size={20} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: '700', paddingLeft: '4px' }}>Olá, {currentUser?.displayName?.split(' ')[0] || 'Usuário'}</h1>
                    </div>
                </Link>
                {/* Removed Logout Button from Home Header */}
            </header>

            {/* Navegador de Mês */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '8px' }}>
                <button onClick={prevMonth}><ChevronLeft size={24} color="var(--primary-color)" /></button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: 'var(--primary-color)', fontSize: '1.1rem' }}>{formattedMonthLabel}</span>
                </div>
                <button onClick={nextMonth}><ChevronRight size={24} color="var(--primary-color)" /></button>
            </div>

            {/* Card principal de saldo */}
            <section className="glass-panel" style={{ flexShrink: 0, padding: '24px', background: cardGradient, color: 'white', border: 'none', position: 'relative', overflow: 'hidden', transition: 'background 0.3s' }}>
                {/* Glow effect */}
                <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '200px', height: '200px', background: 'rgba(255,255,255,0.1)', filter: 'blur(30px)', borderRadius: '50%' }}></div>

                <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '8px' }}>Saldo Mensal</p>
                <h2 style={{ fontSize: 'clamp(1.8rem, 8vw, 2.5rem)', marginBottom: '24px', fontWeight: '700', letterSpacing: '-1px', wordBreak: 'break-word' }}>{formatCurrency(balance)}</h2>

                <div style={{ display: 'flex', gap: '24px', opacity: 0.9 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></div>
                            <p style={{ fontSize: '0.8rem', margin: 0 }}>Receitas</p>
                        </div>
                        <p style={{ fontWeight: '600', fontSize: '1.1rem', margin: 0 }}>{formatCurrency(incomes)}</p>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171' }}></div>
                            <p style={{ fontSize: '0.8rem', margin: 0 }}>Despesas</p>
                        </div>
                        <p style={{ fontWeight: '600', fontSize: '1.1rem', margin: 0 }}>{formatCurrency(expenses)}</p>
                    </div>
                </div>
            </section>

            {/* Removido botões manuais da Home a pedido do usuário */}
            {/* Atividades Recentes */}
            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>Movimentações</h3>
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '20px 0' }}>Carregando dados...</p>
                ) : transactions.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)' }}>Nenhuma movimentação neste mês.</p>
                    </div>
                ) : (
                    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                        {transactions.map((t, i) => {
                            const catTheme = getCategoryTheme(t.category, t.type);
                            const isLast = i === transactions.length - 1;
                            const isIncome = t.type === 'income';

                            // Ajusta a data exibida caso seja virtual (recorrente/parcelado)
                            const [y, m, d] = t.virtualDate.split('-');
                            const dateDisplay = `${d}/${m}`;

                            const displayName = t.dynamicDescription || t.description;

                            return (
                                <SwipeableItem key={t.id} onDelete={() => deleteTx(t.id)} onEdit={() => handleEditTx(t)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            {/* Badge redondinho colorido com a inicial da categoria */}
                                            <div style={{
                                                width: '42px', height: '42px', borderRadius: '50%',
                                                background: catTheme.color + '20', // Opacidade ~12%
                                                display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                color: catTheme.color, fontWeight: 'bold'
                                            }}>
                                                {catTheme.icon || catTheme.label.charAt(0)}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <p style={{ fontWeight: '500', color: 'var(--text-main)', fontSize: '0.95rem', margin: 0 }}>{displayName}</p>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{dateDisplay}</p>
                                                    <span style={{ fontSize: '0.7rem', backgroundColor: catTheme.color + '20', color: catTheme.color, padding: '2px 8px', borderRadius: '12px', fontWeight: '500' }}>{catTheme.label}</span>
                                                    {t.repeatType === 'recurring' && <span style={{ fontSize: '0.7rem', background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '12px', fontWeight: '500' }}>Recorrente</span>}
                                                    {t.repeatType === 'installment' && <span style={{ fontSize: '0.7rem', background: 'var(--danger-light)', color: 'var(--danger-color)', padding: '2px 8px', borderRadius: '12px', fontWeight: '500' }}>Parcela</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px', marginRight: 0 }}>
                                            <p style={{ fontWeight: '600', color: isIncome ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '0.95rem', margin: 0 }}>
                                                {isIncome ? '+' : '-'} {formatCurrency(t.amount)}
                                            </p>
                                        </div>
                                    </div>
                                </SwipeableItem>
                            );
                        })}
                    </div>
                )}
            </section>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingTx(null); }}
                defaultType={modalType}
                initialData={editingTx}
                onSuccess={refetch}
            />
        </div>
    );
};

export default Home;
