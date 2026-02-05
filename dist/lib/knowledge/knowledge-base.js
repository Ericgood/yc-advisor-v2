import { DEFAULT_CONFIG, ResourceNotFoundError, } from './types';
function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function extractKeywords(text) {
    const normalized = normalizeText(text);
    const words = normalized.split(/\s+/);
    const stopWords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
        'how', 'when', 'where', 'why', 'all', 'any', 'both', 'each', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
        'own', 'same', 'so', 'than', 'too', 'very', 'just', 'get', 'like'
    ]);
    return words.filter(word => word.length > 2 && !stopWords.has(word));
}
function calculateKeywordScore(resource, keywords) {
    let totalScore = 0;
    const matches = [];
    const searchableFields = [
        { field: 'title', value: resource.title, weight: 3 },
        { field: 'author', value: resource.author, weight: 2 },
        { field: 'topics', value: resource.topics.join(' '), weight: 2 },
        { field: 'summary', value: resource.summary || '', weight: 1 },
    ];
    for (const keyword of keywords) {
        for (const { field, value, weight } of searchableFields) {
            const normalizedValue = normalizeText(value);
            const normalizedKeyword = normalizeText(keyword);
            if (normalizedValue === normalizedKeyword) {
                totalScore += 10 * weight;
                matches.push({ field, matched: keyword, score: 10 * weight });
            }
            else if (normalizedValue.includes(normalizedKeyword)) {
                totalScore += 5 * weight;
                matches.push({ field, matched: keyword, score: 5 * weight });
            }
            else if (new RegExp(`\\b${normalizedKeyword}\\b`).test(normalizedValue)) {
                totalScore += 3 * weight;
                matches.push({ field, matched: keyword, score: 3 * weight });
            }
        }
    }
    return { score: totalScore, matches };
}
function applyFilters(resources, filters) {
    return resources.filter(resource => {
        if (filters.categories?.length) {
            const hasMatchingTopic = resource.topics.some(topic => filters.categories.includes(topic));
            if (!hasMatchingTopic)
                return false;
        }
        if (filters.stages?.length) {
            const hasMatchingStage = resource.founderStage.some(stage => filters.stages.includes(stage));
            if (!hasMatchingStage)
                return false;
        }
        if (filters.authors?.length) {
            if (!filters.authors.includes(resource.author))
                return false;
        }
        if (filters.types?.length) {
            if (!filters.types.includes(resource.type))
                return false;
        }
        if (filters.minLines !== undefined && resource.lines < filters.minLines) {
            return false;
        }
        if (filters.maxLines !== undefined && resource.lines > filters.maxLines) {
            return false;
        }
        return true;
    });
}
function calculateFacets(resources) {
    const facets = {
        categories: {},
        authors: {},
        stages: {},
        types: {},
    };
    for (const resource of resources) {
        for (const topic of resource.topics) {
            facets.categories[topic] =
                (facets.categories[topic] || 0) + 1;
        }
        facets.authors[resource.author] =
            (facets.authors[resource.author] || 0) + 1;
        for (const stage of resource.founderStage) {
            facets.stages[stage] = (facets.stages[stage] || 0) + 1;
        }
        facets.types[resource.type] = (facets.types[resource.type] || 0) + 1;
    }
    return facets;
}
class LRUCache {
    maxSize;
    defaultTtl;
    cache = new Map();
    constructor(maxSize, defaultTtl) {
        this.maxSize = maxSize;
        this.defaultTtl = defaultTtl;
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }
    set(key, value, ttl) {
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, {
            data: value,
            timestamp: Date.now(),
            ttl: ttl || this.defaultTtl,
        });
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
}
export class KnowledgeBase {
    index = null;
    config;
    resourceCache;
    searchCache;
    initialized = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.resourceCache = new LRUCache(this.config.cacheSize, this.config.cacheTtl);
        this.searchCache = new LRUCache(this.config.cacheSize, this.config.cacheTtl);
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            if (typeof window === 'undefined') {
                const fs = await import('fs/promises');
                const path = await import('path');
                const indexPath = path.resolve(this.config.indexPath);
                const data = await fs.readFile(indexPath, 'utf-8');
                this.index = JSON.parse(data);
            }
            else {
                const response = await fetch(this.config.indexPath);
                this.index = await response.json();
            }
            this.initialized = true;
        }
        catch (error) {
            throw new Error(`Failed to load knowledge index: ${error}`);
        }
    }
    ensureInitialized() {
        if (!this.initialized || !this.index) {
            throw new Error('KnowledgeBase not initialized. Call initialize() first.');
        }
    }
    getAllResources() {
        this.ensureInitialized();
        return Object.values(this.index.resources);
    }
    getResourceMeta(code) {
        this.ensureInitialized();
        return this.index.resources[code];
    }
    getResourcesByCodes(codes) {
        this.ensureInitialized();
        return codes
            .map(code => this.index.resources[code])
            .filter((r) => r !== undefined);
    }
    getResourcesByCategory(category) {
        this.ensureInitialized();
        const categoryData = this.index.categories[category];
        if (!categoryData)
            return [];
        return this.getResourcesByCodes(categoryData.resources);
    }
    getResourcesByAuthor(author) {
        this.ensureInitialized();
        const codes = this.index.searchIndex.byAuthor[author] || [];
        return this.getResourcesByCodes(codes);
    }
    getResourcesByType(type) {
        this.ensureInitialized();
        const codes = this.index.searchIndex.byType[type] || [];
        return this.getResourcesByCodes(codes);
    }
    getResourcesByStage(stage) {
        this.ensureInitialized();
        const codes = this.index.searchIndex.byStage[stage] || [];
        return this.getResourcesByCodes(codes);
    }
    async loadResource(code) {
        this.ensureInitialized();
        const cached = this.resourceCache.get(code);
        if (cached)
            return cached;
        const meta = this.index.resources[code];
        if (!meta) {
            throw new ResourceNotFoundError(code);
        }
        try {
            let content;
            if (typeof window === 'undefined') {
                const fs = await import('fs/promises');
                const path = await import('path');
                const filePath = path.resolve(this.config.contentPath, meta.filePath);
                content = await fs.readFile(filePath, 'utf-8');
            }
            else {
                const response = await fetch(`${this.config.contentPath}/${meta.filePath}`);
                content = await response.text();
            }
            const resource = {
                ...meta,
                content,
            };
            this.resourceCache.set(code, resource);
            return resource;
        }
        catch (error) {
            throw new Error(`Failed to load resource ${code}: ${error}`);
        }
    }
    async search(query) {
        this.ensureInitialized();
        const startTime = Date.now();
        const cacheKey = JSON.stringify(query);
        const cached = this.searchCache.get(cacheKey);
        if (cached)
            return cached;
        let candidates = this.getAllResources();
        if (Object.keys(query.filters).length > 0) {
            candidates = applyFilters(candidates, query.filters);
        }
        let scoredResources = [];
        if (query.keywords.length > 0) {
            for (const resource of candidates) {
                const { score, matches } = calculateKeywordScore(resource, query.keywords);
                if (score > 0 || query.keywords.length === 0) {
                    scoredResources.push({ resource, score, matches });
                }
            }
            scoredResources.sort((a, b) => b.score - a.score);
        }
        else {
            scoredResources = candidates.map(r => ({
                resource: r,
                score: 0,
                matches: [],
            }));
        }
        const total = scoredResources.length;
        const offset = query.offset || 0;
        const limit = query.limit;
        scoredResources = scoredResources.slice(offset, offset + limit);
        const resources = scoredResources.map(sr => sr.resource);
        const allMatching = query.keywords.length > 0
            ? candidates.filter(c => scoredResources.some(sr => sr.resource.code === c.code) ||
                calculateKeywordScore(c, query.keywords).score > 0)
            : candidates;
        const facets = calculateFacets(allMatching);
        const result = {
            resources,
            total,
            query,
            facets,
            executionTimeMs: Date.now() - startTime,
        };
        this.searchCache.set(cacheKey, result);
        return result;
    }
    async quickSearch(query, options = {}) {
        const keywords = extractKeywords(query);
        return this.search({
            keywords,
            rawQuery: query,
            filters: options.filters || {},
            limit: options.limit || this.config.defaultLimit,
        });
    }
    getCategories() {
        this.ensureInitialized();
        return Object.entries(this.index.categories).map(([id, data]) => ({
            id: id,
            name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
            count: data.count,
        }));
    }
    getStats() {
        this.ensureInitialized();
        return this.index.stats;
    }
    clearCache() {
        this.resourceCache.clear();
        this.searchCache.clear();
    }
    getCacheStats() {
        return {
            resourceCacheSize: this.resourceCache.size(),
            searchCacheSize: this.searchCache.size(),
        };
    }
}
let globalKnowledgeBase = null;
export function getKnowledgeBase(config) {
    if (!globalKnowledgeBase) {
        globalKnowledgeBase = new KnowledgeBase(config);
    }
    return globalKnowledgeBase;
}
export function resetKnowledgeBase() {
    globalKnowledgeBase = null;
}
//# sourceMappingURL=knowledge-base.js.map