/**
 * Knowledge Base Core Implementation
 * Fast in-memory search with multi-level caching
 */

import {
  ResourceMeta,
  Resource,
  SearchQuery,
  SearchResult,
  SearchFilters,
  SearchFacets,
  ScoredResource,
  KnowledgeIndex,
  Category,
  ResourceType,
  FounderStage,
  CacheEntry,
  KnowledgeBaseConfig,
  DEFAULT_CONFIG,
  ResourceNotFoundError,
} from './types';

// ============================================================================
// Utility Functions
// ============================================================================

/** Normalize text for search */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract keywords from text */
function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);
  
  // Remove common stop words
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
  
  return words.filter(word => 
    word.length > 2 && !stopWords.has(word)
  );
}

/** Calculate keyword match score */
function calculateKeywordScore(
  resource: ResourceMeta,
  keywords: string[]
): { score: number; matches: { field: string; matched: string; score: number }[] } {
  let totalScore = 0;
  const matches: { field: string; matched: string; score: number }[] = [];
  
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
      
      // Exact match
      if (normalizedValue === normalizedKeyword) {
        totalScore += 10 * weight;
        matches.push({ field, matched: keyword, score: 10 * weight });
      }
      // Contains match
      else if (normalizedValue.includes(normalizedKeyword)) {
        totalScore += 5 * weight;
        matches.push({ field, matched: keyword, score: 5 * weight });
      }
      // Word boundary match
      else if (new RegExp(`\\b${normalizedKeyword}\\b`).test(normalizedValue)) {
        totalScore += 3 * weight;
        matches.push({ field, matched: keyword, score: 3 * weight });
      }
    }
  }
  
  return { score: totalScore, matches };
}

/** Apply filters to resources */
function applyFilters(
  resources: ResourceMeta[],
  filters: SearchFilters
): ResourceMeta[] {
  return resources.filter(resource => {
    // Category filter
    if (filters.categories?.length) {
      const hasMatchingTopic = resource.topics.some(topic => 
        filters.categories!.includes(topic as Category)
      );
      if (!hasMatchingTopic) return false;
    }
    
    // Stage filter
    if (filters.stages?.length) {
      const hasMatchingStage = resource.founderStage.some(stage =>
        filters.stages!.includes(stage)
      );
      if (!hasMatchingStage) return false;
    }
    
    // Author filter
    if (filters.authors?.length) {
      if (!filters.authors.includes(resource.author)) return false;
    }
    
    // Type filter
    if (filters.types?.length) {
      if (!filters.types.includes(resource.type)) return false;
    }
    
    // Line count filters
    if (filters.minLines !== undefined && resource.lines < filters.minLines) {
      return false;
    }
    if (filters.maxLines !== undefined && resource.lines > filters.maxLines) {
      return false;
    }
    
    return true;
  });
}

/** Calculate facets for search results */
function calculateFacets(resources: ResourceMeta[]): SearchFacets {
  const facets: SearchFacets = {
    categories: {} as Record<Category, number>,
    authors: {},
    stages: {} as Record<FounderStage, number>,
    types: {} as Record<ResourceType, number>,
  };
  
  for (const resource of resources) {
    // Categories (from topics)
    for (const topic of resource.topics) {
      facets.categories[topic as Category] = 
        (facets.categories[topic as Category] || 0) + 1;
    }
    
    // Authors
    facets.authors[resource.author] = 
      (facets.authors[resource.author] || 0) + 1;
    
    // Stages
    for (const stage of resource.founderStage) {
      facets.stages[stage] = (facets.stages[stage] || 0) + 1;
    }
    
    // Types
    facets.types[resource.type] = (facets.types[resource.type] || 0) + 1;
  }
  
  return facets;
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  
  constructor(
    private maxSize: number,
    private defaultTtl: number
  ) {}
  
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.data;
  }
  
  set(key: K, value: V, ttl?: number): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value as K | undefined;
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
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Knowledge Base Class
// ============================================================================

export class KnowledgeBase {
  private index: KnowledgeIndex | null = null;
  private config: KnowledgeBaseConfig;
  private resourceCache: LRUCache<string, Resource>;
  private searchCache: LRUCache<string, SearchResult>;
  private initialized = false;
  
  constructor(config: Partial<KnowledgeBaseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.resourceCache = new LRUCache(this.config.cacheSize, this.config.cacheTtl);
    this.searchCache = new LRUCache(this.config.cacheSize, this.config.cacheTtl);
  }
  
