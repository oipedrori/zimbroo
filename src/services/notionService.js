/**
 * Notion Service - Zimbro App
 * Handles interaction with Notion API (proxied via Vite for dev)
 */

const API_BASE = '/notion-api';

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
        return mapNotionToZimbro(data.results);
    } catch (error) {
        console.error("Fetch Error: ", error);
        throw error;
    }
};

/**
 * Heuristics to map various Notion property names to Zimbro
 */
const mapNotionToZimbro = (results) => {
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
