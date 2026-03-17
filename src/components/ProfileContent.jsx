import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { User, LogOut, Trash2, Moon, Globe, DollarSign, ArrowRight, RefreshCcw } from 'lucide-react';
import { deleteAllUserTransactions } from '../services/transactionService';
import { haptic } from '../utils/haptic';

const ProfileContent = ({ onOpenNotion, onClose }) => {
    const { currentUser, logout, deleteAccount } = useAuth();
    const { t, locale, changeLocale, currency, changeCurrency } = useI18n();

    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isResettingData, setIsResettingData] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [theme, setTheme] = useState(localStorage.getItem('zimbroo_theme') || 'system');

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('theme-dark');
            root.classList.remove('theme-light');
        } else if (theme === 'light') {
            root.classList.add('theme-light');
            root.classList.remove('theme-dark');
        } else {
            root.classList.remove('theme-dark', 'theme-light');
        }
        localStorage.setItem('zimbroo_theme', theme);
    }, [theme]);

    const handleResetData = async () => {
        setIsResettingData(true);
        try {
            await deleteAllUserTransactions(currentUser.uid);
            haptic.success();
            setShowResetConfirm(false);
            alert('Dados financeiros apagados.');
        } catch (error) {
            alert('Erro ao apagar dados.');
        } finally {
            setIsResettingData(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') return;
        setIsDeleting(true);
        try {
            await deleteAccount();
            haptic.success();
            onClose();
        } catch (error) {
            alert('Erro ao excluir conta.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
            {/* Profile Info Summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', background: 'var(--surface-color)', padding: '16px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--bg-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)', border: '1px solid var(--glass-border)' }}>
                    <User size={24} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>{currentUser?.displayName || 'Perfil'}</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email}</p>
                </div>
            </div>

            {/* Notion Trigger */}
            <button
                onClick={onOpenNotion}
                style={{
                    width: '100%', background: '#000', padding: '16px 20px', borderRadius: '20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    color: 'white', cursor: 'pointer', border: 'none', marginBottom: '24px',
                    boxShadow: '0 8px 15px rgba(0,0,0,0.1)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img src="/notion_logo.png" style={{ width: '18px', height: '18px' }} alt="" />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '1rem' }}>Importar Hub Financeiro</span>
                </div>
                <ArrowRight size={18} opacity={0.5} />
            </button>

            {/* Quick Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                <div style={{ background: 'var(--surface-color)', padding: '16px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', opacity: 0.6 }}>
                        <Moon size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px' }}>TEMA</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-color)', padding: '4px', borderRadius: '12px' }}>
                        {['system', 'light', 'dark'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTheme(t)}
                                style={{
                                    flex: 1, padding: '10px 8px', borderRadius: '12px', border: 'none', fontSize: '0.85rem', fontWeight: '700',
                                    background: theme === t ? 'var(--primary-color)' : 'transparent',
                                    color: theme === t ? 'white' : 'var(--text-muted)'
                                }}
                            >
                                {t === 'system' ? 'AUTO' : t === 'light' ? 'CLARO' : 'ESCURO'}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'var(--surface-color)', padding: '16px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', opacity: 0.6 }}>
                        <Globe size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px' }}>IDIOMA</span>
                    </div>
                    <select
                        value={locale}
                        onChange={(e) => changeLocale(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '12px', color: 'var(--text-main)', fontWeight: '600', fontSize: '0.85rem' }}
                    >
                        <option value="pt">Português</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                    </select>
                </div>
            </div>

            {/* Destructive Actions */}
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                    onClick={() => logout()}
                    style={{ 
                        width: '100%', padding: '16px', borderRadius: '16px', 
                        background: 'rgba(34, 197, 94, 0.1)', color: 'var(--primary-color)', 
                        border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: '700', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
                    }}
                >
                    <LogOut size={18} /> <span style={{ fontSize: '1rem' }}>Sair</span>
                </button>
                <button
                    onClick={() => setShowResetConfirm(true)}
                    style={{ 
                        width: '100%', padding: '16px', borderRadius: '16px', 
                        background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', 
                        border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: '700', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
                    }}
                >
                    <RefreshCcw size={18} /> <span style={{ fontSize: '1rem' }}>Resetar Dados</span>
                </button>
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{ 
                        width: '100%', padding: '16px', borderRadius: '16px', 
                        background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: '700', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
                    }}
                >
                    <Trash2 size={18} /> <span style={{ fontSize: '1rem' }}>Excluir Conta</span>
                </button>
            </div>

            {/* Overlays (Inline for Sheet) */}
            {(showResetConfirm || showDeleteConfirm) && (
                <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-color)', zIndex: 10, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                    {showResetConfirm && (
                        <>
                            <RefreshCcw size={48} color="#f59e0b" style={{ margin: '0 auto 20px' }} />
                            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '12px' }}>Apagar tudo?</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '32px' }}>Isso removerá todas as transações, mas manterá sua conta. Ação irreversível.</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button onClick={handleResetData} style={{ height: '56px', borderRadius: '18px', background: '#f59e0b', color: 'white', fontWeight: '700', border: 'none' }}>Sim, apagar tudo</button>
                                <button onClick={() => setShowResetConfirm(false)} style={{ height: '56px', borderRadius: '18px', background: 'var(--surface-color)', color: 'var(--text-main)', border: 'none' }}>Cancelar</button>
                            </div>
                        </>
                    )}
                    {showDeleteConfirm && (
                        <>
                            <Trash2 size={48} color="var(--danger-color)" style={{ margin: '0 auto 20px' }} />
                            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '12px' }}>Excluir Conta?</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>Digite <b>DELETE</b> para confirmar a exclusão permanente:</p>
                            <input 
                                type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--danger-color)', background: 'var(--bg-color)', color: 'var(--text-main)', textAlign: 'center', fontWeight: '700', marginBottom: '20px', outline: 'none' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE'} style={{ height: '56px', borderRadius: '18px', background: deleteConfirmText === 'DELETE' ? 'var(--danger-color)' : 'var(--glass-border)', color: 'white', fontWeight: '700', border: 'none' }}>Confirmar Exclusão</button>
                                <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} style={{ height: '56px', borderRadius: '18px', background: 'var(--surface-color)', color: 'var(--text-main)', border: 'none' }}>Cancelar</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProfileContent;
