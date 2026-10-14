import React from 'react';
import { Shield, Sparkles, ArrowRight, Database, CheckCircle2, Globe } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const PrototypeEntry = ({ onStart }) => {
    const { t, locale, changeLocale } = useI18n();

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

            {/* Language Selector Top Right */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'flex-end',
                width: '100%'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--surface-color)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    border: '1px solid var(--glass-border)'
                }}>
                    <Globe size={14} color="var(--text-main)" style={{ marginRight: '6px' }} />
                    <select
                        value={locale}
                        onChange={(e) => changeLocale(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="pt" style={{ color: 'var(--text-main)' }}>PT</option>
                        <option value="en" style={{ color: 'var(--text-main)' }}>EN</option>
                        <option value="es" style={{ color: 'var(--text-main)' }}>ES</option>
                    </select>
                </div>
            </div>

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
                    width: '88px',
                    height: '88px',
                    borderRadius: '28px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: '24px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
                }}>
                    <img src="/Z.png" alt="Zimbroo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
                </div>

                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    marginBottom: '16px'
                }}>
                    <span>Ambiente de Avaliação</span>
                </div>

                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: '800',
                    letterSpacing: '-0.5px',
                    margin: '0 0 12px 0',
                    color: 'var(--btn-text)'
                }}>
                    Zimbroo Protótipo
                </h1>

                <p style={{
                    fontSize: '0.98rem',
                    lineHeight: '1.5',
                    color: 'rgba(255, 255, 255, 0.85)',
                    margin: '0 0 28px 0',
                    maxWidth: '340px'
                }}>
                    Experimente o MVP do Zimbroo sem criar conta ou fazer login. Seus testes ficam salvos localmente neste navegador.
                </p>

                {/* Cards de destaque rápidos */}
                <div style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    textAlign: 'left'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.12)'
                    }}>
                        <Shield size={20} color="var(--btn-text)" />
                        <span style={{ fontSize: '0.88rem', fontWeight: '500' }}>
                            Sem login ou vínculo com conta Google
                        </span>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.12)'
                    }}>
                        <Database size={20} color="var(--btn-text)" />
                        <span style={{ fontSize: '0.88rem', fontWeight: '500' }}>
                            Persistência 100% local no dispositivo
                        </span>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.12)'
                    }}>
                        <CheckCircle2 size={20} color="var(--btn-text)" />
                        <span style={{ fontSize: '0.88rem', fontWeight: '500' }}>
                            Transações, limites e motor de parcelas
                        </span>
                    </div>
                </div>
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
                    onClick={onStart}
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
                        cursor: 'pointer',
                        border: 'none'
                    }}
                >
                    <span>Começar agora</span>
                    <ArrowRight size={20} />
                </button>

                <p style={{
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.7)',
                    margin: 0
                }}>
                    Ambiente isolado para testes e avaliação acadêmica
                </p>
            </div>
        </div>
    );
};

export default PrototypeEntry;
