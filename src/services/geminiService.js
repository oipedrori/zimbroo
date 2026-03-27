import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';
import { AI_BUBBLE_PHRASES } from '../utils/phrases';

const callBackendAi = async (type, payload, uid, premiumPrompt) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, uid, premiumPrompt })
    });

    if (!response.ok) {
      const errData = await response.json();
      
      // Paywall Interception
      if (errData.action === 'show_paywall') {
         return { action: 'show_paywall', error: errData.error, message: 'Limite atingido.' };
      }

      const detailedError = errData.details ? `${errData.error} (${errData.details})` : (errData.error || 'Erro no servidor de IA');
      throw new Error(detailedError);
    }

    return await response.json();
  } catch (error) {
    console.error(`[GeminiService] ${type} failed:`, error);
    throw error;
  }
};

export const analyzeTextWithGemini = async (text, transactions = [], conversationContext = null, locale = 'pt', allTransactions = [], uid = null) => {
  try {
    const lowerText = text.toLowerCase();

    // --- 1. ROTAS DE UI (INTERCEPTAÇÃO LOCAL) ---
    const routeRelatorio = /relatório|gráfico|balanço|estatística/i;
    if (routeRelatorio.test(text)) {
      return { action: 'analysis', message: 'Para uma visão detalhada, clique no seu Card de Saldo na tela inicial para ver os gráficos.' };
    }

    const routeGestao = /remover|deletar|excluir|editar|mudar|alterar/i;
    if (routeGestao.test(text)) {
      return { action: 'analysis', message: 'Para editar uma movimentação, arraste-a para a direita. Para excluir, arraste para a esquerda.' };
    }

    let prompt = "";
    const model = "gemini-1.5-flash";

    // --- CLASSIFICAÇÃO DE ROTAS Gemini ---
    const isLimitRoute = lowerText.includes('limite') || lowerText.includes('teto') || lowerText.includes('orçamento');
    const isHistoryRoute = lowerText.includes('ano') || lowerText.includes('histórico') || lowerText.includes('meses passados') || lowerText.includes('evolução');
    const isCurrentAnalysisRoute = (lowerText.includes('quanto') || lowerText.includes('como') || lowerText.includes('está') || lowerText.includes('status')) && !isLimitRoute && !isHistoryRoute;

    if (isLimitRoute) {
      // --- 5. ROTA DE LIMITES ---
      const amountMatch = text.match(/([\d.,]+)/);
      let last3MonthsData = "";
      
      if (!amountMatch) {
        // Buscar categoria mencionada para injetar histórico
        const allCats = [...CATEGORIAS_DESPESA, ...CATEGORIAS_RECEITA];
        const matchedCat = allCats.find(c => lowerText.includes(c.id.toLowerCase()) || lowerText.includes(c.label.toLowerCase()));
        if (matchedCat) {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          const relevantTxs = allTransactions.filter(t => (t.category === matchedCat.id) && new Date(t.date || t.createdAt) >= threeMonthsAgo);
          const total = relevantTxs.reduce((sum, t) => sum + t.amount, 0);
          last3MonthsData = `Total gasto em ${matchedCat.label} nos últimos 3 meses: R$${total.toFixed(2)}`;
        }
      }

      prompt = `Você gerencia os limites de gastos do Zimbroo. O usuário quer um limite para a categoria solicitada.
REGRAS:
1. Se o usuário já informou o valor desejado, apenas crie o limite.
2. Se o usuário NÃO informou o valor, analise o total gasto nesta categoria nos últimos 3 meses (Dados: ${last3MonthsData}). Com base nisso, sugira um valor de limite realista, explique brevemente o motivo, e considere o limite como criado na ação.
FORMATO DE SAÍDA: {'action': 'limit', 'category': 'ID_CATEGORIA', 'amount': number, 'message': 'Mensagem natural confirmando a criação e/ou explicando a sugestão de valor'}`;
    } 
    else if (isHistoryRoute) {
      // --- 4. ROTA DE ANÁLISE: HISTÓRICO E ANO ---
      const history = {};
      allTransactions.forEach(t => {
        const date = new Date(t.date || t.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!history[key]) history[key] = { income: 0, expense: 0 };
        if (t.type === 'income') history[key].income += t.amount;
        else history[key].expense += t.amount;
      });
      const monthlyBalancesHistory = Object.entries(history)
        .map(([m, val]) => `${m}: Saldo R$${(val.income - val.expense).toFixed(2)} (Ganho R$${val.income.toFixed(2)}, Gasto R$${val.expense.toFixed(2)})`)
        .join('\n');

      prompt = `Você é o analista financeiro do Zimbroo. Avalie a evolução financeira do usuário usando APENAS este resumo de saldos mensais:
${monthlyBalancesHistory}
Retorne insights macro de forma objetiva em JSON: {'action': 'analysis', 'message': 'Sua resposta aqui'}.`;
    }
    else if (isCurrentAnalysisRoute) {
      // --- 3. ROTA DE ANÁLISE: MÊS ATUAL ---
      const currentMonthTxs = transactions.map(t => `- R$${t.amount.toFixed(2)} | ${t.description || 'Sem descrição'} (${t.category})`).join('\n');
      prompt = `Você é o analista financeiro do Zimbroo. Responda à dúvida do usuário baseando-se EXCLUSIVAMENTE na seguinte lista de movimentações do mês atual:
${currentMonthTxs}
Seja direto e natural. Retorne apenas JSON: {'action': 'analysis', 'message': 'Sua resposta aqui'}.`;
    }
    else {
      // --- 2. ROTA DE INSERÇÃO ---
      prompt = `Você é o extrator de dados do Zimbroo. Transforme a entrada em um JSON estrito.
CONTEXTO:
- Estado Pendente: ${conversationContext ? JSON.stringify(conversationContext) : 'vazio'}
- Nova Entrada: ${text}
REGRAS:
1. Múltiplas Adições: O usuário pode adicionar até 5 movimentações de uma vez (ex: 'mercado 50 e padaria 35'). Retorne todas dentro da lista 'transactions'.
2. Decimais Especiais: Interprete as palavras 'e' ou 'com' como separadores de centavos (ex: '24 e 30' ou '24 com 30' equivale ao valor numérico 24.30).
3. Memória de Curto Prazo: Combine o 'Estado Pendente' com a 'Nova Entrada'.
4. Dados Faltantes: Se, após combinar o contexto, faltar VALOR, CATEGORIA ou TIPO (receita/despesa) em qualquer transação, defina action: 'need_info', atualize o objeto 'pendingData' com o que já descobriu, e escreva uma 'message' curta e natural perguntando apenas o que falta.
5. DESCRIÇÃO LIMPA: Não inclua verbos de ação (gastei, paguei, comprei, recebi) ou pronomes (eu) na descrição. Extraia apenas o item ou local (ex: 'Mercado', 'Padaria', 'Salário').
6. REPETIÇÃO: Identifique se é parcelado (ex: 'em 10x', '10 vezes') ou recorrente (ex: 'todo mês', 'mensal'). 
   - Se recorrente: tipo_recorrencia='recurring'
   - Se parcelado: tipo_recorrencia='installment', parcelas=número (ex: 10)
   - Caso contrário: tipo_recorrencia='none', parcelas=1
   - IMPORTANTE: Gastos variáveis como 'Mercado', 'Gasolina', 'Ifood' ou 'Restaurante' NÃO devem ser marcados como recorrentes, pois o valor muda todo mês. Use 'recurring' apenas para contas fixas (aluguel, internet, assinaturas) ou se o usuário pedir explicitamente.
FORMATO DE SAÍDA:
- Completo: {'action': 'add', 'transactions': [{'valor': number, 'categoria': string, 'tipo': 'despesa'|'receita', 'descricao': string, 'tipo_recorrencia': 'none'|'recurring'|'installment', 'parcelas': number}]}
- Incompleto: {'action': 'need_info', 'pendingData': {...}, 'message': '...'}`;
    }

    const premiumPrompt = prompt; // Send as premiumPrompt to the backend, the backend will decide whether to use it based on the user's status.
    // O backend agora injeta o "strict JSON prompt" caso o usuário seja gratuito.
    const result = await callBackendAi('analyze', { prompt: text, model }, uid, premiumPrompt);
    
    // Check if the backend intercepted due to limit
    if (result.action === 'show_paywall') {
       return result;
    }

    let responseText = result.text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/); // Matches objects or arrays
    if (!jsonMatch) {
       // Se o Gemini backend (gating free user) retornou "action: paywall", a regex ainda deve achar, mas caso não ache:
       if (responseText.includes('"action": "paywall"')) return { action: 'show_paywall', trigger_type: 'feature_gate' };
       throw new Error("Invalid output format from IA");
    }
    
    const aiJson = JSON.parse(jsonMatch[0]);

    if (aiJson.action === 'paywall') {
        return { action: 'show_paywall', trigger_type: 'feature_gate' };
    }

    if (aiJson.action === 'add' || aiJson.transactions) {
      return {
        action: "add",
        transactions: aiJson.transactions.map(tx => ({
          type: tx.tipo === 'receita' ? 'income' : 'expense',
          amount: parseFloat(tx.valor),
          description: tx.descricao,
          category: tx.categoria,
          date: new Date().toISOString().split('T')[0],
          repeatType: tx.tipo_recorrencia || "none",
          installments: tx.parcelas || 1
        }))
      };
    }

    return aiJson;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { error: `Erro na IA: ${error.message}` };
  }
};

