/**
 * Simplified YC Skill Knowledge
 * Uses bundled core articles - no file system access needed
 */

import { startupIdeasArticles, articleMap, findRelevantArticles } from '../../data/core-knowledge';

export interface SkillContent {
  meta: {
    code: string;
    title: string;
    author: string;
    type: string;
  };
  content: string;
}

export class YCSkillKnowledge {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log(`[YCSkill] Loaded ${startupIdeasArticles.length} core articles`);
    this.initialized = true;
  }

  /**
   * Step 1: Discovery - Find relevant articles by keyword matching
   */
  async discover(query: string, limit: number = 3): Promise<Array<{code: string; title: string; author: string; type: string}>> {
    await this.ensureInitialized();
    
    console.log(`[YCSkill] Discovery: "${query}"`);
    
    const articles = findRelevantArticles(query, limit);
    
    console.log(`[YCSkill] Found ${articles.length} articles:`, articles.map(a => a.code));
    
    return articles.map(a => ({
      code: a.code,
      title: a.title,
      author: a.author,
      type: a.type,
    }));
  }

  /**
   * Step 2: Deep Dive - Get content of articles by code
   */
  async loadResources(codes: string[]): Promise<SkillContent[]> {
    await this.ensureInitialized();
    
    const results: SkillContent[] = [];
    
    for (const code of codes) {
      const article = articleMap.get(code);
      if (article) {
        results.push({
          meta: {
            code: article.code,
            title: article.title,
            author: article.author,
            type: article.type,
          },
          content: article.content,
        });
        console.log(`[YCSkill] Loaded ${code}: ${article.content.length} chars`);
      } else {
        console.warn(`[YCSkill] Article not found: ${code}`);
      }
    }
    
    return results;
  }

  getAllResources(): Array<{code: string; title: string; author: string; type: string}> {
    return startupIdeasArticles.map(a => ({
      code: a.code,
      title: a.title,
      author: a.author,
      type: a.type,
    }));
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
