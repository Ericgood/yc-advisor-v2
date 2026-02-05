export type ResourceType = 'essay' | 'video' | 'podcast';
export type FounderStage = 'pre-idea' | 'idea' | 'building' | 'launched' | 'scaling' | 'all';
export declare const CATEGORIES: readonly ["accelerator", "admin", "ai", "avoiding-failure", "b2b", "biotech", "building", "career", "case-study", "co-founders", "crypto", "culture", "customers", "deep-tech", "design", "engineering", "finance", "founder-interview", "fundraising", "general", "getting-started", "governance", "growth", "hiring", "launching", "leadership", "metrics", "mindset", "pivoting", "pricing", "scaling"];
export type Category = typeof CATEGORIES[number];
export interface ResourceMeta {
    code: string;
    title: string;
    author: string;
    type: ResourceType;
    url: string;
    topics: string[];
    founderStage: FounderStage[];
    lines: number;
    filePath: string;
    hasTranscript: boolean;
    related?: string[];
    summary?: string;
}
export interface Resource extends ResourceMeta {
    content: string;
    chunks?: ContentChunk[];
}
export interface ContentChunk {
    id: string;
    text: string;
    startLine: number;
    endLine: number;
}
export interface CategoryInfo {
    id: Category;
    name: string;
    count: number;
    description?: string;
}
export interface SearchFilters {
    categories?: Category[];
    stages?: FounderStage[];
    authors?: string[];
    types?: ResourceType[];
    minLines?: number;
    maxLines?: number;
}
export interface SearchQuery {
    keywords: string[];
    rawQuery?: string;
    filters: SearchFilters;
    semantic?: boolean;
    embedding?: number[];
    limit: number;
    offset?: number;
    sortBy?: 'relevance' | 'date' | 'lines' | 'title';
    sortOrder?: 'asc' | 'desc';
}
export interface SearchFacets {
    categories: Record<Category, number>;
    authors: Record<string, number>;
    stages: Record<FounderStage, number>;
    types: Record<ResourceType, number>;
}
export interface SearchResult {
    resources: ResourceMeta[];
    total: number;
    query: SearchQuery;
    facets: SearchFacets;
    executionTimeMs: number;
}
export interface ScoredResource {
    resource: ResourceMeta;
    score: number;
    matches: {
        field: string;
        matched: string;
        score: number;
    }[];
}
export interface KnowledgeIndex {
    version: string;
    generatedAt: string;
    stats: {
        totalResources: number;
        totalCategories: number;
        totalLines: number;
        totalAuthors: number;
    };
    categories: Record<Category, {
        count: number;
        resources: string[];
    }>;
    resources: Record<string, ResourceMeta>;
    searchIndex: {
        byAuthor: Record<string, string[]>;
        byType: Record<ResourceType, string[]>;
        byStage: Record<FounderStage, string[]>;
        keywords: Record<string, string[]>;
    };
}
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}
export interface ApiSearchRequest {
    q: string;
    category?: Category;
    stage?: FounderStage;
    author?: string;
    type?: ResourceType;
    semantic?: boolean;
    limit?: number;
    offset?: number;
}
export interface ApiSearchResponse {
    results: ResourceMeta[];
    total: number;
    query: string;
    facets: SearchFacets;
    executionTimeMs: number;
}
export interface ApiResourceResponse {
    meta: ResourceMeta;
    content: string;
    related: ResourceMeta[];
}
export interface ApiCategoriesResponse {
    categories: CategoryInfo[];
    totalResources: number;
}
export declare class KnowledgeBaseError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode?: number);
}
export declare class ResourceNotFoundError extends KnowledgeBaseError {
    constructor(code: string);
}
export declare class InvalidQueryError extends KnowledgeBaseError {
    constructor(message: string);
}
export interface KnowledgeBaseConfig {
    indexPath: string;
    contentPath: string;
    cacheSize: number;
    cacheTtl: number;
    enableSemantic: boolean;
    embeddingModel?: string;
    maxResults: number;
    defaultLimit: number;
}
export declare const DEFAULT_CONFIG: KnowledgeBaseConfig;
//# sourceMappingURL=types.d.ts.map