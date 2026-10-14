import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingDots from '../components/LoadingDots';

const PrototypeEntry = ({ onStart }) => {
    const { changeLocale } = useI18n();
    const { loginAnonymously } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        changeLocale('pt');
    }, [changeLocale]);

    const handleStart = async () => {
        setIsLoading(true);
        try {
            if (loginAnonymously) {
                await loginAnonymously();
            }
        } catch (error) {
            console.warn("Autenticação anônima no protótipo:", error);
        } finally {
            setIsLoading(false);
            onStart();
        }
    };

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '480px',
            margin: '0 auto',
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '40px 24px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            color: 'var(--btn-text)',
            boxShadow: 'var(--shadow-lg)'
        }}>
            {/* Background com o gradiente da marca */}
            <div className="onboarding-bg" style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(135deg, var(--primary-darker) 0%, var(--primary-darkest) 100%)',
                zIndex: 0
            }} />

            {/* Espaço superior para equilíbrio visual */}
            <div style={{ height: '24px' }} />

            {/* Conteúdo Central */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                marginTop: 'auto',
                marginBottom: 'auto'
            }}>
                <div style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '30px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: '28px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
                }}>
                    <img src="/Z.png" alt="Zimbroo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                </div>

                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: '16px'
                }}>
                    <span>PROTÓTIPO</span>
                </div>

                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: '800',
                    letterSpacing: '-0.5px',
                    margin: 0,
                    color: 'var(--btn-text)'
                }}>
                    Zimbroo
                </h1>
            </div>

            {/* Ação Inferior */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <button
                    onClick={handleStart}
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        padding: '18px',
                        backgroundColor: 'var(--surface-color)',
                        color: 'var(--text-main)',
                        borderRadius: 'var(--border-radius-lg)',
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        border: 'none',
                        opacity: isLoading ? 0.7 : 1
                    }}
                >
                    {isLoading ? <LoadingDots style={{ color: 'var(--text-main)' }} /> : (
                        <>
                            <span>Começar agora</span>
                            <ArrowRight size={20} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default PrototypeEntry;
