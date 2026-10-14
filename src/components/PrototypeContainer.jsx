import React from 'react';
import { usePrototype } from '../contexts/PrototypeContext';
import { PrototypeFinancialProvider, usePrototypeFinancial } from '../contexts/PrototypeFinancialContext';
import PrototypeEntry from '../pages/PrototypeEntry';
import Layout from './Layout';

const PrototypeThemedContent = () => {
    const { financialContext } = usePrototypeFinancial();
    return (
        <div
            data-prototype-context={financialContext}
            className={`prototype-context-wrapper prototype-context-${financialContext}`}
            style={{ width: '100%', minHeight: '100%' }}
        >
            <Layout />
        </div>
    );
};

const PrototypeContainer = () => {
    const { isStarted, startPrototype } = usePrototype();

    if (!isStarted) {
        return <PrototypeEntry onStart={startPrototype} />;
    }

    return (
        <PrototypeFinancialProvider>
            <PrototypeThemedContent />
        </PrototypeFinancialProvider>
    );
};

export default PrototypeContainer;
