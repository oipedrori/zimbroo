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
        let allResults = [];
        let hasMore = true;
        let startCursor = undefined;

        console.log("Iniciando busca global no Notion (Páginas e Bases)...");

        while (hasMore) {
            const response = await fetch(`${API_BASE}/search`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${secret}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start_cursor: startCursor,
                    page_size: 100
                })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error("Notion Search API Error:", err);
                throw new Error(err.message || 'Falha na busca global do Notion');
            }

            const data = await response.json();
            allResults = [...allResults, ...data.results];
            hasMore = data.has_more;
            startCursor = data.next_cursor;

            if (allResults.length > 500) break;
        }

        console.log(`Busca concluída. Total: ${allResults.length} itens encontrados.`);
        return allResults;
    } catch (error) {
        console.error("Search Fail: ", error);
        throw error;
    }
};

/**
 * Find databases inside a specific page (Mother Page) - Recursive Search
 */
export const findDatabasesOnPage = async (secret, blockId) => {
    try {
        const databases = [];
        const visited = new Set();
        const MAX_DEPTH = 3; // Profundidade segura para recursão

        const scan = async (id, level) => {
            if (visited.has(id) || level > MAX_DEPTH) return;
            visited.add(id);

            // Evita varredura infinita ou muito pesada
            if (databases.length > 20) return;

            let hasMore = true;
            let startCursor = undefined;

            while (hasMore) {
                try {
                    const response = await fetch(`${API_BASE}/blocks/${id}/children?page_size=100${startCursor ? `&start_cursor=${startCursor}` : ''}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${secret}`,
                            'Notion-Version': '2022-06-28'
                        }
                    });

                    if (!response.ok) break;
                    const data = await response.json();

                    for (const block of data.results) {
                        try {
                            // 1. Encontrou database direta
                            if (block.type === 'child_database') {
                                const db = await getNotionDatabaseInfo(secret, block.id);
                                if (db && !databases.some(d => d.id === db.id)) {
                                    databases.push(db);
                                }
                            }
                            // 2. Encontrou sub-página ou bloco com filhos (colunas, grupos, toggles, synced blocks)
                            else if ((block.type === 'child_page' || block.has_children) && level < MAX_DEPTH) {
                                await scan(block.id, level + 1);
                            }
                        } catch (e) {
                            console.warn(`Erro processando bloco ${block.id}:`, e);
                        }
                    }

                    hasMore = data.has_more;
                    startCursor = data.next_cursor;
                } catch (e) {
                    console.error("Erro na varredura de filhos do bloco:", id, e);
                    break;
                }
            }
        };

        await scan(blockId, 0);
        return databases;
    } catch (error) {
        console.error("Deep Scan Error: ", error);
        return [];
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
