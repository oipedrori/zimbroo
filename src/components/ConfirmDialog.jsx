import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

const ConfirmDialog = ({ 
    isOpen, 
    onClose, 
    title, 
    message, 
    onConfirm, 
    type = 'danger',
    confirmLabel,
    cancelLabel,
    options = [] // [{ label, value, color }]
}) => {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);
    const { t } = useI18n();

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setTimeout(() => setIsAnimating(true), 10);
        } else {
            setIsAnimating(false);
            const timeout = setTimeout(() => {
                setShouldRender(false);
            }, 300);
            return () => clearTimeout(timeout);
        }
    }, [isOpen]);

    if (!shouldRender && !isOpen) return null;

    return (
        <div 
            className={`confirm-overlay ${isAnimating ? 'visible' : ''}`}
            onClick={onClose}
        >
            <div 
                className={`confirm-content ${isAnimating ? 'slide-up' : 'slide-down'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="confirm-icon-box">
                    {type === 'danger' ? <Trash2 size={32} color="#ef4444" /> : <AlertCircle size={32} color="var(--primary-color)" />}
                </div>

                <h2 className="confirm-title">{title}</h2>
                <p className="confirm-message">{message}</p>

                <div className="confirm-actions">
                    {options.length > 0 ? (
                        options.map((opt, i) => (
                            <button
                                key={i}
                                className="confirm-btn"
                                style={{ background: opt.color || 'var(--primary-gradient)', color: 'white' }}
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
                            onClick={() => {
                                onConfirm();
                                onClose();
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
                </div>
            </div>

            <style>{`
                .confirm-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0);
                    z-index: 20000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    transition: background 0.3s ease;
                }
                .confirm-overlay.visible {
                    background: rgba(0,0,0,0.7);
                }
                .confirm-content {
                    width: 100%;
                    max-width: 340px;
                    background: var(--surface-color);
                    border-radius: 28px;
                    padding: 32px 24px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                    transform: scale(0.8) translateY(20px);
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .confirm-content.slide-up {
                    transform: scale(1) translateY(0);
                    opacity: 1;
                }
                .confirm-content.slide-down {
                    transform: scale(0.8) translateY(20px);
                    opacity: 0;
                }
                .confirm-icon-box {
                    width: 64px;
                    height: 64px;
                    background: var(--bg-color);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                }
                .confirm-title {
                    font-size: 1.25rem;
                    color: var(--text-main);
                    margin-bottom: 12px;
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
                    margin-bottom: 20px; /* Adiciona margem na base para evitar que fique colado no fundo no mobile */
                }
                .confirm-btn {
                    width: 100%;
                    padding: 16px;
                    border-radius: 16px;
                    font-weight: 700;
                    font-size: 1rem;
                    transition: transform 0.2s;
                }
                .confirm-btn:active {
                    transform: scale(0.98);
                }
                .confirm-btn-primary {
                    background: var(--primary-gradient);
                    color: white;
                }
                .confirm-btn-outline {
                    background: var(--bg-color);
                    color: var(--text-main);
                    border: 1px solid var(--glass-border);
                }
            `}</style>
        </div>
    );
};

export default ConfirmDialog;
