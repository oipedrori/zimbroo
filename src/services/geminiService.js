import { GoogleGenerativeAI } from '@google/generative-ai';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categories';

// Lendo a chave de um arquivo .env para evitar vazamentos, com fallback direto para a chave atual informada para resolver problemas de cache.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyDEThSbhNYqYn_imgQktAiu_NoqpqT_0GQ";
const genAI = new GoogleGenerativeAI(API_KEY);

export const analyzeTextWithGemini = async (text, transactions = [], conversationContext = null) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const categoriesExpenseStr = CATEGORIAS_DESPESA.map(c => c.id).join(', ');
    const categoriesIncomeStr = CATEGORIAS_RECEITA.map(c => c.id).join(', ');

    const recentTxsStr = transactions.slice(0, 15).map(t =>
      `ID: ${t.id} | Tipo: ${t.type === 'expense' ? 'Despesa' : 'Receita'} | Valor: R$${t.amount} | Desc: ${t.description} | Cat: ${t.category}`
    ).join('\n');

    const currentDateStr = new Date().toLocaleDateString('pt-BR'); // Ex: 04/03/2026

    const prompt = `
Você é um assistente financeiro do aplicativo Zimbro. O usuário enviará uma transcrição de voz.

Data de Hoje: ${currentDateStr}. Sempre que o usuário mencionar uma data específica (ex: "dia 10", "10 de marco"), calcule a data correta no formato YYYY-MM-DD considerando o mês/ano atual. Se não falar data, retorne um texto vazio "".

CONTEXTO FINANCEIRO RECENTE (Últimas transações):
${recentTxsStr || "Nenhuma transação recente"}

Categorias de Despesa: [${categoriesExpenseStr}]
Categorias de Receita: [${categoriesIncomeStr}]

CONVERSA PENDENTE ANTERIOR (O usuário está respondendo a uma pergunta sua):
${conversationContext ? JSON.stringify(conversationContext) : "Nenhuma pendência"}

REGRAS ESTRITAS:
Você DEVE retornar APENAS um ÚNICO objeto JSON válido. NÃO inclua marcações markdown (\`\`\`json), nem texto antes ou depois. APENAS o JSON puro.

Você APENAS PODE RESPONDER com um objeto JSON puro. NÃO INCLUA \`\`\`json ou markdown. Seu JSON deve obrigatoriamente seguir um destes modelos abaixo baseado no objetivo da fala:

MODELO 1: ADICIONAR NOVA TRANSAÇÃO
{
  "action": "add",
  "transaction": {
    "type": "expense", // ou "income"
    "amount": 10.50, // Deve ser um NÚMERO FLOAT. Use PONTO (.) decimal. NUNCA TEXTO. Se for parcelado, calcule o valor CADA parcela.
    "description": "Nome curto do local (ex: Pão de Açúcar)",
    "category": "ID_DA_CATEGORIA_CORRESPONDENTE", // Use as listas providas
    "date": "2026-03-04", // SEMPRE no formato YYYY-MM-DD
    "repeatType": "none", // ou "recurring", ou "installment"
    "installments": 1 // Quantidade de vezes. null/1 se não for installment.
  }
}

MODELO 2: PEDIR MAIS INFORMAÇÕES (Falta de dados como Categoria, Se é Recorrente/Parcelado ou Valor)
{
  "action": "need_info",
  "message": "Ficou faltando o valor! Quanto custou?",
  "pendingData": { // Dados já preenchidos para salvar no contexto
     "type": "expense",
     "description": "Spotify"
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
    return { error: "Ops, tive um problema ao analisar o que você disse." };
  }
};
