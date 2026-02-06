export const CATEGORIES = [
    'accelerator',
    'admin',
    'ai',
    'avoiding-failure',
    'b2b',
    'biotech',
    'building',
    'career',
    'case-study',
    'co-founders',
    'crypto',
    'culture',
    'customers',
    'deep-tech',
    'design',
    'engineering',
    'finance',
    'founder-interview',
    'fundraising',
    'general',
    'getting-started',
    'governance',
    'growth',
    'hiring',
    'launching',
    'leadership',
    'metrics',
    'mindset',
    'pivoting',
    'pricing',
    'scaling',
];
export class KnowledgeBaseError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 500) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'KnowledgeBaseError';
    }
}
export class ResourceNotFoundError extends KnowledgeBaseError {
    constructor(code) {
        super(`Resource not found: ${code}`, 'RESOURCE_NOT_FOUND', 404);
        this.name = 'ResourceNotFoundError';
    }
}
export class InvalidQueryError extends KnowledgeBaseError {
    constructor(message) {
        super(message, 'INVALID_QUERY', 400);
        this.name = 'InvalidQueryError';
    }
}
export const DEFAULT_CONFIG = {
    indexPath: './data/knowledge-index.json',
    contentPath: './references',
    cacheSize: 100,
    cacheTtl: 5 * 60 * 1000,
    enableSemantic: false,
    maxResults: 50,
    defaultLimit: 10,
};
//# sourceMappingURL=types.js.map