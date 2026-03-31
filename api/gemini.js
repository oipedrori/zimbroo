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

    const { payload, uid } = req.body;
    const { prompt: userText, pending_data: pendingData } = payload || {};
    
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
            details: 'O Firebase Admin não pôde ser inicializado.'
        });
    }

    try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        
        const subStatus = userData.subscription_status || 'free';
        const isPremium = subStatus === 'active' || subStatus === 'trialing';

        // 1. GESTÃO DE COTA (FREE: 3/DIA)
        if (!isPremium) {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            let usageCount = userData.daily_ai_usage_count || 0;
            if (userData.last_ai_usage_date !== todayStr) usageCount = 0;

            if (usageCount >= 3) {
                return res.status(403).json({ 
                    error: 'limit_reached', 
                    action: 'paywall',
                    details: 'Você atingiu o limite de 3 usos diários da IA no plano gratuito.' 
                });
            }

            await userRef.set({ 
                daily_ai_usage_count: usageCount + 1, 
                last_ai_usage_date: todayStr 
            }, { merge: true });
        }

        // 2. ROTEADOR DE PROMPTS (PRO)
        let systemInstruction = "";
        let injectedContext = "";

        if (!isPremium) {
            // PROMPT FREE: Stateless e Rígido
            systemInstruction = `Você é um extrator financeiro rigoroso. O usuário enviará uma frase.
1. Se for uma adição clara (ex: 'gastei 20 no almoço'), extraia e retorne: {'action': 'add', 'transactions': [{'descricao': string, 'valor': number, 'categoria': string, 'tipo': 'expense'|'income'}]}.
2. Se faltar informação (como categoria ou valor), deduza uma categoria genérica ou assuma valor 0. NÃO FAÇA PERGUNTAS.
3. Se a frase for uma pergunta, pedido de conselho, falar sobre limites, parcelas, recorrência ou qualquer outra coisa que não seja uma adição simples, retorne IMEDIATAMENTE: {'action': 'paywall', 'msg': 'Essa é uma ação exclusiva para assinantes do plano Pro!'}`;
        } else {
            // ROTEAMENTO PRO
            const lowerText = (userText || "").toLowerCase();
            const isHistory = /ano|histórico|passado|relatório|balanço/.test(lowerText);
            const isLimit = /limite|teto|orçamento|sugestão/.test(lowerText);

            if (isHistory) {
                // ROTA B: ANÁLISE HISTÓRICA
                const yearlyStats = await getInjectedYearlyStats(uid);
                injectedContext = `SALDOS HISTÓRICOS (Mensal): ${yearlyStats}`;
                systemInstruction = `Você é o conselheiro financeiro Pro do Zimbroo.
Baseie-se APENAS nos SALDOS HISTÓRICOS fornecidos. Responda à dúvida ou dê o conselho pedido.
Retorne JSON: {'action': 'advice', 'message': 'Sua resposta amigável e direta'}`;
            } else if (isLimit) {
                // ROTA C: GESTÃO DE LIMITES
                const catStats = await getInjectedCategoryStats(uid);
                injectedContext = `MÉDIA DE GASTOS (Últimos 3 meses): ${catStats}`;
                systemInstruction = `Você é o gestor de limites do Zimbroo.
Baseie-se no HISTÓRICO DA CATEGORIA fornecido.
1. Se o usuário definir o valor: {'action': 'set_limit', 'category': string, 'amount': number, 'message': 'Confirmação'}
2. Se pedir sugestão, calcule um valor saudável: {'action': 'suggest_limit', 'category': string, 'suggested_val': number, 'message': 'Sugestão e motivo'}`;
            } else {
                // ROTA A: ADIÇÃO E CONVERSAÇÃO (DEFAULT PRO)
                const pendingStr = pendingData ? JSON.stringify(pendingData) : "Nenhum";
                systemInstruction = `Você é o assistente financeiro Pro do Zimbroo.
CONTEXTO PENDENTE: ${pendingStr}
Baseie-se no contexto para completar informações faltantes.
1. ADIÇÃO: {'action': 'add', 'transactions': [{'descricao': string, 'valor': number, 'categoria': string, 'tipo': string, 'parcelas': number, 'tipo_recorrencia': 'none'|'recurring'}]}
2. DADOS FALTANTES: Se faltar VALOR ou DESCRIÇÃO, retorne: {'action': 'need_info', 'pending_data': {dados_coletados}, 'message': 'Sua pergunta para o usuário'}
3. PARCELAMENTO: Se a compra for parcelada, divida o valor. Retorne: {'action': 'add', 'transactions': [{'valor': total_dividido_por_parcelas, 'parcelas': numero_parcelas, ...}]}
4. RECORRÊNCIA (Identificação): Se for assinatura/fixo, sugira: {'action': 'suggest_recurrence', 'pending_data': {dados}, 'message': 'Quer adicionar como recorrente?'}
5. RECORRÊNCIA (Confirmada): Retorne 'add' com 'tipo_recorrencia': 'recurring'.`;
            }
        }

        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const promptContent = `${injectedContext}\nEntrada do Usuário: "${userText}"`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction,
            contents: [{ role: 'user', parts: [{ text: promptContent }] }],
            config: {
                responseMimeType: "application/json",
                temperature: 0.1,
                topP: 0.95,
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                ]
            }
        });

        return res.status(200).json({ text: result.text });

    } catch (error) {
        console.error("[GeminiAPI] Error:", error);
        return res.status(500).json({ 
            error: 'Erro no servidor de IA', 
            details: error.message 
        });
    }
}

// --- HELPER FUNCTIONS FOR CONTEXT INJECTION ---

async function getInjectedYearlyStats(uid) {
    try {
        const year = new Date().getFullYear();
        const snapshot = await admin.firestore().collection('transactions').where('userId', '==', uid).get();
        const txs = snapshot.docs.map(doc => doc.data());
        
        const months = {};
        txs.forEach(tx => {
            const date = tx.date;
            if (!date || !date.startsWith(String(year))) return;
            const m = date.split('-')[1];
            if (!months[m]) months[m] = { inc: 0, exp: 0 };
            if (tx.type === 'income') months[m].inc += tx.amount;
            else months[m].exp += tx.amount;
        });

        return Object.entries(months)
            .map(([m, v]) => `Mês ${m}: +${v.inc}, -${v.exp}`)
            .join(' | ');
    } catch (e) { return "Sem histórico disponível."; }
}

async function getInjectedCategoryStats(uid) {
    try {
        const snapshot = await admin.firestore().collection('transactions')
            .where('userId', '==', uid)
            .orderBy('date', 'desc')
            .limit(50)
            .get();
        const txs = snapshot.docs.map(doc => doc.data());
        
        const catAvg = {};
        txs.forEach(tx => {
            if (tx.type !== 'expense') return;
            if (!catAvg[tx.category]) catAvg[tx.category] = { total: 0, count: 0 };
            catAvg[tx.category].total += tx.amount;
            catAvg[tx.category].count += 1;
        });

        return Object.entries(catAvg)
            .map(([cat, v]) => `${cat}: Méd. R$${(v.total / 3).toFixed(0)}/mês`)
            .join(', ');
    } catch (e) { return "Sem dados de categoria."; }
}