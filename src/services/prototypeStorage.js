/**
 * Serviço de armazenamento local isolado para o Modo Protótipo do Zimbroo.
 * Não interage com o Firebase Firestore nem com as chaves da aplicação principal ou Carteira.
 */

export const PROTOTYPE_STORAGE_VERSION = 1;
export const PROTOTYPE_STORAGE_PREFIX = 'zimbroo_prototipo_';
export const PROTOTYPE_STORAGE_KEYS = {
    META: `${PROTOTYPE_STORAGE_PREFIX}meta_v${PROTOTYPE_STORAGE_VERSION}`,
    ACTIVE: `${PROTOTYPE_STORAGE_PREFIX}active`,
    TRANSACTIONS: `${PROTOTYPE_STORAGE_PREFIX}transactions_v${PROTOTYPE_STORAGE_VERSION}`,
    LIMITS: `${PROTOTYPE_STORAGE_PREFIX}limits_v${PROTOTYPE_STORAGE_VERSION}`
};
const KEYS = PROTOTYPE_STORAGE_KEYS;

// Eventos customizados para atualização reativa em tempo real na mesma aba
export const PROTOTYPE_EVENTS = {
    TXS_CHANGED: 'zimbroo-prototype-txs-changed',
    LIMITS_CHANGED: 'zimbroo-prototype-limits-changed'
};

const notify = (eventName) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(eventName));
    }
};

const safeGetJson = (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (err) {
        console.error(`[PrototypeStorage] Erro ao ler chave ${key}:`, err);
        return fallback;
    }
};

const safeSetJson = (key, data) => {
    if (typeof window === 'undefined') return false;
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (err) {
        console.error(`[PrototypeStorage] Erro ao gravar chave ${key}:`, err);
        return false;
    }
};

export const prototypeStorage = {
    /**
     * Verifica se o protótipo está marcado como ativo
     */
    isActive() {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem(KEYS.ACTIVE) === 'true';
    },

    /**
     * Ativa o protótipo (após o clique em "Começar agora")
     */
    setActive(active = true) {
        if (typeof window === 'undefined') return;
        if (active) {
            localStorage.setItem(KEYS.ACTIVE, 'true');
            if (!localStorage.getItem(KEYS.META)) {
                safeSetJson(KEYS.META, {
                    version: PROTOTYPE_STORAGE_VERSION,
                    createdAt: new Date().toISOString()
                });
            }
        } else {
            localStorage.removeItem(KEYS.ACTIVE);
        }
    },

    /**
     * Busca todas as transações do protótipo
     */
    getTransactions() {
        const txs = safeGetJson(KEYS.TRANSACTIONS, []);
        if (!Array.isArray(txs)) return [];
        return txs;
    },

    /**
     * Salva uma nova transação no armazenamento do protótipo
     */
    addTransaction(data) {
        const currentList = this.getTransactions();
        const id = `proto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        const newTx = {
            id,
            userId: 'prototipo',
            amount: typeof data.amount === 'string' ? parseFloat(data.amount.replace(',', '.')) : Number(data.amount) || 0,
            type: data.type || 'expense',
            category: data.category,
            description: data.description || '',
            date: data.date || new Date().toISOString().split('T')[0],
            repeatType: data.repeatType || 'none',
            installments: Number(data.installments) || 1,
            currentInstallment: Number(data.currentInstallment) || 1,
            createdAt: new Date().toISOString()
        };

        const updated = [newTx, ...currentList];
        safeSetJson(KEYS.TRANSACTIONS, updated);
        notify(PROTOTYPE_EVENTS.TXS_CHANGED);
        return newTx;
    },

    /**
     * Atualiza uma transação existente no protótipo
     */
    updateTransaction(id, data) {
        const currentList = this.getTransactions();
        let updatedTx = null;

        const updated = currentList.map(tx => {
            if (tx.id === id) {
                updatedTx = {
                    ...tx,
                    ...data,
                    amount: data.amount !== undefined 
                        ? (typeof data.amount === 'string' ? parseFloat(data.amount.replace(',', '.')) : Number(data.amount)) 
                        : tx.amount,
                    updatedAt: new Date().toISOString()
                };
                return updatedTx;
            }
            return tx;
        });

        safeSetJson(KEYS.TRANSACTIONS, updated);
        notify(PROTOTYPE_EVENTS.TXS_CHANGED);
        return updatedTx;
    },

    /**
     * Exclui uma transação do protótipo ou registra mês excluído para recorrência
     */
    deleteTransaction(id, dateToSkip = null) {
        const currentList = this.getTransactions();
        let updated;

        if (dateToSkip) {
            updated = currentList.map(tx => {
                if (tx.id === id) {
                    const excludedMonths = tx.excludedMonths || [];
                    if (!excludedMonths.includes(dateToSkip)) {
                        return { ...tx, excludedMonths: [...excludedMonths, dateToSkip] };
                    }
                }
                return tx;
            });
        } else {
            updated = currentList.filter(tx => tx.id !== id);
        }

        safeSetJson(KEYS.TRANSACTIONS, updated);
        notify(PROTOTYPE_EVENTS.TXS_CHANGED);
    },

    /**
     * Busca os limites definidos no protótipo
     */
    getLimits(year) {
        const allLimits = safeGetJson(KEYS.LIMITS, {});
        const fieldName = year ? `limits_${year}` : 'limits';
        return allLimits[fieldName] || {};
    },

    /**
     * Salva novos limites no protótipo
     */
    saveLimits(newLimits, year) {
        const allLimits = safeGetJson(KEYS.LIMITS, {});
        const fieldName = year ? `limits_${year}` : 'limits';
        allLimits[fieldName] = newLimits;
        safeSetJson(KEYS.LIMITS, allLimits);
        notify(PROTOTYPE_EVENTS.LIMITS_CHANGED);
        return newLimits;
    },

    /**
     * Limpa completamente todos os dados do protótipo
     */
    clearAllPrototypeData() {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(KEYS.ACTIVE);
        localStorage.removeItem(KEYS.TRANSACTIONS);
        localStorage.removeItem(KEYS.LIMITS);
        localStorage.removeItem(KEYS.META);
        notify(PROTOTYPE_EVENTS.TXS_CHANGED);
        notify(PROTOTYPE_EVENTS.LIMITS_CHANGED);
    }
};
