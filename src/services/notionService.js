/**
 * Notion Service - Zimbroo App
 * Handles interaction with Notion API (proxied via Vite for dev)
 */

const API_BASE = '/notion-api';

/**
 * Notion API Helper - Centralizes requests and avoids malformed URLs
 */
const notionRequest = async (secret, endpoint, method = 'GET', body = null) => {
    // Sanitize endpoint and ensure base URL doesn't have trailing slash
    const cleanBase = API_BASE.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\//, '').replace(/\/$/, '');
    const url = `${cleanBase}/${cleanEndpoint}`;

    console.log(`[NotionRequest] ${method} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const options = {
            method,
            signal: controller.signal,
            headers: {
                'Authorization': `Bearer ${secret}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            }
        };

        // Notion POST/PATCH requests usually REQUIRE a body, even if empty {}
        if (method === 'POST' || method === 'PATCH') {
            options.body = JSON.stringify(body || {});
        } else if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errMsg = 'Erro na comunicação';
            try {
                const errData = await response.json();
                errMsg = errData.message || errMsg;
            } catch (e) { /* fallback */ }
            throw new Error(`Erro API Notion (${response.status}): ${errMsg}`);
        }

        return response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Timeout: O Notion demorou demais para responder.');
        }
        throw error;
    }
};

/**
 * Utility: Extract Notion ID from URL or string
 */
export const extractNotionId = (input) => {
    if (!input) return '';
    // A regex that captures hex IDs (32 chars) even if they have dashes (36 chars)
    // and correctly ignores the surrounding URL parts
    const match = input.match(/([a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}|[a-f0-9]{32})/);
    return match ? match[1].replace(/-/g, '') : input.trim();
};

/**
 * Search all databases accessible by the integration
 */
export const searchNotionDatabases = async (secret) => {
    try {
        console.log("Iniciando discovery no Notion...");
        // Usamos uma busca simples sem filtros para evitar erro 400 por parâmetros inválidos
        const data = await notionRequest(secret, 'search', 'POST', {
            page_size: 100
        });
        return data.results || [];
    } catch (error) {
        console.error("Discovery Fail: ", error);
        throw error;
    }
};

/**
 * Find databases inside a specific page (Mother Page) - Fast Recursive Search
 */
export const findDatabasesOnPage = async (secret, blockId) => {
    try {
        const databases = [];
        const visited = new Set();
        const MAX_DEPTH = 3;
        let totalBlocksScanned = 0;
        const MAX_TOTAL_BLOCKS = 100;

        const scan = async (id, level) => {
            const cleanId = id.replace(/-/g, '');
            if (!cleanId || visited.has(cleanId) || level > MAX_DEPTH || totalBlocksScanned > MAX_TOTAL_BLOCKS) return;
            visited.add(cleanId);

            try {
                const data = await notionRequest(secret, `blocks/${cleanId}/children?page_size=100`);
                if (!data.results) return;

                for (const block of data.results) {
                    totalBlocksScanned++;
                    if (totalBlocksScanned > MAX_TOTAL_BLOCKS) break;

                    // Standard Child Database
                    if (block.type === 'child_database') {
                        const dbTitle = block.child_database?.title || 'Tabela sem nome';
                        const simpleDb = {
                            id: block.id.replace(/-/g, ''),
                            object: 'database',
                            title: [{ plain_text: dbTitle }]
                        };
                        if (!databases.some(d => d.id === simpleDb.id)) {
                            databases.push(simpleDb);
                        }
                    } 
                    // Linked Database (common in dashboards)
                    else if (block.type === 'link_to_database') {
                        const dbId = block.link_to_database?.database_id || block.link_to_database?.id;
                        if (dbId) {
                            try {
                                const directDb = await getNotionDatabaseInfo(secret, dbId.replace(/-/g, ''));
                                if (!databases.some(d => d.id === directDb.id.replace(/-/g, ''))) {
                                    databases.push({ ...directDb, id: directDb.id.replace(/-/g, '') });
                                }
                            } catch (e) {
                                console.warn("Erro ao buscar info de database vinculada:", e);
                            }
                        }
                    }

                    // Scan child blocks if it's a known container or has children
                    if (block.has_children && level < MAX_DEPTH) {
                        await scan(block.id, level + 1);
                    }
                }
            } catch (e) {
                console.warn(`Aviso no scan do bloco ${cleanId}:`, e.message);
            }
        };

        await scan(blockId.replace(/-/g, ''), 0);
        return databases;
    } catch (error) {
        console.error("Deep Scan Error: ", error);
        return [];
    }
};

