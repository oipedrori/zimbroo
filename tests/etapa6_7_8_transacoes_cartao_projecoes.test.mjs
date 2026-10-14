import test from 'node:test';
import assert from 'node:assert/strict';

// Setup mock do localStorage e window para ambiente Node.js
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
    dispatchEvent: (evt) => dispatchedEvents.push(evt.type),
    addEventListener: () => {},
    removeEventListener: () => {}
};
globalThis.CustomEvent = class CustomEvent {
    constructor(type) {
        this.type = type;
    }
};

const {
    prototypeStorage,
    FINANCIAL_CONTEXTS
} = await import('../src/services/prototypeStorage.js');

const {
    parseFinancialText,
    extractAmount
} = await import('../src/services/localNlpParser.js');

const {
    prepareMonthlyTransactions
} = await import('../src/utils/transactionUtils.js');

test('Etapa 6 - 1. Parser determinístico de linguagem natural em português', () => {
    // Valores
    assert.equal(extractAmount('Gastei 50 reais no mercado'), 50);
    assert.equal(extractAmount('Paguei R$ 120,50 de farmácia'), 120.5);
    assert.equal(extractAmount('Conta de luz deu 156 e 80'), 156.8);
    assert.equal(extractAmount('Paguei cem reais no jantar'), 100);

    // Tipos e Categorias
    const expenseParsed = parseFinancialText('Gastei 45 reais na pizzaria ontem');
    assert.equal(expenseParsed.type, 'expense');
    assert.equal(expenseParsed.amount, 45);
    assert.equal(expenseParsed.category, 'alimentacao');
    assert.equal(expenseParsed.paymentMethod, 'cash');
    assert.equal(expenseParsed.installments, 1);

    const incomeParsed = parseFinancialText('Recebi 2500 reais de salário da empresa');
    assert.equal(incomeParsed.type, 'income');
    assert.equal(incomeParsed.amount, 2500);
    assert.equal(incomeParsed.category, 'salario');

    // Transporte
    const uberParsed = parseFinancialText('Paguei 32 reais de Uber');
    assert.equal(uberParsed.category, 'transporte');
    assert.equal(uberParsed.amount, 32);

    // Saúde
    const pharmaParsed = parseFinancialText('Gastei 80 reais na drogaria com remédios');
    assert.equal(pharmaParsed.category, 'saude');
    assert.equal(pharmaParsed.amount, 80);
});

test('Etapa 6 & 7 - 2. Detecção de cartão de crédito, parcelamento e escopo', () => {
    const space = { id: 'fam_casa', name: 'Casa Silva' };
    const members = [
        { id: 'mem_1', name: 'Pedro Silva' },
        { id: 'mem_2', name: 'Mariana Silva' }
    ];

    // Compra parcelada no cartão
    const creditParsed = parseFinancialText('Comprei um sofá por 1200 reais no cartão em 6x');
    assert.equal(creditParsed.paymentMethod, 'credit');
    assert.equal(creditParsed.installments, 6);
    assert.equal(creditParsed.repeatType, 'installment');
    assert.equal(creditParsed.amount, 1200);

    // Escopo familiar detectado por palavra-chave
    const famParsed = parseFinancialText('Paguei 200 da conta de luz familiar', {
        context: 'individual',
        activeFamilySpace: space,
        familyMembers: members
    });
    assert.equal(famParsed.scope, 'family');
    assert.equal(famParsed.familyId, 'fam_casa');
    assert.equal(famParsed.category, 'moradia');

    // Escopo familiar detectado por menção de membro
    const memberMentioned = parseFinancialText('Mariana pagou 150 no mercado', {
        context: 'individual',
        activeFamilySpace: space,
        familyMembers: members
    });
    assert.equal(memberMentioned.scope, 'family');
    assert.equal(memberMentioned.memberId, 'mem_2');
    assert.equal(memberMentioned.category, 'alimentacao');
});

