/**
 * YC Advisor Knowledge Base - Type Definitions
 * Version 2.0
 */

// ============================================================================
// Enums & Constants
// ============================================================================

export type ResourceType = 'essay' | 'video' | 'podcast';

export type FounderStage = 'pre-idea' | 'idea' | 'building' | 'launched' | 'scaling' | 'all';

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
] as const;

export type Category = typeof CATEGORIES[number];

// ============================================================================
// Core Data Models
// ============================================================================

/**
 * Resource metadata (lightweight, for indexing)
 */
export interface ResourceMeta {
  /** Unique code (e.g., '8z', 'JW') */
  code: string;
  
  /** Resource title */
  title: string;
  
  /** Author name */
  author: string;
  
  /** Resource type */
  type: ResourceType;
  
  /** YC Library URL */
  url: string;
  
  /** Topic tags */
  topics: string[];
  
  /** Applicable founder stages */
  founderStage: FounderStage[];
  
  /** Line count (for size estimation) */
  lines: number;
  
  /** Relative file path */
  filePath: string;
  
  /** Whether full transcript is available */
  hasTranscript: boolean;
  
  /** Related resource codes */
  related?: string[];
  
  /** Brief summary (optional) */
  summary?: string;
}

/**
 * Full resource with content
 */
export interface Resource extends ResourceMeta {
  /** Full markdown content */
  content: string;
  
  /** Content chunks for semantic search */
  chunks?: ContentChunk[];
}

/**
 * Content chunk for semantic search
 */
export interface ContentChunk {
  id: string;
  text: string;
  startLine: number;
  endLine: number;
}

/**
 * Category information
 */
export interface CategoryInfo {
  id: Category;
  name: string;
  count: number;
  description?: string;
}

// ============================================================================
// Search & Query Models
// ============================================================================

/**
 * Search filters
 */
export interface SearchFilters {
  /** Filter by categories */
  categories?: Category[];
  
  /** Filter by founder stages */
  stages?: FounderStage[];
  
  /** Filter by authors */
  authors?: string[];
  
  /** Filter by resource types */
  types?: ResourceType[];
  
  /** Minimum line count */
  minLines?: number;
  
  /** Maximum line count */
  maxLines?: number;
}

/**
 * Search query
 */
export interface SearchQuery {
  /** Search keywords */
  keywords: string[];
  
  /** Raw query string (for semantic search) */
  rawQuery?: string;
  
  /** Filters to apply */
  filters: SearchFilters;
  
  /** Use semantic search */
  semantic?: boolean;
  
  /** Query embedding vector (for semantic search) */
  embedding?: number[];
  
  /** Maximum results to return */
  limit: number;
  
  /** Offset for pagination */
  offset?: number;
  
  /** Sort field */
  sortBy?: 'relevance' | 'date' | 'lines' | 'title';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Facet counts for search results
 */
export interface SearchFacets {
  categories: Record<Category, number>;
  authors: Record<string, number>;
  stages: Record<FounderStage, number>;
  types: Record<ResourceType, number>;
}

/**
 * Search result
 */
export interface SearchResult {
  /** Matching resources */
  resources: ResourceMeta[];
  
  /** Total matching count */
  total: number;
  
  /** Query that was executed */
  query: SearchQuery;
  
  /** Facet counts */
  facets: SearchFacets;
  
  /** Search execution time (ms) */
  executionTimeMs: number;
}

/**
 * Scored resource for ranking
 */
export interface ScoredResource {
  resource: ResourceMeta;
  score: number;
  matches: {
    field: string;
    matched: string;
    score: number;
  }[];
}

// ============================================================================
// Index & Storage Models
// ============================================================================

/**
 * Knowledge index structure (JSON)
 */
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
    resources: string[];  // Resource codes
  }>;
  resources: Record<string, ResourceMeta>;
  searchIndex: {
    byAuthor: Record<string, string[]>;
    byType: Record<ResourceType, string[]>;
    byStage: Record<FounderStage, string[]>;
    keywords: Record<string, string[]>;  // Inverted index
  };
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// API Request/Response Models
// ============================================================================

/**
 * API Search request
 */
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

/**
 * API Search response
 */
export interface ApiSearchResponse {
  results: ResourceMeta[];
  total: number;
  query: string;
  facets: SearchFacets;
  executionTimeMs: number;
}

/**
 * API Resource response
 */
export interface ApiResourceResponse {
  meta: ResourceMeta;
  content: string;
  related: ResourceMeta[];
}

/**
 * API Categories response
 */
export interface ApiCategoriesResponse {
  categories: CategoryInfo[];
  totalResources: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class KnowledgeBaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'KnowledgeBaseError';
  }
}

export class ResourceNotFoundError extends KnowledgeBaseError {
  constructor(code: string) {
    super(`Resource not found: ${code}`, 'RESOURCE_NOT_FOUND', 404);
    this.name = 'ResourceNotFoundError';
  }
}

export class InvalidQueryError extends KnowledgeBaseError {
  constructor(message: string) {
    super(message, 'INVALID_QUERY', 400);
    this.name = 'InvalidQueryError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface KnowledgeBaseConfig {
  /** Path to knowledge index JSON */
  indexPath: string;
  
  /** Path to markdown files */
  contentPath: string;
  
  /** Cache size limit (number of entries) */
  cacheSize: number;
  
  /** Default cache TTL (ms) */
  cacheTtl: number;
  
  /** Enable semantic search */
  enableSemantic: boolean;
  
  /** Embedding model name (for semantic search) */
  embeddingModel?: string;
  
  /** Maximum results per search */
  maxResults: number;
  
  /** Default results limit */
  defaultLimit: number;
}

export const DEFAULT_CONFIG: KnowledgeBaseConfig = {
  indexPath: './data/knowledge-index.json',
  contentPath: './references',
  cacheSize: 100,
  cacheTtl: 5 * 60 * 1000,  // 5 minutes
  enableSemantic: false,
  maxResults: 50,
  defaultLimit: 10,
};