export const generateInsightMessage = async (transactions = [], locale = 'pt') => {
  const randomIndex = Math.floor(Math.random() * AI_BUBBLE_PHRASES.length);
  return AI_BUBBLE_PHRASES[randomIndex];
};

export const suggestCategoryLimit = async (category, transactions = [], locale = 'pt') => {
  try {
    const recentTxs = transactions
      .filter(t => t.category === category)
      .slice(0, 20)
      .map(t => `R$${t.amount} (${t.description})`)
      .join(', ');

    const prompt = `
      Com base na lista de gastos recentes da categoria "${category}": [${recentTxs || "Nenhum gasto registrado"}].
      Estipule um limite mensal ideal para essa categoria. 
      Considere a média de gastos e adicione uma margem de segurança de 10%.
      
      Retorne APENAS um JSON com o campo "amount" (número) e "reason" (uma frase curta explicando o porquê em ${locale}).
      Ex: {"amount": 150.00, "reason": "Sua média é R$130, deixamos uma margem extra."}
    `;

    // Limit calculation doesn't consume the text input of the user, but we will protect it in the frontend later or pass UID
    const result = await callBackendAi('suggest_limit', { prompt, model: "gemini-1.5-flash" }, null, prompt);
    let text = result.text;
    text = text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Error suggesting limit:", error);
    return { amount: null, reason: "Não consegui calcular agora." };
  }
};
