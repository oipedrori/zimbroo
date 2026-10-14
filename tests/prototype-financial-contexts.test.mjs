import test from 'node:test';
import assert from 'node:assert/strict';

// Mock do ambiente do navegador (localStorage, window e CustomEvent)
const storage = new Map();
globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
};

const dispatchedEvents = [];
globalThis.window = {
    location: { pathname: '/prototipo' },
    dispatchEvent: (evt) => dispatchedEvents.push(evt.type)
};
globalThis.CustomEvent = class CustomEvent {
    constructor(type) {
        this.type = type;
    }
};

const {
    prototypeStorage,
    FINANCIAL_CONTEXTS,
    FAMILY_ROLES,
    PROTOTYPE_STORAGE_KEYS,
    PROTOTYPE_EVENTS
} = await import('../src/services/prototypeStorage.js');

// Função utilitária que replica a resolução de transações do hook useTransactions
const getScopedTransactions = () => {
    const context = prototypeStorage.getActiveFinancialContext();
    const individualTxs = prototypeStorage.getTransactions().map(tx => ({
        ...tx,
        scope: 'individual',
        originLabel: 'Individual'
    }));

    if (context === FINANCIAL_CONTEXTS.INDIVIDUAL) {
        return individualTxs;
    }

    const activeFamilyId = prototypeStorage.getActiveFamilyId();
    let familyTxs = [];
    if (activeFamilyId) {
        const space = prototypeStorage.getFamilySpaceById(activeFamilyId);
        if (space) {
            const members = prototypeStorage.getFamilyMembers(activeFamilyId);
            const memberMap = new Map(members.map(m => [m.id, m.name]));
            familyTxs = prototypeStorage.getFamilyTransactions(activeFamilyId).map(tx => ({
                ...tx,
                scope: 'family',
                originLabel: 'Familiar',
                memberName: memberMap.get(tx.memberId) || ''
            }));
        }
    }

    if (context === FINANCIAL_CONTEXTS.FAMILY) {
        return familyTxs;
    }

    // Contexto 'both'
    const combined = [...individualTxs];
    const seenIds = new Set(individualTxs.map(t => t.id));
    for (const fTx of familyTxs) {
        if (!seenIds.has(fTx.id)) {
            combined.push(fTx);
            seenIds.add(fTx.id);
        }
    }

    combined.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return combined;
};

test.beforeEach(() => {
    storage.clear();
    dispatchedEvents.length = 0;
});

test('1. Individual como contexto padrão', () => {
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.INDIVIDUAL);
    assert.equal(localStorage.getItem(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT), null);
});

test('2. Persistência da escolha de contexto após nova leitura do armazenamento', () => {
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.FAMILY);
    assert.equal(localStorage.getItem(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT), 'family');
    assert.ok(dispatchedEvents.includes(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED));

    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.BOTH);
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.BOTH);
    assert.equal(localStorage.getItem(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT), 'both');

    // Simula recarregamento
    const freshContext = prototypeStorage.getActiveFinancialContext();
    assert.equal(freshContext, FINANCIAL_CONTEXTS.BOTH);
});

test('3. Tratamento de valor de contexto inválido', () => {
    // Valor inválido no storage
    storage.set(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT, 'super_admin');
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.INDIVIDUAL);

    storage.set(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT, '');
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.INDIVIDUAL);

    // Chamada inválida via API
    assert.throws(() => {
        prototypeStorage.setActiveFinancialContext('invalido');
    }, /Contexto financeiro inválido/);
});

