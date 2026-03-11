import { GoogleGenerativeAI } from '@google/generative-ai';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';

// Lendo a chave de um arquivo .env para evitar vazamentos.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const analyzeTextWithGemini = async (text, transactions = [], conversationContext = null, locale = 'pt') => {
  if (!API_KEY) {
    console.error("Gemini API Key is missing! Check your .env file.");
    return { error: "Erro de configuração: Chave de API não encontrada." };
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const categoriesExpenseStr = CATEGORIAS_DESPESA.map(c => c.id).join(', ');
    const categoriesIncomeStr = CATEGORIAS_RECEITA.map(c => c.id).join(', ');

    const recentTxsStr = transactions.slice(0, 15).map(t =>
      `ID: ${t.id} | Tipo: ${t.type === 'expense' ? 'Despesa' : 'Receita'} | Valor: R$${t.amount} | Desc: ${t.description} | Cat: ${t.category}`
    ).join('\n');

    const currentDateStr = new Date().toLocaleDateString('pt-BR'); // Ex: 04/03/2026

    const prompt = `
Você é um assistente financeiro do aplicativo Zimbroo. O usuário enviará uma transcrição de voz.

Data de Hoje: ${currentDateStr}. Sempre que o usuário mencionar uma data específica (ex: "dia 10", "10 de marco"), calcule a data correta no formato YYYY-MM-DD considerando o mês/ano atual. Se não falar data, retorne um texto vazio "".

CONTEXTO FINANCEIRO RECENTE (Últimas transações):
${recentTxsStr || "Nenhuma transação recente"}

Categorias de Despesa: [${categoriesExpenseStr}]
Categorias de Receita: [${categoriesIncomeStr}]

CONVERSA PENDENTE ANTERIOR (O usuário está respondendo a uma pergunta sua):
${conversationContext ? JSON.stringify(conversationContext) : "Nenhuma pendência"}

REGRAS DE OURO:
1. PARCELAMENTO: Se o usuário falar que algo foi "parcelado em X vezes", "em 10x", etc., você DEVE calcular o valor de CADA parcela (Valor Total / X) e retornar no campo "amount". Defina "repeatType": "installment" e "installments": X.
2. RECORRÊNCIA: Se a transação parece ser um gasto fixo mensal (Aluguel, Energia, Internet, Plano de Celular, Condomínio, Netflix, Spotify, etc.) e o usuário AINDA não especificou se é recorrente, você DEVE retornar "action": "need_info" com uma mensagem perguntando se ele deseja tornar recorrente.
3. Se o usuário confirmar algo que você sugeriu (ex: "Sim", "Pode ser"), complete a ação usando o contexto anterior.

REGRAS ESTRITAS:
1. Você DEVE retornar APENAS um ÚNICO objeto JSON válido. NÃO inclua marcações markdown (\`\`\`json), nem texto antes ou depois. APENAS o JSON puro.
2. Você DEVE responder toda a chave "message" estritamente no idioma do usuário (${locale}). Se for "en", responda em Inglês. Se for "es", Espanhol, etc. E não traduza as propriedades do objeto JSON, apenas o conteúdo de "message".
3. Quando a ação for "analysis" ou apenas responder a informações ou opiniões pedidas pelo usuário, o campo "message" DEVE ter NO MÁXIMO 2 parágrafos. Seja conciso e direto.

Você APENAS PODE RESPONDER com um objeto JSON puro. NÃO INCLUA \`\`\`json ou markdown. Seu JSON deve obrigatoriamente seguir um destes modelos abaixo baseado no objetivo da fala:

MODELO 1: ADICIONAR NOVA TRANSAÇÃO
{
  "action": "add",
  "transaction": {
    "type": "expense", // ou "income"
    "amount": 10.50, // O valor de UMA parcela se for installment. Use PONTO (.) decimal.
    "description": "Ex: Aluguel",
    "category": "ID_CATEGORIA",
    "date": "2026-03-04",
    "repeatType": "none", // "none", "recurring", "installment"
    "installments": 1 // Quantidade de parcelas se for installment.
  }
}

MODELO 2: PEDIR MAIS INFORMAÇÕES (Sugerir Recorrência ou falta de dados)
{
  "action": "need_info",
  "message": "Notei que esse é um gasto fixo. Deseja que eu coloque como recorrente todos os meses?",
  "pendingData": { 
     "type": "expense",
     "amount": 1200,
     "description": "Aluguel",
     "category": "moradia",
     "repeatType": "recurring"
  }
}

MODELO 3: DELETAR UMA TRANSAÇÃO
{
  "action": "delete",
  "targetId": "ID_DA_TRANSACAO_NA_LISTA_RECENTE",
  "message": "Ok, apaguei o Spotify do seu registro."
}

MODELO 4: ANÁLISE GENÉRICA / DICAS FINACEIRAS
{
  "action": "analysis",
  "message": "Seu resumo e dicas sobre o texto."
}

Mensagem do usuário: "${text}"
`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // Fallback: strip markdown ticks if Gemini included them despite instructions
    responseText = responseText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();

    // Use regex to strictly extract JSON object
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      console.error("Gemini didn't return a valid JSON object:", responseText);
      throw new Error("Invalid output format");
    }

  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { error: `Erro na IA: ${error.message || "Tente novamente mais tarde."}` };
  }
};

export const generateInsightMessage = async (transactions = [], locale = 'pt') => {
  if (!API_KEY) {
    console.warn("VITE_GEMINI_API_KEY is not defined. Using fallback insight.");
    return "Pronto para organizar suas finanças hoje? É só apertar e falar.";
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const recentTxsStr = transactions.slice(0, 20).map(t =>
      `Tipo: ${t.type === 'expense' ? 'Despesa' : 'Receita'} | Valor: ${t.amount} | Desc: ${t.description} | Data: ${t.virtualDate}`
    ).join('\n');

    const prompt = `
Você é a voz interna de "pensamento" da IA do aplicativo financeiro Zimbroo. O usuário acabou de abrir o app.
Sua função é olhar o log das últimas transações listadas e gerar um ÚNICO insight curto e ALTAMENTE RELEVANTE que sirva de dica ou puxão de orelha (amigável) sobre o comportamento de gastos/ganhos dele.

TRANSAÇÕES RECENTES:
${recentTxsStr || "Nenhuma transação"}

REGRAS OBRIGATÓRIAS:
1. Você DEVE responder com NO MÁXIMO 1 FRASE (uma sentença curta brilhante e fluida). Textos longos são estritamente proibidos.
2. Se houver despesas recorrentes no mesmo tipo, avise. Se houver economia, elogie. Se estiver gastando muito com bobagens, alerte.
3. Se a lista estiver vazia, dê um incentivo amigável para ele registrar seus gastos do dia usando a voz.
4. NÃO use saudações ("Olá", "Bom dia"). Vá direto ao ponto.
5. Seja casual, inteligente, direto e pareça a consciência financeira da própria pessoa.
6. Responda estritamente no idioma: ${locale}.
7. Responda APENAS com a frase, sem aspas, sem markdown, puramente o texto limpo.
    `;

    const result = await model.generateContent(prompt);
    let message = result.response.text().trim();
    // Limpar aspas acidentais no começo/fim
    message = message.replace(/^["']|["']$/g, '');
    return message;
  } catch (error) {
    console.error("Gemini AI Insight Error:", error);
    return "Pronto para organizar suas finanças hoje? É só apertar e falar.";
  }
};
