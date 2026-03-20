import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, Trash2, X } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import LoadingDots from './LoadingDots';

const ConfirmDialog = ({ 
    isOpen, 
    onClose, 
    title, 
    message, 
    onConfirm, 
    type = 'danger',
    confirmLabel,
    cancelLabel,
    options = [], // [{ label, value, color }]
    requireConfirm = null, // string to match
    isLoading = false
}) => {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const inputRef = useRef(null);
    const { t } = useI18n();

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setConfirmText(''); // Reset when open
            setTimeout(() => {
                setIsAnimating(true);
                if (requireConfirm) {
                    inputRef.current?.focus();
                }
            }, 100);
        } else {
            setIsAnimating(false);
            const timeout = setTimeout(() => {
                setShouldRender(false);
            }, 300);
            return () => clearTimeout(timeout);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!window.visualViewport || !isInputFocused) {
            setKeyboardHeight(0);
            return;
        }

        const handleViewportChange = () => {
            const vv = window.visualViewport;
            const offset = window.innerHeight - vv.height;
            // Subtracting scroll position if the viewport was scrolled
            setKeyboardHeight(Math.max(0, offset));
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
        handleViewportChange();

        return () => {
            window.visualViewport.removeEventListener('resize', handleViewportChange);
            window.visualViewport.removeEventListener('scroll', handleViewportChange);
        };
    }, [isInputFocused]);

    if (!shouldRender && !isOpen) return null;

    return createPortal(
        <div 
            className={`confirm-overlay ${isAnimating ? 'visible' : ''}`}
            onClick={onClose}
        >
            <div 
                className={`confirm-content ${isAnimating ? 'slide-up' : 'slide-down'}`}
                style={{ 
                    paddingBottom: keyboardHeight > 0 ? `${keyboardHeight + 20}px` : '48px',
                    transition: 'padding-bottom 0.1s ease-out'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                    <button 
                        onClick={onClose} 
                        disabled={isLoading}
                        style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '12px', 
                            background: 'var(--surface-color)', 
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-main)', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: isLoading ? 0.5 : 1
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="confirm-icon-box">
                    {type === 'danger' ? <Trash2 size={32} color="#ef4444" /> : <AlertCircle size={32} color="var(--primary-color)" />}
                </div>

                <h2 className="confirm-title">{title}</h2>
                <p className="confirm-message">{message}</p>

                {requireConfirm && (
                    <div style={{ marginBottom: '24px' }}>
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder={t('type_to_confirm', { defaultValue: `Digite ${requireConfirm}` })}
                            value={confirmText}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            onChange={(e) => setConfirmText(e.target.value)}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '12px',
                                border: '1px solid var(--glass-border)', background: 'var(--bg-color)',
                                color: 'var(--text-main)', textAlign: 'center', fontSize: '1rem',
                                fontWeight: '700', outline: 'none', transition: 'all 0.2s',
                                borderColor: confirmText === requireConfirm ? 'var(--danger-color)' : 'var(--glass-border)'
                            }}
                        />
                    </div>
                )}

                <div className="confirm-actions">
                    {isLoading ? (
                        <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <LoadingDots />
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {t('processing', { defaultValue: 'Processando...' })}
                            </span>
                        </div>
                    ) : (
                        <>
                            {options.length > 0 ? (
                                options.map((opt, i) => (
                                    <button
                                        key={i}
                                        className="confirm-btn"
                                        disabled={requireConfirm && confirmText !== requireConfirm}
                                        style={{ 
                                            background: opt.color || 'var(--primary-gradient)', 
                                            color: 'white',
                                            opacity: (requireConfirm && confirmText !== requireConfirm) ? 0.5 : 1
                                        }}
                                        onClick={() => {
                                            onConfirm(opt.value);
                                            onClose();
                                        }}
                                    >
                                        <span style={{ color: opt.textColor || 'white' }}>{opt.label}</span>
                                    </button>
                                ))
                            ) : (
                                <button
                                    className="confirm-btn confirm-btn-primary"
                                    disabled={requireConfirm && confirmText !== requireConfirm}
                                    style={{ 
                                        opacity: (requireConfirm && confirmText !== requireConfirm) ? 0.5 : 1
                                    }}
                                    onClick={() => {
                                        onConfirm();
                                        // Parent usually handles closing if it's an async action or wants to show loading
                                    }}
                                >
                                    {confirmLabel || "Confirmar"}
                                </button>
                            )}
                            
                            <button 
                                className="confirm-btn confirm-btn-outline"
                                onClick={onClose}
                            >
                                {cancelLabel || "Cancelar"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .confirm-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0);
                    z-index: 20000;
                    display: flex;
                    align-items: flex-end; /* Bottom by default (mobile) */
                    justify-content: center;
                    padding: 0;
                    transition: all 0.3s ease;
                    touch-action: none;
                    backdrop-filter: blur(0px);
                    -webkit-backdrop-filter: blur(0px);
                }
                .confirm-overlay.visible {
                    background: rgba(27, 69, 32, 0.4);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }
                .confirm-content {
                    width: 100%;
                    max-width: none;
                    background: var(--bg-color);
                    border-radius: 32px 32px 0 0;
                    padding: 32px 24px;
                    text-align: center;
                    box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
                    transform: translateY(100%);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                }
                .confirm-content::before {
                    content: '';
                    position: absolute;
                    top: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 40px;
                    height: 4px;
                    background: var(--glass-border);
                    border-radius: 2px;
                }
                .confirm-content.slide-up {
                    transform: translateY(0);
                    opacity: 1;
                }
                .confirm-content.slide-down {
                    transform: translateY(100%);
                    opacity: 1;
                }

                @media (min-width: 1024px) {
                    .confirm-overlay {
                        align-items: center;
                        padding: 24px;
                    }
                    .confirm-content {
                        max-width: 380px;
                        border-radius: 28px;
                        transform: scale(0.9) translateY(20px);
                        opacity: 0;
                    }
                    .confirm-content::before {
                        display: none;
                    }
                    .confirm-content.slide-up {
                        transform: scale(1) translateY(0);
                        opacity: 1;
                    }
                    .confirm-content.slide-down {
                        transform: scale(0.9) translateY(20px);
                        opacity: 0;
                    }
                }

                .confirm-icon-box {
                    width: 64px;
                    height: 64px;
                    background: var(--surface-color);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    border: 1px solid var(--glass-border);
                }
                .confirm-title {
                    font-size: 1.25rem;
                    color: var(--text-main);
                    margin-bottom: 12px;
                    font-weight: 700;
                }
                .confirm-message {
                    font-size: 0.95rem;
                    color: var(--text-muted);
                    margin-bottom: 32px;
                    line-height: 1.5;
                }
                .confirm-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .confirm-btn {
                    width: 100%;
                    padding: 16px;
                    border-radius: 16px;
                    font-weight: 700;
                    font-size: 1rem;
                    transition: all 0.2s;
                    border: none;
                    cursor: pointer;
                }
                .confirm-btn:active {
                    transform: scale(0.98);
                }
                .confirm-btn-primary {
                    background: var(--primary-gradient);
                    color: white;
                    box-shadow: 0 8px 20px rgba(var(--primary-rgb), 0.2);
                }
                .confirm-btn-outline {
                    background: var(--surface-color);
                    color: var(--text-main);
                    border: 1px solid var(--glass-border);
                }
            `}</style>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
