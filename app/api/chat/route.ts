/**
 * Chat API Route
 * Handles knowledge base queries with streaming support
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  KnowledgeBase,
  getKnowledgeBase,
  SearchQuery,
  ResourceMeta,
  ApiSearchRequest,
  ApiSearchResponse,
  InvalidQueryError,
  ResourceNotFoundError,
} from '../../../lib/knowledge';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  defaultLimit: 10,
  maxLimit: 50,
  defaultSearchTimeout: 5000,
};

// ============================================================================
// Knowledge Base Singleton
// ============================================================================

let kbInstance: KnowledgeBase | null = null;

async function getKB(): Promise<KnowledgeBase> {
  if (!kbInstance) {
    kbInstance = getKnowledgeBase({
      indexPath: process.env.KNOWLEDGE_INDEX_PATH || 'data/knowledge-index.json',
      contentPath: process.env.KNOWLEDGE_CONTENT_PATH || 'references',
      cacheSize: 100,
      cacheTtl: 5 * 60 * 1000, // 5 minutes
    });
    await kbInstance.initialize();
  }
  return kbInstance;
}

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * GET /api/chat/search?q=query&category=ai&limit=10
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const params: ApiSearchRequest = {
      q: searchParams.get('q') || '',
      category: (searchParams.get('category') as any) || undefined,
      stage: (searchParams.get('stage') as any) || undefined,
      author: searchParams.get('author') || undefined,
      type: (searchParams.get('type') as any) || undefined,
      semantic: searchParams.get('semantic') === 'true',
      limit: parseInt(searchParams.get('limit') || '10', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    };
    
    // Validate query
    if (!params.q || params.q.trim().length < 2) {
      throw new InvalidQueryError('Query must be at least 2 characters');
    }
    
    // Enforce limits
    const limit = Math.min(params.limit || CONFIG.defaultLimit, CONFIG.maxLimit);
    const offset = params.offset || 0;
    
    // Get knowledge base
    const kb = await getKB();
    
    // Build search query
    const searchQuery: SearchQuery = {
      keywords: params.q.split(/\s+/).filter(Boolean),
      rawQuery: params.q,
      filters: {
        categories: params.category ? [params.category] : undefined,
        stages: params.stage ? [params.stage] : undefined,
        authors: params.author ? [params.author] : undefined,
        types: params.type ? [params.type] : undefined,
      },
      semantic: params.semantic,
      limit,
      offset,
    };
    
    // Execute search
    const result = await kb.search(searchQuery);
    
    // Build response
    const response: ApiSearchResponse = {
      results: result.resources,
      total: result.total,
      query: params.q,
      facets: result.facets,
      executionTimeMs: result.executionTimeMs,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/chat
 * Main chat endpoint with context retrieval
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { message, options = {} } = body;
    
    if (!message || typeof message !== 'string') {
      throw new InvalidQueryError('Message is required');
    }
    
    // Get knowledge base
    const kb = await getKB();
    
    // Extract search intent from message
    const searchQuery = extractSearchIntent(message);
    
    // Search for relevant resources
    const searchResult = await kb.search({
      keywords: searchQuery.keywords || [],
      rawQuery: message,
      filters: searchQuery.filters || {},
      limit: options.limit || 5,
    });
    
    // Load top resources for context
    const resourcesWithContent = await Promise.all(
      searchResult.resources.slice(0, 3).map(async (meta) => {
        try {
          const resource = await kb.loadResource(meta.code);
          return {
            meta,
            content: truncateContent(resource.content, 2000),
          };
        } catch {
          return { meta, content: null };
        }
      })
    );
    
    // Build context for LLM
    const contextString = buildContext(resourcesWithContent, message);
    
    // Call OpenRouter to generate response
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      console.error('OPENROUTER_API_KEY not configured or invalid');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    // Build citations from resources
    const citations = resourcesWithContent
      .filter(r => r.content)
      .map(r => `- **${r.meta.title}** by ${r.meta.author}`)
      .join('\n');

    const SYSTEM_PROMPT = `你是 **YC Advisor**，一位经验丰富的 Y Combinator 合伙人。

## 你的背景
- 你在 Y Combinator 工作了多年，看过数千家创业公司
- 你熟悉 Paul Graham、Sam Altman、Dalton Caldwell 等 YC 合伙人的理念
- 你参与过 Airbnb、Stripe、Dropbox、Reddit、Coinbase 等公司的早期孵化

## 回答风格
- **直接、实用、不废话**：YC 风格就是直截了当
- **具体可操作**：给出明确的下一步行动，不是泛泛而谈
- **诚实务实**：如果某个想法不好，直接说；如果有风险，提醒清楚
- **用创始人听得懂的语言**：避免过于学术化的表达

## 核心原则（YC 圣经）
1. **"做出人们想要的东西"** - 这是唯一重要的东西
2. **"做不规模化的事情"** - 早期一个一个找用户
3. **"快速迭代"** - 每周都发布新版本
4. **"保持精简"** - 小而快的团队胜过庞大的团队
5. **"生存下来"** - 创业公司的首要目标是活下去

## 引用规范（必须遵守）
- **每个观点都要标注来源**：使用 "[作者名 - 文章标题]" 格式
- **示例**："根据 Paul Graham 在《How to Get Startup Ideas》中的观点..."
- **示例**："Sam Altman 在《How to Raise Money》中提到..."
- **示例**："YC 合伙人 Dalton Caldwell 认为..."
- 提及具体的 YC 公司案例（如 "Airbnb 早期..."、"Stripe 的做法是..."）
- 如果建议来自某篇特定的 YC 文章，必须提及标题
- **最后列出参考来源**：使用 "## 参考资料" 标题列出所有引用的资源

## 你可以帮助的话题
- 创业想法验证和选择
- 联合创始人关系和股权分配
- 产品开发和 MVP
- 融资策略和投资人沟通
- 增长策略（从 0 到 1000 用户）
- 招聘前 10 个员工
- 创业心态和压力管理
- AI 时代的创业机会

## YC 知识库参考
以下是与用户问题相关的 YC 资源内容，请基于这些资料回答。注意每个观点都要标注来源：

${contextString}

## 本次回答可用的参考资料
${citations}

记住：
1. **每个观点都要标注来源** - 使用 [作者 - 标题] 格式
2. 你的目标是帮助创始人做出更好的决策，而不是替他们做决定
3. 最后列出 "## 参考资料" 部分
4. 提供建议、分享经验、指出风险，但最终决定权在他们
`;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: message },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'https://yc-advisor-v2.vercel.app',
          'X-Title': 'YC Advisor',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenRouter error:', error);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return NextResponse.json({ text: '抱歉，没有收到回复。' });
      }

      return NextResponse.json({
        text: content,
        resources: searchResult.resources.map(r => ({ code: r.code, title: r.title, author: r.author })),
        totalFound: searchResult.total,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
    
  } catch (error) {
    return handleError(error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract search intent from natural language query
 */
