import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';

let db;
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }
    db = admin.firestore();
} catch (e) {
    console.error("[FirebaseAdmin] Initialization Error:", e.message);
}

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
    if (!API_KEY) {
        return res.status(500).json({ 
            error: 'GEMINI_API_KEY_MISSING', 
            details: 'A variável de ambiente GEMINI_API_KEY não foi configurada. Verifique suas variáveis na Vercel.' 
        });
    }

    if (!API_KEY.startsWith('AIza')) {
        return res.status(500).json({ 
            error: 'GEMINI_API_KEY_INVALID', 
            details: `A chave Gemini fornecida é inválida (começa com "${API_KEY.substring(0, 4)}...", deveria começar com "AIza"). Verifique se você copiou a chave correta do Google AI Studio.` 
        });
    }

    if (!db) {
        return res.status(500).json({
            error: 'FIREBASE_ADMIN_ERROR',
            details: 'O Firebase Admin não pôde ser inicializado. Verifique se as variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY estão corretas e se a chave privada inclui os delimitadores BEGIN/END.'
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
            const todayStr = now.toISOString().split('T')[0];
            let usageCount = userData.daily_ai_usage_count || 0;
            if (userData.last_ai_usage_date !== todayStr) usageCount = 0;

            if (usageCount >= 5) return res.status(403).json({ error: 'limit_reached', action: 'show_paywall' });

            await userRef.set({ daily_ai_usage_count: usageCount + 1, last_ai_usage_date: todayStr }, { merge: true });
        }

        const ai = new GoogleGenAI({ apiKey: API_KEY });
        
        // Configuração SEGURA para evitar bloqueios por falso positivo
        const safetySettings = [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ];

        const systemInstruction = `Você é o Zimbroo Brain, assistente financeiro de elite. 
Sua missão é processar a entrada do usuário e o contexto fornecido para retornar um JSON de ação.

REGRAS DE OURO:
1. Retorne APENAS o JSON. Sem texto explicativo.
2. Identifique a INTENÇÃO:
   - "add": Se o usuário quer adicionar gastos ou ganhos.
   - "analyze": Se o usuário faz perguntas sobre dinheiro, saldo ou pede conselhos.
   - "limit": Se o usuário quer definir ou mudar um teto de gastos.

DETALHES DA AÇÃO "add":
- Extraia cada transação para uma lista 'transactions'.
- 'valor': o total mencionado (numérico).
- 'parcelas': número de vezes (ex: 'em 3x' -> 3). Default: 1.
- 'tipo_recorrencia': 'recurring' (se fixo/mensal como aluguel) ou 'none'.
- 'tipo': 'expense' (gasto) ou 'income' (ganho).
- 'categoria': ID da categoria mais próxima (ex: 'alimentacao', 'transporte', 'lazer', 'saude', 'casa', 'educacao', 'compras', 'outros').

DETALHES DA AÇÃO "analyze":
- Use o contexto de transações enviado no prompt. 
- Seja amigável e direto. Use a moeda do usuário se presente (R$).

GATING DE PLANO:
- O usuário atual é: ${isPremium ? 'PREMIUM' : 'FREE'}.
- Usuários FREE só podem realizar a ação "add".
- Se um usuário FREE pedir "analyze" ou "limit", você DEVE retornar obrigatoriamente: {"action": "paywall"}.

LAYOUT DE SAÍDA:
{
  "action": "add" | "analyze" | "limit" | "paywall",
  "transactions": [...], 
  "message": "Resposta para o usuário",
  "category": "ID_CATEGORIA",
  "amount": number
}`;

        const model = ai.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: systemInstruction,
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.1,
                topP: 0.95,
            },
            safetySettings: safetySettings
        });
        
        const prompt = `Input: "${payload.prompt}"\nContext: ${payload.context || "Nenhum"}`;

        const result = await model.generateContent(prompt); // Limpamos a chamada

        const responseText = result.response.text();
        return res.status(200).json({ text: responseText });

    } catch (error) {
        console.error("[GeminiAPI] Error:", error);
        return res.status(500).json({ 
            error: 'Erro na comunicação com a API do Gemini', 
            details: error.message 
        });
    }
}