  /**
   * Initialize the knowledge base by loading the index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // In Node.js environment, try fs first, fallback to fetch
      if (typeof window === 'undefined') {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Try multiple possible paths for different environments
        const possiblePaths = [
          // Environment variable override
          process.env.KNOWLEDGE_INDEX_PATH,
          // Relative to cwd (local dev)
          path.resolve(this.config.indexPath),
          // Relative to cwd with ./
          path.resolve(process.cwd(), this.config.indexPath),
          // Vercel serverless specific paths
          path.resolve(process.cwd(), 'data/knowledge-index.json'),
          path.join(process.cwd(), 'data/knowledge-index.json'),
        ].filter(Boolean) as string[];
        
        let data: string | null = null;
        
        for (const indexPath of possiblePaths) {
          try {
            // Check if file exists first
            await fs.access(indexPath);
            data = await fs.readFile(indexPath, 'utf-8');
            console.log(`[KnowledgeBase] Loaded index from: ${indexPath}`);
            break;
          } catch {
            continue;
          }
        }
        
        if (data) {
          this.index = JSON.parse(data) as KnowledgeIndex;
        } else {
          // Fallback to fetch API if fs fails (e.g., in some serverless environments)
          console.log('[KnowledgeBase] Falling back to fetch API for index');
          const indexUrl = process.env.KNOWLEDGE_INDEX_URL || '/data/knowledge-index.json';
          const response = await fetch(indexUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch index from ${indexUrl}: ${response.status}`);
          }
          this.index = await response.json() as KnowledgeIndex;
        }
      } else {
        // In browser, fetch the index
        const response = await fetch(this.config.indexPath);
        this.index = await response.json() as KnowledgeIndex;
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('[KnowledgeBase] Failed to load knowledge index:', error);
      throw new Error(`Failed to load knowledge index: ${error}`);
    }
  }
  
  /**
   * Ensure initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.index) {
      throw new Error('KnowledgeBase not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Get all resource metadata
   */
  getAllResources(): ResourceMeta[] {
    this.ensureInitialized();
    return Object.values(this.index!.resources);
  }
  
  /**
   * Get resource by code
   */
  getResourceMeta(code: string): ResourceMeta | undefined {
    this.ensureInitialized();
    return this.index!.resources[code];
  }
  
  /**
   * Get multiple resources by codes
   */
  getResourcesByCodes(codes: string[]): ResourceMeta[] {
    this.ensureInitialized();
    return codes
      .map(code => this.index!.resources[code])
      .filter((r): r is ResourceMeta => r !== undefined);
  }
  
  /**
   * Get resources by category
   */
  getResourcesByCategory(category: Category): ResourceMeta[] {
    this.ensureInitialized();
    const categoryData = this.index!.categories[category];
    if (!categoryData) return [];
    return this.getResourcesByCodes(categoryData.resources);
  }
  
  /**
   * Get resources by author
   */
  getResourcesByAuthor(author: string): ResourceMeta[] {
    this.ensureInitialized();
    const codes = this.index!.searchIndex.byAuthor[author] || [];
    return this.getResourcesByCodes(codes);
  }
  
  /**
   * Get resources by type
   */
  getResourcesByType(type: ResourceType): ResourceMeta[] {
    this.ensureInitialized();
    const codes = this.index!.searchIndex.byType[type] || [];
    return this.getResourcesByCodes(codes);
  }
  
  /**
   * Get resources by stage
   */
  getResourcesByStage(stage: FounderStage): ResourceMeta[] {
    this.ensureInitialized();
    const codes = this.index!.searchIndex.byStage[stage] || [];
    return this.getResourcesByCodes(codes);
  }
  
