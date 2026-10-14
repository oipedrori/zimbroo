import test from 'node:test';
import assert from 'node:assert/strict';

// Mock browser localStorage and window before importing prototypeStorage
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
    FAMILY_ROLES,
    MEMBER_STATUS,
    PROTOTYPE_STORAGE_KEYS,
    PROTOTYPE_EVENTS
} = await import('../src/services/prototypeStorage.js');

test.beforeEach(() => {
    storage.clear();
    dispatchedEvents.length = 0;
});

test('1. Criação e leitura de um espaço familiar', () => {
    const space = prototypeStorage.createFamilySpace({
        name: 'Família Teste',
        createdBy: 'user-123',
        creatorName: 'Responsável Inicial'
    });

    assert.ok(space.id.startsWith('fam-'), 'ID deve ter prefixo fam-');
    assert.equal(space.name, 'Família Teste');
    assert.equal(space.createdBy, 'user-123');
    assert.ok(space.createdAt);
    assert.ok(space.updatedAt);

    // Leitura por ID
    const retrieved = prototypeStorage.getFamilySpaceById(space.id);
    assert.deepEqual(retrieved, space);

    // Leitura de todos
    const allSpaces = prototypeStorage.getFamilySpaces();
    assert.equal(allSpaces.length, 1);
    assert.equal(allSpaces[0].id, space.id);

    // Espaço ativo configurado automaticamente
    assert.equal(prototypeStorage.getActiveFamilyId(), space.id);

    // Criador cadastrado como membro owner
    const members = prototypeStorage.getFamilyMembers(space.id);
    assert.equal(members.length, 1);
    assert.equal(members[0].name, 'Responsável Inicial');
    assert.equal(members[0].role, FAMILY_ROLES.OWNER);
});

test('2. Cadastro e consulta de membros com validações', () => {
    const space = prototypeStorage.createFamilySpace({
        name: 'Família Silva',
        createdBy: 'pedro-id'
    });

    // Cadastro de membro com sucesso
    const member1 = prototypeStorage.addFamilyMember({
        familyId: space.id,
        name: 'Pedro',
        role: FAMILY_ROLES.OWNER
    });

    const member2 = prototypeStorage.addFamilyMember({
        familyId: space.id,
        name: 'Ana',
        role: FAMILY_ROLES.MEMBER
    });

    assert.equal(member1.familyId, space.id);
    assert.equal(member2.name, 'Ana');
    assert.equal(member2.role, FAMILY_ROLES.MEMBER);
    assert.equal(member2.status, MEMBER_STATUS.ACTIVE);

    // Consulta de membros do espaço
    const spaceMembers = prototypeStorage.getFamilyMembers(space.id);
    assert.equal(spaceMembers.length, 2);

    // Consulta de membro por ID
    const foundMember = prototypeStorage.getFamilyMemberById(member2.id);
    assert.equal(foundMember.id, member2.id);

    // Validação: Impedir nome duplicado no mesmo espaço familiar
    assert.throws(() => {
        prototypeStorage.addFamilyMember({
            familyId: space.id,
            name: 'pedro', // mesmo nome, case-insensitive
            role: FAMILY_ROLES.MEMBER
        });
    }, /Já existe um membro com o nome "pedro"/);

    // Validação: Impedir membro com familyId inexistente
    assert.throws(() => {
        prototypeStorage.addFamilyMember({
            familyId: 'fam-inexistente',
            name: 'Carlos'
        });
    }, /Espaço familiar "fam-inexistente" não encontrado/);

    // Validação: Papel inválido
    assert.throws(() => {
        prototypeStorage.addFamilyMember({
            familyId: space.id,
            name: 'Carlos',
            role: 'superadmin'
        });
    }, /Papel inválido/);
});

