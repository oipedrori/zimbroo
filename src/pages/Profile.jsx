import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { ChevronLeft, User, LogOut, Crown, Moon, Globe, DollarSign, Database, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const { currentUser, logout } = useAuth();
    const { t, locale, changeLocale, currency, changeCurrency } = useI18n();
    const navigate = useNavigate();

    // Mock settings
    const [isPremium, setIsPremium] = useState(false); // Default to free for demo

    // Theme logic
    const [theme, setTheme] = useState(localStorage.getItem('zimbroo_theme') || 'system');
    const [showEasterEgg, setShowEasterEgg] = useState(false);

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

    return (
        <div className="page-container animate-fade-in" style={{ paddingBottom: '110px' }}>
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', marginBottom: '20px' }}>
                <button onClick={() => navigate(-1)} style={{ padding: '8px', marginLeft: '-8px' }}>
                    <ChevronLeft size={24} color="var(--text-main)" />
                </button>
                <h1 style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: '600' }}>{t('profile')}</h1>
                <div style={{ width: '40px' }}></div>
            </header>

            {/* Profile Info */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-color)', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-color)', marginBottom: '16px', boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)' }}>
                    <User size={36} />
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    {currentUser?.displayName || 'Usuário Zimbroo'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>{currentUser?.email}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                    {/* Theme Toggle */}
                    <div style={{ minHeight: '56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-color)', padding: '0 20px', borderRadius: '20px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-darker)' }}>
                                <Moon size={18} />
                            </div>
                            <span style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-main)' }}>{t('theme')}</span>
                        </div>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            style={{ background: 'transparent', border: 'none', fontWeight: '700', color: 'var(--primary-color)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', textAlign: 'right', padding: '10px 0' }}
                        >
                            <option value="system">Auto</option>
                            <option value="light">Claro</option>
                            <option value="dark">Escuro</option>
                        </select>
                    </div>

                    {/* Language Selection Chips */}
                    <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '20px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-darker)' }}>
                                <Globe size={18} />
                            </div>
                            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>{t('language')}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {[
                                { id: 'pt', label: 'Português' },
                                { id: 'en', label: 'English' },
                                { id: 'es', label: 'Español' },
                                { id: 'fr', label: 'Français' }
                            ].map(lang => (
                                <button
                                    key={lang.id}
                                    onClick={() => changeLocale(lang.id)}
                                    style={{
                                        height: '48px',
                                        borderRadius: '14px',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        background: locale === lang.id ? 'var(--primary-color)' : 'var(--bg-color)',
                                        color: locale === lang.id ? 'white' : 'var(--text-main)',
                                        border: locale === lang.id ? 'none' : '1px solid var(--glass-border)',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Currency Selection Chips */}
                    <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '20px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--primary-darker)' }}>
                                <DollarSign size={18} />
                            </div>
                            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>{t('currency')}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {[
                                { id: 'BRL', label: 'R$ Real' },
                                { id: 'USD', label: '$ Dollar' },
                                { id: 'EUR', label: '€ Euro' },
                                { id: 'GBP', label: '£ Pound' }
                            ].map(curr => (
                                <button
                                    key={curr.id}
                                    onClick={() => changeCurrency(curr.id)}
                                    style={{
                                        height: '48px',
                                        borderRadius: '14px',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        background: currency === curr.id ? 'var(--primary-color)' : 'var(--bg-color)',
                                        color: currency === curr.id ? 'white' : 'var(--text-main)',
                                        border: currency === curr.id ? 'none' : '1px solid var(--glass-border)',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {curr.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Notion Import Button */}
                    <div
                        onClick={() => navigate('/notion-import')}
                        style={{
                            background: '#000', padding: '18px 20px', borderRadius: '24px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            color: 'white', cursor: 'pointer', boxShadow: '0 8px 15px rgba(0,0,0,0.1)',
                            width: '100%'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none' }}>
                                <img src="/notion_logo.png" style={{ width: '22px', height: '22px', objectFit: 'contain' }} alt="Notion" loading="eager" />
                            </div>
                            <span style={{ fontWeight: '600', fontSize: '1rem' }}>Sincronizar com Notion</span>
                        </div>
                        <ArrowRight size={20} opacity={0.6} />
                    </div>
                </div>
            </div>

            {/* Log out Menu Item (settings removed as requested) */}
            <section style={{ background: 'var(--surface-color)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginTop: '24px' }}>
                <div
                    onClick={logout}
                    style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--danger-color)' }}>
                            <LogOut size={20} />
                        </div>
                        <span style={{ fontWeight: '600', color: 'var(--danger-color)' }}>{t('logout')}</span>
                    </div>
                </div>
            </section>

            {/* Easter Egg / Version */}
            <div style={{ marginTop: '40px', paddingBottom: '40px', textAlign: 'center', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <p 
                    onClick={() => setShowEasterEgg(!showEasterEgg)}
                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s', zIndex: 1 }}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.5}
                >
                    Zimbroo v1.0
                </p>
                
                {showEasterEgg && (
                    <div 
                        onClick={() => setShowEasterEgg(false)}
                        style={{ 
                            position: 'absolute', 
                            bottom: '100%', 
                            marginBottom: '12px',
                            width: '280px',
                            background: 'var(--surface-color)', 
                            padding: '16px 20px', 
                            borderRadius: '24px', 
                            border: '1px solid var(--glass-border)', 
                            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            animation: 'bubblePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                            cursor: 'pointer',
                            zIndex: 10
                        }}
                    >
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontStyle: 'italic', lineHeight: '1.5', margin: 0 }}>
                            "Deitou-se e dormiu sob o zimbro. De repente um anjo o tocou e disse: 'Levante-se e coma'."
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: '700', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            — 1 Reis 19:5
                        </p>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes bubblePop {
                    0% { transform: scale(0.1) translateY(20px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Profile;
