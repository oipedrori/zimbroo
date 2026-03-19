import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { User, LogOut, Trash2, Moon, Globe, DollarSign, ArrowRight, RefreshCcw, X, Sparkles, Bell } from 'lucide-react';
import { requestNotificationPermission } from './NotificationHandler';
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
    const [showVerse, setShowVerse] = useState(false);
    const [verseHiding, setVerseHiding] = useState(false);

    const hideVerse = () => {
        setVerseHiding(true);
        setTimeout(() => { setShowVerse(false); setVerseHiding(false); }, 240);
    };

    // Auto-dismiss do balão do versículo após 5s
    useEffect(() => {
        if (showVerse) {
            const timer = setTimeout(hideVerse, 5000);
            return () => clearTimeout(timer);
        }
    }, [showVerse]);

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
            alert(t('success_reset_all'));
        } catch (error) {
            alert('Error');
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

    const [notificationsEnabled, setNotificationsEnabled] = useState(
        localStorage.getItem('zimbroo_notifications_enabled') === 'true' && Notification.permission === 'granted'
    );

    const handleToggleNotifications = async () => {
        haptic.medium();
        
        if (!notificationsEnabled) {
            const token = await requestNotificationPermission();
            if (token) {
                setNotificationsEnabled(true);
                localStorage.setItem('zimbroo_notifications_enabled', 'true');
            }
        } else {
            setNotificationsEnabled(false);
            localStorage.setItem('zimbroo_notifications_enabled', 'false');
        }
    };

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
            {/* Header with Close Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>{t('profile')}</h2>
                <button 
                    onClick={onClose}
                    style={{ 
                        width: '44px', height: '44px', borderRadius: '50%', 
                        background: 'var(--surface-color)', border: '1px solid var(--glass-border)',
                        color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                    }}
                >
                    <X size={24} />
                </button>
            </div>

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
                    width: '100%', background: 'var(--notion-btn-bg)', padding: '16px 20px', borderRadius: '20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    color: 'var(--notion-btn-text)', cursor: 'pointer', border: 'none', marginBottom: '32px',
                    boxShadow: '0 8px 15px rgba(0,0,0,0.1)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img src="/notion_logo.png" style={{ width: '18px', height: '18px' }} alt="" />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '1rem' }}>{t('import_hub')}</span>
                </div>
                <ArrowRight size={18} opacity={0.5} />
            </button>

            {/* Quick Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                <div style={{ background: 'var(--surface-color)', padding: '16px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', opacity: 0.6 }}>
                        <Moon size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px' }}>{t('theme_caps')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-color)', padding: '4px', borderRadius: '12px' }}>
                        {['system', 'light', 'dark'].map(themeOption => (
                            <button
                                key={themeOption}
                                onClick={() => setTheme(themeOption)}
                                style={{
                                    flex: 1, padding: '10px 8px', borderRadius: '12px', border: 'none', fontSize: '0.85rem', fontWeight: '700',
                                    background: theme === themeOption ? 'var(--primary-color)' : 'transparent',
                                    color: theme === themeOption ? 'white' : 'var(--text-muted)'
                                }}
                            >
                                {themeOption === 'system' ? t('theme_auto') : themeOption === 'light' ? t('theme_light') : t('theme_dark')}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'var(--surface-color)', padding: '16px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', opacity: 0.6 }}>
                        <Globe size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px' }}>{t('language_caps')}</span>
                    </div>
                    <select
                        value={locale}
                        onChange={(e) => changeLocale(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '12px', color: 'var(--text-main)', fontWeight: '600', fontSize: '0.85rem' }}
                    >
                        <option value="pt">Português</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                    </select>
                </div>

                <div style={{ background: 'var(--surface-color)', padding: '16px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', opacity: 0.6 }}>
                        <DollarSign size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px' }}>{t('currency_caps')}</span>
                    </div>
                    <select
                        value={currency}
                        onChange={(e) => changeCurrency(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '12px', color: 'var(--text-main)', fontWeight: '600', fontSize: '0.85rem' }}
                    >
                        <option value="BRL">Real (R$)</option>
                        <option value="USD">Dólar ($)</option>
                        <option value="EUR">Euro (€)</option>
                        <option value="GBP">Libra (£)</option>
                        <option value="MXN">Peso Mexicano ($)</option>
                        <option value="ARS">Peso Argentino ($)</option>
                        <option value="CLP">Peso Chileno ($)</option>
                        <option value="COP">Peso Colombiano ($)</option>
                        <option value="PEN">Sol Peruano (S/)</option>
                        <option value="UYU">Peso Uruguaio ($)</option>
                        <option value="CAD">Dólar Canadense ($)</option>
                        <option value="AUD">Dólar Australiano ($)</option>
                        <option value="AOA">Kwanza (Kz)</option>
                        <option value="MZN">Metical (MT)</option>
                        <option value="INR">Rupia (₹)</option>
                        <option value="JPY">Iene (¥)</option>
                    </select>
                </div>

                <div style={{ background: 'var(--surface-color)', padding: '16px', borderRadius: '20px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Bell size={18} style={{ opacity: 0.6 }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>NOTIFICAÇÕES</span>
                    </div>

                    <div 
                        onClick={handleToggleNotifications}
                        style={{
                            width: '56px',
                            height: '32px',
                            background: notificationsEnabled ? 'var(--primary-color)' : 'var(--bg-color)',
                            borderRadius: '10px', // Quadrado com cantos arredondados
                            border: '1px solid var(--glass-border)',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1)'
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '4px',
                            left: notificationsEnabled ? '28px' : '4px',
                            width: '22px',
                            height: '22px',
                            background: 'white',
                            borderRadius: '6px', // Mantendo o estilo quadrado arredondado
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1)'
                        }} />
                    </div>
                </div>
            </div>

            {/* Destructive Actions */}
            <div style={{ paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                    onClick={() => logout()}
                    style={{ 
                        width: '100%', padding: '16px', borderRadius: '16px', 
                        background: 'rgba(34, 197, 94, 0.1)', color: 'var(--primary-color)', 
                        border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: '700', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
                    }}
                >
                    <LogOut size={18} /> <span style={{ fontSize: '1rem' }}>{t('logout')}</span>
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
                    <RefreshCcw size={18} /> <span style={{ fontSize: '1rem' }}>{t('reset_data')}</span>
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
                    <Trash2 size={18} /> <span style={{ fontSize: '1rem' }}>{t('delete_account')}</span>
                </button>
            </div>

            {/* Overlays (Inline for Sheet) */}
            {(showResetConfirm || showDeleteConfirm) && (
                <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-color)', zIndex: 10, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                    {showResetConfirm && (
                        <>
                            <RefreshCcw size={48} color="#f59e0b" style={{ margin: '0 auto 20px' }} />
                            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '12px' }}>{t('reset_data_confirm_title')}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '32px' }}>{t('reset_data_confirm_desc')}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button onClick={handleResetData} style={{ height: '56px', borderRadius: '18px', background: '#f59e0b', color: 'white', fontWeight: '700', border: 'none' }}>{t('reset_data_confirm_btn')}</button>
                                <button onClick={() => setShowResetConfirm(false)} style={{ height: '56px', borderRadius: '18px', background: 'var(--surface-color)', color: 'var(--text-main)', border: 'none' }}>{t('cancel')}</button>
                            </div>
                        </>
                    )}
                    {showDeleteConfirm && (
                        <>
                            <Trash2 size={48} color="var(--danger-color)" style={{ margin: '0 auto 20px' }} />
                            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '12px' }}>{t('delete_account_confirm_title')}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>{t('delete_account_confirm_desc')}</p>
                            <input 
                                type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--danger-color)', background: 'var(--bg-color)', color: 'var(--text-main)', textAlign: 'center', fontWeight: '700', marginBottom: '20px', outline: 'none' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE'} style={{ height: '56px', borderRadius: '18px', background: deleteConfirmText === 'DELETE' ? 'var(--danger-color)' : 'var(--glass-border)', color: 'white', fontWeight: '700', border: 'none' }}>{t('delete_account_confirm_btn')}</button>
                                <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} style={{ height: '56px', borderRadius: '18px', background: 'var(--surface-color)', color: 'var(--text-main)', border: 'none' }}>{t('cancel')}</button>
                            </div>
                        </>
                    )}
                </div>
            )}
            
            {/* App Version, Easter Egg e Feito no Brasil */}
            <div style={{ marginTop: '32px', textAlign: 'center', paddingBottom: '20px', position: 'relative' }}>
                <style>{`
                    @keyframes bubbleIn { from { opacity:0; transform:translateX(-50%) translateY(10px) scale(0.9); } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }
                    @keyframes bubbleOut { from { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } to { opacity:0; transform:translateX(-50%) translateY(10px) scale(0.9); } }
                `}</style>

                {/* Balão do versículo */}
                {showVerse && (
                    <div
                        onClick={hideVerse}
                        style={{
                            position: 'absolute', bottom: '100%', left: '50%',
                            marginBottom: '12px',
                            background: 'var(--surface-color)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '20px',
                            padding: '16px 20px',
                            width: '280px',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                            cursor: 'pointer',
                            zIndex: 20,
                            animation: verseHiding
                                ? 'bubbleOut 0.24s ease forwards'
                                : 'bubbleIn 0.24s ease forwards',
                        }}
                    >
                        {/* Rabo do balão */}
                        <div style={{
                            position: 'absolute', bottom: '-8px', left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0, height: 0,
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderTop: '8px solid var(--glass-border)'
                        }} />
                        <Sparkles size={18} color="var(--primary-color)" style={{ marginBottom: '8px', opacity: 0.8 }} />
                        <p style={{ fontSize: '0.8rem', fontWeight: '500', lineHeight: 1.6, color: 'var(--text-main)', fontStyle: 'italic', margin: '0 0 8px' }}>
                            {t('easter_egg_verse')}
                        </p>
                        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary-color)', margin: 0 }}>{t('easter_egg_ref')}</p>
                    </div>
                )}

                <button
                    onClick={() => { if (showVerse) { hideVerse(); } else { setShowVerse(true); haptic.medium(); } }}
                    style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.5px', color: 'var(--text-muted)', border: 'none', background: 'none', cursor: 'pointer', opacity: 0.4 }}
                >
                    ZIMBROO v1.8.4
                </button>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.35, margin: '4px 0 0', letterSpacing: '0.3px' }}>{t('made_in_brazil')}</p>
            </div>
        </div>
    );
};

export default ProfileContent;
