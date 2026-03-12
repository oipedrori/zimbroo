import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Building2, Wallet as WalletIcon, CreditCard, TrendingUp } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const Wallet = () => {
    // Store accounts in local state/storage for MVP
    const [accounts, setAccounts] = useState(() => {
        const saved = localStorage.getItem('zimbroo_accounts');
        return saved ? JSON.parse(saved) : {};
    });

    const [isAdding, setIsAdding] = useState(false);
    const [accountName, setAccountName] = useState('');
    const [accountBalance, setAccountBalance] = useState('');
    const [accountType, setAccountType] = useState('bank'); // bank, cash, credit

    const { t, formatCurrency } = useI18n();

    useEffect(() => {
        localStorage.setItem('zimbroo_accounts', JSON.stringify(accounts));
    }, [accounts]);

    const handleAddAccount = (e) => {
        e.preventDefault();
        if (accountName && accountBalance !== '') {
            const id = Date.now().toString();
            setAccounts(prev => ({
                ...prev,
                [id]: {
                    name: accountName,
                    balance: parseFloat(accountBalance),
                    type: accountType
                }
            }));
            setIsAdding(false);
            setAccountName('');
            setAccountBalance('');
            setAccountType('bank');
        }
    };

    const handleRemoveAccount = (id) => {
        setAccounts(prev => {
            const newAccounts = { ...prev };
            delete newAccounts[id];
            return newAccounts;
        });
    };

    const totalWealth = Object.values(accounts).reduce((acc, curr) => acc + curr.balance, 0);

    const getIconForType = (type) => {
        switch (type) {
            case 'bank': return <Building2 size={24} />;
            case 'cash': return <WalletIcon size={24} />;
            case 'credit': return <CreditCard size={24} />;
            case 'investment': return <TrendingUp size={24} />;
            default: return <Building2 size={24} />;
        }
    };

    return (
        <div className="page-container animate-fade-in" style={{ paddingBottom: '110px' }}>
            <header style={{ paddingTop: '10px', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: '700' }}>{t('wallet_title')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{t('wallet_subtitle')}</p>
            </header>

            {/* Total Wealth Panel */}
            <section className="glass-panel" style={{ padding: '24px', background: 'var(--primary-darker)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden', marginBottom: '30px' }}>
                <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '200px', height: '200px', background: 'rgba(255,255,255,0.05)', filter: 'blur(30px)', borderRadius: '50%' }}></div>
                <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '8px' }}>{t('total_wealth')}</p>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-1px' }}>{formatCurrency(totalWealth)}</h2>
            </section>

            {/* Add New Account Form */}
            {!isAdding ? (
                <button
                    onClick={() => setIsAdding(true)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--surface-color)', border: '2px dashed var(--primary-color)', color: 'var(--primary-color)', fontWeight: '600', marginBottom: '24px', cursor: 'pointer' }}
                >
                    <Plus size={20} />
                    {t('add_new_account')}
                </button>
            ) : (
                <form onSubmit={handleAddAccount} className="glass-panel" style={{ padding: '20px', marginBottom: '24px', position: 'relative' }}>
                    <button type="button" onClick={() => setIsAdding(false)} style={{ position: 'absolute', top: '10px', right: '10px', color: 'var(--text-muted)', fontSize: '1.2rem' }}>&times;</button>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>{t('new_institution')}</h3>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('account_name')}</label>
                        <input
                            required
                            type="text"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            placeholder="Ex: Nubank, Dinheiro Físico"
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('current_balance')}</label>
                        <input
                            required
                            type="number"
                            step="0.01"
                            value={accountBalance}
                            onChange={(e) => setAccountBalance(e.target.value)}
                            placeholder="Ex: 1540.50"
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('account_type')}</label>
                        <select
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)' }}
                        >
                            <option value="bank">{t('bank_acc')}</option>
                            <option value="credit">{t('credit_card')}</option>
                            <option value="cash">{t('cash_acc')}</option>
                            <option value="investment">{t('investment_acc')}</option>
                        </select>
                    </div>

                    <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--primary-color)', color: 'var(--text-main)', fontWeight: 'bold' }}>
                        {t('add')}
                    </button>
                </form>
            )}

            {/* Accounts List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.keys(accounts).length === 0 && !isAdding && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <p>{t('no_accounts')}</p>
                    </div>
                )}

                {Object.entries(accounts).map(([id, val]) => (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: 'var(--surface-color)', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary-light)', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                {getIconForType(val.type)}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>{val.name}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                    {t(val.type)}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <span style={{ fontWeight: '700', color: val.balance >= 0 ? 'var(--primary-color)' : 'var(--danger-color)', fontSize: '1.1rem' }}>
                                {formatCurrency(val.balance)}
                            </span>
                            <button onClick={() => handleRemoveAccount(id)} style={{ color: 'var(--text-muted)', opacity: 0.6 }} aria-label="Remover">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Wallet;
