import React from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { useInstall } from '../contexts/InstallContext';
import { useI18n } from '../contexts/I18nContext';

const InstallPrompt = () => {
    const { isIOS, showInstructions, setShowInstructions, isStandalone } = useInstall();
    const { t } = useI18n();

    if (!showInstructions || !isIOS || isStandalone) return null;

    return (
        <div 
            className="install-overlay"
            onClick={() => setShowInstructions(false)}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 20000,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                animation: 'fadeIn 0.3s ease-out'
            }}
        >
            <div 
                className="install-sheet"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '480px',
                    backgroundColor: 'var(--bg-color)',
                    borderTopLeftRadius: '32px',
                    borderTopRightRadius: '32px',
                    padding: '32px 24px 48px',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
                    position: 'relative',
                    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center'
                }}
            >
                {/* Drag Handle */}
                <div style={{
                    width: '40px',
                    height: '4px',
                    backgroundColor: 'var(--glass-border)',
                    borderRadius: '2px',
                    position: 'absolute',
                    top: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    opacity: 0.6
                }} />

                {/* Close Button */}
                <button 
                    onClick={() => setShowInstructions(false)}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--surface-color)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                >
                    <X size={18} />
                </button>

                {/* App Icon */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '20px',
                    backgroundColor: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                    boxShadow: '0 8px 24px rgba(var(--primary-rgb), 0.2)',
                    overflow: 'hidden'
                }}>
                    <img src="/favicon.png" alt="Icon" style={{ width: '50px', height: '50px' }} />
                </div>

                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
                    {t('install_title')}
                </h2>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '300px', lineHeight: 1.5 }}>
                    {t('install_desc')}
                </p>

                {/* Instructions Grid */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                    <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '16px', 
                        padding: '16px', background: 'var(--surface-color)', 
                        borderRadius: '16px', border: '1px solid var(--glass-border)',
                        textAlign: 'left'
                    }}>
                        <div style={{ 
                            width: '44px', height: '44px', borderRadius: '12px', 
                            background: 'rgba(0, 122, 255, 0.1)', color: '#007AFF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <Share size={22} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '500' }}>
                            1. {t('install_ios_step1_text', { defaultValue: 'Toque no ícone de Compartilhar no Safari' })}
                        </p>
                    </div>

                    <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '16px', 
                        padding: '16px', background: 'var(--surface-color)', 
                        borderRadius: '16px', border: '1px solid var(--glass-border)',
                        textAlign: 'left'
                    }}>
                        <div style={{ 
                            width: '44px', height: '44px', borderRadius: '12px', 
                            background: 'rgba(0, 0, 0, 0.05)', color: 'var(--text-main)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <PlusSquare size={22} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '500' }}>
                            2. {t('install_ios_step2_text', { defaultValue: 'Role para baixo e toque em "Adicionar à Tela de Início"' })}
                        </p>
                    </div>
                </div>

                <button 
                    onClick={() => setShowInstructions(false)}
                    style={{
                        width: '100%',
                        padding: '18px',
                        borderRadius: '16px',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '1rem',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(var(--primary-rgb), 0.3)'
                    }}
                >
                    Tudo pronto!
                </button>

                <style>{`
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                `}</style>
            </div>
        </div>
    );
};

export default InstallPrompt;
