import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
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
    isLoading = false,
    loadingMessage = null,
    loadingSubMessage = null,
    showIcon = true,
    showCancel = true,
    children = null,
    childrenPosition = 'bottom', // 'top' or 'bottom'
    layout = 'column', // 'column' or 'row'
    wide = false
}) => {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isInputFocused, setIsInputFocused] = useState(false);
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
                className={`confirm-content ${isAnimating ? 'slide-up' : 'slide-down'} ${wide ? 'wide' : ''}`}
                style={{ 
                    paddingBottom: keyboardHeight > 0 ? `${keyboardHeight + 20}px` : (layout === 'row' ? '32px' : '48px'),
                    transition: 'padding-bottom 0.1s ease-out'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: 'var(--btn-radius)', 
                            background: 'var(--surface-color)', 
                            border: '1px solid var(--glass-border)',
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

                {showIcon && (
                    <div className="confirm-icon-box">
                        {type === 'danger' ? <Trash2 size={32} color="#ef4444" /> : <AlertCircle size={32} color="var(--primary-color)" />}
                    </div>
                )}

                <h2 className="confirm-title">{title}</h2>
                
                {childrenPosition === 'top' && children && <div style={{ marginBottom: '24px', textAlign: 'left' }}>{children}</div>}

                <p className="confirm-message" style={{ 
                    marginBottom: (children && childrenPosition === 'bottom') ? '16px' : '32px',
                    fontSize: childrenPosition === 'top' ? '0.9rem' : '0.95rem',
                    fontWeight: childrenPosition === 'top' ? '600' : '400',
                    color: childrenPosition === 'top' ? 'var(--text-main)' : 'var(--text-muted)'
                }}>{message}</p>

                {childrenPosition === 'bottom' && children && <div style={{ marginBottom: '32px', textAlign: 'left' }}>{children}</div>}

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
                                width: '100%', padding: '14px', borderRadius: 'var(--btn-radius)',
                                border: '1px solid var(--glass-border)', background: 'var(--bg-color)',
                                color: 'var(--text-main)', textAlign: 'center', fontSize: '1rem',
                                fontWeight: '700', outline: 'none', transition: 'all 0.2s',
                                borderColor: confirmText === requireConfirm ? 'var(--danger-color)' : 'var(--glass-border)'
                            }}
                        />
                    </div>
                )}

                <div className={`confirm-actions ${layout === 'row' ? 'layout-row' : ''}`}>
                    {options.length > 0 ? (
                        options.map((opt, i) => (
                            <button
                                key={i}
                                className="confirm-btn"
                                disabled={requireConfirm && confirmText !== requireConfirm}
                                style={{ 
                                    background: opt.color || 'var(--primary-gradient)', 
                                    border: opt.border || 'none',
                                    color: 'white',
                                    opacity: (requireConfirm && confirmText !== requireConfirm) ? 0.5 : 1,
                                    flex: layout === 'row' ? 1 : 'none'
                                }}
                                onClick={() => {
                                    onConfirm(opt.value);
                                    if (!isLoading) onClose();
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
                                opacity: (requireConfirm && confirmText !== requireConfirm) ? 0.5 : 1,
                                flex: layout === 'row' ? (showCancel ? 2 : 1) : 'none'
                            }}
                            onClick={() => {
                                onConfirm();
                                if (!isLoading && !requireConfirm) onClose();
                            }}
                        >
                            {confirmLabel || "Confirmar"}
                        </button>
                    )}
                    
                    {showCancel && (
                        <button 
                            className={`confirm-btn confirm-btn-outline ${layout === 'row' ? 'outlined-only' : ''}`}
                            onClick={onClose}
                            disabled={isLoading}
                            style={{
                                flex: layout === 'row' ? 1 : 'none'
                            }}
                        >
                            {cancelLabel || "Cancelar"}
                        </button>
                    )}
                </div>

                {isLoading && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'var(--bg-color)',
                        borderRadius: 'inherit',
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '24px',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <LoadingDots />
                        <h3 style={{ marginTop: '24px', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>
                            {loadingMessage || t('processing', { defaultValue: 'Processando...' })}
                        </h3>
                        {loadingSubMessage && (
                            <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                {loadingSubMessage}
                            </p>
                        )}
                        <style>{`
                            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                        `}</style>
                    </div>
                )}
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
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
                    .confirm-content.wide {
                        max-width: 600px;
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
                .confirm-actions.layout-row {
                    flex-direction: row-reverse;
                    gap: 8px;
                }
                .confirm-btn {
                    width: 100%;
                    padding: 16px;
                    border-radius: var(--btn-radius);
                    font-weight: 700;
                    font-size: 1rem;
                    transition: all 0.2s;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
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
                .confirm-btn.outlined-only {
                    background: transparent;
                    border: 1px solid var(--danger-color);
                    color: var(--danger-color);
                }
            `}</style>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
