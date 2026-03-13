/**
 * Vercel Serverless Function to exchange Notion OAuth code for access_token
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    const clientId = process.env.VITE_NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    
    // Use the redirect_uri sent by client, or fallback to dynamic origin
    const origin = req.headers.origin || 'https://zimbroo.vercel.app';
    const redirectUri = req.body.redirect_uri || `${origin}/notion-callback`;

    try {
        const response = await fetch('https://api.notion.com/v1/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error("Notion Auth Error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
