import { ResourceMeta, Category } from './types';
export declare function tokenize(text: string): string[];
export declare function createNGrams(text: string, n?: number): string[];
export declare function calculateTfIdf(term: string, document: string, documents: string[]): number;
export declare function levenshteinDistance(a: string, b: string): number;
export declare function fuzzyMatch(query: string, text: string): number;
export declare function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number;
export declare function cosineSimilarity(a: number[], b: number[]): number;
export declare function createBowVector(text: string, vocabulary: string[]): number[];
interface ScoringWeights {
    title: number;
    author: number;
    topics: number;
    summary: number;
    content: number;
    category: number;
}
export declare function advancedScoreResource(resource: ResourceMeta, query: string, weights?: Partial<ScoringWeights>): {
    score: number;
    breakdown: Record<string, number>;
};
export declare function generateSuggestions(partialQuery: string, resources: ResourceMeta[], maxSuggestions?: number): string[];
export declare function aggregateByCategory(resources: ResourceMeta[]): Record<Category, ResourceMeta[]>;
export declare function getTopAuthors(resources: ResourceMeta[], limit?: number): {
    author: string;
    count: number;
}[];
export interface ParsedQuery {
    keywords: string[];
    filters: {
        author?: string;
        category?: string;
        type?: string;
        stage?: string;
    };
    excluded: string[];
    phrases: string[];
}
export declare function parseQuery(query: string): ParsedQuery;
export declare const SearchUtils: {
    tokenize: typeof tokenize;
    createNGrams: typeof createNGrams;
    calculateTfIdf: typeof calculateTfIdf;
    fuzzyMatch: typeof fuzzyMatch;
    jaccardSimilarity: typeof jaccardSimilarity;
    cosineSimilarity: typeof cosineSimilarity;
    createBowVector: typeof createBowVector;
    advancedScoreResource: typeof advancedScoreResource;
    generateSuggestions: typeof generateSuggestions;
    aggregateByCategory: typeof aggregateByCategory;
    getTopAuthors: typeof getTopAuthors;
    parseQuery: typeof parseQuery;
};
export {};
//# sourceMappingURL=search.d.ts.map