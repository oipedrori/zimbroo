/**
 * Notion Service - Zimbroo App
 * Handles interaction with Notion API (proxied via Vite for dev)
 */

const API_BASE = '/notion-api/v1';

/**
 * Notion API Helper - Centralizes requests and avoids malformed URLs
 */
const notionRequest = async (secret, endpoint, method = 'GET', body = null) => {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const url = `${API_BASE}/${cleanEndpoint}`;

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${secret}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        }
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

    if (!response.ok) {
        let errMsg = 'Erro na comunicação';
        try {
            const errData = await response.json();
            errMsg = errData.message || errMsg;
        } catch (e) { /* fallback to default */ }
        throw new Error(`Erro API Notion (${response.status}): ${errMsg}`);
    }

    return response.json();
};

/**
 * Utility: Extract Notion ID from URL or string
 */
export const extractNotionId = (input) => {
    if (!input) return '';
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

        console.log("Iniciando discovery no Notion...");

        while (hasMore) {
            const data = await notionRequest(secret, 'search', 'POST', {
                start_cursor: startCursor,
                page_size: 100
            });

            allResults = [...allResults, ...data.results];
            hasMore = data.has_more;
            startCursor = data.next_cursor;

            if (allResults.length > 300) break;
        }

        return allResults;
    } catch (error) {
        console.error("Discovery Fail: ", error);
        throw error;
    }
};

/**
 * Find databases inside a specific page (Mother Page) - Deep Recursive Search
 */
export const findDatabasesOnPage = async (secret, blockId) => {
    try {
        const databases = [];
        const visited = new Set();
        const MAX_DEPTH = 3;

        const scan = async (id, level) => {
            if (visited.has(id) || level > MAX_DEPTH) return;
            visited.add(id);

            if (databases.length > 20) return;

            let hasMore = true;
            let startCursor = undefined;

            while (hasMore) {
                try {
                    const data = await notionRequest(secret, `blocks/${id}/children?page_size=100${startCursor ? `&start_cursor=${startCursor}` : ''}`);

                    for (const block of data.results) {
                        try {
                            if (block.type === 'child_database') {
                                const dbTitle = block.child_database?.title || 'Tabela sem nome';
                                const simpleDb = {
                                    id: block.id,
                                    object: 'database',
                                    title: [{ plain_text: dbTitle }],
                                    properties: {} // Mock para não quebrar a UI, carregamos props no vincular se precisar
                                };
                                if (!databases.some(d => d.id === simpleDb.id)) {
                                    databases.push(simpleDb);
                                }
                            }
                            // Só entra em containers que podem ter tabelas (colunas, grupos, toggles)
                            const isContainer = [
                                'column_list', 'column', 'toggle', 'child_page',
                                'synced_block', 'template', 'group'
                            ].includes(block.type);

                            if (isContainer && block.has_children && level < MAX_DEPTH) {
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
    return notionRequest(secret, `databases/${databaseId}`);
};

/**
 * Get workspace/bot info to verify connection
 */
export const getNotionWorkspaceInfo = async (secret) => {
    try {
        return await notionRequest(secret, 'users/me');
    } catch (e) {
        return null;
    }
};

/**
 * Create a new Page (Transaction) in Notion Database
 */
export const createNotionTransaction = async (secret, databaseId, tx) => {
    try {
        const dbInfo = await getNotionDatabaseInfo(secret, databaseId);
        const properties = dbInfo.properties;

        const titleKey = Object.keys(properties).find(k => properties[k].type === 'title');
        const numberKey = Object.keys(properties).find(k => properties[k].type === 'number');
        const dateKey = Object.keys(properties).find(k => properties[k].type === 'date');
        const selectKey = Object.keys(properties).find(k => properties[k].type === 'select');

        const notionProps = {};
        if (titleKey) notionProps[titleKey] = { title: [{ text: { content: tx.description } }] };
        if (numberKey) notionProps[numberKey] = { number: Number(tx.amount) };
        if (dateKey) notionProps[dateKey] = { date: { start: tx.date } };
        if (selectKey) notionProps[selectKey] = { select: { name: tx.category || 'Zimbroo' } };

        return await notionRequest(secret, 'pages', 'POST', {
            parent: { database_id: databaseId },
            properties: notionProps
        });
    } catch (error) {
        console.error("Notion Sync Error:", error);
        return null;
    }
};

/**
 * Fetch and Map Transactions from Notion
 */
export const fetchNotionTransactions = async (secret, databaseId) => {
    try {
        const data = await notionRequest(secret, `databases/${databaseId}/query`, 'POST');
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
