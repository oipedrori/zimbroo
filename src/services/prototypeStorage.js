/**
 * Serviço de armazenamento local isolado para o Modo Protótipo do Zimbroo.
 * Não interage com o Firebase Firestore nem com as chaves da aplicação principal ou Carteira.
 * Etapa 3: Modelo de Dados Familiar 100% local com isolamento e validações.
 */

export const PROTOTYPE_STORAGE_VERSION = 1;
export const PROTOTYPE_STORAGE_PREFIX = 'zimbroo_prototipo_';

export const PROTOTYPE_STORAGE_KEYS = {
    META: `${PROTOTYPE_STORAGE_PREFIX}meta_v${PROTOTYPE_STORAGE_VERSION}`,
    ACTIVE: `${PROTOTYPE_STORAGE_PREFIX}active`,
    // Dados individuais (preservados)
    TRANSACTIONS: `${PROTOTYPE_STORAGE_PREFIX}transactions_v${PROTOTYPE_STORAGE_VERSION}`,
    LIMITS: `${PROTOTYPE_STORAGE_PREFIX}limits_v${PROTOTYPE_STORAGE_VERSION}`,
    // Etapa 3: Modelo Familiar (100% isolado, chaves próprias)
    FAMILY_SPACES: `${PROTOTYPE_STORAGE_PREFIX}family_spaces_v${PROTOTYPE_STORAGE_VERSION}`,
    FAMILY_MEMBERS: `${PROTOTYPE_STORAGE_PREFIX}family_members_v${PROTOTYPE_STORAGE_VERSION}`,
    FAMILY_TRANSACTIONS: `${PROTOTYPE_STORAGE_PREFIX}family_transactions_v${PROTOTYPE_STORAGE_VERSION}`,
    FAMILY_SETTINGS: `${PROTOTYPE_STORAGE_PREFIX}family_settings_v${PROTOTYPE_STORAGE_VERSION}`,
    ACTIVE_FAMILY_ID: `${PROTOTYPE_STORAGE_PREFIX}active_family_id`,
    // Etapa 4: Contexto Financeiro Ativo (Individual, Familiar, Ambos)
    ACTIVE_FINANCIAL_CONTEXT: `${PROTOTYPE_STORAGE_PREFIX}active_financial_context_v1`,
    // Etapa 5: Escolha de modelo no onboarding e convites simulados
    ONBOARDING_MODEL: `${PROTOTYPE_STORAGE_PREFIX}onboarding_model_v1`,
    FAMILY_INVITES: `${PROTOTYPE_STORAGE_PREFIX}family_invites_v1`,
    HAS_COMPLETED_TOUR: `${PROTOTYPE_STORAGE_PREFIX}has_completed_tour_v1`
};
const KEYS = PROTOTYPE_STORAGE_KEYS;

// Contextos financeiros do Protótipo (Etapa 4)
export const FINANCIAL_CONTEXTS = {
    INDIVIDUAL: 'individual',
    FAMILY: 'family',
    BOTH: 'both'
};

// Papéis e estados dos membros familiares
export const FAMILY_ROLES = {
    OWNER: 'owner',     // Responsável principal / criador
    ADMIN: 'admin',     // Responsável
    MEMBER: 'member'    // Integrante
};

export const MEMBER_STATUS = {
    ACTIVE: 'active',
    PENDING: 'pending',
    INACTIVE: 'inactive'
};

// Estados dos convites simulados (Etapa 5)
export const INVITE_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REVOKED: 'revoked'
};

// Eventos customizados para atualização reativa em tempo real na mesma aba
export const PROTOTYPE_EVENTS = {
    TXS_CHANGED: 'zimbroo-prototype-txs-changed',
    LIMITS_CHANGED: 'zimbroo-prototype-limits-changed',
    FAMILY_SPACES_CHANGED: 'zimbroo-prototype-family-spaces-changed',
    FAMILY_MEMBERS_CHANGED: 'zimbroo-prototype-family-members-changed',
    FAMILY_TXS_CHANGED: 'zimbroo-prototype-family-txs-changed',
    FAMILY_SETTINGS_CHANGED: 'zimbroo-prototype-family-settings-changed',
    FINANCIAL_CONTEXT_CHANGED: 'zimbroo-prototype-financial-context-changed',
    FAMILY_INVITES_CHANGED: 'zimbroo-prototype-family-invites-changed',
    ONBOARDING_MODEL_CHANGED: 'zimbroo-prototype-onboarding-model-changed'
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

// ==========================================
// Validações locais para integridade de dados
// ==========================================

const validateSpaceName = (name) => {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        throw new Error('Nome do espaço familiar é obrigatório (mínimo de 2 caracteres).');
    }
    return name.trim();
};

const validateMemberName = (name) => {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        throw new Error('Nome do membro familiar é obrigatório (mínimo de 2 caracteres).');
    }
    return name.trim();
};

const validateRole = (role) => {
    const validRoles = Object.values(FAMILY_ROLES);
    if (!validRoles.includes(role)) {
        throw new Error(`Papel inválido: "${role}". Valores válidos: ${validRoles.join(', ')}.`);
    }
    return role;
};

const validateStatus = (status) => {
    const validStatuses = Object.values(MEMBER_STATUS);
    if (!validStatuses.includes(status)) {
        throw new Error(`Status inválido: "${status}". Valores válidos: ${validStatuses.join(', ')}.`);
    }
    return status;
};

const validateAmount = (amount) => {
    const parsed = typeof amount === 'string' ? parseFloat(amount.replace(',', '.')) : Number(amount);
    if (isNaN(parsed) || parsed <= 0) {
        throw new Error('Valor da transação deve ser um número positivo maior que zero.');
    }
    return parsed;
};

const validateTransactionType = (type) => {
    if (type !== 'expense' && type !== 'income') {
        throw new Error('Tipo da transação deve ser "expense" ou "income".');
    }
    return type;
};

