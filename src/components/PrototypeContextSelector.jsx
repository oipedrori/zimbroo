import React from 'react';
import { usePrototypeFinancial } from '../contexts/PrototypeFinancialContext';
import { usePrototype } from '../contexts/PrototypeContext';
import { FINANCIAL_CONTEXTS } from '../services/prototypeStorage';
import { User, Users } from 'lucide-react';
import { haptic } from '../utils/haptic';

const PrototypeContextSelector = () => {
    const { isPrototype } = usePrototype();
    const {
        financialContext,
        setFinancialContext
    } = usePrototypeFinancial();

    if (!isPrototype) return null;

    const handleSelectContext = (ctx) => {
        if (ctx === financialContext) return;
        haptic.light();
        setFinancialContext(ctx);
    };

    const isIndividual = financialContext === FINANCIAL_CONTEXTS.INDIVIDUAL;
    const isFamily = financialContext === FINANCIAL_CONTEXTS.FAMILY;

    return (
        <div
            className="prototype-context-selector-container"
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px',
                marginBottom: '4px'
            }}
        >
            {/* Seletor Segmentado Individual / Familiar */}
            <div
                role="tablist"
                aria-label="Seletor de contexto financeiro"
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px',
                    background: 'var(--surface-color)',
                    padding: '3px',
                    borderRadius: '14px',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                {/* Individual */}
                <button
                    type="button"
                    role="tab"
                    id="tab-context-individual"
                    aria-selected={isIndividual}
                    aria-controls="panel-context-content"
                    onClick={() => handleSelectContext(FINANCIAL_CONTEXTS.INDIVIDUAL)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '11px',
                        border: 'none',
                        background: isIndividual ? 'var(--primary-color, #4BB45A)' : 'transparent',
                        color: isIndividual ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minHeight: '36px',
                        boxShadow: isIndividual ? '0 2px 8px rgba(75, 180, 90, 0.25)' : 'none'
                    }}
                >
                    <User size={15} />
                    <span>Individual</span>
                </button>

                {/* Familiar */}
                <button
                    type="button"
                    role="tab"
                    id="tab-context-family"
                    aria-selected={isFamily}
                    aria-controls="panel-context-content"
                    onClick={() => handleSelectContext(FINANCIAL_CONTEXTS.FAMILY)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '11px',
                        border: 'none',
                        background: isFamily ? 'var(--primary-darkest, #2D7D39)' : 'transparent',
                        color: isFamily ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minHeight: '36px',
                        boxShadow: isFamily ? '0 2px 8px rgba(45, 125, 57, 0.25)' : 'none'
                    }}
                >
                    <Users size={15} />
                    <span>Familiar</span>
                </button>
            </div>
        </div>
    );
};

export default PrototypeContextSelector;
