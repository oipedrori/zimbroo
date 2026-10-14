import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
    PROTOTYPE_STORAGE_KEYS,
    PROTOTYPE_EVENTS
} = await import('../src/services/prototypeStorage.js');

test.beforeEach(() => {
    storage.clear();
    dispatchedEvents.length = 0;
});

test('1. Seletor com apenas Individual e Familiar, posicionado abaixo da saudação', () => {
    // Verifica que apenas Individual e Familiar são contextos válidos para o usuário
    assert.equal(FINANCIAL_CONTEXTS.INDIVIDUAL, 'individual');
    assert.equal(FINANCIAL_CONTEXTS.FAMILY, 'family');

    // Se preferência antiga 'both' estiver salva, normaliza para 'individual' sem apagar dados
    storage.set(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT, 'both');
    const ctx = prototypeStorage.getActiveFinancialContext();
    assert.equal(ctx, FINANCIAL_CONTEXTS.INDIVIDUAL, 'Contexto both deve ser normalizado para individual');
    assert.equal(localStorage.getItem(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT), FINANCIAL_CONTEXTS.INDIVIDUAL);

    // Verifica que no Home.jsx o PrototypeContextSelector é renderizado logo após a saudação e antes de Month Navigation
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');
    const greetingIdx = homeContent.indexOf('displayName = isPrototype');
    const selectorIdx = homeContent.indexOf('<PrototypeContextSelector');
    const monthNavIdx = homeContent.indexOf('Month Navigation');

    assert.ok(greetingIdx !== -1, 'Saudação deve existir em Home.jsx');
    assert.ok(selectorIdx !== -1, 'PrototypeContextSelector deve estar em Home.jsx');
    assert.ok(monthNavIdx !== -1, 'Month Navigation deve existir em Home.jsx');
    assert.ok(greetingIdx < selectorIdx, 'Seletor deve vir após a saudação');
    assert.ok(selectorIdx < monthNavIdx, 'Seletor deve vir antes da navegação mensal');
});

test('2. Ausência do selo "Protótipo Local" e da barra superior removida', () => {
    const layoutContent = fs.readFileSync(path.resolve('src/components/Layout.jsx'), 'utf-8');
    assert.ok(!layoutContent.includes('<PrototypeContextSelector'), 'Layout.jsx não deve conter a faixa superior com PrototypeContextSelector');

    const selectorContent = fs.readFileSync(path.resolve('src/components/PrototypeContextSelector.jsx'), 'utf-8');
    assert.ok(!selectorContent.includes('Protótipo Local'), 'Não deve existir o selo "Protótipo Local" na barra');
    assert.ok(!selectorContent.includes('Informações do Protótipo Local'), 'Não deve existir botão de informações no topo');
});

test('3. Ausência da página separada de Limites no protótipo', () => {
    const selectorContent = fs.readFileSync(path.resolve('src/components/PrototypeContextSelector.jsx'), 'utf-8');
    assert.ok(!selectorContent.includes('/prototipo/limits'), 'Não deve existir link ou botão para /prototipo/limits no seletor');

    // Toda gestão de limites está na Home.jsx
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');
    assert.ok(homeContent.includes('<LimitsSection'), 'LimitsSection deve estar integrada diretamente na Home.jsx');
    assert.ok(homeContent.includes('isLimitModalOpen'), 'Modal de limites deve estar na Home.jsx');
});

test('4. Redirecionamento de /prototipo/limits para /prototipo', () => {
    const appContent = fs.readFileSync(path.resolve('src/App.jsx'), 'utf-8');
    assert.ok(
        appContent.includes('<Route path="limits" element={<Navigate to="/prototipo" replace />} />'),
        'Rota /prototipo/limits deve redirecionar para /prototipo'
    );
});

test('5. Persistência da seleção do contexto', () => {
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.FAMILY);
    assert.equal(localStorage.getItem(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT), 'family');
    assert.ok(dispatchedEvents.includes(PROTOTYPE_EVENTS.FINANCIAL_CONTEXT_CHANGED));

    // Nova leitura simula recarregamento
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.FAMILY);

    // Retorna para individual
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.INDIVIDUAL);
    assert.equal(prototypeStorage.getActiveFinancialContext(), FINANCIAL_CONTEXTS.INDIVIDUAL);
    assert.equal(localStorage.getItem(PROTOTYPE_STORAGE_KEYS.ACTIVE_FINANCIAL_CONTEXT), 'individual');
});

