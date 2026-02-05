const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
    'how', 'when', 'where', 'why', 'all', 'any', 'both', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'just', 'get', 'like',
    'about', 'also', 'into', 'up', 'out', 'if', 'then', 'as', 'its',
    ' startup', 'startups', 'founder', 'founders', 'company', 'companies'
]);
export function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}
export function createNGrams(text, n = 2) {
    const tokens = tokenize(text);
    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
}
export function calculateTfIdf(term, document, documents) {
    const tokens = tokenize(document);
    const termCount = tokens.filter(t => t === term).length;
    const tf = termCount / tokens.length;
    const docCount = documents.filter(doc => tokenize(doc).includes(term)).length;
    const idf = Math.log(documents.length / (docCount + 1)) + 1;
    return tf * idf;
}
export function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[b.length][a.length];
}
export function fuzzyMatch(query, text) {
    const normalizedQuery = query.toLowerCase();
    const normalizedText = text.toLowerCase();
    if (normalizedText === normalizedQuery)
        return 1;
    if (normalizedText.includes(normalizedQuery))
        return 0.9;
    if (new RegExp(`\\b${normalizedQuery}\\b`).test(normalizedText)) {
        return 0.8;
    }
    const distance = levenshteinDistance(normalizedQuery, normalizedText);
    const maxLength = Math.max(normalizedQuery.length, normalizedText.length);
    const similarity = 1 - distance / maxLength;
    return similarity > 0.7 ? similarity * 0.7 : 0;
}
export function jaccardSimilarity(setA, setB) {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}
export function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
export function createBowVector(text, vocabulary) {
    const tokens = tokenize(text);
    const tokenSet = new Set(tokens);
    return vocabulary.map(word => tokenSet.has(word) ? 1 : 0);
}
const DEFAULT_WEIGHTS = {
    title: 5,
    author: 3,
    topics: 3,
    summary: 2,
    content: 1,
    category: 2,
};
export function advancedScoreResource(resource, query, weights = {}) {
    const w = { ...DEFAULT_WEIGHTS, ...weights };
    const queryTokens = new Set(tokenize(query));
    const breakdown = {};
    const titleTokens = new Set(tokenize(resource.title));
    breakdown.title = jaccardSimilarity(queryTokens, titleTokens) * w.title;
    const authorTokens = new Set(tokenize(resource.author));
    breakdown.author = jaccardSimilarity(queryTokens, authorTokens) * w.author;
    const topicTokens = new Set(resource.topics.flatMap(tokenize));
    breakdown.topics = jaccardSimilarity(queryTokens, topicTokens) * w.topics;
    if (resource.summary) {
        const summaryTokens = new Set(tokenize(resource.summary));
        breakdown.summary = jaccardSimilarity(queryTokens, summaryTokens) * w.summary;
    }
    else {
        breakdown.summary = 0;
    }
    const categoryMatch = resource.topics.some(topic => query.toLowerCase().includes(topic.toLowerCase()));
    breakdown.category = categoryMatch ? w.category : 0;
    const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return { score, breakdown };
}
export function generateSuggestions(partialQuery, resources, maxSuggestions = 5) {
    const query = partialQuery.toLowerCase();
    const suggestions = new Set();
    for (const resource of resources) {
        if (resource.title.toLowerCase().includes(query)) {
            suggestions.add(resource.title);
        }
        if (resource.author.toLowerCase().includes(query)) {
            suggestions.add(`author:${resource.author}`);
        }
        for (const topic of resource.topics) {
            if (topic.toLowerCase().includes(query)) {
                suggestions.add(`topic:${topic}`);
            }
        }
        if (suggestions.size >= maxSuggestions)
            break;
    }
    return Array.from(suggestions).slice(0, maxSuggestions);
}
export function aggregateByCategory(resources) {
    const aggregated = {};
    for (const resource of resources) {
        for (const topic of resource.topics) {
            const category = topic;
            if (!aggregated[category]) {
                aggregated[category] = [];
            }
            aggregated[category].push(resource);
        }
    }
    return aggregated;
}
export function getTopAuthors(resources, limit = 10) {
    const counts = {};
    for (const resource of resources) {
        counts[resource.author] = (counts[resource.author] || 0) + 1;
    }
    return Object.entries(counts)
        .map(([author, count]) => ({ author, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}
export function parseQuery(query) {
    const parsed = {
        keywords: [],
        filters: {},
        excluded: [],
        phrases: [],
    };
    const phraseRegex = /"([^"]+)"/g;
    let match;
    while ((match = phraseRegex.exec(query)) !== null) {
        parsed.phrases.push(match[1]);
    }
    const withoutPhrases = query.replace(phraseRegex, '');
    const parts = withoutPhrases.split(/\s+/);
    for (const part of parts) {
        if (!part)
            continue;
        if (part.includes(':')) {
            const [key, value] = part.split(':');
            if (key && value && ['author', 'category', 'type', 'stage'].includes(key)) {
                parsed.filters[key] = value;
                continue;
            }
        }
        if (part.startsWith('-')) {
            parsed.excluded.push(part.slice(1));
            continue;
        }
        parsed.keywords.push(part);
    }
    return parsed;
}
export const SearchUtils = {
    tokenize,
    createNGrams,
    calculateTfIdf,
    fuzzyMatch,
    jaccardSimilarity,
    cosineSimilarity,
    createBowVector,
    advancedScoreResource,
    generateSuggestions,
    aggregateByCategory,
    getTopAuthors,
    parseQuery,
};
//# sourceMappingURL=search.js.map