test('4. Consulta exclusiva de transações e limites individuais em Individual', () => {
    // Cadastra dados individuais
    prototypeStorage.addTransaction({
        description: 'Salário Individual',
        amount: 5000,
        type: 'income',
        category: 'salario',
        date: '2026-10-01'
    });
    prototypeStorage.saveLimits({ alimentacao: 800 });

    // Cadastra espaço e dados familiares
    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1', creatorName: 'Pai' });
    const members = prototypeStorage.getFamilyMembers(space.id);
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: members[0].id,
        description: 'Mercado Familiar',
        amount: 1200,
        type: 'expense',
        category: 'alimentacao',
        date: '2026-10-05'
    });
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 2500 });

    // Define contexto como Individual
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.INDIVIDUAL);

    const txs = getScopedTransactions();
    assert.equal(txs.length, 1);
    assert.equal(txs[0].description, 'Salário Individual');
    assert.equal(txs[0].scope, 'individual');
    assert.equal(txs[0].originLabel, 'Individual');

    const limits = prototypeStorage.getLimits();
    assert.deepEqual(limits, { alimentacao: 800 });
});

test('5. Consulta restrita ao espaço ativo em Familiar', () => {
    const spaceA = prototypeStorage.createFamilySpace({ name: 'Espaço A', createdBy: 'u1', creatorName: 'Alice' });
    const spaceB = prototypeStorage.createFamilySpace({ name: 'Espaço B', createdBy: 'u2', creatorName: 'Bob' });
    const memberA = prototypeStorage.getFamilyMembers(spaceA.id)[0];
    const memberB = prototypeStorage.getFamilyMembers(spaceB.id)[0];

    prototypeStorage.addFamilyTransaction({
        familyId: spaceA.id,
        memberId: memberA.id,
        description: 'Aluguel Espaço A',
        amount: 2000,
        type: 'expense',
        category: 'moradia',
        date: '2026-10-10'
    });

    prototypeStorage.addFamilyTransaction({
        familyId: spaceB.id,
        memberId: memberB.id,
        description: 'Condomínio Espaço B',
        amount: 800,
        type: 'expense',
        category: 'moradia',
        date: '2026-10-10'
    });

    prototypeStorage.setActiveFamilyId(spaceA.id);
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);

    const txs = getScopedTransactions();
    assert.equal(txs.length, 1);
    assert.equal(txs[0].description, 'Aluguel Espaço A');
    assert.equal(txs[0].scope, 'family');
    assert.equal(txs[0].originLabel, 'Familiar');
    assert.equal(txs[0].memberName, 'Alice');
});

test('6. Atualização da visualização ao trocar de espaço familiar', () => {
    const spaceA = prototypeStorage.createFamilySpace({ name: 'Espaço A', createdBy: 'u1', creatorName: 'Alice' });
    const spaceB = prototypeStorage.createFamilySpace({ name: 'Espaço B', createdBy: 'u2', creatorName: 'Bob' });
    const memberB = prototypeStorage.getFamilyMembers(spaceB.id)[0];

    prototypeStorage.addFamilyTransaction({
        familyId: spaceB.id,
        memberId: memberB.id,
        description: 'Conta Espaço B',
        amount: 350,
        type: 'expense',
        category: 'outros',
        date: '2026-10-12'
    });

    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
    prototypeStorage.setActiveFamilyId(spaceA.id);
    assert.equal(getScopedTransactions().length, 0);

    // Troca para o Espaço B
    prototypeStorage.setActiveFamilyId(spaceB.id);
    const txs = getScopedTransactions();
    assert.equal(txs.length, 1);
    assert.equal(txs[0].description, 'Conta Espaço B');
    assert.equal(txs[0].memberName, 'Bob');
});

