/**
 * Notion Service - Zimbroo App
 * Handles interaction with Notion API (proxied via Vite for dev)
 */

const API_BASE = '/api/notion';

/**
 * Notion API Helper - Now routes through our serverless proxy /api/notion
 */
const notionRequest = async (secret, endpoint, method = 'GET', body = null) => {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST', // The proxy always uses POST to receive our request details
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                secret,
                endpoint,
                method,
                body: body || (['POST', 'PATCH'].includes(method) ? {} : null)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data.message || 'Erro na comunicação';
            throw new Error(`Erro API Notion (${response.status}) em [${endpoint}]: ${errMsg}`);
        }

        return data;
    } catch (error) {
        console.error("[notionRequest] Error:", error);
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
 * Advanced Orchestrated Discovery
 * Starts with a search, then automatically dives into discovered pages to find inline databases
 */
export const orchestratedDiscovery = async (secret, onPageScanned) => {
    try {
        console.log("[OrchestratedDiscovery] Iniciando busca global...");
        const searchResults = await searchNotionDatabases(secret);
        
        const directDbs = searchResults.filter(item => item.object === 'database');
        const pages = searchResults.filter(item => item.object === 'page');
        
        console.log(`[OrchestratedDiscovery] Busca direta: ${directDbs.length} bases, ${pages.length} páginas.`);
        
        const discovered = [...directDbs];
        const visitedIds = new Set(directDbs.map(db => db.id.replace(/-/g, '')));
        
        // Deep scan each page for child databases
        for (const page of pages) {
            const pageId = page.id.replace(/-/g, '');
            if (onPageScanned) onPageScanned(page.properties?.title?.title?.[0]?.plain_text || 'Página');
            
            try {
                const childDbs = await findDatabasesOnPage(secret, pageId);
                for (const db of childDbs) {
                    const cleanId = db.id.replace(/-/g, '');
                    if (!visitedIds.has(cleanId)) {
                        discovered.push(db);
                        visitedIds.add(cleanId);
                    }
                }
            } catch (err) {
                console.warn(`[OrchestratedDiscovery] Falha ao escanear página ${pageId}:`, err);
            }
        }
        
        return discovered;
    } catch (error) {
        console.error("[OrchestratedDiscovery] Erro crítico:", error);
        throw error;
    }
};

/**
 * Search all items accessible by the integration
 */
export const searchNotionDatabases = async (secret) => {
    try {
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
export const fetchNotionTransactions = async (secret, databaseId, onProgress) => {
    try {
        const cleanId = databaseId.replace(/-/g, '');
        let allResults = [];
        let hasMore = true;
        let nextCursor = undefined;

        while (hasMore) {
            const body = { page_size: 100 };
            if (nextCursor) body.start_cursor = nextCursor;

            const data = await notionRequest(secret, `databases/${cleanId}/query`, 'POST', body);
            allResults = [...allResults, ...(data.results || [])];
            hasMore = data.has_more;
            nextCursor = data.next_cursor;

            if (onProgress) onProgress(allResults.length);
        }

        return mapNotionToZimbroo(allResults);
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
        const props = row.properties || {};
        const mapped = {
            description: 'Sem descrição',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            category: 'Outros',
            type: 'expense',
            repeatType: 'none',
            installments: 1
        };

        try {
            // 1. Description / Title
            const titleProp = Object.values(props).find(p => p.type === 'title');
            if (titleProp?.title?.[0]?.plain_text) {
                mapped.description = titleProp.title[0].plain_text;
            }

            // 2. Identification of Type, Installments and Recurrence
            const typeProp = Object.entries(props).find(([name]) => 
                name.toLowerCase().includes('tipo de despesa') || name.toLowerCase().includes('tipo')
            );
            const instProp = Object.entries(props).find(([name]) => 
                name.toLowerCase().includes('parcela') && (name.toLowerCase().includes('nº') || name.toLowerCase().includes('numero'))
            );

            if (typeProp) {
                const val = (typeProp[1].select?.name || typeProp[1].multi_select?.[0]?.name || typeProp[1].formula?.string || '').toLowerCase();
                if (val.includes('parcela')) {
                    mapped.repeatType = 'installment';
                    mapped.installments = instProp?.[1]?.number || 1;
                } else if (val.includes('recorrente')) {
                    mapped.repeatType = 'recurring';
                }
            }

            // Special handling for payment method - append to description if found
            const payProp = Object.entries(props).find(([name]) => name.toLowerCase().includes('método de pagamento') || name.toLowerCase().includes('pagamento'));
            if (payProp) {
                const payName = payProp[1].select?.name || payProp[1].multi_select?.[0]?.name || payProp[1].rich_text?.[0]?.plain_text || '';
                if (payName) mapped.description = `${mapped.description} (${payName})`;
            }

            // 3. Amount Logic (Total vs Balancete)
            const balanceteProp = Object.entries(props).find(([name]) => 
                name.toLowerCase().includes('balancete') || name.toLowerCase().includes('valor para balancete')
            );
            const totalProp = Object.entries(props).find(([name, p]) => {
                const lowName = name.toLowerCase();
                return (p.type === 'number' || p.type === 'formula') && 
                       (lowName === 'valor' || lowName === 'amount' || lowName === 'valor (inteiro)' || lowName === 'valor total');
            });

            let baseAmount = 0;
            const tp = totalProp?.[1];
            if (tp?.type === 'number') baseAmount = tp.number || 0;
            else if (tp?.type === 'formula') baseAmount = tp.formula?.number || 0;

            const bp = balanceteProp?.[1];
            let balanceteAmount = 0;
            if (bp?.type === 'number') balanceteAmount = bp.number || 0;
            else if (bp?.type === 'formula') {
                balanceteAmount = bp.formula?.number || 0;
            }

            // Decision: Favor Balancete if it exists and is > 0, otherwise use total
            if (balanceteAmount > 0) {
                mapped.amount = balanceteAmount;
                // If we use balancete, we usually don't need to divide anymore as it's the monthly portion
            } else if (mapped.repeatType === 'installment' && mapped.installments > 1) {
                mapped.amount = baseAmount / mapped.installments;
            } else if (mapped.repeatType === 'recurring') {
                mapped.amount = baseAmount / 12;
            } else {
                mapped.amount = baseAmount;
            }

            // 4. Date / Data
            const dateProp = Object.entries(props).find(([name, p]) => {
                const lowName = name.toLowerCase();
                return p.type === 'date' || p.type === 'created_time' || lowName.includes('data') || lowName.includes('date');
            });

            if (dateProp) {
                const p = dateProp[1];
                if (p.type === 'date' && p.date?.start) mapped.date = p.date.start;
                else if (p.type === 'created_time') mapped.date = p.created_time.split('T')[0];
            }

            // 5. Category (Prioritiza nome exato "Categoria")
            const catProp = Object.entries(props).find(([name]) => name.toLowerCase() === 'categoria') ||
                           Object.entries(props).find(([name]) => {
                               const lowName = name.toLowerCase();
                               return lowName.includes('categ') || lowName.includes('tag');
                           });

            if (catProp) {
                const p = catProp[1];
                if (p.type === 'select') mapped.category = p.select?.name || 'Outros';
                else if (p.type === 'multi_select') mapped.category = p.multi_select[0]?.name || 'Outros';
                else if (p.type === 'formula') mapped.category = p.formula?.string || 'Outros';
                else if (p.type === 'rich_text') mapped.category = p.rich_text?.[0]?.plain_text || 'Outros';
            }

            // 6. Type (Income/Expense detection)
            const catName = (mapped.category || '').toLowerCase();
            const descName = (mapped.description || '').toLowerCase();
            const typePropValue = typeProp ? (typeProp[1].select?.name || typeProp[1].multi_select?.[0]?.name || '').toLowerCase() : '';
            
            // Specific check for "Tipo de Receita" property
            const incomeProp = Object.entries(props).find(([name]) => name.toLowerCase().includes('tipo de receita'));
            
            const isRec = catName.includes('receita') || catName.includes('ganho') || 
                          descName.includes('receita') || !!incomeProp || 
                          typePropValue.includes('receita') || typePropValue.includes('rendimento');
            
            mapped.type = isRec ? 'income' : 'expense';

        } catch (err) {
            console.warn("[mapNotionToZimbroo] Erro ao mapear:", err);
        }

        return {
            description: String(mapped.description),
            amount: Number(mapped.amount),
            date: String(mapped.date),
            category: String(mapped.category),
            type: String(mapped.type),
            repeatType: String(mapped.repeatType),
            installments: Number(mapped.installments)
        };
    });
};
