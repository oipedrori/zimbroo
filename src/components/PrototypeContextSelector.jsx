import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePrototypeFinancial } from '../contexts/PrototypeFinancialContext';
import { usePrototype } from '../contexts/PrototypeContext';
import { FINANCIAL_CONTEXTS } from '../services/prototypeStorage';
import { Info, Home as HomeIcon, Shield, Users, Layers, User, ChevronDown } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { haptic } from '../utils/haptic';

const PrototypeContextSelector = () => {
    const { isPrototype, resetPrototype } = usePrototype();
    const {
        financialContext,
        setFinancialContext,
        familySpaces,
        activeFamilySpace,
        setActiveFamilyId,
        hasFamilySpace
    } = usePrototypeFinancial();

    const location = useLocation();
    const navigate = useNavigate();

    const [showInfo, setShowInfo] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    if (!isPrototype) return null;

    const isHome = location.pathname === '/prototipo' || location.pathname === '/prototipo/';
    const isLimits = location.pathname.startsWith('/prototipo/limits');

    const handleSelectContext = (ctx) => {
        if (ctx === financialContext) return;
        haptic.light();
        setFinancialContext(ctx);
    };

    const handleSpaceChange = (e) => {
        const newSpaceId = e.target.value;
        haptic.light();
        setActiveFamilyId(newSpaceId);
    };

    return (
        <aside
            aria-label="Controles do modo protótipo"
            style={{
                width: '100%',
                padding: '12px 16px 14px 16px',
                background: 'var(--surface-color)',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 40,
                position: 'relative'
            }}
        >
            {/* Linha Superior: Badge de status do Protótipo + Abas de Navegação Início / Limites */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap'
            }}>
                {/* Badge do Protótipo */}
                <button
                    type="button"
                    onClick={() => {
                        haptic.light();
                        setShowInfo(true);
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(27, 69, 32, 0.08)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '20px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        color: 'var(--text-main)',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        letterSpacing: '0.2px'
                    }}
                    title="Informações do Protótipo Local"
                    aria-label="Informações sobre o modo protótipo"
                >
                    <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: 'var(--primary-color)',
                        display: 'inline-block'
                    }} />
                    <span>Protótipo Local</span>
                    <Info size={12} color="var(--primary-color)" />
                </button>

                {/* Navegação Interna: Início / Limites (permanecendo sempre sob /prototipo) */}
                <nav
                    aria-label="Navegação do protótipo"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'var(--bg-color)',
                        padding: '3px',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)'
                    }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            if (!isHome) {
                                haptic.light();
                                navigate('/prototipo');
                            }
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '9px',
                            border: 'none',
                            background: isHome ? 'var(--surface-color)' : 'transparent',
                            color: isHome ? 'var(--primary-color)' : 'var(--text-muted)',
                            fontWeight: isHome ? '700' : '500',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: isHome ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                        aria-current={isHome ? 'page' : undefined}
                    >
                        <HomeIcon size={13} />
                        <span>Início</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (!isLimits) {
                                haptic.light();
                                navigate('/prototipo/limits');
                            }
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '9px',
                            border: 'none',
                            background: isLimits ? 'var(--surface-color)' : 'transparent',
                            color: isLimits ? 'var(--primary-color)' : 'var(--text-muted)',
                            fontWeight: isLimits ? '700' : '500',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: isLimits ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                        aria-current={isLimits ? 'page' : undefined}
                    >
                        <Shield size={13} />
                        <span>Limites</span>
                    </button>
                </nav>
            </div>

            {/* Linha Principal: Seletor Segmentado de Contexto (Individual | Familiar | Ambos) */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
            }}>
                <div
                    role="tablist"
                    aria-label="Seletor de contexto financeiro"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '4px',
                        background: 'var(--bg-color)',
                        padding: '4px',
                        borderRadius: '14px',
                        border: '1px solid var(--glass-border)'
                    }}
                >
                    {/* Individual */}
                    <button
                        type="button"
                        role="tab"
                        id="tab-context-individual"
                        aria-selected={financialContext === FINANCIAL_CONTEXTS.INDIVIDUAL}
                        aria-controls="panel-context-content"
                        onClick={() => handleSelectContext(FINANCIAL_CONTEXTS.INDIVIDUAL)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 6px',
                            borderRadius: '10px',
                            border: 'none',
                            background: financialContext === FINANCIAL_CONTEXTS.INDIVIDUAL ? 'var(--primary-color)' : 'transparent',
                            color: financialContext === FINANCIAL_CONTEXTS.INDIVIDUAL ? 'var(--btn-text)' : 'var(--text-main)',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            minHeight: '38px',
                            boxShadow: financialContext === FINANCIAL_CONTEXTS.INDIVIDUAL ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <User size={14} />
                        <span>Individual</span>
                    </button>

                    {/* Familiar */}
                    <button
                        type="button"
                        role="tab"
                        id="tab-context-family"
                        aria-selected={financialContext === FINANCIAL_CONTEXTS.FAMILY}
                        aria-controls="panel-context-content"
                        onClick={() => handleSelectContext(FINANCIAL_CONTEXTS.FAMILY)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 6px',
                            borderRadius: '10px',
                            border: 'none',
                            background: financialContext === FINANCIAL_CONTEXTS.FAMILY ? 'var(--primary-color)' : 'transparent',
                            color: financialContext === FINANCIAL_CONTEXTS.FAMILY ? 'var(--btn-text)' : 'var(--text-main)',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            minHeight: '38px',
                            boxShadow: financialContext === FINANCIAL_CONTEXTS.FAMILY ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <Users size={14} />
                        <span>Familiar</span>
                    </button>

                    {/* Ambos */}
                    <button
                        type="button"
                        role="tab"
                        id="tab-context-both"
                        aria-selected={financialContext === FINANCIAL_CONTEXTS.BOTH}
                        aria-controls="panel-context-content"
                        onClick={() => handleSelectContext(FINANCIAL_CONTEXTS.BOTH)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 6px',
                            borderRadius: '10px',
                            border: 'none',
                            background: financialContext === FINANCIAL_CONTEXTS.BOTH ? 'var(--primary-color)' : 'transparent',
                            color: financialContext === FINANCIAL_CONTEXTS.BOTH ? 'var(--btn-text)' : 'var(--text-main)',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            minHeight: '38px',
                            boxShadow: financialContext === FINANCIAL_CONTEXTS.BOTH ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <Layers size={14} />
                        <span>Ambos</span>
                    </button>
                </div>

                {/* Sub-barra: Indicação e seletor de espaço familiar quando em Familiar ou Ambos */}
                {(financialContext === FINANCIAL_CONTEXTS.FAMILY || financialContext === FINANCIAL_CONTEXTS.BOTH) && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '4px 6px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)'
                    }}>
                        <span style={{ fontWeight: '600' }}>Espaço Familiar:</span>

                        {hasFamilySpace ? (
                            familySpaces.length > 1 ? (
                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                    <select
                                        aria-label="Selecionar espaço familiar ativo"
                                        value={activeFamilySpace?.id || ''}
                                        onChange={handleSpaceChange}
                                        style={{
                                            appearance: 'none',
                                            background: 'var(--bg-color)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px',
                                            padding: '4px 24px 4px 8px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            color: 'var(--text-main)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {familySpaces.map(space => (
                                            <option key={space.id} value={space.id}>
                                                {space.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} style={{ position: 'absolute', right: '6px', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                </div>
                            ) : (
                                <span style={{
                                    fontWeight: '700',
                                    color: 'var(--text-main)',
                                    background: 'var(--bg-color)',
                                    padding: '3px 8px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--glass-border)'
                                }}>
                                    {activeFamilySpace?.name || 'Família'}
                                </span>
                            )
                        ) : (
                            <span style={{
                                fontStyle: 'italic',
                                color: 'var(--text-muted)',
                                background: 'rgba(234, 179, 8, 0.1)',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(234, 179, 8, 0.2)'
                            }}>
                                Nenhum espaço configurado
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Modal com Informações detalhadas do Protótipo */}
            <ConfirmDialog
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
                title="Modo Protótipo do Zimbroo"
                message="Você está utilizando a versão acadêmica com armazenamento 100% local."
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
                        <span><strong>Contextos:</strong> Alterne entre Individual, Familiar e Ambos a qualquer momento sem recarregar.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>•</span>
                        <span><strong>Armazenamento local:</strong> todos os registros (individuais e familiares) ficam gravados apenas neste navegador.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>•</span>
                        <span><strong>Sem Firebase / Supabase:</strong> nenhuma chamada de nuvem é realizada nesta rota.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>•</span>
                        <span><strong>Proteção de escopo:</strong> gravações nos contextos Familiar e Ambos são bloqueadas até a Etapa 5 para proteger seus dados.</span>
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
                                padding: '6px 12px'
                            }}
                        >
                            Reiniciar dados do protótipo
                        </button>
                    </div>
                </div>
            </ConfirmDialog>

            {/* Confirmação de Reset */}
            <ConfirmDialog
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                title="Reiniciar Protótipo?"
                message="Isso apagará todas as transações, limites e espaços familiares locais e retornará à tela de entrada. Deseja continuar?"
                confirmLabel="Sim, reiniciar"
                cancelLabel="Cancelar"
                type="danger"
                onConfirm={() => {
                    haptic.medium();
                    resetPrototype();
                    setShowResetConfirm(false);
                }}
            />
        </aside>
    );
};

export default PrototypeContextSelector;
