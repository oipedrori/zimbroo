import { useState, useEffect } from 'react';
import { X, Share, MoreVertical, PlusSquare } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const InstallPrompt = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [os, setOs] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const { t } = useI18n();

    useEffect(() => {
        // Verifica se já viu o prompt ou se já está rodando como app standalone (PWA instalado)
        const hasSeenPrompt = localStorage.getItem('zimbroo_install_prompt_seen');
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        if (hasSeenPrompt === 'true' || isStandalone) {
            return;
        }

        // Detectar o OS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(userAgent);
        const isAndroid = /android/.test(userAgent);

        if (isIOS) {
            setOs('ios');
            // Mostra o prompt com atraso de 1 segundo para mostrar rapidamente
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        } else if (isAndroid) {
            setOs('android');
            // No Android, tentamos interceptar o evento nativo de instalação
            window.addEventListener('beforeinstallprompt', (e) => {
                // Previne o mini-infobar padrão do chrome de aparecer
                e.preventDefault();
                // Guarda o evento para disparar quando o usuário clicar no botão
                setDeferredPrompt(e);
                setIsVisible(true);
            });

            // Fallback caso o evento não dispare (sem manifest, etc)
            const timer = setTimeout(() => setIsVisible(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('zimbroo_install_prompt_seen', 'true');
    };

    const handleInstallAndroid = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            }
            setDeferredPrompt(null);
        }
        handleDismiss();
    };

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: '360px',
            backgroundColor: 'var(--surface-color)',
            borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            border: '1px solid var(--glass-border)',
            padding: '16px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'slideUpBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                <button
                    onClick={handleDismiss}
                    className="glass-btn-close"
                    style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '50%', 
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

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    <img src="/favicon.png" alt="Zimbroo Icon" style={{ width: '28px', height: '28px' }} />
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{t('install_title')}</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3', marginTop: '2px' }}>
                        {t('install_desc')}
                    </p>
                </div>
            </div>

            {os === 'ios' ? (
                <div style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>1.</span> {t('install_ios_step1', { icon: <Share size={18} color="var(--primary-color)" /> })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>2.</span> {t('install_ios_step2', { icon: <PlusSquare size={18} color="var(--text-main)" /> })}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {deferredPrompt ? (
                        <button
                            onClick={handleInstallAndroid}
                            style={{ width: '100%', padding: '12px', background: 'var(--primary-color)', color: 'var(--btn-text)', borderRadius: '8px', fontWeight: '600' }}
                        >
                            {t('install_android_btn')}
                        </button>
                    ) : (
                        <div style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 'bold' }}>1.</span> {t('install_android_step1', { icon: <MoreVertical size={18} color="var(--primary-color)" /> })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 'bold' }}>2.</span> {t('install_android_step2')}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes slideUpBounce {
                    0% { transform: translate(-50%, 100%); opacity: 0; }
                    50% { transform: translate(-50%, -10%); opacity: 1; }
                    100% { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default InstallPrompt;
