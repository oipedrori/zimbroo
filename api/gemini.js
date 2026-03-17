import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini AI Serverless Function - Zimbroo App
 * Protects the API Key by running AI logic on the server.
 */
export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type, payload } = req.body;
    // Tenta pegar a chave de ambas as nomenclaturas comuns
    const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!API_KEY) {
        console.error("[GeminiAPI] GEMINI_API_KEY is not set in environment variables.");
        return res.status(500).json({ 
            error: 'Erro de Configuração', 
            details: 'Chave de API não encontrada no servidor. Verifique as variáveis de ambiente.' 
        });
    }

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);

        if (type === 'analyze' || type === 'suggest_limit') {
            // Forçamos o modelo flash 1.5 que é o mais compatível globalmente
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const { prompt } = payload;
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            return res.status(200).json({ text: responseText });
        }

        return res.status(400).json({ error: 'Invalid request type' });

    } catch (error) {
        console.error("[GeminiAPI] Error:", error);
        return res.status(500).json({ error: 'Erro ao processar requisição na IA.', details: error.message });
    }
}
