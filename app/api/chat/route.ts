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
  // OpenRouter timeout - must be less than Vercel serverless timeout
  openRouterTimeout: 10000, // 10 seconds
  // Knowledge base initialization timeout
  kbInitTimeout: 5000, // 5 seconds
  // Max retries for OpenRouter
  maxRetries: 2,
};

// ============================================================================
// Knowledge Base Singleton with Initialization Tracking
// ============================================================================

let kbInstance: KnowledgeBase | null = null;
let kbInitializing: Promise<KnowledgeBase> | null = null;

async function getKB(): Promise<KnowledgeBase> {
  // Return existing instance
  if (kbInstance) {
    return kbInstance;
  }

  // Return existing initialization promise to prevent duplicate initialization
  if (kbInitializing) {
    return kbInitializing;
  }

  // Create new initialization promise
  kbInitializing = (async () => {
    try {
      kbInstance = getKnowledgeBase({
        indexPath: process.env.KNOWLEDGE_INDEX_PATH || 'data/knowledge-index.json',
        contentPath: process.env.KNOWLEDGE_CONTENT_PATH || 'references',
        cacheSize: 100,
        cacheTtl: 5 * 60 * 1000, // 5 minutes
      });

      // Initialize with timeout
      const initPromise = kbInstance.initialize();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Knowledge base initialization timeout')), CONFIG.kbInitTimeout)
      );

      await Promise.race([initPromise, timeoutPromise]);
      console.log('[getKB] Knowledge base initialized successfully');
      return kbInstance;
    } catch (error) {
      console.error('[getKB] Failed to initialize knowledge base:', error);
      // Reset for retry
      kbInstance = null;
      throw error;
    } finally {
      kbInitializing = null;
    }
  })();

  return kbInitializing;
}

// ============================================================================
// OpenRouter API Call with Timeout and Retry
// ============================================================================

