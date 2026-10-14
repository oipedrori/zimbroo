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
    dispatchEvent: (evt) => dispatchedEvents.push(evt.type)
};
globalThis.CustomEvent = class CustomEvent {
    constructor(type) {
        this.type = type;
    }
};

const {
    prototypeStorage,
    INVITE_STATUS,
    MEMBER_STATUS,
    FAMILY_ROLES,
    FINANCIAL_CONTEXTS
} = await import('../src/services/prototypeStorage.js');

test('Etapa 5 - 1. Escolha de modelo no onboarding e persistência independente', () => {
    localStorage.clear();
    assert.equal(prototypeStorage.getOnboardingModel(), null);

    // Salva modelo 'individual'
    prototypeStorage.setOnboardingModel('individual');
    assert.equal(prototypeStorage.getOnboardingModel(), 'individual');

    // Salva modelo 'family'
    prototypeStorage.setOnboardingModel('family');
    assert.equal(prototypeStorage.getOnboardingModel(), 'family');

    // Salva modelo 'both'
    prototypeStorage.setOnboardingModel('both');
    assert.equal(prototypeStorage.getOnboardingModel(), 'both');

    // Contexto financeiro continua segregado do modelo
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.INDIVIDUAL);
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.INDIVIDUAL);
    assert.equal(prototypeStorage.getOnboardingModel(), 'both');
});

test('Etapa 5 - 2. Criação de espaço familiar com responsável inicial', () => {
    localStorage.clear();
    const space = prototypeStorage.createFamilySpace({
        name: 'Família Silva',
        createdBy: 'prototipo',
        creatorName: 'Avaliador'
    });

    assert.ok(space.id);
    assert.equal(space.name, 'Família Silva');

    // Verifica que o criador foi cadastrado como membro owner e active
    const members = prototypeStorage.getFamilyMembers(space.id);
    assert.equal(members.length, 1);
    assert.equal(members[0].name, 'Avaliador');
    assert.equal(members[0].role, FAMILY_ROLES.OWNER);
    assert.equal(members[0].status, MEMBER_STATUS.ACTIVE);
});

test('Etapa 5 - 3. Criação de convite demonstrativo com status pendente', () => {
    localStorage.clear();
    const space = prototypeStorage.createFamilySpace({
        name: 'Família Silva',
        createdBy: 'prototipo',
        creatorName: 'Avaliador'
    });

    const invite = prototypeStorage.createFamilyInvite({
        familyId: space.id,
        inviteeName: 'Mariana',
        inviteeEmail: 'mariana@exemplo.com'
    });

    assert.ok(invite.id);
    assert.equal(invite.inviteeName, 'Mariana');
    assert.equal(invite.inviteeEmail, 'mariana@exemplo.com');
    assert.equal(invite.status, INVITE_STATUS.PENDING);

    // O integrante correspondente deve estar pendente e não ativo
    const members = prototypeStorage.getFamilyMembers(space.id);
    assert.equal(members.length, 2);
    const mariana = members.find(m => m.name === 'Mariana');
    assert.ok(mariana);
    assert.equal(mariana.status, MEMBER_STATUS.PENDING);

    // Convite idempotente: mesmo e-mail pendente retorna o mesmo convite sem duplicar
    const duplicateInvite = prototypeStorage.createFamilyInvite({
        familyId: space.id,
        inviteeName: 'Mariana',
        inviteeEmail: 'mariana@exemplo.com'
    });
    assert.equal(duplicateInvite.id, invite.id);
    assert.equal(prototypeStorage.getFamilyMembers(space.id).length, 2);
});

test('Etapa 5 - 4. Aceite simulado do convite atualiza estado e ativa o membro', () => {
    localStorage.clear();
    const space = prototypeStorage.createFamilySpace({
        name: 'Família Silva',
        createdBy: 'prototipo',
        creatorName: 'Avaliador'
    });

    const invite = prototypeStorage.createFamilyInvite({
        familyId: space.id,
        inviteeName: 'Mariana',
        inviteeEmail: 'mariana@exemplo.com'
    });

    const accepted = prototypeStorage.acceptFamilyInvite(invite.id);
    assert.equal(accepted.status, INVITE_STATUS.ACCEPTED);
    assert.ok(accepted.acceptedAt);

    // Membro deve ter passado para active
    const member = prototypeStorage.getFamilyMemberById(invite.memberId);
    assert.equal(member.status, MEMBER_STATUS.ACTIVE);

    // Idempotência: aceitar novamente não gera duplicidade
    const acceptedAgain = prototypeStorage.acceptFamilyInvite(invite.id);
    assert.equal(acceptedAgain.status, INVITE_STATUS.ACCEPTED);
    const members = prototypeStorage.getFamilyMembers(space.id);
    assert.equal(members.length, 2);
});

test('Etapa 5 - 5. Revogação de convite pendente remove membro sem histórico', () => {
    localStorage.clear();
    const space = prototypeStorage.createFamilySpace({
        name: 'Família Silva',
        createdBy: 'prototipo',
        creatorName: 'Avaliador'
    });

    const invite = prototypeStorage.createFamilyInvite({
        familyId: space.id,
        inviteeName: 'Lucas',
        inviteeEmail: 'lucas@exemplo.com'
    });

    const revoked = prototypeStorage.revokeFamilyInvite(invite.id);
    assert.equal(revoked.status, INVITE_STATUS.REVOKED);

    // Como o membro não tinha histórico e estava pendente, ele foi removido
    const members = prototypeStorage.getFamilyMembers(space.id);
    assert.equal(members.length, 1);
    assert.equal(members[0].name, 'Avaliador');
});

test('Etapa 5 - 6. Reinicialização limpa dados do onboarding e preserva zimbroo_accounts', () => {
    localStorage.clear();
    localStorage.setItem('zimbroo_accounts', JSON.stringify([{ id: 'acc1', name: 'Carteira Principal' }]));

    const space = prototypeStorage.createFamilySpace({
        name: 'Família Silva',
        createdBy: 'prototipo',
        creatorName: 'Avaliador'
    });
    prototypeStorage.createFamilyInvite({
        familyId: space.id,
        inviteeName: 'Mariana',
        inviteeEmail: 'mariana@exemplo.com'
    });
    prototypeStorage.setOnboardingModel('both');
    prototypeStorage.setActive(true);

    assert.equal(prototypeStorage.isActive(), true);
    assert.equal(prototypeStorage.getOnboardingModel(), 'both');
    assert.equal(prototypeStorage.getFamilyInvites().length, 1);

    // Executa limpeza total do protótipo
    prototypeStorage.clearAllPrototypeData();

    assert.equal(prototypeStorage.isActive(), false);
    assert.equal(prototypeStorage.getOnboardingModel(), null);
    assert.equal(prototypeStorage.getFamilyInvites().length, 0);
    assert.equal(prototypeStorage.getFamilySpaces().length, 0);

    // Preservação estrita da Carteira
    const accounts = JSON.parse(localStorage.getItem('zimbroo_accounts'));
    assert.ok(Array.isArray(accounts));
    assert.equal(accounts[0].name, 'Carteira Principal');
});
