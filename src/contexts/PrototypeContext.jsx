import React, { createContext, useContext, useState, useEffect } from 'react';
import { prototypeStorage } from '../services/prototypeStorage';

const PrototypeContext = createContext({
    isPrototype: false,
    isStarted: false,
    startPrototype: () => {},
    resetPrototype: () => {},
});

export const usePrototype = () => {
    const context = useContext(PrototypeContext);
    // Fallback seguro caso o hook seja invocado fora do Provider mas sob a URL /prototipo
    if (!context || !context.isPrototype) {
        const isPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/prototipo');
        if (isPath) {
            return {
                isPrototype: true,
                isStarted: prototypeStorage.isActive(),
                startPrototype: () => prototypeStorage.setActive(true),
                resetPrototype: () => prototypeStorage.clearAllPrototypeData(),
            };
        }
    }
    return context;
};

export const PrototypeProvider = ({ children }) => {
    const [isStarted, setIsStarted] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('start') === 'true') {
                prototypeStorage.setActive(true);
                return true;
            }
        }
        return prototypeStorage.isActive();
    });

    const startPrototype = () => {
        prototypeStorage.setActive(true);
        prototypeStorage.seedDefaultTransactionsIfEmpty();
        setIsStarted(true);
    };

    const resetPrototype = () => {
        prototypeStorage.clearAllPrototypeData();
        setIsStarted(false);
    };

    return (
        <PrototypeContext.Provider
            value={{
                isPrototype: true,
                isStarted,
                startPrototype,
                resetPrototype,
            }}
        >
            {children}
        </PrototypeContext.Provider>
    );
};
