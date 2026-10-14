import React from 'react';
import { usePrototype } from '../contexts/PrototypeContext';
import { PrototypeFinancialProvider } from '../contexts/PrototypeFinancialContext';
import PrototypeEntry from '../pages/PrototypeEntry';
import Layout from './Layout';

const PrototypeContainer = () => {
    const { isStarted, startPrototype } = usePrototype();

    if (!isStarted) {
        return <PrototypeEntry onStart={startPrototype} />;
    }

    return (
        <PrototypeFinancialProvider>
            <Layout />
        </PrototypeFinancialProvider>
    );
};

export default PrototypeContainer;
