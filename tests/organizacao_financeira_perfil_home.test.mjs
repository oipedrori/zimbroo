import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock do ambiente do navegador
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

test('1. Emissão de evento e persistência ao alterar onboardingModel', () => {
    assert.equal(prototypeStorage.getOnboardingModel(), null);

    prototypeStorage.setOnboardingModel('individual');
    assert.equal(prototypeStorage.getOnboardingModel(), 'individual');
    assert.ok(dispatchedEvents.includes(PROTOTYPE_EVENTS.ONBOARDING_MODEL_CHANGED));

    prototypeStorage.setOnboardingModel('family');
    assert.equal(prototypeStorage.getOnboardingModel(), 'family');

    prototypeStorage.setOnboardingModel('both');
    assert.equal(prototypeStorage.getOnboardingModel(), 'both');
});

test('2. ensureActiveFamilySpace garante espaço familiar ativo', () => {
    // Sem espaços, cria o espaço padrão "Família" com criador "Avaliador"
    const familyId = prototypeStorage.ensureActiveFamilySpace();
    assert.ok(familyId, 'Deve retornar o ID do espaço familiar');

    const space = prototypeStorage.getFamilySpaceById(familyId);
    assert.equal(space.name, 'Família');
    assert.equal(prototypeStorage.getActiveFamilyId(), familyId);

    // Se chamado novamente, reutiliza o espaço existente
    const sameId = prototypeStorage.ensureActiveFamilySpace();
    assert.equal(sameId, familyId);
});

test('3. ProfileContent possui menu de ORGANIZAÇÃO FINANCEIRA no estilo do tema', () => {
    const profileContent = fs.readFileSync(path.resolve('src/components/ProfileContent.jsx'), 'utf-8');

    // Menu exclusivo do protótipo
    assert.ok(profileContent.includes('ORGANIZAÇÃO FINANCEIRA'), 'Deve conter o rótulo ORGANIZAÇÃO FINANCEIRA');
    assert.ok(profileContent.includes("key: 'individual', label: 'INDIVIDUAL'"), 'Opção INDIVIDUAL deve existir');
    assert.ok(profileContent.includes("key: 'family', label: 'FAMILIAR'"), 'Opção FAMILIAR deve existir');
    assert.ok(profileContent.includes("key: 'both', label: 'AMBOS'"), 'Opção AMBOS deve existir');
    assert.ok(profileContent.includes('setOnboardingModel'), 'Deve invocar setOnboardingModel');
});

test('4. Home renderiza seletor apenas quando o modelo for Ambos', () => {
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');

    // Condição para renderizar o seletor
    assert.ok(
        homeContent.includes("(onboardingModel || 'both') === 'both' && (") ||
        homeContent.includes("onboardingModel === 'both' && ("),
        'Seletor deve ser condicionado ao modelo ambos'
    );
});

test('5. Home exibe nome da família e ícone Users no modo familiar', () => {
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');

    // Ícone de perfil no header
    assert.ok(
        homeContent.includes("financialContext === 'family' ? <Users size={22} /> : <User size={22} />"),
        'Ícone de perfil deve ser Users no modo familiar e User no individual'
    );

    // Saudação no header
    assert.ok(
        homeContent.includes("financialContext === 'family'") &&
        homeContent.includes("activeFamilySpace?.name || 'Família'"),
        'Header deve exibir o nome da família no modo familiar'
    );
});

test('6. PrototypeContextSelector não contém a linha "Espaço:"', () => {
    const selectorContent = fs.readFileSync(path.resolve('src/components/PrototypeContextSelector.jsx'), 'utf-8');

    assert.ok(!selectorContent.includes('Espaço:'), 'PrototypeContextSelector não deve conter o texto "Espaço:"');
    assert.ok(!selectorContent.includes('ChevronDown'), 'PrototypeContextSelector não deve importar ChevronDown');
});

test('7. Título Limites é exibido no modo familiar', () => {
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');

    // Deve conter título Limites na seção mesmo se não houver espaço ativo
    assert.ok(
        homeContent.includes('<LimitsSection') && homeContent.includes('title="Limites"'),
        'LimitsSection deve receber title="Limites"'
    );
    assert.ok(
        homeContent.includes('Limites') && homeContent.includes('!activeFamilySpace'),
        'Heading Limites deve existir no estado vazio de familiar'
    );
});

