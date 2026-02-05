import { NextResponse } from 'next/server';
import { getKnowledgeBase, InvalidQueryError, ResourceNotFoundError, } from '../../../lib/knowledge';
const CONFIG = {
    defaultLimit: 10,
    maxLimit: 50,
    defaultSearchTimeout: 5000,
};
let kbInstance = null;
async function getKB() {
    if (!kbInstance) {
        kbInstance = getKnowledgeBase({
            indexPath: process.env.KNOWLEDGE_INDEX_PATH || './data/knowledge-index.json',
            contentPath: process.env.KNOWLEDGE_CONTENT_PATH || './references',
            cacheSize: 100,
            cacheTtl: 5 * 60 * 1000,
        });
        await kbInstance.initialize();
    }
    return kbInstance;
}
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const params = {
            q: searchParams.get('q') || '',
            category: searchParams.get('category') || undefined,
            stage: searchParams.get('stage') || undefined,
            author: searchParams.get('author') || undefined,
            type: searchParams.get('type') || undefined,
            semantic: searchParams.get('semantic') === 'true',
            limit: parseInt(searchParams.get('limit') || '10', 10),
            offset: parseInt(searchParams.get('offset') || '0', 10),
        };
        if (!params.q || params.q.trim().length < 2) {
            throw new InvalidQueryError('Query must be at least 2 characters');
        }
        const limit = Math.min(params.limit || CONFIG.defaultLimit, CONFIG.maxLimit);
        const offset = params.offset || 0;
        const kb = await getKB();
        const searchQuery = {
            keywords: params.q.split(/\s+/).filter(Boolean),
            rawQuery: params.q,
            filters: {
                categories: params.category ? [params.category] : undefined,
                stages: params.stage ? [params.stage] : undefined,
                authors: params.author ? [params.author] : undefined,
                types: params.type ? [params.type] : undefined,
            },
            semantic: params.semantic,
            limit,
            offset,
        };
        const result = await kb.search(searchQuery);
        const response = {
            results: result.resources,
            total: result.total,
            query: params.q,
            facets: result.facets,
            executionTimeMs: result.executionTimeMs,
        };
        return NextResponse.json(response);
    }
    catch (error) {
        return handleError(error);
    }
}
export async function POST(request) {
    try {
        const body = await request.json();
        const { message, options = {} } = body;
        if (!message || typeof message !== 'string') {
            throw new InvalidQueryError('Message is required');
        }
        const kb = await getKB();
        const searchQuery = extractSearchIntent(message);
        const searchResult = await kb.search({
            keywords: searchQuery.keywords || [],
            rawQuery: message,
            filters: searchQuery.filters || {},
            limit: options.limit || 5,
        });
        const resourcesWithContent = await Promise.all(searchResult.resources.slice(0, 3).map(async (meta) => {
            try {
                const resource = await kb.loadResource(meta.code);
                return {
                    meta,
                    content: truncateContent(resource.content, 2000),
                };
            }
            catch {
                return { meta, content: null };
            }
        }));
        const contextString = buildContext(resourcesWithContent, message);
        return NextResponse.json({
            query: message,
            resources: searchResult.resources,
            context: contextString,
            totalFound: searchResult.total,
            executionTimeMs: searchResult.executionTimeMs,
        });
    }
    catch (error) {
        return handleError(error);
    }
}
function extractSearchIntent(message) {
    const keywords = [];
    const filters = {};
    const stagePatterns = [
        { pattern: /pre[-\s]?idea/i, stage: 'pre-idea' },
        { pattern: /early stage|just starting/i, stage: 'pre-idea' },
        { pattern: /mvp|building/i, stage: 'building' },
        { pattern: /launched|launched/i, stage: 'launched' },
        { pattern: /scaling|growth stage/i, stage: 'scaling' },
    ];
    for (const { pattern, stage } of stagePatterns) {
        if (pattern.test(message)) {
            filters.stages = [stage];
            break;
        }
    }
    const topicPatterns = {
        'fundraising': [/fundraising?|raise money|investor/i],
        'co-founders': [/co[-\s]?founder|partner/i],
        'ai': [/ai|artificial intelligence|ml|machine learning/i],
        'growth': [/growth|scale|scaling/i],
        'product': [/product|mvp|feature/i],
    };
    for (const [topic, patterns] of Object.entries(topicPatterns)) {
        for (const pattern of patterns) {
            if (pattern.test(message)) {
                filters.categories = [topic];
                break;
            }
        }
    }
    const cleanMessage = message
        .replace(/\b(how|what|when|where|why|who|is|are|do|does|can|could|would|should)\b/gi, '')
        .replace(/\b(a|an|the|to|for|of|in|on|at|by|with)\b/gi, '')
        .trim();
    keywords.push(...cleanMessage.split(/\s+/).filter(w => w.length > 2));
    return {
        keywords: [...new Set(keywords)],
        filters,
    };
}
function truncateContent(content, maxLength) {
    if (content.length <= maxLength)
        return content;
    const truncated = content.slice(0, maxLength);
    const lastParagraph = truncated.lastIndexOf('\n\n');
    if (lastParagraph > maxLength * 0.8) {
        return truncated.slice(0, lastParagraph) + '\n\n...';
    }
    return truncated + '...';
}
function buildContext(resources, query) {
    const parts = [];
    parts.push(`# Context for: "${query}"`);
    parts.push('');
    for (let i = 0; i < resources.length; i++) {
        const { meta, content } = resources[i];
        parts.push(`## Resource ${i + 1}: ${meta.title}`);
        parts.push(`**Author:** ${meta.author}`);
        parts.push(`**Type:** ${meta.type}`);
        parts.push(`**URL:** ${meta.url}`);
        parts.push('');
        if (content) {
            parts.push(content);
        }
        else {
            parts.push('(Content not available)');
        }
        parts.push('');
        parts.push('---');
        parts.push('');
    }
    return parts.join('\n');
}
function handleError(error) {
    console.error('API Error:', error);
    if (error instanceof InvalidQueryError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof ResourceNotFoundError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
}
export async function getResource(code) {
    try {
        const kb = await getKB();
        const resource = await kb.loadResource(code);
        const related = kb.getResourcesByCodes(resource.related || []);
        const response = {
            meta: {
                code: resource.code,
                title: resource.title,
                author: resource.author,
                type: resource.type,
                url: resource.url,
                topics: resource.topics,
                founderStage: resource.founderStage,
                lines: resource.lines,
                filePath: resource.filePath,
                hasTranscript: resource.hasTranscript,
                related: resource.related,
            },
            content: resource.content,
            related,
        };
        return NextResponse.json(response);
    }
    catch (error) {
        return handleError(error);
    }
}
export async function getCategories() {
    try {
        const kb = await getKB();
        const categories = kb.getCategories();
        const stats = kb.getStats();
        const response = {
            categories: categories.map(c => ({
                id: c.id,
                name: c.name,
                count: c.count,
            })),
            totalResources: stats.totalResources,
        };
        return NextResponse.json(response);
    }
    catch (error) {
        return handleError(error);
    }
}
//# sourceMappingURL=route.js.map