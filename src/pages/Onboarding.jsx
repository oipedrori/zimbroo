import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { Mic, TrendingUp, ShieldCheck, Sparkles, Globe } from 'lucide-react';

const STORY_DURATION = 5000; // 5 segundos por story

const Onboarding = () => {
    const { loginWithGoogle } = useAuth();
    const { t, locale, changeLocale } = useI18n();
    const navigate = useNavigate();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [currentStory, setCurrentStory] = useState(0);

    const stories = [
        {
            id: 0,
            icon: <img src="/Z.png" alt="Zimbro" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />,
            title: t('ob_welcome'),
            desc: t('ob_desc_1')
        },
        {
            id: 1,
            icon: <Mic size={48} color="white" />,
            title: t('ob_ai_title'),
            desc: t('ob_ai_desc')
        },
        {
            id: 2,
            icon: <ShieldCheck size={48} color="white" />,
            title: t('ob_fast_title'),
            desc: t('ob_fast_desc')
        },
        {
            id: 3,
            icon: <Sparkles size={48} color="white" />,
            title: t('ob_ready'),
            desc: t('ob_start')
        }
    ];

    const handleLogin = async () => {
        setIsLoggingIn(true);
        try {
            await loginWithGoogle();
            // Com signInWithRedirect, a página será recarregada.
            // O componente App.jsx cuidará de redirecionar para '/' assim que detectar currentUser.
        } catch (error) {
            console.error("Falha ao fazer login", error);
            setIsLoggingIn(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentStory((prev) => (prev + 1) % stories.length); // Loop infinito
        }, STORY_DURATION);

        return () => clearTimeout(timer);
    }, [currentStory]);

    const handleTouchLeft = () => {
        setCurrentStory((prev) => (prev === 0 ? stories.length - 1 : prev - 1));
    };

    const handleTouchRight = () => {
        setCurrentStory((prev) => (prev + 1) % stories.length);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100dvh',
            backgroundColor: 'var(--primary-darkest)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background gradient animado usando a identidade visual */}
            <div className="onboarding-bg"></div>

            {/* Top Progress Bars (Estilo Stories) */}
            <div style={{
                position: 'absolute',
                top: '0', left: '0', right: '0',
                padding: '24px 16px 10px', // Mais padding no topo para celular
                display: 'flex',
                gap: '8px',
                zIndex: 10
            }}>
                {stories.map((story, idx) => {
                    let fillWidth = '0%';
                    let applyAnimation = false;

                    if (idx < currentStory) {
                        fillWidth = '100%';
                    } else if (idx === currentStory) {
                        applyAnimation = true;
                    }

                    return (
                        <div key={story.id} style={{
                            flex: 1,
                            height: '4px',
                            background: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: '2px',
                            overflow: 'hidden'
                        }}>
                            <div
                                className={applyAnimation ? 'progress-fill active' : 'progress-fill'}
                                style={{
                                    width: applyAnimation ? '0%' : fillWidth,
                                }}
                            ></div>
                        </div>
                    );
                })}
            </div>

            {/* Language Selector Chip */}
            <div style={{
                position: 'absolute',
                top: '50px', right: '16px',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '4px 12px',
                border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
                <Globe size={14} color="white" style={{ marginRight: '6px' }} />
                <select
                    value={locale}
                    onChange={(e) => changeLocale(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="pt" style={{ color: 'black' }}>PT</option>
                    <option value="en" style={{ color: 'black' }}>EN</option>
                    <option value="es" style={{ color: 'black' }}>ES</option>
                    <option value="fr" style={{ color: 'black' }}>FR</option>
                </select>
            </div>

            {/* Áreas Invisíveis de Toque (Laterais) */}
            <div style={{ position: 'absolute', top: 0, bottom: '100px', left: 0, width: '35%', zIndex: 5, cursor: 'pointer' }} onClick={handleTouchLeft} />
            <div style={{ position: 'absolute', top: 0, bottom: '100px', right: 0, width: '65%', zIndex: 5, cursor: 'pointer' }} onClick={handleTouchRight} />

            {/* Conteúdo Dinâmico do Story com Fade */}
            <div
                key={currentStory}
                className="story-content"
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '24px',
                    textAlign: 'center',
                    zIndex: 2,
                    pointerEvents: 'none' // Clicks passam por cima pras bordas
                }}
            >
                <div style={{
                    width: '120px', height: '120px', borderRadius: '40px', background: 'rgba(0,0,0,0.2)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '40px',
                    backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                }}>
                    {stories[currentStory].icon}
                </div>

                <h2 style={{ fontSize: '2.2rem', lineHeight: 1.1, marginBottom: '20px', fontWeight: '800', textShadow: '0 4px 15px rgba(0,0,0,0.3)', letterSpacing: '-0.5px' }}>
                    {stories[currentStory].title}
                </h2>
                <p style={{ fontSize: '1.2rem', opacity: 0.9, lineHeight: 1.5, maxWidth: '85%' }}>
                    {stories[currentStory].desc}
                </p>
            </div>

            {/* Botão Base Fixado */}
            <div style={{
                position: 'relative',
                padding: '24px',
                zIndex: 10,
                background: 'transparent',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)'
            }}>
                <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    style={{
                        width: '100%', padding: '18px', backgroundColor: 'white', color: 'var(--primary-color)',
                        borderRadius: 'var(--border-radius-lg)', fontSize: '1.1rem', fontWeight: '700',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s',
                        zIndex: 10
                    }}
                >
                    {isLoggingIn ? t('connecting', { defaultValue: 'Conectando...' }) : (
                        <>
                            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            {t('continue_google', { defaultValue: 'Continuar com Google' })}
                        </>
                    )}
                </button>
            </div>

            <style>{`
                .onboarding-bg {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
                    background-size: 200% 200%;
                    animation: gradientAnim 15s ease infinite;
                    z-index: 0;
                }
                @keyframes gradientAnim {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .progress-fill {
                    height: 100%;
                    background: white;
                }
                
                .progress-fill.active {
                    animation: fillProgress ${STORY_DURATION}ms linear forwards;
                }

                @keyframes fillProgress {
                    from { width: 0%; }
                    to { width: 100%; }
                }

                .story-content {
                    animation: fadeInScale 0.4s ease-out forwards;
                }

                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.95); filter: blur(4px); }
                    to { opacity: 1; transform: scale(1); filter: blur(0px); }
                }
            `}</style>
        </div>
    );
};

export default Onboarding;