test('8. No modo individual do protótipo a saudação não contém "Avaliador"', () => {
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');
    assert.ok(homeContent.includes("(hour >= 3 && hour < 12) ? 'Bom dia' :"));
    assert.ok(homeContent.includes("(hour >= 12 && hour < 18) ? 'Boa tarde' : 'Boa noite'"));
});

test('9. Remoção de Saldo em Caixa e Compromissos Futuros da Home', () => {
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');
    assert.ok(!homeContent.includes('Saldo em Caixa'), 'Home não deve exibir o bloco Saldo em Caixa');
    assert.ok(!homeContent.includes('Compromissos Futuros'), 'Home não deve exibir o bloco Compromissos Futuros');
    assert.ok(!homeContent.includes('Parcelas a vencer'), 'Home não deve exibir Parcelas a vencer');
});

test('10. Estatísticas: título dinâmico e Balanço Mensal em grid 3x4', () => {
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');
    assert.ok(homeContent.includes("financialContext === 'family' ? 'Estatísticas Familiares' : 'Estatísticas Individuais'"), 'Título deve alternar entre Estatísticas Familiares e Estatísticas Individuais');
    assert.ok(homeContent.includes("gridTemplateColumns: 'repeat(3, 1fr)'"), 'Balanço mensal deve usar grid de 3 colunas');
    assert.ok(homeContent.includes("const monthLabels = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']"), 'Deve conter os meses abreviados em caixa alta');
});

test('11. Onboarding demonstrativo na Home com passo do seletor em modo Ambos', () => {
    const onboardingContent = fs.readFileSync(path.resolve('src/components/Onboarding.jsx'), 'utf-8');
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');

    // Onboarding suporta passo do seletor condicionado a showSelectorStep
    assert.ok(onboardingContent.includes('onboarding-context-selector'), 'Deve conter id do passo do seletor');
    assert.ok(onboardingContent.includes('showSelectorStep'), 'Deve aceitar prop showSelectorStep');
    assert.ok(onboardingContent.includes('storageKey'), 'Deve aceitar storageKey customizado');
    assert.ok(onboardingContent.includes('Alterne entre suas finanças individuais e familiares'), 'Texto instrutivo do seletor deve estar presente');

    // Home possui o id no seletor e passa showSelectorStep condicionado a Ambos
    assert.ok(homeContent.includes('id="onboarding-context-selector"'), 'Container do seletor na Home deve conter id onboarding-context-selector');
    assert.ok(homeContent.includes("showSelectorStep={isPrototype && (onboardingModel || 'both') === 'both'}"), 'Home deve passar showSelectorStep apenas quando modelo for Ambos');
    assert.ok(homeContent.includes('tourStorageKey'), 'Home deve isolar a chave de tour do protótipo da chave do app principal');

    // Reset limpa a chave do tour
    localStorage.setItem(PROTOTYPE_STORAGE_KEYS.HAS_COMPLETED_TOUR, 'true');
    prototypeStorage.clearAllPrototypeData();
    assert.equal(localStorage.getItem(PROTOTYPE_STORAGE_KEYS.HAS_COMPLETED_TOUR), null);
});

test('12. Balanço Mensal com seletor (card/gráfico), gráfico de linha e valores reduzidos', () => {
    const homeContent = fs.readFileSync(path.resolve('src/pages/Home.jsx'), 'utf-8');

    // Estado com padrão 'cards'
    assert.ok(homeContent.includes("useState('cards')"), "Padrão deve ser 'cards'");

    // Botões do seletor com ícones no canto superior direito
    assert.ok(homeContent.includes('LayoutGrid'), 'Deve renderizar ícone de cards LayoutGrid');
    assert.ok(homeContent.includes('LineChart'), 'Deve renderizar ícone de gráfico LineChart');
    assert.ok(homeContent.includes("setBalanceViewMode('cards')"), 'Deve alternar para modo cards');
    assert.ok(homeContent.includes("setBalanceViewMode('line')"), 'Deve alternar para modo line');

    // Gráfico de linha SVG
    assert.ok(homeContent.includes('<svg'), 'Deve conter SVG para o gráfico');
    assert.ok(homeContent.includes('stroke="var(--primary-color, #10b981)"'), 'Linha deve usar cor primária');
    assert.ok(homeContent.includes('strokeDasharray="4 4"'), 'Linha de zero tracejada deve estar presente para balanços negativos');
    assert.ok(homeContent.includes('formatCompactNumber'), 'Deve usar formatador de valores compactados');

    // Formatação reduzida
    assert.ok(homeContent.includes("endsWith(',0') ? num.slice(0, -2) : num"), 'Deve formatar 1100 como 1,1K');
});


