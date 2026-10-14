import { format, subDays, addDays } from 'date-fns';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories.js';

/**
 * Mapeamento determinístico de palavras-chave para categorias.
 */
const CATEGORY_KEYWORDS = {
    // Despesas
    alimentacao: [
        'mercado', 'supermercado', 'supermercados', 'feira', 'açougue', 'acougue', 'hortifruti',
        'almoço', 'almoco', 'jantar', 'refeição', 'refeicao', 'lanche', 'pizza', 'pizzaria',
        'hambúrguer', 'hamburguer', 'hamburgueria', 'padaria', 'pão', 'pao', 'café', 'cafe', 'cafeteria',
        'ifood', 'restaurante', 'restaurantes', 'bar', 'botequim', 'comida', 'churrasco', 'churrascaria'
    ],
    moradia: [
        'energia', 'luz', 'enel', 'ceee', 'copel', 'água', 'agua', 'sabesp', 'sanepar',
        'aluguel', 'condomínio', 'condominio', 'gás', 'gas', 'internet', 'claro', 'vivo',
        'iptu', 'reforma', 'casa', 'apartamento'
    ],
    transporte: [
        'uber', '99', 'táxi', 'taxi', 'metrô', 'metro', 'ônibus', 'onibus',
        'gasolina', 'combustível', 'combustivel', 'posto', 'etanol', 'diesel',
        'estacionamento', 'pedágio', 'pedagio', 'passagem', 'carro', 'moto', 'oficina'
    ],
    saude: [
        'farmácia', 'farmacia', 'farmácias', 'farmacias', 'drogaria', 'drogarias', 'remédio', 'remedio', 'remédios', 'remedios', 'medicamento', 'medicamentos',
        'médico', 'medico', 'consulta', 'dentista', 'exame', 'hospital', 'psicólogo',
        'psicologo', 'plano de saúde', 'plano de saude'
    ],
    lazer: [
        'cinema', 'teatro', 'show', 'viagem', 'hotel', 'praia', 'passeio', 'festa', 'jogo', 'ingresso'
    ],
    assinaturas: [
        'netflix', 'spotify', 'amazon prime', 'streaming', 'hbo', 'disney', 'youtube premium', 'assinatura'
    ],
    vestuario: [
        'roupa', 'roupas', 'camisa', 'camiseta', 'calça', 'calca', 'sapato', 'tênis', 'tenis',
        'vestido', 'shopping', 'zara', 'renner', 'riachuelo', 'c&a'
    ],
    pet: [
        'pet', 'ração', 'racao', 'veterinário', 'veterinario', 'cachorro', 'gato', 'petshop'
    ],
    educacao: [
        'curso', 'faculdade', 'escola', 'livro', 'livros', 'mensalidade', 'aula'
    ],
    // Receitas
    salario: [
        'salário', 'salario', 'adiantamento', 'holerite', 'empresa', 'pagamento da empresa'
    ],
    freela: [
        'freela', 'freelance', 'bico', 'serviço', 'servico', 'projeto', 'cliente'
    ],
    investimento: [
        'rendimento', 'rendimentos', 'dividendo', 'dividendos', 'juros', 'cdb', 'ações', 'acoes'
    ],
    reembolso: [
        'reembolso', 'estorno', 'devolução', 'devolucao', 'cashback'
    ]
};

/**
 * Converte palavras numéricas comuns em português para número
 */
const parseWordNumber = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('cem')) return 100;
    if (lower.includes('duzentos')) return 200;
    if (lower.includes('trezentos')) return 300;
    if (lower.includes('quatrocentos')) return 400;
    if (lower.includes('quinhentos')) return 500;
    if (lower.includes('seiscentos')) return 600;
    if (lower.includes('setecentos')) return 700;
    if (lower.includes('oitocentos')) return 800;
    if (lower.includes('novecentos')) return 900;
    if (lower.includes('mil')) {
        const parts = lower.split('mil');
        const before = parts[0].trim();
        if (!before || before === 'um') return 1000;
        if (before === 'dois') return 2000;
        if (before === 'três' || before === 'tres') return 3000;
        if (before === 'quatro') return 4000;
        if (before === 'cinco') return 5000;
    }
    return null;
};

/**
 * Extrai valor monetário em BRL do texto
 */
export const extractAmount = (text) => {
    // 1. Tenta padrão de moeda explícito: R$ 50,00 ou R$ 50
    const rsMatch = text.match(/R\$\s*([\d.,]+)/i);
    if (rsMatch) {
        const raw = rsMatch[1].replace(/\./g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0) return val;
    }

    // 2. Padrão "X e Y" (ex: "156 e 80", "156 e 80 centavos")
    const centsMatch = text.match(/(\d+)\s*e\s*(\d{1,2})\s*(?:reais|centavos)?/i);
    if (centsMatch) {
        const integers = parseInt(centsMatch[1], 10);
        const cents = parseInt(centsMatch[2].padEnd(2, '0'), 10);
        return integers + cents / 100;
    }

    // 3. Padrão "X reais" ou "X real"
    const reaisMatch = text.match(/([\d.,]+)\s*(?:reais|real|pila|conto)/i);
    if (reaisMatch) {
        const raw = reaisMatch[1].replace(/\./g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0) return val;
    }

    // 4. Padrão "por X" ou "de X" ou "foi X"
    const prepMatch = text.match(/(?:por|de|foi|custou|valor de)\s*([\d.,]+)/i);
    if (prepMatch) {
        const raw = prepMatch[1].replace(/\./g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0) return val;
    }

    // 5. Palavras numéricas
    const wordNum = parseWordNumber(text);
    if (wordNum !== null) return wordNum;

    // 6. Qualquer número isolado maior que zero
    const anyNumMatch = text.match(/\b(\d+(?:[.,]\d+)?)\b/);
    if (anyNumMatch) {
        const raw = anyNumMatch[1].replace(/\./g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0) return val;
    }

    return null;
};

