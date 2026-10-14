import React from 'react';
import { usePrototype } from '../contexts/PrototypeContext';
import PrototypeEntry from '../pages/PrototypeEntry';
import Layout from './Layout';

const PrototypeContainer = () => {
    const { isStarted, startPrototype } = usePrototype();

    if (!isStarted) {
        return <PrototypeEntry onStart={startPrototype} />;
    }

    return <Layout />;
};

export default PrototypeContainer;