function extractSearchIntent(message: string): Partial<SearchQuery> {
  const keywords: string[] = [];
  const filters: SearchQuery['filters'] = {};
  
  // Extract stage keywords
  const stagePatterns = [
    { pattern: /pre[-\s]?idea/i, stage: 'pre-idea' },
    { pattern: /early stage|just starting/i, stage: 'pre-idea' },
    { pattern: /mvp|building/i, stage: 'building' },
    { pattern: /launched|launched/i, stage: 'launched' },
    { pattern: /scaling|growth stage/i, stage: 'scaling' },
  ];
  
  for (const { pattern, stage } of stagePatterns) {
    if (pattern.test(message)) {
      filters.stages = [stage as any];
      break;
    }
  }
  
  // Extract topic keywords
  const topicPatterns: Record<string, RegExp[]> = {
    'fundraising': [/fundraising?|raise money|investor/i],
    'co-founders': [/co[-\s]?founder|partner/i],
    'ai': [/ai|artificial intelligence|ml|machine learning/i],
    'growth': [/growth|scale|scaling/i],
    'product': [/product|mvp|feature/i],
  };
  
  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        filters.categories = [topic as any];
        break;
      }
    }
  }
  
  // Extract remaining keywords
  const cleanMessage = message
    .replace(/\b(how|what|when|where|why|who|is|are|do|does|can|could|would|should)\b/gi, '')
    .replace(/\b(a|an|the|to|for|of|in|on|at|by|with)\b/gi, '')
    .trim();
  
  keywords.push(...cleanMessage.split(/\s+/).filter(w => w.length > 2));
  
  return {
    keywords: [...new Set(keywords)],
    filters,
  };
}

/**
 * Truncate content to max length
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  
  // Try to truncate at paragraph boundary
  const truncated = content.slice(0, maxLength);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  
  if (lastParagraph > maxLength * 0.8) {
    return truncated.slice(0, lastParagraph) + '\n\n...';
  }
  
  return truncated + '...';
}

/**
 * Build context string from resources
 */
function buildContext(
  resources: { meta: ResourceMeta; content: string | null }[],
  query: string
): string {
  const parts: string[] = [];
  
  parts.push(`# Context for: "${query}"`);
  parts.push('');
  
  for (let i = 0; i < resources.length; i++) {
    const { meta, content } = resources[i];
    
    parts.push(`## Resource ${i + 1}: ${meta.title}`);
    parts.push(`**Author:** ${meta.author}`);
    parts.push(`**Type:** ${meta.type}`);
    parts.push(`**URL:** ${meta.url}`);
    parts.push('');
    
    if (content) {
      parts.push(content);
    } else {
      parts.push('(Content not available)');
    }
    
    parts.push('');
    parts.push('---');
    parts.push('');
  }
  
  return parts.join('\n');
}

/**
 * Handle errors
 */
function handleError(error: unknown): NextResponse {
  console.error('API Error:', error);
  
  if (error instanceof InvalidQueryError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  
  if (error instanceof ResourceNotFoundError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 404 }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

// ============================================================================
// Additional Endpoints (for /api/knowledge/*)
// ============================================================================

// Note: Additional endpoints moved to separate route files
// - GET /api/knowledge/resource/:code -> app/api/knowledge/resource/[code]/route.ts
// - GET /api/knowledge/categories -> app/api/knowledge/categories/route.ts
