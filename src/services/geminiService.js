import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Limpa e extrai JSON de uma string de resposta (remove markdown e textos extras)
 */
const extractJsonContent = (str) => {
    try {
        const jsonMatch = str.match(/\{[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : str;
    } catch (e) {
        return str;
    }
};

/**
 * Fetch com timeout para evitar que a UI fique travada
 */
const fetchWithTimeout = async (url, options, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

const callBackendAi = async (payload, uid, retries = 1) => {
  try {
    const response = await fetchWithTimeout('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, uid })
    }, 15000);

    if (!response.ok) {
        const errData = await response.json();
        if (errData.action === 'show_paywall') return { action: 'paywall' };
        // Mostra os detalhes técnicos se disponíveis (ajuda a debugar)
        const errorMessage = errData.details || errData.error || 'Erro no servidor de IA';
        throw new Error(errorMessage);
    }

    const data = await response.json();
    const cleanText = extractJsonContent(data.text);
    return JSON.parse(cleanText);
  } catch (error) {
    if (retries > 0 && error.name !== 'AbortError') {
        console.warn(`[GeminiService] AI Call failed, retrying... (${retries} left)`);
        return callBackendAi(payload, uid, retries - 1);
    }
    const msg = error.message || 'Erro no servidor de IA';
    console.error(`[GeminiService] AI Call failed:`, error);
    throw new Error(msg);
  }
};

/**
 * REFAZENDO DO ZERO: O "Cérebro" da Interação com IA
 */
export const analyzeTextWithGemini = async (text, currentMonthTransactions = [], allTransactions = [], uid = null) => {
  try {
    const lowerText = text.toLowerCase();
    let context = "";

    // 1. Identificar intenção e construir contexto otimizado (Token Saving)
    const isLimit = lowerText.includes('limite') || lowerText.includes('teto') || lowerText.includes('orçamento');
    const isBroad = lowerText.includes('ano') || lowerText.includes('histórico') || lowerText.includes('meses passados') || lowerText.includes('saldo anual');
    const isAnalyze = lowerText.includes('quanto') || lowerText.includes('como') || lowerText.includes('qual') || lowerText.includes('ajuda');

    if (isLimit) {
        // Contexto: Últimos 3 meses da categoria (se identificável localmente) ou resumo geral
        const last3Months = buildCategoryHistory(allTransactions);
        context = `Histórico de gastos por categoria nos últimos 3 meses: ${last3Months}`;
    } else if (isBroad) {
        // Contexto: Apenas totais mensais (sem detalhes de transações) -> TOKEN SAVING
        context = buildAnnualSummary(allTransactions);
    } else if (isAnalyze) {
        // Contexto: Apenas transações do mês atual (resumidas)
        context = `Transações do mês atual: ${currentMonthTransactions.map(t => `${t.description}: R$${t.amount} (${t.category})`).join(', ')}`;
    }

    // 2. Chamar Backend
    const aiResponse = await callBackendAi({ prompt: text, context }, uid);

    // 3. Processar Ação
    if (aiResponse.action === 'paywall') {
        return { action: 'show_paywall', trigger_type: 'feature_gate' };
    }

    if (aiResponse.action === 'add' && aiResponse.transactions) {
        return {
            action: 'add',
            transactions: aiResponse.transactions.map(tx => {
                const totalValor = parseFloat(tx.valor) || 0;
                const parcelasCount = parseInt(tx.parcelas) || 1;
                
                return {
                    type: tx.tipo === 'income' || tx.tipo === 'receita' ? 'income' : 'expense',
                    amount: tx.parcelas > 1 ? totalValor / parcelasCount : totalValor,
                    totalAmount: totalValor,
                    description: tx.descricao,
                    category: tx.categoria || 'outros',
                    date: format(new Date(), 'yyyy-MM-dd'),
                    repeatType: tx.parcelas > 1 ? 'installment' : (tx.tipo_recorrencia === 'recurring' ? 'recurring' : 'none'),
                    installments: parcelasCount
                };
            })
        };
    }

    if (aiResponse.action === 'limit') {
        return {
            action: 'limit',
            category: aiResponse.category,
            amount: aiResponse.amount,
            message: aiResponse.message || `Limite de R$${aiResponse.amount} definido para ${aiResponse.category}.`
        };
    }

    if (aiResponse.action === 'analyze') {
        return { action: 'analysis', message: aiResponse.message };
    }

    return aiResponse;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { error: error.message || "Erro desconhecido na IA. Tente novamente em breve." };
  }
};

// --- Helpers de Contexto (Token Optimization) ---

const buildAnnualSummary = (allTransactions) => {
    const history = {};
    allTransactions.forEach(t => {
        const date = new Date(t.date || t.createdAt);
        if (date.getFullYear() !== new Date().getFullYear()) return; // Só este ano
        
        const key = format(date, 'yyyy-MM');
        if (!history[key]) history[key] = { inc: 0, exp: 0 };
        if (t.type === 'income') history[key].inc += t.amount;
        else history[key].exp += t.amount;
    });

    return Object.entries(history)
        .map(([m, v]) => `${m}: Ganho R$${v.inc.toFixed(0)}, Gasto R$${v.exp.toFixed(0)}`)
        .join(' | ');
};

const buildCategoryHistory = (allTransactions) => {
    const threeMonthsAgo = subMonths(new Date(), 3);
    const summary = {};
    
    allTransactions
        .filter(t => new Date(t.date || t.createdAt) >= threeMonthsAgo)
        .forEach(t => {
            if (!summary[t.category]) summary[t.category] = 0;
            summary[t.category] += t.amount;
        });

    return Object.entries(summary)
        .map(([cat, total]) => `${cat}: R$${total.toFixed(0)} total (3 meses)`)
        .join(', ');
};

export const generateInsightMessage = async () => {
  return "Precisa de ajuda com suas finanças? É só falar!";
};
