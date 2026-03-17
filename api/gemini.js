import { createClient } from '@google/genai/server';

/**
 * Gemini AI Serverless Function - Zimbroo App (Updated New SDK)
 * Implementation with strict validation and debug logging.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { payload } = req.body;
    
    // 1. API Key Fallback: Verificação rigorosa e limpeza de espaços/caracteres invisíveis
    const RAW_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
    const API_KEY = RAW_KEY.trim().replace(/['"]/g, '');

    if (!API_KEY) {
        console.error("[GeminiAPI] Critical: GEMINI_API_KEY is missing or empty.");
        return res.status(500).json({ 
            error: 'Erro de Configuração', 
            details: 'Variável GEMINI_API_KEY não configurada ou vazia no servidor Vercel. Por favor, adicione-a nas configurações do projeto.' 
        });
    }

    try {
        const client = createClient({ apiKey: API_KEY });
        
        // 2. Formato do Modelo: Garantia de string limpa
        // Nota técnica: O novo SDK pode exigir o prefixo 'models/' se o pattern error persistir
        const modelName = "gemini-2.5-flash".trim();
        
        // 3. Estrutura do Payload: Revisão estrita conforme sintaxe exigida pelo SDK @google/genai
        const generateOptions = {
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [{ text: payload.prompt }]
                }
            ]
        };

        // 4. Logs de Debug: Impressão do payload para inspeção (visível nos logs da Vercel)
        console.log("[GeminiAPI] Model:", modelName);
        console.log("[GeminiAPI] Sending options to SDK:", JSON.stringify(generateOptions, null, 2));

        const response = await client.models.generateContent(generateOptions);

        // Captura de texto robusta na nova estrutura
        const responseText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!responseText) {
            console.error("[GeminiAPI] Empty response or unknown structure:", JSON.stringify(response, null, 2));
            return res.status(500).json({ error: 'Resposta vazia da IA', details: 'O modelo não gerou conteúdo vísivel.' });
        }

        return res.status(200).json({ text: responseText });

    } catch (error) {
        console.error("[GeminiAPI] SDK Technical Error:", error);
        
        // Retornamos o erro detalhado para ajudar no diagnóstico do "pattern"
        return res.status(500).json({ 
            error: 'Erro de validação no SDK', 
            details: error.message 
        });
    }
}
