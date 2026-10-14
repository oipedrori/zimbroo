import React, { useState } from 'react';
import { Info, Sparkles, RefreshCcw } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { usePrototype } from '../contexts/PrototypeContext';
import { haptic } from '../utils/haptic';

const PrototypeBadge = () => {
    const { isPrototype, resetPrototype } = usePrototype();
    const [showInfo, setShowInfo] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    if (!isPrototype) return null;

    return (
        <>
            <div
                onClick={() => {
                    haptic.light();
                    setShowInfo(true);
                }}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    margin: '0 auto 16px auto',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: 'rgba(27, 69, 32, 0.08)',
                    border: '1px solid var(--glass-border)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
                className="prototype-pill"
            >
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--primary-color)',
                    display: 'inline-block'
                }} />
                <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    letterSpacing: '0.2px'
                }}>
                    Modo Protótipo • Armazenamento Local
                </span>
                <Info size={13} color="var(--primary-color)" />
            </div>

            {/* Modal de Informações do Protótipo */}
            <ConfirmDialog
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
                title="Modo Protótipo do Zimbroo"
                message="Você está utilizando a versão de avaliação com armazenamento 100% local no seu navegador."
                showIcon={true}
                showCancel={false}
                confirmLabel="Entendi"
                onConfirm={() => setShowInfo(false)}
            >
                <div style={{
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '8px 0 16px 0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>•</span>
                        <span><strong>Sem conta necessária:</strong> não é preciso criar conta nem fazer login com o Google.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>•</span>
                        <span><strong>Armazenamento local:</strong> todos os registros ficam gravados exclusivamente neste navegador e dispositivo.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>•</span>
                        <span><strong>Sem sincronização em nuvem:</strong> os dados não são enviados nem sincronizados com contas do Zimbroo ou outros aparelhos.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>•</span>
                        <span><strong>Limpeza do navegador:</strong> limpar o cache ou os dados deste navegador apagará os registros do protótipo.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>•</span>
                        <span><strong>Uso de dados de teste:</strong> recomendamos cadastrar apenas dados fictícios para fins de avaliação e teste.</span>
                    </div>

                    <div style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--glass-border)',
                        display: 'flex',
                        justifyContent: 'center'
                    }}>
                        <button
                            type="button"
                            onClick={() => {
                                setShowInfo(false);
                                setTimeout(() => setShowResetConfirm(true), 150);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--danger-color)',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <RefreshCcw size={14} />
                            <span>Reiniciar dados do protótipo</span>
                        </button>
                    </div>
                </div>
            </ConfirmDialog>

            {/* Confirmação de Reset de Dados Locais do Protótipo */}
            <ConfirmDialog
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                title="Reiniciar Protótipo?"
                message="Isso apagará todas as transações e limites gravados localmente no protótipo e retornará à tela inicial de demonstração. Deseja continuar?"
                confirmLabel="Sim, reiniciar"
                cancelLabel="Cancelar"
                type="danger"
                onConfirm={() => {
                    haptic.medium();
                    resetPrototype();
                    setShowResetConfirm(false);
                }}
            />
        </>
    );
};

export default PrototypeBadge;
