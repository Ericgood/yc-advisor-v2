import { ResourceMeta, Resource, SearchQuery, SearchResult, SearchFilters, Category, ResourceType, FounderStage, KnowledgeBaseConfig } from './types';
export declare class KnowledgeBase {
    private index;
    private config;
    private resourceCache;
    private searchCache;
    private initialized;
    constructor(config?: Partial<KnowledgeBaseConfig>);
    initialize(): Promise<void>;
    private ensureInitialized;
    getAllResources(): ResourceMeta[];
    getResourceMeta(code: string): ResourceMeta | undefined;
    getResourcesByCodes(codes: string[]): ResourceMeta[];
    getResourcesByCategory(category: Category): ResourceMeta[];
    getResourcesByAuthor(author: string): ResourceMeta[];
    getResourcesByType(type: ResourceType): ResourceMeta[];
    getResourcesByStage(stage: FounderStage): ResourceMeta[];
    loadResource(code: string): Promise<Resource>;
    search(query: SearchQuery): Promise<SearchResult>;
    quickSearch(query: string, options?: {
        filters?: SearchFilters;
        limit?: number;
    }): Promise<SearchResult>;
    getCategories(): {
        id: Category;
        name: string;
        count: number;
    }[];
    getStats(): {
        totalResources: number;
        totalCategories: number;
        totalLines: number;
        totalAuthors: number;
    };
    clearCache(): void;
    getCacheStats(): {
        resourceCacheSize: number;
        searchCacheSize: number;
    };
}
export declare function getKnowledgeBase(config?: Partial<KnowledgeBaseConfig>): KnowledgeBase;
export declare function resetKnowledgeBase(): void;
//# sourceMappingURL=knowledge-base.d.ts.map