test('3. Associação de transações ao espaço familiar e membro corretos', () => {
    const space1 = prototypeStorage.createFamilySpace({ name: 'Espaço 1', createdBy: 'u1' });
    const space2 = prototypeStorage.createFamilySpace({ name: 'Espaço 2', createdBy: 'u2' });

    const member1 = prototypeStorage.addFamilyMember({ familyId: space1.id, name: 'Membro 1' });
    const member2 = prototypeStorage.addFamilyMember({ familyId: space2.id, name: 'Membro 2' });

    // Criação de transação familiar vinculada corretamente
    const tx = prototypeStorage.addFamilyTransaction({
        familyId: space1.id,
        memberId: member1.id,
        amount: 250.75,
        type: 'expense',
        category: 'Supermercado',
        description: 'Compras do mês',
        date: '2026-10-14',
        repeatType: 'none',
        installments: 1
    });

    assert.ok(tx.id.startsWith('ftx-'));
    assert.equal(tx.familyId, space1.id);
    assert.equal(tx.memberId, member1.id);
    assert.equal(tx.scope, 'family');
    assert.equal(tx.amount, 250.75);
    assert.equal(tx.type, 'expense');

    // Consulta de transações por espaço
    const space1Txs = prototypeStorage.getFamilyTransactions(space1.id);
    const space2Txs = prototypeStorage.getFamilyTransactions(space2.id);
    assert.equal(space1Txs.length, 1);
    assert.equal(space2Txs.length, 0);

    // Validação: Inconsistência de associação (membro não pertence ao espaço)
    assert.throws(() => {
        prototypeStorage.addFamilyTransaction({
            familyId: space1.id,
            memberId: member2.id, // membro do space2 tentando criar no space1
            amount: 50,
            category: 'Lazer'
        });
    }, /Inconsistência de associação/);

    // Validação: Valor inválido
    assert.throws(() => {
        prototypeStorage.addFamilyTransaction({
            familyId: space1.id,
            memberId: member1.id,
            amount: -10,
            category: 'Lazer'
        });
    }, /Valor da transação deve ser um número positivo/);
});

test('4. Armazenamento e leitura de limites familiares: independência e fallback consistente', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Família Silva', createdBy: 'u1' });

    // 1. Salvar limites gerais (sem ano)
    const generalLimits = { Alimentação: 1000, Lazer: 500, Transporte: 300 };
    prototypeStorage.saveFamilyLimits(space.id, generalLimits);

    // Leitura dos limites gerais
    assert.deepEqual(prototypeStorage.getFamilyLimits(space.id), generalLimits);

    // 2. Salvar limites específicos para 2026
    const limits2026 = { Alimentação: 1500, Moradia: 2500 };
    prototypeStorage.saveFamilyLimits(space.id, limits2026, 2026);

    // 3. Confirmar que salvar limites anuais NÃO sobrescreveu os limites gerais
    const generalAfterAnnual = prototypeStorage.getFamilyLimits(space.id);
    assert.deepEqual(generalAfterAnnual, generalLimits, 'Limites gerais devem permanecer intactos');

    // 4. Confirmar que a leitura de 2026 prioriza 2026 e aplica fallback geral para categorias não definidas no ano
    const read2026 = prototypeStorage.getFamilyLimits(space.id, 2026);
    assert.equal(read2026.Alimentação, 1500, 'Prioriza valor específico do ano 2026');
    assert.equal(read2026.Moradia, 2500, 'Prioriza valor específico do ano 2026');
    assert.equal(read2026.Lazer, 500, 'Aplica fallback dos limites gerais para categorias ausentes');
    assert.equal(read2026.Transporte, 300, 'Aplica fallback dos limites gerais para categorias ausentes');

    // 5. Salvar novos limites gerais e confirmar que NÃO sobrescreve limits_2026
    const updatedGeneral = { Alimentação: 1200, Lazer: 600, Saúde: 400 };
    prototypeStorage.saveFamilyLimits(space.id, updatedGeneral);

    const rawSettings = prototypeStorage.getFamilySettings(space.id);
    assert.deepEqual(rawSettings.limits, updatedGeneral, 'Campo limits deve ter novos limites gerais');
    assert.deepEqual(rawSettings.limits_2026, limits2026, 'Campo limits_2026 não pode ser sobrescrito ao salvar limits geral');

    // 6. Leitura de um ano sem limites específicos (ex: 2027) aplica fallback geral
    const read2027 = prototypeStorage.getFamilyLimits(space.id, 2027);
    assert.deepEqual(read2027, updatedGeneral, 'Ano sem limites específicos deve usar fallback geral');
});

