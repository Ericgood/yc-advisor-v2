/**
 * YC Skill-Based Knowledge Retrieval
 * Simple version that works on Vercel
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface SkillResource {
  code: string;
  title: string;
  author: string;
  type: 'essay' | 'video' | 'podcast';
  lines: number;
  stage: string;
}

export interface SkillContent {
  meta: SkillResource;
  content: string;
}

export class YCSkillKnowledge {
  private resources: Map<string, SkillResource> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try multiple possible paths for different environments
      const possiblePaths = [
        path.join(process.cwd(), 'data', 'references', 'quick-index.md'),
        path.join('/var/task', 'data', 'references', 'quick-index.md'),
        path.join(__dirname, '..', '..', '..', 'data', 'references', 'quick-index.md'),
      ];

      let content: string | null = null;
      let loadedPath: string | null = null;

      for (const p of possiblePaths) {
        try {
          content = await fs.readFile(p, 'utf-8');
          loadedPath = p;
          break;
        } catch {
          continue;
        }
      }

      if (!content) {
        throw new Error('Could not find quick-index.md in any path');
      }

      this.parseQuickIndex(content);
      this.initialized = true;
      console.log(`[YCSkill] Loaded ${this.resources.size} resources from ${loadedPath}`);
    } catch (error) {
      console.error('[YCSkill] Init failed:', error);
      throw error;
    }
  }

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

  async discover(query: string, limit: number = 5): Promise<SkillResource[]> {
    await this.ensureInitialized();

    const keywords = this.extractKeywords(query);
    console.log(`[YCSkill] Discovery: "${query}" -> keywords:`, keywords);

    const scored: Array<{ resource: SkillResource; score: number }> = [];

    for (const resource of this.resources.values()) {
      const score = this.calculateRelevanceScore(resource, keywords);
      if (score > 0) {
        scored.push({ resource, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit).map(s => s.resource);
    
    console.log(`[YCSkill] Discovered ${results.length} resources:`, results.map(r => r.code));
    return results;
  }

  async loadResources(codes: string[]): Promise<SkillContent[]> {
    await this.ensureInitialized();

    // Get references directory path
    const refsDir = await this.findReferencesDir();
    const results: SkillContent[] = [];

    for (const code of codes) {
      const resource = this.resources.get(code);
      if (!resource) continue;

      try {
        const filePath = path.join(refsDir, `${code}-*.md`);
        const { glob } = await import('tinyglobby');
        const files = await glob(filePath);

        if (files.length === 0) {
          console.warn(`[YCSkill] File not found: ${code}`);
          continue;
        }

        const content = await fs.readFile(files[0], 'utf-8');
        results.push({ meta: resource, content });
        console.log(`[YCSkill] Loaded ${code}: ${content.length} chars`);
      } catch (error) {
        console.error(`[YCSkill] Failed to load ${code}:`, error);
      }
    }

    return results;
  }

  private async findReferencesDir(): Promise<string> {
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'references'),
      path.join('/var/task', 'data', 'references'),
      path.join(__dirname, '..', '..', '..', 'data', 'references'),
    ];

    for (const p of possiblePaths) {
      try {
        await fs.access(p);
        return p;
      } catch {
        continue;
      }
    }

    throw new Error('Could not find references directory');
  }

  getAllResources(): SkillResource[] {
    return Array.from(this.resources.values());
  }

  getResource(code: string): SkillResource | undefined {
    return this.resources.get(code);
  }

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
      '关于', '如何', '的', '了', '是', '在', '我', '有', '个', '和', '吗'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  private calculateRelevanceScore(resource: SkillResource, keywords: string[]): number {
    let score = 0;
    const searchableText = `${resource.title} ${resource.author}`.toLowerCase();

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      
      if (resource.title.toLowerCase().includes(lowerKeyword)) {
        score += 10;
      }
      
      if (resource.author.toLowerCase().includes(lowerKeyword)) {
        score += 5;
      }
      
      if (searchableText.includes(lowerKeyword)) {
        score += 3;
      }
    }

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

let skillKnowledge: YCSkillKnowledge | null = null;

export function getYCSkillKnowledge(): YCSkillKnowledge {
  if (!skillKnowledge) {
    skillKnowledge = new YCSkillKnowledge();
  }
  return skillKnowledge;
}
