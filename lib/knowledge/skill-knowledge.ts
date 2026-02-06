/**
 * YC Skill-Based Knowledge Retrieval
 * Implements the proper 3-step workflow from SKILL.md
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'tinyglobby';

// Resource metadata from quick-index
export interface SkillResource {
  code: string;
  title: string;
  author: string;
  type: 'essay' | 'video' | 'podcast';
  lines: number;
  stage: string;
  filePath?: string;
}

export interface SkillContent {
  meta: SkillResource;
  content: string;
}

export class YCSkillKnowledge {
  private resources: Map<string, SkillResource> = new Map();
  private quickIndexPath: string;
  private referencesPath: string;
  private initialized = false;

  constructor(
    quickIndexPath?: string,
    referencesPath?: string
  ) {
    // Use environment variables or fallback to project-relative paths
    this.quickIndexPath = quickIndexPath || 
      process.env.QUICK_INDEX_PATH || 
      path.join(process.cwd(), 'data', 'references', 'quick-index.md');
    this.referencesPath = referencesPath || 
      process.env.REFERENCES_PATH || 
      path.join(process.cwd(), 'data', 'references');
  }

  /**
   * Step 1: Discovery - Load and parse quick-index.md
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const content = await fs.readFile(this.quickIndexPath, 'utf-8');
      this.parseQuickIndex(content);
      this.initialized = true;
      console.log(`[YCSkill] Loaded ${this.resources.size} resources from quick-index`);
    } catch (error) {
      console.error('[YCSkill] Failed to load quick-index:', error);
      throw error;
    }
  }

  /**
   * Parse quick-index.md format:
   * - **8z** | How to Get Startup Ideas | Paul Graham | essay | 543L | idea
   */
  private parseQuickIndex(content: string): void {
    const lines = content.split('\n');
    const resourcePattern = /^-\s+\*\*([A-Za-z0-9]+)\*\*\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(essay|video|podcast)\s+\|\s+(\d+)L?\s+\|\s+(\w+)/;

    for (const line of lines) {
      const match = line.match(resourcePattern);
      if (match) {
        const [, code, title, author, type, lines, stage] = match;
        this.resources.set(code, {
          code,
          title: title.trim(),
          author: author.trim(),
          type: type as 'essay' | 'video' | 'podcast',
          lines: parseInt(lines, 10),
          stage: stage.trim(),
        });
      }
    }
  }

  /**
   * Step 1: Discovery - Find relevant resources by keyword matching
   */
  async discover(query: string, limit: number = 5): Promise<SkillResource[]> {
    await this.ensureInitialized();

    const keywords = this.extractKeywords(query);
    console.log(`[YCSkill] Discovery for query: "${query}" with keywords:`, keywords);

    const scored: Array<{ resource: SkillResource; score: number }> = [];

    for (const resource of this.resources.values()) {
      const score = this.calculateRelevanceScore(resource, keywords);
      if (score > 0) {
        scored.push({ resource, score });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top N
    const results = scored.slice(0, limit).map(s => s.resource);
    console.log(`[YCSkill] Discovered ${results.length} relevant resources:`, 
      results.map(r => ({ code: r.code, title: r.title, author: r.author })));

    return results;
  }

  /**
   * Step 2: Deep Dive - Load full content of resources by code
   */
  async loadResources(codes: string[]): Promise<SkillContent[]> {
    await this.ensureInitialized();

    const results: SkillContent[] = [];

    for (const code of codes) {
      const resource = this.resources.get(code);
      if (!resource) {
        console.warn(`[YCSkill] Resource not found: ${code}`);
        continue;
      }

      try {
        // Find file using glob pattern: {CODE}-*.md
        const pattern = path.join(this.referencesPath, `${code}-*.md`);
        const files = await glob(pattern);

        if (files.length === 0) {
          console.warn(`[YCSkill] No file found for code: ${code}`);
          continue;
        }

        const filePath = files[0];
        const content = await fs.readFile(filePath, 'utf-8');

        results.push({
          meta: resource,
          content,
        });

        console.log(`[YCSkill] Loaded content for ${code}: ${content.length} chars`);
      } catch (error) {
        console.error(`[YCSkill] Failed to load resource ${code}:`, error);
      }
    }

    return results;
  }

  /**
   * Get all available resources
   */
  getAllResources(): SkillResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resource by code
   */
  getResource(code: string): SkillResource | undefined {
    return this.resources.get(code);
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
      'how', 'when', 'where', 'why', 'all', 'any', 'both', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 'just', 'get', 'like',
      'me', 'my', 'we', 'our', 'us', 'them', 'their', 'there', 'then',
      '关于', '如何', '的', '了', '是', '在', '我', '有', '个', '和', '吗'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Calculate relevance score based on keyword matching
   */
  private calculateRelevanceScore(resource: SkillResource, keywords: string[]): number {
    let score = 0;
    const searchableText = `${resource.title} ${resource.author}`.toLowerCase();

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      
      // Title match (highest weight)
      if (resource.title.toLowerCase().includes(lowerKeyword)) {
        score += 10;
      }
      
      // Author match
      if (resource.author.toLowerCase().includes(lowerKeyword)) {
        score += 5;
      }
      
      // Partial word match
      if (searchableText.includes(lowerKeyword)) {
        score += 3;
      }
    }

    // Boost for shorter, more focused articles (line count)
    if (resource.lines < 200) score += 2;
    else if (resource.lines < 500) score += 1;

    return score;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Singleton instance
let skillKnowledge: YCSkillKnowledge | null = null;

export function getYCSkillKnowledge(): YCSkillKnowledge {
  if (!skillKnowledge) {
    skillKnowledge = new YCSkillKnowledge();
  }
  return skillKnowledge;
}
