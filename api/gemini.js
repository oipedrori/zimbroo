import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { payload, uid, premiumPrompt } = req.body;
    
    // GATING START
    if (!uid) {
        return res.status(401).json({ error: 'Operação bloqueada: UID não fornecido.' });
    }
    
    // 1. Tratamento e verificação rigorosa da chave
    const RAW_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
    const API_KEY = RAW_KEY.trim().replace(/['"]/g, '');

    // Verifica se a chave existe e se tem o prefixo padrão do Google (AIza)
    if (!API_KEY || !API_KEY.startsWith('AIza')) {
        return res.status(500).json({ 
            error: 'Erro de Configuração de Chave', 
            details: 'A GEMINI_API_KEY não foi encontrada ou é inválida (precisa começar com "AIza"). Verifique o seu arquivo .env ou as variáveis na Vercel.' 
        });
    }

    try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        
        const subStatus = userData.subscription_status || 'free';
        const isPremium = subStatus === 'active' || subStatus === 'trialing';

        if (!isPremium) {
            // VERIFICAÇÃO DE COTA PARA USUÁRIOS FREE
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
            
            let usageCount = userData.daily_ai_usage_count || 0;
            const lastUsageStr = userData.last_ai_usage_date || "";

            // Se é um novo dia, zera o contador
            if (lastUsageStr !== todayStr) {
                usageCount = 0;
            }

            if (usageCount >= 5) {
                return res.status(403).json({ error: 'limit_reached', action: 'show_paywall' });
            }

            // Atualiza o contador de cota diária antes de processar
            await userRef.set({
                daily_ai_usage_count: usageCount + 1,
                last_ai_usage_date: todayStr
            }, { merge: true });
        }

        // 2. Inicialização correta SDK
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const modelName = "gemini-2.5-flash";
        
        let promptText = payload?.prompt || "Olá, teste de conexão.";
        let systemInstruction = "";

        // SELEÇÃO DE PROMPT COM BASE NO STATUS
        if (!isPremium) {
            // STRICT FREE PROMPT
            systemInstruction = `Você é um classificador e extrator financeiro estrito. O usuário enviará uma frase. Sua única função é retornar um JSON puro.
  REGRAS:
  1. Se a frase for uma adição (ex: 'gastei 20 no mercado'), extraia os dados: {'action': 'add', 'transactions': [{'valor': number, 'categoria': string, 'tipo': 'despesa'|'receita', 'descricao': string}]}. Assuma categorias genéricas se faltar informação. NÃO faça perguntas. NÃO retorne 'need_info'. A descrição deve ser curta (ex: 'Mercado', 'Gasolina').
  2. O GATILHO DO PAYWALL: Se a frase for uma pergunta, pedido de relatório, análise, ou exigir histórico, recuse a extração e retorne estritamente: {'action': 'paywall'}. Retorne APENAS o JSON e nada mais.`;
            
            // Força o prompt a ser apenas a nova string sem a sujeira do prompt premium que o frontend tentou enviar
            promptText = payload?.prompt;
        } else {
            // PREMIUM PROMPT DO FRONTEND
            systemInstruction = premiumPrompt || "Você é o assistente financeiro do Zimbroo.";
            promptText = payload?.prompt;
        }

        console.log(`[GeminiAPI] Chamada IA (${isPremium ? 'Premium' : 'Free'}) UID: ${uid}`);

        // 3. Chamada da API
        const response = await ai.models.generateContent({
            model: modelName,
            contents: promptText,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });

        if (!response.text) throw new Error("Resposta vazia da IA");

        return res.status(200).json({ text: response.text });

    } catch (error) {
        console.error("[GeminiAPI] Error:", error);
        return res.status(500).json({ 
            error: 'Erro na comunicação com a API do Gemini', 
            details: error.message 
        });
    }
}