test('5. Persistência após simulação de recarregamento', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Persistência Família', createdBy: 'u1' });
    const member = prototypeStorage.addFamilyMember({ familyId: space.id, name: 'João' });
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        amount: 80,
        category: 'Farmácia'
    });

    // Simula "recarregar a página": mantém storage, mas relê os métodos
    const reloadedSpaces = prototypeStorage.getFamilySpaces();
    const reloadedMembers = prototypeStorage.getFamilyMembers(space.id);
    const reloadedTxs = prototypeStorage.getFamilyTransactions(space.id);

    assert.equal(reloadedSpaces.length, 1);
    assert.equal(reloadedSpaces[0].name, 'Persistência Família');
    assert.equal(reloadedMembers.length, 1);
    assert.equal(reloadedMembers[0].name, 'João');
    assert.equal(reloadedTxs.length, 1);
    assert.equal(reloadedTxs[0].amount, 80);
});

test('6. Ausência de alterações indevidas nos dados individuais existentes', () => {
    // Registra transação e limite individual
    const indTx = prototypeStorage.addTransaction({
        amount: 120,
        category: 'Transporte',
        description: 'Combustível pessoal'
    });
    prototypeStorage.saveLimits({ Transporte: 300 }, 2026);

    assert.equal(prototypeStorage.getTransactions().length, 1);
    assert.equal(prototypeStorage.getLimits(2026).Transporte, 300);

    // Cria espaço familiar, membro e transação familiar
    const space = prototypeStorage.createFamilySpace({ name: 'Família Isolada', createdBy: 'u1' });
    const member = prototypeStorage.addFamilyMember({ familyId: space.id, name: 'Membro 1' });
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        amount: 500,
        category: 'Alimentação'
    });
    prototypeStorage.saveFamilyLimits(space.id, { Alimentação: 1500 }, 2026);

    // Os dados individuais DEVEM permanecer intactos
    const indTxsAfter = prototypeStorage.getTransactions();
    assert.equal(indTxsAfter.length, 1);
    assert.equal(indTxsAfter[0].id, indTx.id);
    assert.equal(indTxsAfter[0].amount, 120);
    assert.equal(prototypeStorage.getLimits(2026).Transporte, 300);
    assert.equal(prototypeStorage.getLimits(2026).Alimentação, undefined);

    // Limpeza apenas de dados familiares
    prototypeStorage.clearFamilyDataOnly();
    assert.equal(prototypeStorage.getFamilySpaces().length, 0);
    assert.equal(prototypeStorage.getFamilyTransactions().length, 0);

    // Dados individuais AINDA continuam intactos
    assert.equal(prototypeStorage.getTransactions().length, 1);
    assert.equal(prototypeStorage.getLimits(2026).Transporte, 300);
});

test('7. Preservação estrita da chave zimbroo_accounts (Carteira)', () => {
    // Simula carteira existente
    const initialAccounts = JSON.stringify([
        { id: 'acc-1', name: 'Nubank', balance: 1500 },
        { id: 'acc-2', name: 'Inter', balance: 3200 }
    ]);
    localStorage.setItem('zimbroo_accounts', initialAccounts);

    // Executa ciclo completo de operações familiares
    const space = prototypeStorage.createFamilySpace({ name: 'Família Carteira', createdBy: 'u1' });
    const member = prototypeStorage.addFamilyMember({ familyId: space.id, name: 'Titular' });
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        amount: 99.90,
        category: 'Assinatura'
    });

    // Limpeza de todos os dados do protótipo
    prototypeStorage.clearAllPrototypeData();

    // A chave zimbroo_accounts DEVE permanecer intacta e não ser afetada
    const preservedAccounts = localStorage.getItem('zimbroo_accounts');
    assert.equal(preservedAccounts, initialAccounts);
});