export const prototypeStorage = {
    // ==========================================
    // 1. Controle de Ciclo de Vida do Protótipo
    // ==========================================

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
     * Retorna o contexto financeiro ativo no protótipo ('individual', 'family').
     * O contexto 'both' fica reservado ao onboarding futuro e é normalizado para 'individual'.
     * Fallback seguro para 'individual' caso não haja preferência salva ou o valor seja inválido.
     */
    getActiveFinancialContext() {
        if (typeof window === 'undefined') return FINANCIAL_CONTEXTS.INDIVIDUAL;
        const saved = localStorage.getItem(KEYS.ACTIVE_FINANCIAL_CONTEXT);
        if (saved === FINANCIAL_CONTEXTS.BOTH || saved === 'both') {
            // Normalizar contexto visível para Individual sem apagar dados financeiros
            localStorage.setItem(KEYS.ACTIVE_FINANCIAL_CONTEXT, FINANCIAL_CONTEXTS.INDIVIDUAL);
            return FINANCIAL_CONTEXTS.INDIVIDUAL;
        }
        if (saved === FINANCIAL_CONTEXTS.INDIVIDUAL || saved === FINANCIAL_CONTEXTS.FAMILY) {
            return saved;
        }
        return FINANCIAL_CONTEXTS.INDIVIDUAL;
    },

    /**
     * Define o contexto financeiro ativo no protótipo ('individual', 'family').
     * Normaliza 'both' para 'individual' e emite evento reativo PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED.
     */
    setActiveFinancialContext(context) {
        if (typeof window === 'undefined') return;
        let target = context;
        if (target === FINANCIAL_CONTEXTS.BOTH || target === 'both') {
            target = FINANCIAL_CONTEXTS.INDIVIDUAL;
        }
        if (target !== FINANCIAL_CONTEXTS.INDIVIDUAL && target !== FINANCIAL_CONTEXTS.FAMILY) {
            throw new Error(`Contexto financeiro inválido: "${context}". Valores válidos: individual, family.`);
        }
        localStorage.setItem(KEYS.ACTIVE_FINANCIAL_CONTEXT, target);
        notify(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED);
    },

    /**
     * Retorna o modelo de organização escolhido no onboarding ('individual', 'family', 'both').
     */
    getOnboardingModel() {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(KEYS.ONBOARDING_MODEL) || null;
    },

    /**
     * Define o modelo de organização do onboarding ('individual', 'family', 'both').
     */
    setOnboardingModel(model) {
        if (typeof window === 'undefined') return;
        if (model) {
            localStorage.setItem(KEYS.ONBOARDING_MODEL, model);
        } else {
            localStorage.removeItem(KEYS.ONBOARDING_MODEL);
        }
        notify(PROTOTYPE_EVENTS.ONBOARDING_MODEL_CHANGED);
    },

    // ==========================================
    // 2. Dados Individuais (Preservados e Isolados)
    // ==========================================

    /**
     * Busca todas as transações individuais do protótipo
     */
    getTransactions() {
        const txs = safeGetJson(KEYS.TRANSACTIONS, []);
        if (!Array.isArray(txs)) return [];
        return txs;
    },

    /**
     * Salva uma nova transação individual no armazenamento do protótipo
     */
    addTransaction(data) {
        const currentList = this.getTransactions();
        const id = `proto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        const newTx = {
            id,
            userId: 'prototipo',
            scope: 'individual',
            amount: typeof data.amount === 'string' ? parseFloat(data.amount.replace(',', '.')) : Number(data.amount) || 0,
            type: data.type || 'expense',
            category: data.category,
            description: data.description || '',
            date: data.date || new Date().toISOString().split('T')[0],
            repeatType: data.repeatType || 'none',
            installments: Number(data.installments) || 1,
            currentInstallment: Number(data.currentInstallment) || 1,
            paymentMethod: data.paymentMethod || 'cash',
            totalAmount: data.totalAmount !== undefined ? data.totalAmount : null,
            originalTransactionId: data.originalTransactionId || null,
            obligationSettled: Boolean(data.obligationSettled),
            excludedMonths: Array.isArray(data.excludedMonths) ? data.excludedMonths : [],
            createdAt: new Date().toISOString()
        };

        const updated = [newTx, ...currentList];
        safeSetJson(KEYS.TRANSACTIONS, updated);
        notify(PROTOTYPE_EVENTS.TXS_CHANGED);
        return newTx;
    },

    /**
     * Atualiza uma transação individual existente no protótipo
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
                    paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : tx.paymentMethod,
                    totalAmount: data.totalAmount !== undefined ? data.totalAmount : tx.totalAmount,
                    originalTransactionId: data.originalTransactionId !== undefined ? data.originalTransactionId : tx.originalTransactionId,
                    obligationSettled: data.obligationSettled !== undefined ? Boolean(data.obligationSettled) : tx.obligationSettled,
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
     * Exclui uma transação individual do protótipo
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
     * Busca os limites individuais definidos no protótipo.
     * Prioriza os limites anuais se informados, aplicando fallback para limites gerais.
     */
    getLimits(year) {
        const allLimits = safeGetJson(KEYS.LIMITS, {});
        const generalLimits = allLimits.limits && typeof allLimits.limits === 'object' ? allLimits.limits : {};
        if (!year) return generalLimits;
        const yearLimits = allLimits[`limits_${year}`];
        if (!yearLimits || typeof yearLimits !== 'object') {
            return generalLimits;
        }
        return {
            ...generalLimits,
            ...yearLimits
        };
    },

    /**
     * Salva novos limites individuais no protótipo mantendo a independência anual vs geral.
     */
    saveLimits(newLimits, year) {
        const allLimits = safeGetJson(KEYS.LIMITS, {});
        const safeLimits = newLimits && typeof newLimits === 'object' ? newLimits : {};
        if (year) {
            allLimits[`limits_${year}`] = safeLimits;
        } else {
            allLimits.limits = safeLimits;
        }
        safeSetJson(KEYS.LIMITS, allLimits);
        notify(PROTOTYPE_EVENTS.LIMITS_CHANGED);
        return safeLimits;
    },

    // ==========================================
    // 3. Espaços Familiares (Family Spaces)
    // ==========================================

    /**
     * Busca todos os espaços familiares cadastrados no protótipo
     */
    getFamilySpaces() {
        const spaces = safeGetJson(KEYS.FAMILY_SPACES, []);
        if (!Array.isArray(spaces)) return [];
        return spaces;
    },

    /**
     * Busca um espaço familiar pelo seu ID
     */
    getFamilySpaceById(id) {
        if (!id) return null;
        const spaces = this.getFamilySpaces();
        return spaces.find(s => s.id === id) || null;
    },

    /**
     * Cria um novo espaço familiar no protótipo
     * @param {Object} params
     * @param {string} params.name - Nome do espaço familiar (ex: "Família Silva")
     * @param {string} params.createdBy - Identificador do criador
     * @param {string} [params.creatorName] - Nome opcional para cadastrar o criador como membro responsável inicial
     */
    createFamilySpace({ name, createdBy, creatorName = null }) {
        const validName = validateSpaceName(name);
        if (!createdBy || typeof createdBy !== 'string' || !createdBy.trim()) {
            throw new Error('Identificador do criador (createdBy) é obrigatório.');
        }

        const spaces = this.getFamilySpaces();
        const now = new Date().toISOString();
        const id = `fam-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const newSpace = {
            id,
            name: validName,
            createdBy: createdBy.trim(),
            createdAt: now,
            updatedAt: now
        };

        const updatedSpaces = [...spaces, newSpace];
        safeSetJson(KEYS.FAMILY_SPACES, updatedSpaces);

        // Se o nome do criador for informado, cadastra-o automaticamente como membro responsável (owner)
        if (creatorName) {
            this.addFamilyMember({
                familyId: id,
                name: creatorName,
                role: FAMILY_ROLES.OWNER,
                status: MEMBER_STATUS.ACTIVE
            });
        }

        // Inicializa configurações padrão para o novo espaço familiar
        const currentSettings = safeGetJson(KEYS.FAMILY_SETTINGS, {});
        currentSettings[id] = {
            familyId: id,
            currency: 'BRL',
            limits: {},
            allowMemberExpenseCreation: true,
            createdAt: now,
            updatedAt: now
        };
        safeSetJson(KEYS.FAMILY_SETTINGS, currentSettings);

        // Se nenhum espaço estiver ativo, define o recém-criado como ativo
        if (!this.getActiveFamilyId()) {
            this.setActiveFamilyId(id);
        }

        notify(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED);
        return newSpace;
    },

    /**
     * Atualiza as informações de um espaço familiar
     */
    updateFamilySpace(id, { name }) {
        if (!id) throw new Error('ID do espaço familiar é obrigatório.');
        const spaces = this.getFamilySpaces();
        const spaceIndex = spaces.findIndex(s => s.id === id);
        if (spaceIndex === -1) {
            throw new Error(`Espaço familiar com ID "${id}" não foi encontrado.`);
        }

        const validName = validateSpaceName(name);
        const updatedSpace = {
            ...spaces[spaceIndex],
            name: validName,
            updatedAt: new Date().toISOString()
        };

        spaces[spaceIndex] = updatedSpace;
        safeSetJson(KEYS.FAMILY_SPACES, spaces);
        notify(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED);
        return updatedSpace;
    },

    /**
     * Exclui um espaço familiar e remove em cascata seus membros, transações e configurações
     */
    deleteFamilySpace(id) {
        if (!id) throw new Error('ID do espaço familiar é obrigatório.');
        const spaces = this.getFamilySpaces();
        const filteredSpaces = spaces.filter(s => s.id !== id);

        if (spaces.length === filteredSpaces.length) {
            throw new Error(`Espaço familiar com ID "${id}" não foi encontrado para exclusão.`);
        }

        safeSetJson(KEYS.FAMILY_SPACES, filteredSpaces);

        // Remove membros associados
        const members = this.getFamilyMembers();
        const filteredMembers = members.filter(m => m.familyId !== id);
        safeSetJson(KEYS.FAMILY_MEMBERS, filteredMembers);

        // Remove transações associadas
        const txs = this.getFamilyTransactions();
        const filteredTxs = txs.filter(t => t.familyId !== id);
        safeSetJson(KEYS.FAMILY_TRANSACTIONS, filteredTxs);

        // Remove configurações associadas
        const settings = safeGetJson(KEYS.FAMILY_SETTINGS, {});
        delete settings[id];
        safeSetJson(KEYS.FAMILY_SETTINGS, settings);

        // Remove convites associados
        const invites = this.getFamilyInvites();
        const filteredInvites = invites.filter(i => i.familyId !== id);
        safeSetJson(KEYS.FAMILY_INVITES, filteredInvites);

        // Se for o espaço ativo, seleciona outro espaço restante se houver, ou remove a seleção
        const currentActiveId = localStorage.getItem(KEYS.ACTIVE_FAMILY_ID);
        if (currentActiveId === id) {
            if (filteredSpaces.length > 0) {
                localStorage.setItem(KEYS.ACTIVE_FAMILY_ID, filteredSpaces[0].id);
            } else {
                localStorage.removeItem(KEYS.ACTIVE_FAMILY_ID);
            }
        }

        notify(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_SETTINGS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_INVITES_CHANGED);
        return true;
    },

    /**
     * Retorna o ID do espaço familiar ativo na sessão local.
     * Garante consistência com os espaços existentes (seleciona o primeiro válido se o id for ausente ou inválido).
     */
    getActiveFamilyId() {
        if (typeof window === 'undefined') return null;
        const savedId = localStorage.getItem(KEYS.ACTIVE_FAMILY_ID);
        const spaces = this.getFamilySpaces();
        if (!Array.isArray(spaces) || spaces.length === 0) {
            if (savedId) localStorage.removeItem(KEYS.ACTIVE_FAMILY_ID);
            return null;
        }
        if (savedId && spaces.some(s => s.id === savedId)) {
            return savedId;
        }
        // Se o identificador estiver ausente ou inválido e existirem espaços, selecionar e persistir um espaço válido
        const fallbackId = spaces[0].id;
        localStorage.setItem(KEYS.ACTIVE_FAMILY_ID, fallbackId);
        return fallbackId;
    },

    /**
     * Define o espaço familiar ativo na sessão local
     */
    setActiveFamilyId(id) {
        if (typeof window === 'undefined') return;
        if (!id) {
            localStorage.removeItem(KEYS.ACTIVE_FAMILY_ID);
            notify(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED);
            return;
        }

        const space = this.getFamilySpaceById(id);
        if (!space) {
            throw new Error(`Não é possível ativar o espaço "${id}": espaço não encontrado.`);
        }

        localStorage.setItem(KEYS.ACTIVE_FAMILY_ID, id);
        notify(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED);
    },

    /**
     * Garante que haja um espaço familiar ativo configurado.
     * Se houver espaços existentes, ativa o primeiro caso nenhum esteja ativo.
     * Se nenhum existir, cria um espaço familiar inicial "Família" com criador "José".
     */
    ensureActiveFamilySpace() {
        if (typeof window === 'undefined') return null;
        const spaces = this.getFamilySpaces();
        if (spaces.length > 0) {
            return this.getActiveFamilyId();
        }
        const defaultSpace = this.createFamilySpace({
            name: 'Família',
            createdBy: 'prototipo',
            creatorName: 'José'
        });
        this.setActiveFamilyId(defaultSpace.id);
        return defaultSpace.id;
    },

    // ==========================================
    // 4. Membros Familiares (Family Members)
    // ==========================================

    /**
     * Busca todos os membros familiares, opcionalmente filtrados por espaço
     */
    getFamilyMembers(familyId = null) {
        const members = safeGetJson(KEYS.FAMILY_MEMBERS, []);
        if (!Array.isArray(members)) return [];
        if (familyId) {
            return members.filter(m => m.familyId === familyId);
        }
        return members;
    },

    /**
     * Busca um membro pelo seu ID
     */
    getFamilyMemberById(memberId) {
        if (!memberId) return null;
        const members = this.getFamilyMembers();
        return members.find(m => m.id === memberId) || null;
    },

    /**
     * Cadastra um novo membro em um espaço familiar com validações
     */
    addFamilyMember({ familyId, name, role = FAMILY_ROLES.MEMBER, status = MEMBER_STATUS.ACTIVE }) {
        if (!familyId) throw new Error('familyId é obrigatório para cadastrar um membro.');
        const space = this.getFamilySpaceById(familyId);
        if (!space) {
            throw new Error(`Espaço familiar "${familyId}" não encontrado.`);
        }

        const validName = validateMemberName(name);
        const validRole = validateRole(role);
        const validStatus = validateStatus(status);

        // Validação anti-duplicação: impede nomes duplicados no mesmo espaço familiar
        const existingMembers = this.getFamilyMembers(familyId);
        const isDuplicate = existingMembers.some(
            m => m.name.toLowerCase() === validName.toLowerCase()
        );
        if (isDuplicate) {
            throw new Error(`Já existe um membro com o nome "${validName}" neste espaço familiar.`);
        }

        const now = new Date().toISOString();
        const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const newMember = {
            id,
            familyId,
            name: validName,
            role: validRole,
            status: validStatus,
            joinedAt: now,
            updatedAt: now
        };

        const allMembers = this.getFamilyMembers();
        const updated = [...allMembers, newMember];
        safeSetJson(KEYS.FAMILY_MEMBERS, updated);
        notify(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED);
        return newMember;
    },

    /**
     * Atualiza os dados de um membro familiar
     */
    updateFamilyMember(memberId, data) {
        if (!memberId) throw new Error('ID do membro é obrigatório.');
        const allMembers = this.getFamilyMembers();
        const memberIndex = allMembers.findIndex(m => m.id === memberId);
        if (memberIndex === -1) {
            throw new Error(`Membro com ID "${memberId}" não foi encontrado.`);
        }

        const currentMember = allMembers[memberIndex];
        const updates = {};

        if (data.name !== undefined) {
            const validName = validateMemberName(data.name);
            // Verifica duplicidade com outros membros do mesmo espaço
            const isDuplicate = allMembers.some(
                m => m.familyId === currentMember.familyId && m.id !== memberId && m.name.toLowerCase() === validName.toLowerCase()
            );
            if (isDuplicate) {
                throw new Error(`Já existe outro membro com o nome "${validName}" neste espaço familiar.`);
            }
            updates.name = validName;
        }

        if (data.role !== undefined) {
            updates.role = validateRole(data.role);
        }

        if (data.status !== undefined) {
            updates.status = validateStatus(data.status);
        }

        const updatedMember = {
            ...currentMember,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        allMembers[memberIndex] = updatedMember;
        safeSetJson(KEYS.FAMILY_MEMBERS, allMembers);
        notify(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED);
        return updatedMember;
    },

    /**
     * Remove um membro de um espaço familiar.
     * - Se o membro tiver transações associadas, impede a remoção definitiva para preservar o histórico, orientando a desativação.
     * - Se não houver transações associadas, permite a remoção conforme as regras de consistência de papéis.
     */
    removeFamilyMember(memberId) {
        if (!memberId) throw new Error('ID do membro é obrigatório.');
        const allMembers = this.getFamilyMembers();
        const member = allMembers.find(m => m.id === memberId);
        if (!member) {
            throw new Error(`Membro com ID "${memberId}" não foi encontrado.`);
        }

        // Integridade referencial: Impede a remoção se houver transações vinculadas a este membro
        const memberTransactions = this.getFamilyTransactions(member.familyId)
            .filter(tx => tx.memberId === memberId);

        if (memberTransactions.length > 0) {
            throw new Error(
                `Não é possível remover definitivamente o membro "${member.name}" pois existem ${memberTransactions.length} transação(ões) associada(s) ao seu histórico. Para manter a integridade das transações e do histórico, desative o membro alterando seu status para 'inactive'.`
            );
        }

        // Validação de consistência: não permite remover o único responsável do espaço se houver outros integrantes
        if (member.role === FAMILY_ROLES.OWNER) {
            const familyMembers = allMembers.filter(m => m.familyId === member.familyId);
            const otherOwners = familyMembers.filter(m => m.id !== memberId && (m.role === FAMILY_ROLES.OWNER || m.role === FAMILY_ROLES.ADMIN));
            if (familyMembers.length > 1 && otherOwners.length === 0) {
                throw new Error('Não é possível remover o único responsável do espaço familiar enquanto houver outros membros. Promova outro membro antes.');
            }
        }

        const updated = allMembers.filter(m => m.id !== memberId);
        safeSetJson(KEYS.FAMILY_MEMBERS, updated);
        notify(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED);
        return true;
    },

    // ==========================================
    // 4.1 Convites Familiares Simulados (Etapa 5)
    // ==========================================

    /**
     * Busca convites de demonstração, opcionalmente filtrados por espaço familiar
     */
    getFamilyInvites(familyId = null) {
        const invites = safeGetJson(KEYS.FAMILY_INVITES, []);
        if (!Array.isArray(invites)) return [];
        if (familyId) {
            return invites.filter(i => i.familyId === familyId);
        }
        return invites;
    },

    /**
     * Busca um convite pelo seu ID
     */
    getFamilyInviteById(inviteId) {
        if (!inviteId) return null;
        const invites = this.getFamilyInvites();
        return invites.find(i => i.id === inviteId) || null;
    },

    /**
     * Cria um convite familiar simulado de demonstração para um parceiro.
     * Mantém o membro correspondente com status PENDING até aceitação simulada.
     */
    createFamilyInvite({ familyId, inviteeName, inviteeEmail, role = FAMILY_ROLES.MEMBER }) {
        if (!familyId) throw new Error('familyId é obrigatório para criar convite.');
        const space = this.getFamilySpaceById(familyId);
        if (!space) {
            throw new Error(`Espaço familiar "${familyId}" não encontrado.`);
        }

        const validName = validateMemberName(inviteeName);
        if (!inviteeEmail || typeof inviteeEmail !== 'string' || !inviteeEmail.includes('@')) {
            throw new Error('E-mail válido é obrigatório para identificação do convite.');
        }
        const cleanEmail = inviteeEmail.trim().toLowerCase();

        const allInvites = this.getFamilyInvites();
        // Evita duplicar convite pendente para o mesmo e-mail no mesmo espaço
        const existingPending = allInvites.find(
            inv => inv.familyId === familyId && inv.inviteeEmail === cleanEmail && inv.status === INVITE_STATUS.PENDING
        );
        if (existingPending) {
            return existingPending;
        }

        // Procura se já existe um membro com esse nome neste espaço
        const existingMembers = this.getFamilyMembers(familyId);
        let member = existingMembers.find(
            m => m.name.toLowerCase() === validName.toLowerCase()
        );

        // Se não existir, cadastra membro com status PENDING
        if (!member) {
            member = this.addFamilyMember({
                familyId,
                name: validName,
                role,
                status: MEMBER_STATUS.PENDING
            });
        }

        const now = new Date().toISOString();
        const inviteId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const newInvite = {
            id: inviteId,
            familyId,
            memberId: member.id,
            inviteeName: validName,
            inviteeEmail: cleanEmail,
            role,
            status: INVITE_STATUS.PENDING,
            createdAt: now,
            updatedAt: now
        };

        const updated = [...allInvites, newInvite];
        safeSetJson(KEYS.FAMILY_INVITES, updated);
        notify(PROTOTYPE_EVENTS.FAMILY_INVITES_CHANGED);
        return newInvite;
    },

    /**
     * Aceita um convite familiar simulado (ação explícita de demonstração).
     * Atualiza o estado do convite e ativa o membro associado de forma idempotente.
     */
    acceptFamilyInvite(inviteId) {
        if (!inviteId) throw new Error('ID do convite é obrigatório.');
        const allInvites = this.getFamilyInvites();
        const invIndex = allInvites.findIndex(i => i.id === inviteId);
        if (invIndex === -1) {
            throw new Error(`Convite com ID "${inviteId}" não foi encontrado.`);
        }

        const currentInvite = allInvites[invIndex];
        if (currentInvite.status === INVITE_STATUS.ACCEPTED) {
            // Idempotência: não duplica operações se o convite já foi aceito
            return currentInvite;
        }
        if (currentInvite.status === INVITE_STATUS.REVOKED) {
            throw new Error('Não é possível aceitar um convite que foi cancelado ou revogado.');
        }

        const now = new Date().toISOString();
        const updatedInvite = {
            ...currentInvite,
            status: INVITE_STATUS.ACCEPTED,
            acceptedAt: now,
            updatedAt: now
        };

        allInvites[invIndex] = updatedInvite;
        safeSetJson(KEYS.FAMILY_INVITES, allInvites);

        // Ativa o membro correspondente
        if (currentInvite.memberId) {
            try {
                this.updateFamilyMember(currentInvite.memberId, { status: MEMBER_STATUS.ACTIVE });
            } catch (err) {
                console.warn('[PrototypeStorage] Não foi possível ativar membro pelo ID:', err);
            }
        } else {
            // Fallback por nome
            const member = this.getFamilyMembers(currentInvite.familyId).find(
                m => m.name.toLowerCase() === currentInvite.inviteeName.toLowerCase()
            );
            if (member) {
                this.updateFamilyMember(member.id, { status: MEMBER_STATUS.ACTIVE });
            }
        }

        notify(PROTOTYPE_EVENTS.FAMILY_INVITES_CHANGED);
        return updatedInvite;
    },

    /**
     * Revoga ou cancela um convite pendente.
     */
    revokeFamilyInvite(inviteId) {
        if (!inviteId) throw new Error('ID do convite é obrigatório.');
        const allInvites = this.getFamilyInvites();
        const invIndex = allInvites.findIndex(i => i.id === inviteId);
        if (invIndex === -1) {
            throw new Error(`Convite com ID "${inviteId}" não foi encontrado.`);
        }

        const currentInvite = allInvites[invIndex];
        if (currentInvite.status === INVITE_STATUS.ACCEPTED) {
            throw new Error('Não é possível revogar um convite que já foi aceito.');
        }

        const now = new Date().toISOString();
        const updatedInvite = {
            ...currentInvite,
            status: INVITE_STATUS.REVOKED,
            revokedAt: now,
            updatedAt: now
        };

        allInvites[invIndex] = updatedInvite;
        safeSetJson(KEYS.FAMILY_INVITES, allInvites);

        // Trata o membro pendente: remove se sem histórico, ou desativa
        if (currentInvite.memberId) {
            try {
                const member = this.getFamilyMemberById(currentInvite.memberId);
                if (member && member.status === MEMBER_STATUS.PENDING) {
                    this.removeFamilyMember(currentInvite.memberId);
                }
            } catch {
                try {
                    this.updateFamilyMember(currentInvite.memberId, { status: MEMBER_STATUS.INACTIVE });
                } catch {
                    // Membro já inativo ou removido
                }
            }
        }

        notify(PROTOTYPE_EVENTS.FAMILY_INVITES_CHANGED);
        return updatedInvite;
    },

    // ==========================================
    // 5. Transações Familiares (Family Transactions)
    // ==========================================

    /**
     * Busca transações familiares, opcionalmente filtradas por espaço familiar
     */
    getFamilyTransactions(familyId = null) {
        const txs = safeGetJson(KEYS.FAMILY_TRANSACTIONS, []);
        if (!Array.isArray(txs)) return [];
        if (familyId) {
            return txs.filter(t => t.familyId === familyId);
        }
        return txs;
    },

    /**
     * Busca uma transação familiar por ID
     */
    getFamilyTransactionById(id) {
        if (!id) return null;
        const txs = this.getFamilyTransactions();
        return txs.find(t => t.id === id) || null;
    },

    /**
     * Adiciona uma transação vinculada a um espaço familiar e a um membro
     */
    addFamilyTransaction(data) {
        if (!data) throw new Error('Dados da transação são obrigatórios.');

        // Validação da associação ao espaço familiar
        if (!data.familyId) {
            throw new Error('familyId é obrigatório para registrar uma transação familiar.');
        }
        const space = this.getFamilySpaceById(data.familyId);
        if (!space) {
            throw new Error(`Espaço familiar "${data.familyId}" não encontrado.`);
        }

        // Validação da associação ao membro
        if (!data.memberId) {
            throw new Error('memberId é obrigatório para identificar quem realizou a transação familiar.');
        }
        const member = this.getFamilyMemberById(data.memberId);
        if (!member) {
            throw new Error(`Membro "${data.memberId}" não encontrado.`);
        }
        if (member.familyId !== data.familyId) {
            throw new Error(`Inconsistência de associação: o membro "${data.memberId}" pertence ao espaço "${member.familyId}", não a "${data.familyId}".`);
        }
        if (member.status === MEMBER_STATUS.INACTIVE) {
            throw new Error(`Não é possível registrar transação para o membro "${member.name}" pois ele está inativo.`);
        }

        // Validação dos dados financeiros
        const validAmount = validateAmount(data.amount);
        const validType = validateTransactionType(data.type || 'expense');
        if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
            throw new Error('Categoria da transação é obrigatória.');
        }

        const now = new Date().toISOString();
        const id = `ftx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const newFamilyTx = {
            id,
            familyId: data.familyId,
            memberId: data.memberId,
            scope: 'family',
            amount: validAmount,
            type: validType,
            category: data.category.trim(),
            description: data.description ? String(data.description).trim() : '',
            date: data.date || now.split('T')[0],
            repeatType: data.repeatType || 'none', // 'none' | 'recurring' | 'installment'
            installments: Number(data.installments) || 1,
            currentInstallment: Number(data.currentInstallment) || 1,
            paymentMethod: data.paymentMethod || 'cash',
            totalAmount: data.totalAmount !== undefined ? data.totalAmount : null,
            originalTransactionId: data.originalTransactionId || null,
            obligationSettled: Boolean(data.obligationSettled),
            excludedMonths: Array.isArray(data.excludedMonths) ? data.excludedMonths : [],
            createdAt: now,
            updatedAt: now
        };

        const currentList = this.getFamilyTransactions();
        const updated = [newFamilyTx, ...currentList];
        safeSetJson(KEYS.FAMILY_TRANSACTIONS, updated);
        notify(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED);
        return newFamilyTx;
    },

    /**
     * Atualiza uma transação familiar existente
     */
    updateFamilyTransaction(id, data) {
        if (!id) throw new Error('ID da transação é obrigatório.');
        const allTxs = this.getFamilyTransactions();
        const txIndex = allTxs.findIndex(t => t.id === id);
        if (txIndex === -1) {
            throw new Error(`Transação familiar com ID "${id}" não foi encontrada.`);
        }

        const currentTx = allTxs[txIndex];
        const updates = {};

        // Se alterou o membro, valida se pertence ao mesmo espaço
        if (data.memberId !== undefined) {
            const member = this.getFamilyMemberById(data.memberId);
            if (!member || member.familyId !== currentTx.familyId) {
                throw new Error(`O membro "${data.memberId}" não pertence ao espaço familiar da transação.`);
            }
            updates.memberId = data.memberId;
        }

        if (data.amount !== undefined) {
            updates.amount = validateAmount(data.amount);
        }

        if (data.type !== undefined) {
            updates.type = validateTransactionType(data.type);
        }

        if (data.category !== undefined) {
            if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
                throw new Error('Categoria da transação não pode ser vazia.');
            }
            updates.category = data.category.trim();
        }

        if (data.description !== undefined) {
            updates.description = String(data.description).trim();
        }

        if (data.date !== undefined) {
            updates.date = data.date;
        }

        if (data.paymentMethod !== undefined) {
            updates.paymentMethod = data.paymentMethod;
        }

        if (data.totalAmount !== undefined) {
            updates.totalAmount = data.totalAmount;
        }

        if (data.originalTransactionId !== undefined) {
            updates.originalTransactionId = data.originalTransactionId;
        }

        if (data.obligationSettled !== undefined) {
            updates.obligationSettled = Boolean(data.obligationSettled);
        }

        if (data.repeatType !== undefined) {
            updates.repeatType = data.repeatType;
        }

        if (data.installments !== undefined) {
            updates.installments = Number(data.installments) || 1;
        }

        if (data.currentInstallment !== undefined) {
            updates.currentInstallment = Number(data.currentInstallment) || 1;
        }

        if (data.excludedMonths !== undefined) {
            updates.excludedMonths = Array.isArray(data.excludedMonths) ? data.excludedMonths : [];
        }

        const updatedTx = {
            ...currentTx,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        allTxs[txIndex] = updatedTx;
        safeSetJson(KEYS.FAMILY_TRANSACTIONS, allTxs);
        notify(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED);
        return updatedTx;
    },

    /**
     * Exclui uma transação familiar ou registra mês excluído para recorrência
     */
    deleteFamilyTransaction(id, dateToSkip = null) {
        if (!id) throw new Error('ID da transação é obrigatório.');
        const allTxs = this.getFamilyTransactions();
        let updated;

        if (dateToSkip) {
            updated = allTxs.map(tx => {
                if (tx.id === id) {
                    const excludedMonths = tx.excludedMonths || [];
                    if (!excludedMonths.includes(dateToSkip)) {
                        return { ...tx, excludedMonths: [...excludedMonths, dateToSkip], updatedAt: new Date().toISOString() };
                    }
                }
                return tx;
            });
        } else {
            updated = allTxs.filter(tx => tx.id !== id);
        }

        safeSetJson(KEYS.FAMILY_TRANSACTIONS, updated);
        notify(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED);
        return true;
    },

    // ==========================================
    // 6. Configurações e Limites Familiares
    // ==========================================

    /**
     * Busca as configurações e limites de um espaço familiar
     */
    getFamilySettings(familyId) {
        if (!familyId) throw new Error('familyId é obrigatório para consultar configurações.');
        const allSettings = safeGetJson(KEYS.FAMILY_SETTINGS, {});
        if (allSettings[familyId]) {
            return allSettings[familyId];
        }

        // Retorna modelo padrão caso ainda não tenha sido customizado
        return {
            familyId,
            currency: 'BRL',
            limits: {},
            allowMemberExpenseCreation: true,
            updatedAt: new Date().toISOString()
        };
    },

    /**
     * Salva ou atualiza as configurações de um espaço familiar
     */
    saveFamilySettings(familyId, settings) {
        if (!familyId) throw new Error('familyId é obrigatório para salvar configurações.');
        const space = this.getFamilySpaceById(familyId);
        if (!space) {
            throw new Error(`Espaço familiar "${familyId}" não encontrado.`);
        }

        const allSettings = safeGetJson(KEYS.FAMILY_SETTINGS, {});
        const current = allSettings[familyId] || { familyId, currency: 'BRL', limits: {} };

        const updated = {
            ...current,
            ...settings,
            familyId,
            updatedAt: new Date().toISOString()
        };

        allSettings[familyId] = updated;
        safeSetJson(KEYS.FAMILY_SETTINGS, allSettings);
        notify(PROTOTYPE_EVENTS.FAMILY_SETTINGS_CHANGED);
        return updated;
    },

    /**
     * Busca os limites compartilhados de um espaço familiar.
     * - Se year não for informado, retorna os limites gerais (settings.limits).
     * - Se year for informado, prioriza os limites específicos de limits_YYYY e aplica
     *   o fallback geral (settings.limits) para categorias não especificadas naquele ano.
     */
    getFamilyLimits(familyId, year = null) {
        const settings = this.getFamilySettings(familyId);
        const generalLimits = settings.limits && typeof settings.limits === 'object' ? settings.limits : {};

        if (!year) {
            return generalLimits;
        }

        const fieldName = `limits_${year}`;
        const yearLimits = settings[fieldName];

        // Se não houver limites específicos definidos para o ano, aplica o fallback dos limites gerais
        if (!yearLimits || typeof yearLimits !== 'object') {
            return generalLimits;
        }

        // Prioriza os valores específicos do ano e aplica o fallback geral para categorias não definidas no ano
        return {
            ...generalLimits,
            ...yearLimits
        };
    },

    /**
     * Salva os limites compartilhados de um espaço familiar mantendo a independência:
     * - Se year for informado: armazena estritamente em limits_YYYY sem sobrescrever limits geral.
     * - Se year não for informado: armazena estritamente em limits geral sem sobrescrever limits_YYYY.
     */
    saveFamilyLimits(familyId, newLimits, year = null) {
        if (!familyId) throw new Error('familyId é obrigatório.');
        const space = this.getFamilySpaceById(familyId);
        if (!space) throw new Error(`Espaço familiar "${familyId}" não encontrado.`);

        const settings = this.getFamilySettings(familyId);
        const safeLimits = newLimits && typeof newLimits === 'object' ? newLimits : {};
        
        let updatedSettings;
        if (year) {
            const fieldName = `limits_${year}`;
            updatedSettings = {
                ...settings,
                [fieldName]: safeLimits
            };
        } else {
            updatedSettings = {
                ...settings,
                limits: safeLimits
            };
        }

        return this.saveFamilySettings(familyId, updatedSettings);
    },


    // ==========================================
    // 7. Limpeza e Isolamento
    // ==========================================

    /**
     * Limpa exclusivamente as estruturas de dados familiares no protótipo,
     * sem tocar nos dados individuais nem na Carteira (zimbroo_accounts).
     */
    clearFamilyDataOnly() {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(KEYS.FAMILY_SPACES);
        localStorage.removeItem(KEYS.FAMILY_MEMBERS);
        localStorage.removeItem(KEYS.FAMILY_TRANSACTIONS);
        localStorage.removeItem(KEYS.FAMILY_SETTINGS);
        localStorage.removeItem(KEYS.ACTIVE_FAMILY_ID);
        localStorage.removeItem(KEYS.FAMILY_INVITES);

        notify(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_SETTINGS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_INVITES_CHANGED);
    },

    /**
     * Limpa completamente todos os dados do protótipo (individuais e familiares).
     * Preserva expressamente a chave 'zimbroo_accounts' e os dados da aplicação principal.
     */
    clearAllPrototypeData() {
        if (typeof window === 'undefined') return;
        // Limpeza dos dados individuais
        localStorage.removeItem(KEYS.ACTIVE);
        localStorage.removeItem(KEYS.TRANSACTIONS);
        localStorage.removeItem(KEYS.LIMITS);
        localStorage.removeItem(KEYS.META);

        // Limpeza dos dados familiares
        localStorage.removeItem(KEYS.FAMILY_SPACES);
        localStorage.removeItem(KEYS.FAMILY_MEMBERS);
        localStorage.removeItem(KEYS.FAMILY_TRANSACTIONS);
        localStorage.removeItem(KEYS.FAMILY_SETTINGS);
        localStorage.removeItem(KEYS.ACTIVE_FAMILY_ID);
        localStorage.removeItem(KEYS.FAMILY_INVITES);
        // Limpeza dos dados de contexto e modelo de onboarding
        localStorage.removeItem(KEYS.ACTIVE_FINANCIAL_CONTEXT);
        localStorage.removeItem(KEYS.ONBOARDING_MODEL);
        localStorage.removeItem(KEYS.HAS_COMPLETED_TOUR);

        notify(PROTOTYPE_EVENTS.TXS_CHANGED);
        notify(PROTOTYPE_EVENTS.LIMITS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_SPACES_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_MEMBERS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_SETTINGS_CHANGED);
        notify(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED);
        notify(PROTOTYPE_EVENTS.FAMILY_INVITES_CHANGED);
        notify(PROTOTYPE_EVENTS.ONBOARDING_MODEL_CHANGED);
    },

    // ==========================================
    // 8. Carga Inicial de Demonstração (Seed Data)
    // ==========================================

    /**
     * Inicializa movimentações demonstrativas realistas (receitas em todos os meses,
     * despesas fixas recorrentes, despesas móveis variáveis e compras parceladas no cartão de crédito)
     * tanto no contexto Individual quanto no Familiar.
     * Não executa se já existirem transações gravadas, a menos que force = true.
     */
    seedDefaultTransactionsIfEmpty(targetFamilyId = null, force = false) {
        if (typeof window === 'undefined') return { individualCount: 0, familyCount: 0 };

        const currentYear = new Date().getFullYear() || 2026;
        const now = new Date().toISOString();
        let individualCount = 0;
        let familyCount = 0;

        // 1. Dados Demonstrativos Individuais
        const existingIndiv = safeGetJson(KEYS.TRANSACTIONS, []);
        if (force || !Array.isArray(existingIndiv) || existingIndiv.length === 0) {
            const indTxs = [];
            const genIndId = (prefix, idx) => `proto-seed-${prefix}-${idx}-${Math.random().toString(36).substring(2, 6)}`;

            // (A) Receitas Mensais
            // Salário recorrente dia 05 em todos os meses
            indTxs.push({
                id: genIndId('inc', 1),
                userId: 'prototipo',
                scope: 'individual',
                amount: 6800.00,
                type: 'income',
                category: 'salario',
                description: 'Salário Mensal',
                date: `${currentYear}-01-05`,
                repeatType: 'recurring',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'pix',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });

            // Receitas adicionais/variadas em meses específicos
            indTxs.push({
                id: genIndId('inc', 2),
                userId: 'prototipo',
                scope: 'individual',
                amount: 2400.00,
                type: 'income',
                category: 'freela',
                description: 'Projeto Freelance UX/UI',
                date: `${currentYear}-03-16`,
                repeatType: 'none',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'pix',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            indTxs.push({
                id: genIndId('inc', 3),
                userId: 'prototipo',
                scope: 'individual',
                amount: 1750.00,
                type: 'income',
                category: 'investimento',
                description: 'Restituição IRPF / Rendimentos',
                date: `${currentYear}-06-20`,
                repeatType: 'none',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'pix',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            indTxs.push({
                id: genIndId('inc', 4),
                userId: 'prototipo',
                scope: 'individual',
                amount: 3400.00,
                type: 'income',
                category: 'salario',
                description: '13º Salário (1ª Parcela)',
                date: `${currentYear}-11-28`,
                repeatType: 'none',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'pix',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            indTxs.push({
                id: genIndId('inc', 5),
                userId: 'prototipo',
                scope: 'individual',
                amount: 3400.00,
                type: 'income',
                category: 'salario',
                description: '13º Salário (2ª Parcela)',
                date: `${currentYear}-12-18`,
                repeatType: 'none',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'pix',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });

            // (B) Despesas Fixas (Recorrentes)
            indTxs.push({
                id: genIndId('fix', 1),
                userId: 'prototipo',
                scope: 'individual',
                amount: 1650.00,
                type: 'expense',
                category: 'moradia',
                description: 'Aluguel Studio & Condomínio',
                date: `${currentYear}-01-10`,
                repeatType: 'recurring',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'debit',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            indTxs.push({
                id: genIndId('fix', 2),
                userId: 'prototipo',
                scope: 'individual',
                amount: 149.90,
                type: 'expense',
                category: 'assinaturas',
                description: 'Internet Fibra 600 Mega',
                date: `${currentYear}-01-12`,
                repeatType: 'recurring',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'debit',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            indTxs.push({
                id: genIndId('fix', 3),
                userId: 'prototipo',
                scope: 'individual',
                amount: 129.90,
                type: 'expense',
                category: 'saude',
                description: 'Mensalidade Academia',
                date: `${currentYear}-01-08`,
                repeatType: 'recurring',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'debit',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            indTxs.push({
                id: genIndId('fix', 4),
                userId: 'prototipo',
                scope: 'individual',
                amount: 79.90,
                type: 'expense',
                category: 'comunicacao',
                description: 'Plano Celular 5G',
                date: `${currentYear}-01-15`,
                repeatType: 'recurring',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'debit',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            indTxs.push({
                id: genIndId('fix', 5),
                userId: 'prototipo',
                scope: 'individual',
                amount: 55.90,
                type: 'expense',
                category: 'assinaturas',
                description: 'Streaming & Música',
                date: `${currentYear}-01-20`,
                repeatType: 'recurring',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'credit',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });

            // (C) Despesas Parceladas (Cartão de Crédito)
            // Notebook Dell Inspiron 10x de 429,90 (Fev a Nov)
            indTxs.push({
                id: genIndId('inst', 1),
                userId: 'prototipo',
                scope: 'individual',
                amount: 429.90,
                totalAmount: 4299.00,
                type: 'expense',
                category: 'equipamentos',
                description: 'Notebook Dell Inspiron',
                date: `${currentYear}-02-14`,
                repeatType: 'installment',
                installments: 10,
                currentInstallment: 1,
                paymentMethod: 'credit',
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            // Smartphone 6x de 380,00 (Abr a Set)
            indTxs.push({
                id: genIndId('inst', 2),
                userId: 'prototipo',
                scope: 'individual',
                amount: 380.00,
                totalAmount: 2280.00,
                type: 'expense',
                category: 'comunicacao',
                description: 'Smartphone 5G',
                date: `${currentYear}-04-08`,
                repeatType: 'installment',
                installments: 6,
                currentInstallment: 1,
                paymentMethod: 'credit',
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });
            // Passagens Férias 4x de 1.450,00 (Jan a Abr)
            indTxs.push({
                id: genIndId('inst', 3),
                userId: 'prototipo',
                scope: 'individual',
                amount: 1450.00,
                totalAmount: 5800.00,
                type: 'expense',
                category: 'lazer',
                description: 'Passagens Aéreas Férias',
                date: `${currentYear}-01-15`,
                repeatType: 'installment',
                installments: 4,
                currentInstallment: 1,
                paymentMethod: 'credit',
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });

            // (D) Despesas Móveis / Variáveis (distribuídas nos 12 meses)
            // Em fevereiro, adicionamos IPVA e Seguro Anual que farão o mês ficar abaixo de zero
            indTxs.push({
                id: genIndId('var', 'feb-ipva'),
                userId: 'prototipo',
                scope: 'individual',
                amount: 4200.00,
                type: 'expense',
                category: 'impostos',
                description: 'IPVA Anual + Licenciamento',
                date: `${currentYear}-02-18`,
                repeatType: 'none',
                installments: 1,
                currentInstallment: 1,
                paymentMethod: 'pix',
                totalAmount: null,
                originalTransactionId: null,
                obligationSettled: false,
                excludedMonths: [],
                createdAt: now
            });

            // Gastos variáveis mensais para cada mês de 01 a 12
            const monthlyVariableData = [
                { m: '01', sup: 580, trans: 210, laz: 180, farm: 95 },
                { m: '02', sup: 540, trans: 195, laz: 220, farm: 60 },
                { m: '03', sup: 610, trans: 230, laz: 250, farm: 110 },
                { m: '04', sup: 590, trans: 220, laz: 190, farm: 85 },
                { m: '05', sup: 640, trans: 240, laz: 310, farm: 130 },
                { m: '06', sup: 570, trans: 185, laz: 210, farm: 75 },
                { m: '07', sup: 680, trans: 260, laz: 380, farm: 120 },
                { m: '08', sup: 595, trans: 215, laz: 200, farm: 90 },
                { m: '09', sup: 620, trans: 225, laz: 230, farm: 105 },
                { m: '10', sup: 605, trans: 240, laz: 260, farm: 80 },
                { m: '11', sup: 710, trans: 255, laz: 340, farm: 115 },
                { m: '12', sup: 890, trans: 280, laz: 520, farm: 140 },
            ];

            monthlyVariableData.forEach(({ m, sup, trans, laz, farm }) => {
                indTxs.push({
                    id: genIndId('var', `${m}-sup`),
                    userId: 'prototipo',
                    scope: 'individual',
                    amount: sup,
                    type: 'expense',
                    category: 'alimentacao',
                    description: 'Supermercado Mensal',
                    date: `${currentYear}-${m}-11`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'debit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now
                });
                indTxs.push({
                    id: genIndId('var', `${m}-trn`),
                    userId: 'prototipo',
                    scope: 'individual',
                    amount: trans,
                    type: 'expense',
                    category: 'transporte',
                    description: 'Combustível / Uber',
                    date: `${currentYear}-${m}-17`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now
                });
                indTxs.push({
                    id: genIndId('var', `${m}-laz`),
                    userId: 'prototipo',
                    scope: 'individual',
                    amount: laz,
                    type: 'expense',
                    category: 'lazer',
                    description: 'Restaurante / Fim de Semana',
                    date: `${currentYear}-${m}-22`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'credit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now
                });
                indTxs.push({
                    id: genIndId('var', `${m}-frm`),
                    userId: 'prototipo',
                    scope: 'individual',
                    amount: farm,
                    type: 'expense',
                    category: 'saude',
                    description: 'Farmácia & Higiene',
                    date: `${currentYear}-${m}-26`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'debit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now
                });
            });

            safeSetJson(KEYS.TRANSACTIONS, indTxs);
            individualCount = indTxs.length;
            notify(PROTOTYPE_EVENTS.TXS_CHANGED);
        }

        // 2. Dados Demonstrativos Familiares
        const existingFam = safeGetJson(KEYS.FAMILY_TRANSACTIONS, []);
        if (force || !Array.isArray(existingFam) || existingFam.length === 0) {
            let familyId = targetFamilyId || this.getActiveFamilyId();
            if (!familyId) {
                familyId = this.ensureActiveFamilySpace();
            }

            if (familyId) {
                // Garantir membros José e Mariana
                const members = this.getFamilyMembers(familyId);
                let jose = members.find(m => m.name.toLowerCase().includes('josé') || m.name.toLowerCase().includes('jose'));
                if (!jose && members.length > 0) {
                    jose = members[0];
                }
                if (!jose) {
                    jose = this.addFamilyMember({
                        familyId,
                        name: 'José',
                        role: FAMILY_ROLES.OWNER,
                        status: MEMBER_STATUS.ACTIVE
                    });
                }

                let mariana = members.find(m => m.name.toLowerCase().includes('mariana'));
                if (!mariana) {
                    const invites = this.getFamilyInvites(familyId);
                    const marianaInvite = invites.find(i => i.inviteeName.toLowerCase().includes('mariana'));
                    if (marianaInvite) {
                        try {
                            this.acceptFamilyInvite(marianaInvite.id);
                        } catch {
                            // Ignora erro se já aceito
                        }
                        mariana = this.getFamilyMembers(familyId).find(m => m.name.toLowerCase().includes('mariana'));
                    }
                    if (!mariana) {
                        mariana = this.addFamilyMember({
                            familyId,
                            name: 'Mariana',
                            role: FAMILY_ROLES.MEMBER,
                            status: MEMBER_STATUS.ACTIVE
                        });
                    }
                }

                const joseId = jose.id;
                const marianaId = mariana.id;
                const famTxs = [];
                const genFamId = (prefix, idx) => `ftx-seed-${prefix}-${idx}-${Math.random().toString(36).substring(2, 6)}`;

                // (A) Receitas Mensais Familiares
                // Salário José recorrente
                famTxs.push({
                    id: genFamId('inc', 'jose'),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 8400.00,
                    type: 'income',
                    category: 'salario',
                    description: 'Salário Mensal José',
                    date: `${currentYear}-01-05`,
                    repeatType: 'recurring',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                // Salário Mariana recorrente
                famTxs.push({
                    id: genFamId('inc', 'mari'),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 6800.00,
                    type: 'income',
                    category: 'salario',
                    description: 'Salário Mensal Mariana',
                    date: `${currentYear}-01-05`,
                    repeatType: 'recurring',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                // Entradas pontuais adicionais
                famTxs.push({
                    id: genFamId('inc', 'bonus-mari'),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 3200.00,
                    type: 'income',
                    category: 'salario',
                    description: 'Bônus Semestral Mariana',
                    date: `${currentYear}-04-15`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('inc', 'rend-jose'),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 1950.00,
                    type: 'income',
                    category: 'investimento',
                    description: 'Rendimentos de Aplicações',
                    date: `${currentYear}-07-20`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('inc', '13-jose'),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 4200.00,
                    type: 'income',
                    category: 'salario',
                    description: '13º Salário José (1ª Parcela)',
                    date: `${currentYear}-11-28`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('inc', '13-mari'),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 3400.00,
                    type: 'income',
                    category: 'salario',
                    description: '13º Salário Mariana (1ª Parcela)',
                    date: `${currentYear}-11-28`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('inc', '13-2-jose'),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 4200.00,
                    type: 'income',
                    category: 'salario',
                    description: '13º Salário José (2ª Parcela)',
                    date: `${currentYear}-12-18`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('inc', '13-2-mari'),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 3400.00,
                    type: 'income',
                    category: 'salario',
                    description: '13º Salário Mariana (2ª Parcela)',
                    date: `${currentYear}-12-18`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });

                // (B) Despesas Fixas Familiares (Recorrentes)
                famTxs.push({
                    id: genFamId('fix', 1),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 3400.00,
                    type: 'expense',
                    category: 'moradia',
                    description: 'Aluguel Casa & Condomínio',
                    date: `${currentYear}-01-10`,
                    repeatType: 'recurring',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'debit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('fix', 2),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 1650.00,
                    type: 'expense',
                    category: 'educacao',
                    description: 'Escola das Crianças',
                    date: `${currentYear}-01-08`,
                    repeatType: 'recurring',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'debit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('fix', 3),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 480.00,
                    type: 'expense',
                    category: 'moradia',
                    description: 'Energia Elétrica & Água',
                    date: `${currentYear}-01-12`,
                    repeatType: 'recurring',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'debit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('fix', 4),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 230.00,
                    type: 'expense',
                    category: 'assinaturas',
                    description: 'Internet Fibra 1Gb + TV',
                    date: `${currentYear}-01-15`,
                    repeatType: 'recurring',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'debit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('fix', 5),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 980.00,
                    type: 'expense',
                    category: 'saude',
                    description: 'Plano de Saúde Familiar',
                    date: `${currentYear}-01-20`,
                    repeatType: 'recurring',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'debit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('fix', 6),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 290.00,
                    type: 'expense',
                    category: 'seguro',
                    description: 'Seguro Automóvel Família',
                    date: `${currentYear}-01-25`,
                    repeatType: 'recurring',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'debit',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });

                // (C) Despesas Parceladas Familiares (Cartão de Crédito)
                famTxs.push({
                    id: genFamId('inst', 1),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 680.00,
                    totalAmount: 6800.00,
                    type: 'expense',
                    category: 'moradia',
                    description: 'Reforma da Cozinha Planejada',
                    date: `${currentYear}-01-18`,
                    repeatType: 'installment',
                    installments: 10,
                    currentInstallment: 1,
                    paymentMethod: 'credit',
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('inst', 2),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 420.00,
                    totalAmount: 3360.00,
                    type: 'expense',
                    category: 'moradia',
                    description: 'Sofá Retrátil para Sala',
                    date: `${currentYear}-02-10`,
                    repeatType: 'installment',
                    installments: 8,
                    currentInstallment: 1,
                    paymentMethod: 'credit',
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('inst', 3),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 560.00,
                    totalAmount: 3360.00,
                    type: 'expense',
                    category: 'equipamentos',
                    description: 'Geladeira Frost Free Inverter',
                    date: `${currentYear}-04-05`,
                    repeatType: 'installment',
                    installments: 6,
                    currentInstallment: 1,
                    paymentMethod: 'credit',
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });
                famTxs.push({
                    id: genFamId('inst', 4),
                    familyId,
                    memberId: marianaId,
                    scope: 'family',
                    amount: 1450.00,
                    totalAmount: 7250.00,
                    type: 'expense',
                    category: 'lazer',
                    description: 'Pacote Férias Família Praia',
                    date: `${currentYear}-06-15`,
                    repeatType: 'installment',
                    installments: 5,
                    currentInstallment: 1,
                    paymentMethod: 'credit',
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });

                // (D) Despesas Móveis / Variáveis Familiares
                // Em janeiro, incluímos despesa anual de IPTU + Material Escolar gerando saldo negativo controlado
                famTxs.push({
                    id: genFamId('var', 'iptu-mat'),
                    familyId,
                    memberId: joseId,
                    scope: 'family',
                    amount: 8900.00,
                    type: 'expense',
                    category: 'impostos',
                    description: 'IPTU Anual Cota Única + Material Escolar',
                    date: `${currentYear}-01-22`,
                    repeatType: 'none',
                    installments: 1,
                    currentInstallment: 1,
                    paymentMethod: 'pix',
                    totalAmount: null,
                    originalTransactionId: null,
                    obligationSettled: false,
                    excludedMonths: [],
                    createdAt: now,
                    updatedAt: now
                });

                const famMonthlyVar = [
                    { m: '01', sup: 1950, trn: 480, laz: 420, pet: 210 },
                    { m: '02', sup: 1880, trn: 450, laz: 390, pet: 195 },
                    { m: '03', sup: 2100, trn: 520, laz: 480, pet: 240 },
                    { m: '04', sup: 1990, trn: 470, laz: 430, pet: 215 },
                    { m: '05', sup: 2250, trn: 540, laz: 560, pet: 260 },
                    { m: '06', sup: 2050, trn: 490, laz: 460, pet: 220 },
                    { m: '07', sup: 2380, trn: 560, laz: 640, pet: 280 },
                    { m: '08', sup: 2120, trn: 510, laz: 490, pet: 230 },
                    { m: '09', sup: 2180, trn: 530, laz: 510, pet: 245 },
                    { m: '10', sup: 2240, trn: 540, laz: 530, pet: 250 },
                    { m: '11', sup: 2450, trn: 580, laz: 620, pet: 290 },
                    { m: '12', sup: 2980, trn: 650, laz: 890, pet: 340 },
                ];

                famMonthlyVar.forEach(({ m, sup, trn, laz, pet }) => {
                    famTxs.push({
                        id: genFamId('var', `${m}-sup`),
                        familyId,
                        memberId: marianaId,
                        scope: 'family',
                        amount: sup,
                        type: 'expense',
                        category: 'alimentacao',
                        description: 'Supermercado & Feira Família',
                        date: `${currentYear}-${m}-10`,
                        repeatType: 'none',
                        installments: 1,
                        currentInstallment: 1,
                        paymentMethod: 'debit',
                        totalAmount: null,
                        originalTransactionId: null,
                        obligationSettled: false,
                        excludedMonths: [],
                        createdAt: now,
                        updatedAt: now
                    });
                    famTxs.push({
                        id: genFamId('var', `${m}-trn`),
                        familyId,
                        memberId: joseId,
                        scope: 'family',
                        amount: trn,
                        type: 'expense',
                        category: 'transporte',
                        description: 'Combustível / Estacionamento',
                        date: `${currentYear}-${m}-16`,
                        repeatType: 'none',
                        installments: 1,
                        currentInstallment: 1,
                        paymentMethod: 'credit',
                        totalAmount: null,
                        originalTransactionId: null,
                        obligationSettled: false,
                        excludedMonths: [],
                        createdAt: now,
                        updatedAt: now
                    });
                    famTxs.push({
                        id: genFamId('var', `${m}-laz`),
                        familyId,
                        memberId: joseId,
                        scope: 'family',
                        amount: laz,
                        type: 'expense',
                        category: 'lazer',
                        description: 'Passeio em Família / Restaurante',
                        date: `${currentYear}-${m}-21`,
                        repeatType: 'none',
                        installments: 1,
                        currentInstallment: 1,
                        paymentMethod: 'credit',
                        totalAmount: null,
                        originalTransactionId: null,
                        obligationSettled: false,
                        excludedMonths: [],
                        createdAt: now,
                        updatedAt: now
                    });
                    famTxs.push({
                        id: genFamId('var', `${m}-pet`),
                        familyId,
                        memberId: marianaId,
                        scope: 'family',
                        amount: pet,
                        type: 'expense',
                        category: 'pet',
                        description: 'Pet Shop & Ração',
                        date: `${currentYear}-${m}-27`,
                        repeatType: 'none',
                        installments: 1,
                        currentInstallment: 1,
                        paymentMethod: 'pix',
                        totalAmount: null,
                        originalTransactionId: null,
                        obligationSettled: false,
                        excludedMonths: [],
                        createdAt: now,
                        updatedAt: now
                    });
                });

                safeSetJson(KEYS.FAMILY_TRANSACTIONS, famTxs);
                familyCount = famTxs.length;
                notify(PROTOTYPE_EVENTS.FAMILY_TXS_CHANGED);
            }
        }

        return { individualCount, familyCount };
    }
};
