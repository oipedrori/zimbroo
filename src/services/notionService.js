/**
 * Notion Service - Zimbroo App
 * Handles interaction with Notion API (proxied via Vite for dev)
 */

const API_BASE = '/notion-api';

/**
 * Utility: Extract Notion ID from URL or string
 */
export const extractNotionId = (input) => {
    if (!input) return '';
    // Match 32 chars hex string from URL or raw
    const match = input.match(/([a-f0-9]{32})/);
    return match ? match[1] : input.trim();
};

/**
 * Search all databases accessible by the integration
 */
export const searchNotionDatabases = async (secret) => {
    try {
        const response = await fetch(`${API_BASE}/search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secret}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: { property: 'object', value: 'database' }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Falha ao buscar bases');
        }

        const data = await response.json();
        return data.results; // Retorna lista de databases
    } catch (error) {
        console.error("Search Error: ", error);
        throw error;
    }
};

/**
 * Fetch Database Metadata to check available properties
 */
export const getNotionDatabaseInfo = async (secret, databaseId) => {
    try {
        const response = await fetch(`${API_BASE}/databases/${databaseId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secret}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Falha ao acessar o Notion');
        }

        return await response.json();
    } catch (error) {
        console.error("Notion API Error: ", error);
        throw error;
    }
};

/**
 * Create a new Page (Transaction) in Notion Database
 */
export const createNotionTransaction = async (secret, databaseId, tx) => {
    try {
        // 1. First, we need to know the property names of the database
        const dbInfo = await getNotionDatabaseInfo(secret, databaseId);
        const properties = dbInfo.properties;

        // 2. Identify property names by type
        const titleKey = Object.keys(properties).find(k => properties[k].type === 'title');
        const numberKey = Object.keys(properties).find(k => properties[k].type === 'number');
        const dateKey = Object.keys(properties).find(k => properties[k].type === 'date');
        const selectKey = Object.keys(properties).find(k => properties[k].type === 'select');

        // 3. Build the properties object for Notion
        const notionProps = {};

        if (titleKey) {
            notionProps[titleKey] = { title: [{ text: { content: tx.description } }] };
        }
        if (numberKey) {
            notionProps[numberKey] = { number: Number(tx.amount) };
        }
        if (dateKey) {
            notionProps[dateKey] = { date: { start: tx.date } };
        }
        if (selectKey) {
            notionProps[selectKey] = { select: { name: tx.category || 'Zimbroo' } };
        }

        // 4. Send the request
        const response = await fetch(`${API_BASE}/pages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secret}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { database_id: databaseId },
                properties: notionProps
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.warn("Failed to sync to Notion:", err);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("Notion Sync Error:", error);
        return null; // Don't crash the app if sync fails
    }
};

/**
 * Fetch and Map Transactions from Notion
 */
export const fetchNotionTransactions = async (secret, databaseId) => {
    try {
        const response = await fetch(`${API_BASE}/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secret}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Falha na sincronização');
        }

        const data = await response.json();
        return mapNotionToZimbroo(data.results);
    } catch (error) {
        console.error("Fetch Error: ", error);
        throw error;
    }
};

/**
 * Heuristics to map various Notion property names to Zimbroo
 */
const mapNotionToZimbroo = (results) => {
    return results.map(row => {
        const props = row.properties;
        const mapped = {};

        // 1. Description (Find TITLE property or 'Nome' or 'Descrição')
        const titleProp = Object.values(props).find(p => p.type === 'title');
        mapped.description = titleProp?.title[0]?.plain_text || 'Sem descrição';

        // 2. Amount (Find NUMBER property)
        const amountProp = Object.entries(props).find(([name, p]) =>
            p.type === 'number' || name.toLowerCase().includes('valor') || name.toLowerCase().includes('amount')
        );
        mapped.amount = amountProp ? amountProp[1].number : 0;

        // 3. Date (Find DATE property)
        const dateProp = Object.values(props).find(p => p.type === 'date');
        mapped.date = dateProp?.date?.start || new Date().toISOString().split('T')[0];

        // 4. Category (Find SELECT property)
        const catProp = Object.values(props).find(p => p.type === 'select');
        mapped.category = catProp?.select?.name || 'Outros';

        // 5. Type (Income vs Expense)
        // heuristic: if it has 'gain', 'income', 'receita' in cat or a dedicated select
        const isRec = mapped.category.toLowerCase().includes('receita') || mapped.category.toLowerCase().includes('ganho');
        mapped.type = isRec ? 'income' : 'expense';

        return mapped;
    });
};
