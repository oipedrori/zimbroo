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

    // Enviar até 50 transações (em vez de 15) com ID para permitir deletar
    const recentTxsStr = transactions.slice(0, 50).map(t =>
      `ID: ${t.id} | Tipo: ${t.type === 'expense' ? 'Despesa' : 'Receita'} | Valor: R$${t.amount.toFixed(2)} | Desc: ${t.description} | Cat: ${t.category} | Data: ${t.date || ''}`
    ).join('\n');

    const currentDateStr = new Date().toLocaleDateString('pt-BR');

    const prompt = `
Você é um assistente financeiro do aplicativo Zimbroo. O usuário enviará uma mensagem de texto ou voz.

Data de Hoje: ${currentDateStr}. Sempre que o usuário mencionar uma data específica (ex: "dia 10", "10 de marco"), calcule a data correta no formato YYYY-MM-DD considerando o mês/ano atual. Se não falar data, retorne um texto vazio "".

═══ RESUMO FINANCEIRO DO MÊS ATUAL ═══
• Total de Receitas: R$${totalIncome.toFixed(2)}
• Total de Despesas: R$${totalExpenses.toFixed(2)}
• Saldo do Mês: R$${monthlyBalance.toFixed(2)} ${monthlyBalance >= 0 ? '(positivo ✓)' : '(negativo ✗)'}
• Número de transações: ${transactions.length}
═══════════════════════════════════════

TRANSAÇÕES DO MÊS (últimas ${Math.min(transactions.length, 50)} de ${transactions.length}):
${recentTxsStr || "Nenhuma transação registrada este mês"}

Categorias de Despesa: [${categoriesExpenseStr}]
Categorias de Receita: [${categoriesIncomeStr}]

CONVERSA PENDENTE ANTERIOR (O usuário está respondendo a uma pergunta sua):
${conversationContext ? JSON.stringify(conversationContext) : "Nenhuma pendência"}

REGRAS DE OURO:
1. PARCELAMENTO: Se o usuário falar que algo foi "parcelado em X vezes", "em 10x", etc., você DEVE calcular o valor de CADA parcela (Valor Total / X) e retornar no campo "amount". Defina "repeatType": "installment" e "installments": X.
2. RECORRÊNCIA: Se a transação parece ser um gasto fixo mensal (Aluguel, Energia, Internet, Plano de Celular, Condomínio, Netflix, Spotify, etc.) e o usuário AINDA não especificou se é recorrente, você DEVE retornar "action": "need_info" com uma mensagem perguntando se ele deseja tornar recorrente.
3. Se o usuário confirmar algo que você sugeriu (ex: "Sim", "Pode ser"), complete a ação usando o contexto anterior.
4. SALDO E ANÁLISES: Ao responder sobre saldo, receitas, despesas ou qualquer análise financeira, use SEMPRE os valores do RESUMO FINANCEIRO acima. Nunca tente calcular da lista de transações.

REGRAS ESTRITAS:
1. Você DEVE retornar APENAS um ÚNICO objeto JSON válido. NÃO inclua marcações markdown (\`\`\`json), nem texto antes ou depois. APENAS o JSON puro.
2. Você DEVE responder toda a chave "message" estritamente no idioma do usuário (${locale}). Se for "en", responda em Inglês. Se for "es", Espanhol, etc. E não traduza as propriedades do objeto JSON, apenas o conteúdo de "message".
3. Quando a ação for "analysis" ou apenas responder a informações ou opiniões pedidas pelo usuário, o campo "message" DEVE ter NO MÁXIMO 2 parágrafos. Seja conciso e direto.

Você APENAS PODE RESPONDER com um objeto JSON puro. NÃO INCLUA \`\`\`json ou markdown. Seu JSON deve obrigatoriamente seguir um destes modelos abaixo baseado no objetivo da fala:

MODELO 1: ADICIONAR NOVA(S) TRANSAÇÃO(ÕES)
{
  "action": "add",
  "transactions": [
    {
      "type": "expense", // ou "income"
      "amount": 10.50, // O valor de UMA parcela se for installment. Use PONTO (.) decimal.
      "description": "Ex: Padaria",
      "category": "ID_CATEGORIA",
      "date": "2026-03-04",
      "repeatType": "none", // "none", "recurring", "installment"
      "installments": 1 // Quantidade de parcelas se for installment.
    }
  ]
}

MODELO 2: PEDIR MAIS INFORMAÇÕES
{
  "action": "need_info",
  "message": "Deseja que eu coloque como recorrente todos os meses?",
  "pendingData": { "type": "expense", "amount": 1200, "description": "Aluguel", "category": "moradia", "repeatType": "recurring" }
}

MODELO 3: DELETAR UMA TRANSAÇÃO
{
  "action": "delete",
  "targetId": "ID_DA_TRANSACAO",
  "message": "Ok, apaguei o registro."
}

MODELO 4: ANÁLISE GENÉRICA
{
  "action": "analysis",
  "message": "Resumo aqui..."
}

Mensagem do usuário: "${text}"
`;

    const result = await callBackendAi('analyze', { prompt, model: "gemini-2.5-flash" });
    let responseText = result.text;

    // Fallback: strip markdown ticks if Gemini included them despite instructions
    responseText = responseText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();

    // Use regex to strictly extract JSON object
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Invalid output format from AI");
    }

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