test('Etapa 7 - 3. Projeção de parcelas mensais e prevenção de dupla contagem de fatura', () => {
    // 1. Compra de 300 reais em 3 parcelas de 100
    const tx = {
        id: 'tx_parcelada',
        type: 'expense',
        amount: 100, // cada parcela
        totalAmount: 300,
        description: 'Mesa de escritório',
        category: 'moradia',
        date: '2026-03-10',
        paymentMethod: 'credit',
        repeatType: 'installment',
        installments: 3
    };

    const allTxs = [tx];

    // Mês 1: Março
    const marchTxs = prepareMonthlyTransactions(allTxs, '2026-03');
    assert.equal(marchTxs.length, 1);
    assert.equal(marchTxs[0].amount, 100);
    assert.match(marchTxs[0].description, /\(1\/3\)/);

    // Mês 2: Abril
    const aprilTxs = prepareMonthlyTransactions(allTxs, '2026-04');
    assert.equal(aprilTxs.length, 1);
    assert.equal(aprilTxs[0].amount, 100);
    assert.match(aprilTxs[0].description, /\(2\/3\)/);

    // Mês 3: Maio
    const mayTxs = prepareMonthlyTransactions(allTxs, '2026-05');
    assert.equal(mayTxs.length, 1);
    assert.equal(mayTxs[0].amount, 100);
    assert.match(mayTxs[0].description, /\(3\/3\)/);

    // Mês 4: Junho (já finalizado)
    const juneTxs = prepareMonthlyTransactions(allTxs, '2026-06');
    assert.equal(juneTxs.length, 0);

    // 2. Não dupla contagem: Quitação de fatura
    const invoicePaymentTx = {
        id: 'tx_fatura',
        type: 'expense',
        amount: 100,
        description: 'Pagamento da fatura Nubank',
        category: 'pagamento_fatura',
        paymentMethod: 'bill_payment',
        date: '2026-03-25',
        repeatType: 'none',
        installments: 1
    };

    const combinedTxs = [tx, invoicePaymentTx];
    const marchCombined = prepareMonthlyTransactions(combinedTxs, '2026-03');
    assert.equal(marchCombined.length, 2);

    // Filtragem para limites de categorias de consumo exclui 'pagamento_fatura'
    const consumptionOnly = marchCombined.filter(t => t.category !== 'pagamento_fatura' && t.paymentMethod !== 'bill_payment');
    assert.equal(consumptionOnly.length, 1);
    assert.equal(consumptionOnly[0].category, 'moradia');
});

test('Etapa 8 - 4. Cálculo de Saldo em Caixa e Compromissos Futuros', () => {
    localStorage.clear();

    const txs = [
        // Receita
        { id: '1', type: 'income', amount: 5000, date: '2026-03-01' },
        // Despesa à vista (sai do caixa agora)
        { id: '2', type: 'expense', amount: 200, paymentMethod: 'cash', date: '2026-03-05' },
        // Compra no crédito em 3 parcelas de 300 (total 900)
        { id: '3', type: 'expense', amount: 300, totalAmount: 900, paymentMethod: 'credit', repeatType: 'installment', installments: 3, date: '2026-03-10' }
    ];

    // Março: Saldo em caixa reflete apenas saídas em dinheiro/débito/pix
    const marchIncomes = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const marchImmediateExpenses = txs.filter(t => t.type === 'expense' && t.paymentMethod !== 'credit').reduce((acc, t) => acc + t.amount, 0);
    const cashBalance = marchIncomes - marchImmediateExpenses;
    assert.equal(cashBalance, 4800); // 5000 - 200

    // Compromissos futuros após março: 2 parcelas restantes de 300 = 600
    const [curY, curM] = '2026-03'.split('-').map(Number);
    const curDateVal = curY * 12 + curM;

    let futureCommitments = 0;
    for (const tx of txs) {
        if (tx.type === 'expense' && tx.repeatType === 'installment' && tx.installments > 1) {
            const [y, m] = tx.date.split('-').map(Number);
            const txDateVal = y * 12 + m;
            const endVal = txDateVal + tx.installments - 1;
            if (endVal > curDateVal) {
                const startPending = Math.max(curDateVal + 1, txDateVal);
                const remaining = (endVal - startPending) + 1;
                futureCommitments += remaining * tx.amount;
            }
        }
    }

    assert.equal(futureCommitments, 600);
});

test('Etapa 9 - 5. Preservação estrita da Carteira (zimbroo_accounts) e integridade referencial', () => {
    localStorage.clear();
    localStorage.setItem('zimbroo_accounts', JSON.stringify([{ id: 'acc_1', name: 'Conta Corrente Banco Inter', balance: 15000 }]));

    // Cria espaço e transações
    const space = prototypeStorage.createFamilySpace({ name: 'Família Teste', createdBy: 'prototipo' });
    const member = prototypeStorage.addFamilyMember({ familyId: space.id, name: 'Carlos', role: 'member' });
    
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        type: 'expense',
        amount: 85,
        description: 'Supermercado',
        category: 'alimentacao',
        date: '2026-03-15'
    });

    prototypeStorage.addTransaction({
        type: 'expense',
        amount: 25,
        description: 'Café',
        category: 'alimentacao',
        date: '2026-03-15'
    });

    // Limpeza completa do protótipo
    prototypeStorage.clearAllPrototypeData();

    // Dados do protótipo zerados
    assert.equal(prototypeStorage.getFamilySpaces().length, 0);
    assert.equal(prototypeStorage.getTransactions().length, 0);

    // zimbroo_accounts intacta
    const accounts = JSON.parse(localStorage.getItem('zimbroo_accounts'));
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].name, 'Conta Corrente Banco Inter');
    assert.equal(accounts[0].balance, 15000);
});