/**
 * Fetch Database Metadata
 */
export const getNotionDatabaseInfo = async (secret, databaseId) => {
    return notionRequest(secret, `databases/${databaseId}`);
};

/**
 * Get workspace/bot info
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
        const properties = dbInfo.properties || {};

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
 * Fetch and Map Transactions from Notion (Filtered by current year)
 */
export const fetchNotionTransactions = async (secret, databaseId) => {
    try {
        const currentYear = new Date().getFullYear();
        const startOfYear = `${currentYear}-01-01`;

        // Filter for transactions in the current year
        const data = await notionRequest(secret, `databases/${databaseId}/query`, 'POST', {
            filter: {
                property: "Data", // Considers standard data name, but will fallback if not found
                date: {
                    on_or_after: startOfYear
                }
            }
        });

        // If filtering by "Data" fails because it doesn't exist, try without filter
        // or attempt to find the date property first.
        // For simplicity and resilience, we'll try to find any date property if the "Data" filter fails in mapping.
        
        return mapNotionToZimbroo(data.results || []);
    } catch (error) {
        console.error("Fetch Error, retrying without filter...: ", error);
        // Fallback: fetch all and filter in JS if the API filter fails due to schema mismatch
        try {
            const data = await notionRequest(secret, `databases/${databaseId}/query`, 'POST');
            const currentYear = new Date().getFullYear();
            return mapNotionToZimbroo(data.results || []).filter(tx => {
                const txYear = new Date(tx.date).getFullYear();
                return txYear === currentYear;
            });
        } catch (e) {
            throw e;
        }
    }
};

/**
 * Heuristics to map various Notion property names to Zimbroo
 */
const mapNotionToZimbroo = (results) => {
    return results.map(row => {
        const props = row.properties;
        const mapped = {};

        // Description / Title
        const titleProp = Object.values(props).find(p => p.type === 'title');
        mapped.description = titleProp?.title[0]?.plain_text || 'Sem descrição';

        // Amount / Valor
        const amountProp = Object.entries(props).find(([name, p]) =>
            p.type === 'number' || 
            name.toLowerCase().includes('valor') || 
            name.toLowerCase().includes('amount') ||
            name.toLowerCase().includes('preço') ||
            name.toLowerCase().includes('price')
        );
        mapped.amount = amountProp ? amountProp[1].number : 0;

        // Date / Data
        const dateProp = Object.entries(props).find(([name, p]) => 
            p.type === 'date' || 
            name.toLowerCase().includes('data') || 
            name.toLowerCase().includes('date') ||
            name.toLowerCase().includes('dia')
        );
        mapped.date = dateProp?.[1]?.date?.start || new Date().toISOString().split('T')[0];

        // Category / Categoria
        const catProp = Object.entries(props).find(([name, p]) => 
            p.type === 'select' || 
            name.toLowerCase().includes('categoria') || 
            name.toLowerCase().includes('category') ||
            name.toLowerCase().includes('tipo')
        );
        mapped.category = catProp?.[1]?.select?.name || 'Outros';

        const isRec = mapped.category.toLowerCase().includes('receita') || 
                     mapped.category.toLowerCase().includes('ganho') ||
                     mapped.category.toLowerCase().includes('lucro') ||
                     mapped.category.toLowerCase().includes('venda');
                     
        mapped.type = isRec ? 'income' : 'expense';

        return mapped;
    });
};