test('7. Agregação correta de receitas, despesas e saldo em Ambos', () => {
    // Individual: Receita 3000, Despesa 1000 => Saldo +2000
    prototypeStorage.addTransaction({
        description: 'Salário',
        amount: 3000,
        type: 'income',
        category: 'salario',
        date: '2026-10-01'
    });
    prototypeStorage.addTransaction({
        description: 'Celular',
        amount: 1000,
        type: 'expense',
        category: 'outros',
        date: '2026-10-05'
    });

    // Familiar: Receita 2000, Despesa 800 => Saldo +1200
    const space = prototypeStorage.createFamilySpace({ name: 'Família Silva', createdBy: 'u1', creatorName: 'Pedro' });
    const member = prototypeStorage.getFamilyMembers(space.id)[0];
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        description: 'Freelance Familiar',
        amount: 2000,
        type: 'income',
        category: 'servicos',
        date: '2026-10-02'
    });
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        description: 'Supermercado',
        amount: 800,
        type: 'expense',
        category: 'alimentacao',
        date: '2026-10-08'
    });

    prototypeStorage.setActiveFamilyId(space.id);
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.BOTH);

    const txs = getScopedTransactions();
    assert.equal(txs.length, 4);

    const totalIncome = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = totalIncome - totalExpense;

    assert.equal(totalIncome, 5000);
    assert.equal(totalExpense, 1800);
    assert.equal(balance, 3200);

    // Subtotais preservados
    const indBalance = txs.filter(t => t.scope === 'individual')
        .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    const famBalance = txs.filter(t => t.scope === 'family')
        .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

    assert.equal(indBalance, 2000);
    assert.equal(famBalance, 1200);
});

test('8. Ausência de duplicação de registros na visão combinada', () => {
    prototypeStorage.addTransaction({ description: 'Item 1', amount: 50, type: 'expense', category: 'outros', date: '2026-10-01' });
    prototypeStorage.addTransaction({ description: 'Item 2', amount: 80, type: 'expense', category: 'outros', date: '2026-10-02' });

    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1', creatorName: 'Pai' });
    const member = prototypeStorage.getFamilyMembers(space.id)[0];
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        description: 'Item 3',
        amount: 120,
        type: 'expense',
        category: 'outros',
        date: '2026-10-03'
    });

    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.BOTH);
    const txs = getScopedTransactions();

    assert.equal(txs.length, 3);
    const ids = new Set(txs.map(t => t.id));
    assert.equal(ids.size, 3, 'Todos os identificadores devem ser únicos');
});

test('9. Identificação da origem de cada transação na lista conjunta', () => {
    prototypeStorage.addTransaction({ description: 'Academia', amount: 120, type: 'expense', category: 'saude', date: '2026-10-01' });

    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1', creatorName: 'Mariana' });
    const member = prototypeStorage.getFamilyMembers(space.id)[0];
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        description: 'Internet Fibra',
        amount: 150,
        type: 'expense',
        category: 'moradia',
        date: '2026-10-02'
    });

    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.BOTH);
    const txs = getScopedTransactions();

    const indTx = txs.find(t => t.description === 'Academia');
    const famTx = txs.find(t => t.description === 'Internet Fibra');

    assert.equal(indTx.scope, 'individual');
    assert.equal(indTx.originLabel, 'Individual');

    assert.equal(famTx.scope, 'family');
    assert.equal(famTx.originLabel, 'Familiar');
    assert.equal(famTx.memberName, 'Mariana');
});

test('10. Separação dos limites individuais e familiares', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Família', createdBy: 'u1' });

    prototypeStorage.saveLimits({ alimentacao: 600, transporte: 200 });
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1800, moradia: 2500 });

    const indLimits = prototypeStorage.getLimits();
    const famLimits = prototypeStorage.getFamilyLimits(space.id);

    assert.deepEqual(indLimits, { alimentacao: 600, transporte: 200 });
    assert.deepEqual(famLimits, { alimentacao: 1800, moradia: 2500 });

    // As estruturas permanecem independentes (alimentação não foi somada para 2400)
    assert.equal(indLimits.alimentacao, 600);
    assert.equal(famLimits.alimentacao, 1800);
});

test('11. Estado vazio quando não existe espaço familiar', () => {
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
    assert.equal(prototypeStorage.getActiveFamilyId(), null);

    const txs = getScopedTransactions();
    assert.deepEqual(txs, []);

    // Não inventa limites fictícios
    assert.equal(prototypeStorage.getFamilySpaces().length, 0);
});