/**
 * Interpretador local determinístico de texto financeiro
 */
export const parseFinancialText = (rawInput, options = {}) => {
    if (!rawInput || typeof rawInput !== 'string') {
        return null;
    }

    const text = rawInput.trim();
    const lower = text.toLowerCase();

    // 1. Extração do valor
    const amount = extractAmount(text);
    if (!amount || isNaN(amount) || amount <= 0) {
        return null;
    }

    // 2. Tipo (Receita vs Despesa)
    const incomeKeywords = ['recebi', 'receber', 'receita', 'ganhei', 'salário', 'salario', 'renda', 'depósito', 'deposito', 'reembolso', 'bônus', 'bonus', 'cashback', 'vendi', 'venda'];
    const isIncome = incomeKeywords.some(kw => lower.includes(kw));
    const type = isIncome ? 'income' : 'expense';

    // 3. Identificação de Categoria
    let matchedCategory = type === 'income' ? CATEGORIAS_RECEITA[0].id : CATEGORIAS_DESPESA[0].id;
    let foundCat = false;

    const matchesKeyword = (targetText, keyword) => {
        if (keyword.includes(' ')) {
            return targetText.includes(keyword);
        }
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[^a-záàâãéèêíïóôõöúçñ])${escaped}([^a-záàâãéèêíïóôõöúçñ]|$)`, 'i');
        return regex.test(targetText);
    };

    for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => matchesKeyword(lower, kw))) {
            matchedCategory = catId;
            foundCat = true;
            break;
        }
    }

    if (!foundCat) {
        matchedCategory = type === 'income' ? 'outros' : 'outros';
    }

    // 4. Forma de Pagamento e Parcelas
    const isCredit = lower.includes('cartão') || lower.includes('cartao') || lower.includes('crédito') || lower.includes('credito');
    let paymentMethod = isCredit ? 'credit' : 'cash';
    let installments = 1;
    let repeatType = 'none';

    // Detecção de parcelas: "em 3x", "3 parcelas", "em 3 vezes"
    const installmentMatch = text.match(/(?:em\s*)?(\d+)\s*(?:x|vezes|parcelas)/i);
    if (installmentMatch) {
        const num = parseInt(installmentMatch[1], 10);
        if (num > 1) {
            installments = Math.min(num, 36); // teto razoável de 36 parcelas
            paymentMethod = 'credit'; // Parcelamento por padrão é cartão de crédito
            repeatType = 'installment';
        }
    } else if (lower.includes('todo mês') || lower.includes('todo mes') || lower.includes('mensal') || lower.includes('recorrente')) {
        repeatType = 'recurring';
    }

    // 5. Data
    let txDate = format(new Date(), 'yyyy-MM-dd');
    if (lower.includes('ontem')) {
        txDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    } else if (lower.includes('amanhã') || lower.includes('amanha')) {
        txDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    }

    // 6. Descrição legível
    // Extrai o principal sujeito ou verbo substantivo da frase
    let description = '';
    const cleanTokens = text
        .replace(/r\$\s*[\d.,]+/gi, '')
        .replace(/\b\d+\s*(?:reais|real|pila|conto|x|vezes|parcelas)\b/gi, '')
        .replace(/\b(gastei|comprei|paguei|recebi|ganhei|no|na|de|com|em|por|um|uma|o|a)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleanTokens.length >= 2) {
        description = cleanTokens.charAt(0).toUpperCase() + cleanTokens.slice(1);
    } else {
        // Fallback para o nome amigável da categoria
        const catInfo = type === 'income'
            ? CATEGORIAS_RECEITA.find(c => c.id === matchedCategory)
            : CATEGORIAS_DESPESA.find(c => c.id === matchedCategory);
        description = catInfo ? catInfo.label : (type === 'income' ? 'Receita' : 'Despesa');
    }

    // 7. Contexto de Destino e Associação
    let scope = 'individual';
    let matchedMemberId = null;

    // Verificar se algum membro da família foi mencionado pelo primeiro nome
    if (options.familyMembers && options.familyMembers.length > 0) {
        for (const member of options.familyMembers) {
            const firstName = (member.name || '').split(' ')[0].toLowerCase();
            if (firstName.length >= 3 && lower.includes(firstName)) {
                matchedMemberId = member.id;
                scope = 'family';
                break;
            }
        }
    }

    if (scope !== 'family') {
        const familyKeywords = ['familiar', 'família', 'familia', 'compartilhado', 'da casa', 'pra casa', 'nossa casa'];
        const individualKeywords = ['individual', 'pessoal', 'meu', 'minha', 'só meu', 'so meu'];

        if (familyKeywords.some(kw => lower.includes(kw))) {
            scope = 'family';
        } else if (individualKeywords.some(kw => lower.includes(kw))) {
            scope = 'individual';
        } else {
            const currentContext = options.context || 'individual';
            scope = currentContext === 'family' ? 'family' : 'individual';
        }
    }

    // Se escopo for familiar mas não tiver espaço ativo, fallback para individual
    if (scope === 'family' && !options.activeFamilySpace) {
        scope = 'individual';
    }

    const familyId = (scope === 'family' && options.activeFamilySpace) ? options.activeFamilySpace.id : null;
    const memberId = (scope === 'family')
        ? (matchedMemberId || (options.familyMembers?.[0]?.id || null))
        : null;

    return {
        type,
        amount,
        description,
        category: matchedCategory,
        date: txDate,
        paymentMethod,
        repeatType,
        installments,
        scope,
        familyId,
        memberId,
        rawText: text
    };
};