async function callOpenRouterWithRetry(
  apiKey: string,
  messages: { role: 'system' | 'user'; content: string }[],
  retries = CONFIG.maxRetries
): Promise<{ content: string; fromCache?: boolean }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.openRouterTimeout);

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
          max_tokens: 2048, // Reduced from 4096 to speed up response
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OpenRouter] Attempt ${attempt + 1} failed:`, response.status, errorText);
        
        // If rate limited, don't retry immediately
        if (response.status === 429) {
          throw new Error('Rate limited by OpenRouter');
        }
        
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenRouter');
      }

      return { content };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on abort/timeout after all retries exhausted
      if (attempt < retries) {
        console.log(`[OpenRouter] Retrying... (${attempt + 1}/${retries})`);
        // Exponential backoff: 500ms, 1000ms
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('OpenRouter API failed after retries');
}

// ============================================================================
// Fallback Response Generator
// ============================================================================

function generateFallbackResponse(query: string, resources: { meta: ResourceMeta; content: string | null }[]): string {
  const relevantResources = resources.filter(r => r.content).slice(0, 3);
  
  if (relevantResources.length === 0) {
    return `抱歉，我暂时无法连接到 AI 服务。不过我可以建议你查看 YC 的官方资源库来获取关于"${query}"的信息。`;
  }

  let response = `抱歉，AI 服务暂时响应较慢。基于知识库，我为你找到了以下相关资源：\n\n`;
  
  relevantResources.forEach((r, i) => {
    response += `${i + 1}. **${r.meta.title}** - ${r.meta.author}\n`;
    if (r.content) {
      const summary = r.content.slice(0, 300).replace(/[#*_]/g, '').trim();
      response += `   ${summary}...\n\n`;
    }
  });

  response += `\n你可以点击参考资料链接查看完整内容。`;
  return response;
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
    
    // Get knowledge base with timeout
    let kb: KnowledgeBase;
    try {
      kb = await getKB();
    } catch (kbError) {
      console.error('[GET] Knowledge base initialization failed:', kbError);
      return NextResponse.json(
        { error: 'Service temporarily unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 }
      );
    }
    
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
    
    // Execute search with timeout
    const searchPromise = kb.search(searchQuery);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Search timeout')), CONFIG.defaultSearchTimeout)
    );
    
    const result = await Promise.race([searchPromise, timeoutPromise]);
    
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
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { message, options = {} } = body;
    
    if (!message || typeof message !== 'string') {
      throw new InvalidQueryError('Message is required');
    }

    // Validate API key early
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      console.error('OPENROUTER_API_KEY not configured or invalid');
      return NextResponse.json(
        { error: 'Service configuration error', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }
    
    // Get knowledge base with error handling
    let kb: KnowledgeBase;
    try {
      kb = await getKB();
    } catch (kbError) {
      console.error('[POST] Knowledge base initialization failed:', kbError);
      // Return fallback response without knowledge base
      return NextResponse.json({
        text: `抱歉，知识库服务暂时不可用。请稍后重试。`,
        resources: [],
        totalFound: 0,
        fallback: true,
      });
    }
    
    // Extract search intent from message
    const searchQuery = extractSearchIntent(message);
    
    // Search for relevant resources with timeout protection
    let searchResult;
    try {
      searchPromise = kb.search({
        keywords: searchQuery.keywords || [],
        rawQuery: message,
        filters: searchQuery.filters || {},
        limit: options.limit || 5,
      });
      
      const searchTimeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), CONFIG.defaultSearchTimeout)
      );
      
      searchResult = await Promise.race([searchPromise, searchTimeoutPromise]);
    } catch (searchError) {
      console.error('[POST] Search failed:', searchError);
      // Continue with empty results
      searchResult = { resources: [], total: 0, facets: {} };
    }
    
    // Load top resources for context (limited to 2 for speed)
    const resourcesWithContent = await Promise.all(
      searchResult.resources.slice(0, 2).map(async (meta) => {
        try {
          const resource = await kb.loadResource(meta.code);
          return {
            meta,
            content: truncateContent(resource.content, 1500), // Reduced from 2000
          };
        } catch {
          return { meta, content: null };
        }
      })
    );
    
    // Build context for LLM
    const contextString = buildContext(resourcesWithContent, message);
    
    // Build citations from resources
    const citations = resourcesWithContent
      .filter(r => r.content)
      .map(r => `- **${r.meta.title}** by ${r.meta.author}`)
      .join('\n');

    const SYSTEM_PROMPT = `你是 **YC Advisor**，一位经验丰富的 Y Combinator 合伙人。

## 你的背景
- 你在 Y Combinator 工作了多年，看过数千家创业公司
- 你熟悉 Paul Graham、Sam Altman、Dalton Caldwell 等 YC 合伙人的理念

## 回答风格
- **直接、实用、不废话**：YC 风格就是直截了当
- **具体可操作**：给出明确的下一步行动
- **诚实务实**：如果某个想法不好，直接说

## 引用规范（必须遵守）
- **每个观点都要标注来源**：使用 "[作者名 - 文章标题]" 格式
- **最后列出参考来源**：使用 "## 参考资料" 标题

## YC 知识库参考
${contextString}

## 本次回答可用的参考资料
${citations}

记住：每个观点都要标注来源，最后列出参考资料。`;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: message },
    ];

    // Call OpenRouter with retry and timeout
    let responseContent: string;
    let usedFallback = false;
    
    try {
      const result = await callOpenRouterWithRetry(apiKey, messages);
      responseContent = result.content;
    } catch (openRouterError) {
      console.error('[POST] OpenRouter failed:', openRouterError);
      // Generate fallback response
      responseContent = generateFallbackResponse(message, resourcesWithContent);
      usedFallback = true;
    }

    const executionTime = Date.now() - startTime;
    console.log(`[POST] Request completed in ${executionTime}ms, fallback=${usedFallback}`);

    return NextResponse.json({
      text: responseContent,
      resources: searchResult.resources.map(r => ({ code: r.code, title: r.title, author: r.author })),
      totalFound: searchResult.total,
      executionTimeMs: executionTime,
      fallback: usedFallback,
    });
    
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

  // Check for timeout errors
  if (error instanceof Error) {
    if (error.message.includes('timeout') || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout, please try again', code: 'TIMEOUT' },
        { status: 504 }
      );
    }
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
