import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';
import { AI_BUBBLE_PHRASES } from '../utils/phrases';

const callBackendAi = async (type, payload) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });

    if (!response.ok) {
      const errData = await response.json();
      const detailedError = errData.details ? `${errData.error} (${errData.details})` : (errData.error || 'Erro no servidor de IA');
      throw new Error(detailedError);
    }

    return await response.json();
  } catch (error) {
    console.error(`[GeminiService] ${type} failed:`, error);
    throw error;
  }
};

export const analyzeTextWithGemini = async (text, transactions = [], conversationContext = null, locale = 'pt') => {
  try {
    // --- ROUTER DE INTENÇÕES (REGEX) ---
    
    // ROTA 1: Relatório (Intercepção Local)
    const reportKeywords = /relat[óo]rio|gr[áa]fico|balan[çc]o|estat[íi]stica/i;
    if (reportKeywords.test(text)) {
      return {
        action: 'analysis',
        message: 'Para uma visão detalhada, clique no seu Card de Saldo para ver os gráficos das suas movimentações!'
      };
    }

    const categoriesExpenseStr = CATEGORIAS_DESPESA.map(c => c.id).join(', ');
    const categoriesIncomeStr = CATEGORIAS_RECEITA.map(c => c.id).join(', ');

    // ✅ Calcular resumo financeiro a partir de TODAS as transações do mês
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const monthlyBalance = totalIncome - totalExpenses;

    // Enviar até 50 transações para análise profunda
    const recentTxsStr = transactions.slice(0, 50).map(t =>
      `ID: ${t.id} | Tipo: ${t.type === 'expense' ? 'Despesa' : 'Receita'} | Valor: R$${t.amount.toFixed(2)} | Desc: ${t.description} | Cat: ${t.category} | Data: ${t.date || ''}`
    ).join('\n');

    // ROTA 2: Pergunta (Análise Contextual)
    const questionKeywords = /^(quem|quando|como|quanto|o que|vale a pena)/i;
    const isQuestion = questionKeywords.test(text.trim()) || text.includes('?') || text.toLowerCase().includes('limite');

    const currentDateStr = new Date().toLocaleDateString('pt-BR');
    let prompt = "";
    const model = "gemini-2.5-flash";

    if (isQuestion) {
      // ROTA 2: Análise Profunda (Mantém histórico para perguntas e limites)
      prompt = `
Você é um assistente financeiro do aplicativo Zimbroo. O usuário fez uma pergunta ou pediu para gerenciar limites: "${text}"

Data de Hoje: ${currentDateStr}.

═══ RESUMO FINANCEIRO DO MÊS ATUAL ═══
• Total de Receitas: R$${totalIncome.toFixed(2)}
• Total de Despesas: R$${totalExpenses.toFixed(2)}
• Saldo do Mês: R$${monthlyBalance.toFixed(2)} ${monthlyBalance >= 0 ? '(positivo ✓)' : '(negativo ✗)'}
═══════════════════════════════════════

TRANSAÇÕES DO MÊS:
${recentTxsStr || "Nenhuma transação registrada este mês"}

Categorias de Despesa: [${categoriesExpenseStr}]
Categorias de Receita: [${categoriesIncomeStr}]

INSTRUÇÕES:
1. Responda à pergunta do usuário considerando o contexto financeiro acima.
2. Se o usuário quiser definir um limite (ex: "limite de 500 em mercado"), retorne MODELO LIMITE.
3. Retorne APENAS o JSON puro.

MODELO ANÁLISE: {"action": "analysis", "message": "Sua resposta curta..."}
MODELO LIMITE: {"action": "limit", "category": "ID_CATEGORIA", "amount": 500.00, "message": "Confirmação..."}
`;
    } else {
      // ROTA 3: Extração de Transação (Prompt Curto)
      prompt = `
Você é um extrator financeiro. Transforme a frase do usuário em um JSON: {"valor": number, "categoria": string, "tipo": "despesa"|"receita", "descricao": string}. Não responda com texto, apenas o JSON.

Categorias de Despesa: [${categoriesExpenseStr}]
Categorias de Receita: [${categoriesIncomeStr}]

Mensagem do usuário: "${text}"
`;
    }

    const result = await callBackendAi('analyze', { prompt, model });
    let responseText = result.text;
    responseText = responseText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid output format from AI");
    
    const aiJson = JSON.parse(jsonMatch[0]);

    // Se for ROTA 3 (Extração Direta), mapear para o formato do app (MODELO 1)
    if (!isQuestion && aiJson.valor) {
      return {
        action: "add",
        transactions: [
          {
            type: aiJson.tipo === 'receita' ? 'income' : 'expense',
            amount: parseFloat(aiJson.valor),
            description: aiJson.descricao,
            category: aiJson.categoria,
            date: "",
            repeatType: "none",
            installments: 1
          }
        ]
      };
    }

    return aiJson;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { error: `IA protegida: ${error.message || "Tente novamente."}` };
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

    const result = await callBackendAi('suggest_limit', { prompt, model: "gemini-1.5-flash" });
    let text = result.text;
    text = text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Error suggesting limit:", error);
    return { amount: null, reason: "Não consegui calcular agora." };
  }
};