  /**
   * Load full resource content
   */
  async loadResource(code: string): Promise<Resource> {
    this.ensureInitialized();
    
    // Check cache
    const cached = this.resourceCache.get(code);
    if (cached) return cached;
    
    const meta = this.index!.resources[code];
    if (!meta) {
      throw new ResourceNotFoundError(code);
    }
    
    try {
      // Load content from file
      let content: string | undefined;
      
      if (typeof window === 'undefined') {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Try multiple possible paths for different environments
        const possiblePaths = [
          path.resolve(this.config.contentPath, meta.filePath),
          path.resolve(process.cwd(), this.config.contentPath, meta.filePath),
          path.join(process.cwd(), this.config.contentPath, meta.filePath),
          path.resolve('references', meta.filePath),
          path.join(process.cwd(), 'references', meta.filePath),
        ];
        
        let loaded = false;
        
        for (const filePath of possiblePaths) {
          try {
            await fs.access(filePath);
            content = await fs.readFile(filePath, 'utf-8');
            console.log(`[KnowledgeBase] Loaded resource ${code} from: ${filePath}`);
            loaded = true;
            break;
          } catch {
            continue;
          }
        }
        
        if (!loaded) {
          // Fallback to fetch API
          const contentUrl = `${process.env.KNOWLEDGE_CONTENT_URL || '/references'}/${meta.filePath}`;
          console.log(`[KnowledgeBase] Falling back to fetch for resource ${code}: ${contentUrl}`);
          const response = await fetch(contentUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch resource from ${contentUrl}: ${response.status}`);
          }
          content = await response.text();
        }
      } else {
        const response = await fetch(`${this.config.contentPath}/${meta.filePath}`);
        content = await response.text();
      }
      
      // Ensure content is defined (should always be due to logic above)
      if (!content) {
        throw new Error('Failed to load content');
      }
      
      const resource: Resource = {
        ...meta,
        content,
      };
      
      // Cache the resource
      this.resourceCache.set(code, resource);
      
      return resource;
    } catch (error) {
      // Fallback: return resource with summary instead of full content
      console.warn(`[KnowledgeBase] Failed to load resource ${code}, using fallback:`, error);
      const fallbackResource: Resource = {
        ...meta,
        content: `# ${meta.title}\n\n**Author:** ${meta.author}\n**Type:** ${meta.type}\n**URL:** ${meta.url}\n\n*(Full content not available in this environment)*\n\n**Topics:** ${meta.topics.join(', ')}`,
      };
      return fallbackResource;
    }
  }
  
  /**
   * Search resources
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    // Generate cache key
    const cacheKey = JSON.stringify(query);
    
    // Check cache
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;
    
    // Get all resources
    let candidates = this.getAllResources();
    
    // Apply metadata filters (Level 1)
    if (Object.keys(query.filters).length > 0) {
      candidates = applyFilters(candidates, query.filters);
    }
    
    // Score by keywords (Level 2)
    let scoredResources: ScoredResource[] = [];
    
    if (query.keywords.length > 0) {
      for (const resource of candidates) {
        const { score, matches } = calculateKeywordScore(resource, query.keywords);
        if (score > 0 || query.keywords.length === 0) {
          scoredResources.push({ resource, score, matches });
        }
      }
      
      // Sort by score
      scoredResources.sort((a, b) => b.score - a.score);
    } else {
      // No keywords, return all filtered resources
      scoredResources = candidates.map(r => ({
        resource: r,
        score: 0,
        matches: [],
      }));
    }
    
    // Calculate total before pagination
    const total = scoredResources.length;
    
    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit;
    scoredResources = scoredResources.slice(offset, offset + limit);
    
    // Extract resources
    const resources = scoredResources.map(sr => sr.resource);
    
    // Calculate facets from all matching resources (before pagination)
    const allMatching = query.keywords.length > 0 
      ? candidates.filter(c => 
          scoredResources.some(sr => sr.resource.code === c.code) ||
          calculateKeywordScore(c, query.keywords).score > 0
        )
      : candidates;
    const facets = calculateFacets(allMatching);
    
    const result: SearchResult = {
      resources,
      total,
      query,
      facets,
      executionTimeMs: Date.now() - startTime,
    };
    
    // Cache result
    this.searchCache.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * Quick search with simple query string
   */
  async quickSearch(
    query: string,
    options: {
      filters?: SearchFilters;
      limit?: number;
    } = {}
  ): Promise<SearchResult> {
    const keywords = extractKeywords(query);
    
    return this.search({
      keywords,
      rawQuery: query,
      filters: options.filters || {},
      limit: options.limit || this.config.defaultLimit,
    });
  }
  
  /**
   * Get category information
   */
  getCategories(): { id: Category; name: string; count: number }[] {
    this.ensureInitialized();
    
    return Object.entries(this.index!.categories).map(([id, data]) => ({
      id: id as Category,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
      count: data.count,
    }));
  }
  
  /**
   * Get index statistics
   */
  getStats() {
    this.ensureInitialized();
    return this.index!.stats;
  }
  
  /**
   * Clear caches
   */
  clearCache(): void {
    this.resourceCache.clear();
    this.searchCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      resourceCacheSize: this.resourceCache.size(),
      searchCacheSize: this.searchCache.size(),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let globalKnowledgeBase: KnowledgeBase | null = null;

export function getKnowledgeBase(config?: Partial<KnowledgeBaseConfig>): KnowledgeBase {
  if (!globalKnowledgeBase) {
    globalKnowledgeBase = new KnowledgeBase(config);
  }
  return globalKnowledgeBase;
}

export function resetKnowledgeBase(): void {
  globalKnowledgeBase = null;
}