test('6. Diferenciação de cores entre Individual e Familiar', () => {
    const indexCss = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
    assert.ok(indexCss.includes('[data-prototype-context="family"]'), 'Deve existir regra CSS de escopo para o contexto familiar');
    assert.ok(indexCss.includes('--primary-darkest'), 'Contexto familiar deve adotar a tonalidade verde mais escura da paleta');

    const selectorContent = fs.readFileSync(path.resolve('src/components/PrototypeContextSelector.jsx'), 'utf-8');
    assert.ok(selectorContent.includes('--primary-color'), 'Individual deve usar verde principal');
    assert.ok(selectorContent.includes('--primary-darkest'), 'Familiar deve usar verde mais escuro');
});

test('7. Criação de limite individual sem regressão', () => {
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.INDIVIDUAL);
    const initialLimits = prototypeStorage.getLimits();
    assert.deepEqual(initialLimits, {});

    prototypeStorage.saveLimits({ alimentacao: 500, transporte: 200 });
    const savedLimits = prototypeStorage.getLimits();
    assert.deepEqual(savedLimits, { alimentacao: 500, transporte: 200 });

    // Nenhum espaço familiar foi afetado
    assert.equal(prototypeStorage.getFamilySpaces().length, 0);
});

test('8. Edição e exclusão de limites individuais sem regressão', () => {
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.INDIVIDUAL);
    prototypeStorage.saveLimits({ alimentacao: 500, transporte: 200 });

    // Edição
    prototypeStorage.saveLimits({ alimentacao: 650, transporte: 200 });
    assert.equal(prototypeStorage.getLimits().alimentacao, 650);

    // Exclusão
    const current = { ...prototypeStorage.getLimits() };
    delete current.transporte;
    prototypeStorage.saveLimits(current);

    const afterDelete = prototypeStorage.getLimits();
    assert.equal(afterDelete.alimentacao, 650);
    assert.equal(afterDelete.transporte, undefined);
});

test('9. Criação de limite familiar no espaço ativo', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Família Silva', createdBy: 'u1' });
    prototypeStorage.setActiveFamilyId(space.id);
    prototypeStorage.setActiveFinancialContext(FINANCIAL_CONTEXTS.FAMILY);

    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1500, moradia: 2200 });
    const famLimits = prototypeStorage.getFamilyLimits(space.id);

    assert.deepEqual(famLimits, { alimentacao: 1500, moradia: 2200 });
    assert.ok(dispatchedEvents.includes(PROTOTYPE_EVENTS.FAMILY_SETTINGS_CHANGED));
});

test('10. Edição de limite familiar sem alterar limites individuais', () => {
    prototypeStorage.saveLimits({ alimentacao: 400 });

    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1' });
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1200, saude: 500 });

    // Edita limite familiar
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1600, saude: 500 });

    assert.equal(prototypeStorage.getFamilyLimits(space.id).alimentacao, 1600);
    // Limite individual permanece 400
    assert.equal(prototypeStorage.getLimits().alimentacao, 400);
});

test('11. Exclusão de limite familiar sem alterar limites individuais', () => {
    prototypeStorage.saveLimits({ alimentacao: 400, transporte: 150 });

    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1' });
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1200, lazer: 300 });

    // Exclui 'alimentacao' familiar
    const currentFam = { ...prototypeStorage.getFamilyLimits(space.id) };
    delete currentFam.alimentacao;
    prototypeStorage.saveFamilyLimits(space.id, currentFam);

    assert.equal(prototypeStorage.getFamilyLimits(space.id).alimentacao, undefined);
    assert.equal(prototypeStorage.getFamilyLimits(space.id).lazer, 300);

    // Limites individuais continuam 100% intactos
    assert.equal(prototypeStorage.getLimits().alimentacao, 400);
    assert.equal(prototypeStorage.getLimits().transporte, 150);
});

