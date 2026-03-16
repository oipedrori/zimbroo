import React, { useState, useEffect } from 'react';
import LoadingDots from '../components/LoadingDots';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { Mic, TrendingUp, ShieldCheck, Sparkles, Globe, X, MessageSquare, Zap } from 'lucide-react';

const STORY_DURATION = 5000; // 5 segundos por story

const Onboarding = () => {
    const { loginWithGoogle } = useAuth();
    const { t, locale, changeLocale } = useI18n();
    const navigate = useNavigate();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState(null);
    const [currentStory, setCurrentStory] = useState(0);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showDocs, setShowDocs] = useState(null); // 'terms' or 'privacy'
    const [docContent, setDocContent] = useState('');
    const [loadingDoc, setLoadingDoc] = useState(false);

    useEffect(() => {
        if (showDocs) {
            setLoadingDoc(true);
            fetch(`/${showDocs}_${locale}.md`)
                .then(res => {
                    if (!res.ok) throw new Error('File not found');
                    return res.text();
                })
                .then(text => {
                    setDocContent(text);
                    setLoadingDoc(false);
                })
                .catch(err => {
                    console.error("Erro ao carregar documento:", err);
                    setDocContent("Erro ao carregar o conteúdo. Por favor, tente novamente mais tarde.");
                    setLoadingDoc(false);
                });
        }
    }, [showDocs, locale]);

    const stories = [
        {
            id: 0,
            icon: <img src="/Z.png" alt="Zimbroo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />,
            title: t('ob_welcome'),
            desc: t('ob_desc_1')
        },
        {
            id: 1,
            icon: <Mic size={54} color="white" />,
            title: t('ob_ai_title'),
            desc: t('ob_ai_desc')
        },
        {
            id: 2,
            icon: <MessageSquare size={54} color="white" />,
            title: t('ob_ask_title'),
            desc: t('ob_ask_desc')
        },
        {
            id: 3,
            icon: <Zap size={54} color="white" />,
            title: t('ob_fast_title'),
            desc: t('ob_fast_desc')
        }
    ];

    const handleLogin = async () => {
        if (!acceptedTerms) {
            alert(t('ob_accept_error', { defaultValue: 'Por favor, aceite os termos e a política para continuar.' }));
            return;
        }
        setIsLoggingIn(true);
        setLoginError(null);
        try {
            await loginWithGoogle();
            // Com signInWithPopup, a página não é recarregada.
            // O componente App.jsx cuidará de redirecionar para '/' assim que o AuthProvider atualizar o currentUser.
        } catch (error) {
            console.error("Falha ao fazer login:", error);
            const errorMsg = error.message || error.code || "Erro desconhecido";
            setIsLoggingIn(false);
            setLoginError(`Falha na autenticação: ${errorMsg}. \nSe for 'unauthorized domain', adicione o domínio do seu app no Firebase Console.`);
            alert(`Erro no Login: ${errorMsg}\n Verifique se o domínio está listado no Firebase Authentication.`);
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
            backgroundColor: 'var(--bg-color)',
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
                    color: 'white',
                    fontWeight: 'sans-serif',
                    padding: '24px',
                    textAlign: 'center',
                    zIndex: 2,
                    pointerEvents: 'none' // Clicks passam por cima pras bordas
                }}
            >
                {/* Fundo Limpo Voltou ao Original */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}></div>



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

                {/* Áreas Invisíveis de Toque (Laterais) - Movidas para dentro do container de story */}
                <div
                    style={{ position: 'absolute', top: 0, bottom: '150px', left: 0, width: '30%', zIndex: 1, cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); handleTouchLeft(); }}
                />
                <div
                    style={{ position: 'absolute', top: 0, bottom: '150px', right: 0, width: '70%', zIndex: 1, cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); handleTouchRight(); }}
                />
            </div>

            {/* Botão Base Fixado */}
            <div style={{
                position: 'relative',
                padding: '24px',
                zIndex: 10,
                background: 'transparent',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)'
            }}>
                {loginError && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '12px',
                        borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', textAlign: 'center',
                        backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        {loginError}
                    </div>
                )}

                {/* Termos e Consentimento */}
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    marginBottom: '24px', textAlign: 'left', padding: '0 4px',
                    position: 'relative', zIndex: 20 // Garante que esteja acima das áreas de toque
                }}>
                    <input
                        type="checkbox"
                        id="terms"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        style={{
                            width: '24px', height: '24px', marginTop: '2px', cursor: 'pointer',
                            accentColor: 'white', flexShrink: 0
                        }}
                    />
                    <div style={{ fontSize: '0.85rem', lineHeight: 1.4, opacity: 0.9 }}>
                        {t('ob_terms_prefix', { defaultValue: 'Eu li e aceito os ' })}
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDocs('terms'); }}
                            style={{
                                background: 'transparent', border: 'none', padding: 0,
                                textDecoration: 'underline', fontWeight: '700', cursor: 'pointer', color: 'white',
                                fontSize: 'inherit', display: 'inline'
                            }}
                        >
                            {t('ob_terms_label', { defaultValue: 'Termos de Uso' })}
                        </button>
                        {t('ob_terms_and', { defaultValue: ' e a ' })}
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDocs('privacy'); }}
                            style={{
                                background: 'transparent', border: 'none', padding: 0,
                                textDecoration: 'underline', fontWeight: '700', cursor: 'pointer', color: 'white',
                                fontSize: 'inherit', display: 'inline'
                            }}
                        >
                            {t('ob_privacy_label', { defaultValue: 'Política de Privacidade' })}
                        </button>.
                    </div>
                </div>

                <button
                    onClick={handleLogin}
                    disabled={isLoggingIn || !acceptedTerms}
                    style={{
                        width: '100%', padding: '18px', backgroundColor: 'white', color: 'var(--primary-color)',
                        borderRadius: 'var(--border-radius-lg)', fontSize: '1.1rem', fontWeight: '700',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.2)', transition: 'all 0.2s',
                        opacity: !acceptedTerms ? 0.6 : 1,
                        zIndex: 10
                    }}
                >
                    {isLoggingIn ? <LoadingDots style={{ color: 'white' }} /> : (
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

            {/* Modal para Termos e Privacidade */}
            {showDocs && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex',
                    flexDirection: 'column', padding: '24px', backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: '20px', color: 'white'
                    }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                            {showDocs === 'terms' ? t('ob_terms_label', { defaultValue: 'Termos de Uso' }) : t('ob_privacy_label', { defaultValue: 'Política de Privacidade' })}
                        </h3>
                        <button
                            onClick={() => setShowDocs(null)}
                            style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.2)', display: 'flex',
                                justifyContent: 'center', alignItems: 'center', color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div style={{
                        flex: 1, overflowY: 'auto', background: 'white', color: 'black',
                        padding: '24px', borderRadius: '24px', lineHeight: 1.6, fontSize: '0.95rem'
                    }}>
                        {loadingDoc ? (
                            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '40px' }}>
                                <LoadingDots />
                            </div>
                        ) : (
                            <div style={{ whiteSpace: 'pre-wrap' }}>
                                {docContent}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Language Selector Chip - Moved to end for stacking order */}
            {!showDocs && (
                <div style={{
                    position: 'absolute',
                    top: '50px', right: '16px',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    pointerEvents: 'auto'
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
            )}

            <style>{`
                .onboarding-bg {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(135deg, var(--primary-darker) 0%, var(--primary-darkest) 100%);
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
