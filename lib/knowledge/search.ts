/**
 * Search utilities and advanced ranking algorithms
 */

import {
  ResourceMeta,
  Category,
} from './types';

// ============================================================================
// Text Processing
// ============================================================================

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

/** Tokenize text into searchable terms */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/** Create n-grams from text */
export function createNGrams(text: string, n: number = 2): string[] {
  const tokens = tokenize(text);
  const ngrams: string[] = [];
  
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  
  return ngrams;
}

/** Calculate TF-IDF score */
export function calculateTfIdf(
  term: string,
  document: string,
  documents: string[]
): number {
  // Term frequency
  const tokens = tokenize(document);
  const termCount = tokens.filter(t => t === term).length;
  const tf = termCount / tokens.length;
  
  // Inverse document frequency
  const docCount = documents.filter(doc => 
    tokenize(doc).includes(term)
  ).length;
  const idf = Math.log(documents.length / (docCount + 1)) + 1;
  
  return tf * idf;
}

// ============================================================================
// Fuzzy Matching
// ============================================================================

/** Calculate Levenshtein distance */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
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
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/** Calculate fuzzy match score (0-1) */
export function fuzzyMatch(query: string, text: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();
  
  // Exact match
  if (normalizedText === normalizedQuery) return 1;
  
  // Contains match
  if (normalizedText.includes(normalizedQuery)) return 0.9;
  
  // Word boundary match
  if (new RegExp(`\\b${normalizedQuery}\\b`).test(normalizedText)) {
    return 0.8;
  }
  
  // Fuzzy match using Levenshtein
  const distance = levenshteinDistance(normalizedQuery, normalizedText);
  const maxLength = Math.max(normalizedQuery.length, normalizedText.length);
  const similarity = 1 - distance / maxLength;
  
  return similarity > 0.7 ? similarity * 0.7 : 0;
}

// ============================================================================
// Semantic Similarity (Simplified - without embeddings)
// ============================================================================

/** Calculate Jaccard similarity between two sets */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/** Calculate cosine similarity between two vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Create a simple bag-of-words vector */
export function createBowVector(
  text: string,
  vocabulary: string[]
): number[] {
  const tokens = tokenize(text);
  const tokenSet = new Set(tokens);
  
  return vocabulary.map(word => tokenSet.has(word) ? 1 : 0);
}

// ============================================================================
// Advanced Scoring
// ============================================================================

interface ScoringWeights {
  title: number;
  author: number;
  topics: number;
  summary: number;
  content: number;
  category: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  title: 5,
  author: 3,
  topics: 3,
  summary: 2,
  content: 1,
  category: 2,
};

/** Advanced resource scoring with multiple signals */
export function advancedScoreResource(
  resource: ResourceMeta,
  query: string,
  weights: Partial<ScoringWeights> = {}
): { score: number; breakdown: Record<string, number> } {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const queryTokens = new Set(tokenize(query));
  
  const breakdown: Record<string, number> = {};
  
  // Title score
  const titleTokens = new Set(tokenize(resource.title));
  breakdown.title = jaccardSimilarity(queryTokens, titleTokens) * w.title;
  
  // Author score
  const authorTokens = new Set(tokenize(resource.author));
  breakdown.author = jaccardSimilarity(queryTokens, authorTokens) * w.author;
  
  // Topics score
  const topicTokens = new Set(resource.topics.flatMap(tokenize));
  breakdown.topics = jaccardSimilarity(queryTokens, topicTokens) * w.topics;
  
  // Summary score (if available)
  if (resource.summary) {
    const summaryTokens = new Set(tokenize(resource.summary));
    breakdown.summary = jaccardSimilarity(queryTokens, summaryTokens) * w.summary;
  } else {
    breakdown.summary = 0;
  }
  
  // Category match bonus
  const categoryMatch = resource.topics.some(topic => 
    query.toLowerCase().includes(topic.toLowerCase())
  );
  breakdown.category = categoryMatch ? w.category : 0;
  
  // Calculate total
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  return { score, breakdown };
}

// ============================================================================
// Query Suggestions
// ============================================================================

/** Generate search suggestions based on partial query */
export function generateSuggestions(
  partialQuery: string,
  resources: ResourceMeta[],
  maxSuggestions: number = 5
): string[] {
  const query = partialQuery.toLowerCase();
  const suggestions = new Set<string>();
  
  for (const resource of resources) {
    // Title suggestions
    if (resource.title.toLowerCase().includes(query)) {
      suggestions.add(resource.title);
    }
    
    // Author suggestions
    if (resource.author.toLowerCase().includes(query)) {
      suggestions.add(`author:${resource.author}`);
    }
    
    // Topic suggestions
    for (const topic of resource.topics) {
      if (topic.toLowerCase().includes(query)) {
        suggestions.add(`topic:${topic}`);
      }
    }
    
    if (suggestions.size >= maxSuggestions) break;
  }
  
  return Array.from(suggestions).slice(0, maxSuggestions);
}

// ============================================================================
// Facet Aggregation
// ============================================================================

/** Aggregate search results by category */
export function aggregateByCategory(
  resources: ResourceMeta[]
): Record<Category, ResourceMeta[]> {
  const aggregated: Partial<Record<Category, ResourceMeta[]>> = {};
  
  for (const resource of resources) {
    for (const topic of resource.topics) {
      const category = topic as Category;
      if (!aggregated[category]) {
        aggregated[category] = [];
      }
      aggregated[category]!.push(resource);
    }
  }
  
  return aggregated as Record<Category, ResourceMeta[]>;
}

/** Get top authors from results */
export function getTopAuthors(
  resources: ResourceMeta[],
  limit: number = 10
): { author: string; count: number }[] {
  const counts: Record<string, number> = {};
  
  for (const resource of resources) {
    counts[resource.author] = (counts[resource.author] || 0) + 1;
  }
  
  return Object.entries(counts)
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ============================================================================
// Query Parser
// ============================================================================

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

/** Parse search query with advanced syntax */
export function parseQuery(query: string): ParsedQuery {
  const parsed: ParsedQuery = {
    keywords: [],
    filters: {},
    excluded: [],
    phrases: [],
  };
  
  // Extract phrases in quotes
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(query)) !== null) {
    parsed.phrases.push(match[1]);
  }
  
  // Remove phrases from query
  const withoutPhrases = query.replace(phraseRegex, '');
  
  // Split by spaces
  const parts = withoutPhrases.split(/\s+/);
  
  for (const part of parts) {
    if (!part) continue;
    
    // Check for filters (e.g., author:Paul)
    if (part.includes(':')) {
      const [key, value] = part.split(':');
      if (key && value && ['author', 'category', 'type', 'stage'].includes(key)) {
        parsed.filters[key as keyof typeof parsed.filters] = value;
        continue;
      }
    }
    
    // Check for exclusions
    if (part.startsWith('-')) {
      parsed.excluded.push(part.slice(1));
      continue;
    }
    
    // Regular keyword
    parsed.keywords.push(part);
  }
  
  return parsed;
}

// ============================================================================
// Export utilities
// ============================================================================

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