test('12. Isolamento de limites entre espaços familiares diferentes', () => {
    const space1 = prototypeStorage.createFamilySpace({ name: 'Espaço 1', createdBy: 'u1' });
    const space2 = prototypeStorage.createFamilySpace({ name: 'Espaço 2', createdBy: 'u2' });

    prototypeStorage.saveFamilyLimits(space1.id, { alimentacao: 1000 });
    prototypeStorage.saveFamilyLimits(space2.id, { alimentacao: 2500, educacao: 800 });

    assert.deepEqual(prototypeStorage.getFamilyLimits(space1.id), { alimentacao: 1000 });
    assert.deepEqual(prototypeStorage.getFamilyLimits(space2.id), { alimentacao: 2500, educacao: 800 });

    // Alternar espaço ativo retorna os limites respectivos
    prototypeStorage.setActiveFamilyId(space1.id);
    assert.equal(prototypeStorage.getActiveFamilyId(), space1.id);
    assert.equal(prototypeStorage.getFamilyLimits(prototypeStorage.getActiveFamilyId()).alimentacao, 1000);

    prototypeStorage.setActiveFamilyId(space2.id);
    assert.equal(prototypeStorage.getActiveFamilyId(), space2.id);
    assert.equal(prototypeStorage.getFamilyLimits(prototypeStorage.getActiveFamilyId()).alimentacao, 2500);
});

test('13. Atualização dos cards depois de cada operação', () => {
    prototypeStorage.saveLimits({ alimentacao: 600 });
    assert.ok(dispatchedEvents.includes(PROTOTYPE_EVENTS.LIMITS_CHANGED));

    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1' });
    dispatchedEvents.length = 0;
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1200 });
    assert.ok(dispatchedEvents.includes(PROTOTYPE_EVENTS.FAMILY_SETTINGS_CHANGED));
});

test('14. Persistência de limites familiares após recarregar o protótipo', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1' });
    prototypeStorage.saveFamilyLimits(space.id, { mercado: 1400 });

    // Simula leitura limpa do storage
    const reloadedSettings = JSON.parse(storage.get(PROTOTYPE_STORAGE_KEYS.FAMILY_SETTINGS));
    assert.equal(reloadedSettings[space.id].limits.mercado, 1400);

    const readLimits = prototypeStorage.getFamilyLimits(space.id);
    assert.equal(readLimits.mercado, 1400);
});

test('15. Manutenção do comportamento dos limites gerais e anuais', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1' });

    // Limites gerais
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1000, saude: 300 });

    // Limites de 2026
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1200 }, 2026);

    // Leitura do ano 2026 prioriza o ano e aplica fallback dos limites gerais para categorias não especificadas
    const limits2026 = prototypeStorage.getFamilyLimits(space.id, 2026);
    assert.equal(limits2026.alimentacao, 1200);
    assert.equal(limits2026.saude, 300);

    // Limites gerais permanecem independentes
    const generalLimits = prototypeStorage.getFamilyLimits(space.id);
    assert.equal(generalLimits.alimentacao, 1000);
});

test('16. Preservação de zimbroo_accounts', () => {
    const carteiraData = JSON.stringify([{ id: 'acc-1', name: 'Conta Principal', balance: 5000 }]);
    storage.set('zimbroo_accounts', carteiraData);

    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1' });
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 800 });
    prototypeStorage.saveLimits({ alimentacao: 400 });

    assert.equal(storage.get('zimbroo_accounts'), carteiraData);

    prototypeStorage.clearAllPrototypeData();
    assert.equal(storage.get('zimbroo_accounts'), carteiraData, 'zimbroo_accounts deve permanecer estritamente intacta');
});

test('17. Ausência de gravações no escopo errado', () => {
    const space = prototypeStorage.createFamilySpace({ name: 'Casa', createdBy: 'u1' });
    prototypeStorage.setActiveFamilyId(space.id);

    // Gravação em contexto Familiar nunca grava na chave individual
    prototypeStorage.saveFamilyLimits(space.id, { alimentacao: 1100 });
    assert.deepEqual(prototypeStorage.getLimits(), {}, 'Chave individual deve continuar vazia');

    // Gravação em contexto Individual nunca grava na chave familiar
    prototypeStorage.saveLimits({ alimentacao: 350 });
    assert.equal(prototypeStorage.getFamilyLimits(space.id).alimentacao, 1100);
    assert.equal(prototypeStorage.getLimits().alimentacao, 350);
});

test('18. Preservação da interface e do comportamento do aplicativo principal', () => {
    const appContent = fs.readFileSync(path.resolve('src/App.jsx'), 'utf-8');
    // Rota /limits do app principal preservada
    assert.ok(appContent.includes('<Route path="limits" element={<Limits />} />'), 'App principal deve preservar rota /limits');

    // Nenhuma chave do app principal é tocada pelo protótipo
    const allKeys = Array.from(storage.keys());
    const foreignKeys = allKeys.filter(k => !k.startsWith('zimbroo_prototipo_') && k !== 'zimbroo_accounts');
    assert.deepEqual(foreignKeys, []);
});