test('8. Validação de deleção em cascata de espaço familiar', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Para Deletar', createdBy: 'u1' });
    const member = prototypeStorage.addFamilyMember({ familyId: space.id, name: 'Membro A' });
    prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: member.id,
        amount: 45,
        category: 'Padaria'
    });

    // Deleta o espaço
    prototypeStorage.deleteFamilySpace(space.id);

    // Cascata: membros, transações e configurações do espaço devem ter sido removidos
    assert.equal(prototypeStorage.getFamilySpaces().length, 0);
    assert.equal(prototypeStorage.getFamilyMembers(space.id).length, 0);
    assert.equal(prototypeStorage.getFamilyTransactions(space.id).length, 0);
    assert.equal(prototypeStorage.getActiveFamilyId(), null);
});

test('9. Integridade referencial ao remover membros (com e sem transações associadas)', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Família Integridade', createdBy: 'u1' });

    // Membro 1: terá transação vinculada
    const memberWithTx = prototypeStorage.addFamilyMember({
        familyId: space.id,
        name: 'Ana Responsável',
        role: FAMILY_ROLES.OWNER
    });

    // Membro 2: sem transação vinculada
    const memberWithoutTx = prototypeStorage.addFamilyMember({
        familyId: space.id,
        name: 'Bruno Integrante',
        role: FAMILY_ROLES.MEMBER
    });

    // Registra transação para memberWithTx
    const tx = prototypeStorage.addFamilyTransaction({
        familyId: space.id,
        memberId: memberWithTx.id,
        amount: 175.50,
        type: 'expense',
        category: 'Energia',
        description: 'Conta de luz da casa'
    });

    // Caso A: Membro com transações associadas DEVE ter remoção definitiva impedida
    assert.throws(() => {
        prototypeStorage.removeFamilyMember(memberWithTx.id);
    }, /Não é possível remover definitivamente o membro "Ana Responsável" pois existem 1 transação\(ões\) associada\(s\)/);

    // Confirma que o membro e a transação continuam intactos no armazenamento
    assert.ok(prototypeStorage.getFamilyMemberById(memberWithTx.id), 'Membro não deve ser removido');
    assert.equal(prototypeStorage.getFamilyTransactionById(tx.id).memberId, memberWithTx.id);

    // Caso B: Desativação do membro com transações deve ser permitida e preservar histórico
    const deactivatedMember = prototypeStorage.updateFamilyMember(memberWithTx.id, {
        status: MEMBER_STATUS.INACTIVE
    });
    assert.equal(deactivatedMember.status, MEMBER_STATUS.INACTIVE);

    // Transação histórica ainda referencia o membro desativado de forma consistente
    const txAfterDeactivation = prototypeStorage.getFamilyTransactionById(tx.id);
    assert.equal(txAfterDeactivation.memberId, memberWithTx.id);

    // Membro inativo NÃO pode registrar novas transações
    assert.throws(() => {
        prototypeStorage.addFamilyTransaction({
            familyId: space.id,
            memberId: memberWithTx.id,
            amount: 50,
            category: 'Mercado'
        });
    }, /Não é possível registrar transação para o membro "Ana Responsável" pois ele está inativo/);

    // Caso C: Membro sem transações pode ser removido definitivamente
    const removedSuccess = prototypeStorage.removeFamilyMember(memberWithoutTx.id);
    assert.equal(removedSuccess, true);
    assert.equal(prototypeStorage.getFamilyMemberById(memberWithoutTx.id), null, 'Membro sem transações foi removido com sucesso');
});