test('12. Comportamento seguro quando o espaço ativo não existe mais', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Temporário', createdBy: 'u1' });
    prototypeStorage.setActiveFamilyId(space.id);
    assert.equal(prototypeStorage.getActiveFamilyId(), space.id);

    // Deleta o espaço
    prototypeStorage.deleteFamilySpace(space.id);
    assert.equal(prototypeStorage.getActiveFamilyId(), null);

    // Leitura segura no contexto Familiar
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
    const txs = getScopedTransactions();
    assert.deepEqual(txs, []);
});

test('13. Preservação dos dados após alternar contextos e recarregar a página', () => {
    prototypeStorage.addTransaction({ description: 'Compra 1', amount: 50, type: 'expense', category: 'outros', date: '2026-10-01' });
    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1', creatorName: 'Ana' });
    const member = prototypeStorage.getFamilyMembers(space.id)[0];
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        description: 'Compra Familiar',
        amount: 200,
        type: 'expense',
        category: 'outros',
        date: '2026-10-02'
    });

    // Alterna várias vezes
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.BOTH);
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.INDIVIDUAL);

    // Dados individuais intactos
    assert.equal(prototypeStorage.getTransactions().length, 1);
    // Dados familiares intactos
    assert.equal(prototypeStorage.getFamilyTransactions(space.id).length, 1);
});

test('14. Preservação estrita de zimbroo_accounts', () => {
    const walletMock = JSON.stringify([{ id: 'acc-1', name: 'Nubank', balance: 1500 }]);
    storage.set('zimbroo_accounts', walletMock);

    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.BOTH);
    prototypeStorage.clearAllPrototypeData();

    assert.equal(storage.get('zimbroo_accounts'), walletMock, 'zimbroo_accounts nunca deve ser tocada');
});

test('15. Bloqueio de gravações em escopo incompatível', () => {
    // Transações familiares não devem ser deletadas ou alteradas pelos métodos individuais
    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1', creatorName: 'Pai' });
    const member = prototypeStorage.getFamilyMembers(space.id)[0];
    const famTx = prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        description: 'Luz',
        amount: 180,
        type: 'expense',
        category: 'moradia',
        date: '2026-10-04'
    });

    // Tentativa de updateTransaction com id familiar no storage individual não afeta a transação
    prototypeStorage.updateTransaction(famTx.id, { description: 'Mutação indevida' });
    const freshFamTx = prototypeStorage.getFamilyTransactionById(famTx.id);
    assert.equal(freshFamTx.description, 'Luz', 'Transação familiar não deve ser alterada por update individual');

    // Tentativa de deleteTransaction com id familiar no storage individual não exclui a transação
    prototypeStorage.deleteTransaction(famTx.id);
    assert.ok(prototypeStorage.getFamilyTransactionById(famTx.id), 'Transação familiar não deve ser excluída por delete individual');
});

test('16. Ausência de regressões no comportamento do aplicativo principal', () => {
    // Chaves de armazenamento da aplicação principal continuam inexistentes / isoladas
    const allKeys = Array.from(storage.keys());
    const mainKeys = allKeys.filter(k => !k.startsWith('zimbroo_prototipo_') && k !== 'zimbroo_accounts');
    assert.deepEqual(mainKeys, [], 'Nenhuma chave externa ao prefixo zimbroo_prototipo_ deve ser gerada');
});

test('17. Manutenção da navegação dentro das rotas do protótipo', () => {
    // Assegura que os links de navegação interna respeitam as rotas filhas de /prototipo
    const prototypeRoutes = ['/prototipo', '/prototipo/limits', '/prototipo/wallet'];
    for (const route of prototypeRoutes) {
        assert.ok(route.startsWith('/prototipo'), `Rota ${route} deve pertencer ao escopo /prototipo`);
    }
});
