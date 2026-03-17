import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { payload } = req.body;
    
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
        // 2. Inicialização correta do novo SDK oficial
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const modelName = "gemini-2.5-flash";
        
        // Garante que estamos pegando o texto do prompt corretamente
        const promptText = payload?.prompt || "Olá, teste de conexão.";

        console.log(`[GeminiAPI] Iniciando chamada para o modelo: ${modelName}`);

        // 3. Chamada da API com a sintaxe correta do @google/genai
        const response = await ai.models.generateContent({
            model: modelName,
            contents: promptText,
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