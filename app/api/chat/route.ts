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
// SSE Helper Functions
// ============================================================================

function createSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function createStreamResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  defaultLimit: 10,
  maxLimit: 50,
  defaultSearchTimeout: 5000,
  openRouterTimeout: 25000,
  kbInitTimeout: 5000,
  maxRetries: 1,
};

// ============================================================================
// Knowledge Base Singleton
// ============================================================================

let kbInstance: KnowledgeBase | null = null;
let kbInitializing: Promise<KnowledgeBase> | null = null;

async function getKB(): Promise<KnowledgeBase> {
  if (kbInstance) {
    return kbInstance;
  }

  if (kbInitializing) {
    return kbInitializing;
  }

  kbInitializing = (async () => {
    try {
      kbInstance = getKnowledgeBase({
        indexPath: process.env.KNOWLEDGE_INDEX_PATH || 'data/knowledge-index.json',
        contentPath: process.env.KNOWLEDGE_CONTENT_PATH || 'references',
        cacheSize: 100,
        cacheTtl: 5 * 60 * 1000,
      });

      const initPromise = kbInstance.initialize();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Knowledge base initialization timeout')), CONFIG.kbInitTimeout)
      );

      await Promise.race([initPromise, timeoutPromise]);
      console.log('[getKB] Knowledge base initialized successfully');
      return kbInstance;
    } catch (error) {
      console.error('[getKB] Failed to initialize knowledge base:', error);
      kbInstance = null;
      throw error;
    } finally {
      kbInitializing = null;
    }
  })();

  return kbInitializing;
}

// ============================================================================
// OpenRouter Streaming
// ============================================================================

async function* streamOpenRouter(apiKey: string, messages: Array<{role: string; content: string}>): AsyncGenerator<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.openRouterTimeout);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'YC Advisor',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages,
        max_tokens: 2048,
        temperature: 0.7,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        
        if (data === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
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
// POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { message, history = [], stream = true } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Validate API Key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      console.error('OPENROUTER_API_KEY not configured or invalid');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    // Get knowledge base
    let kb: KnowledgeBase;
    try {
      kb = await getKB();
    } catch (kbError) {
      console.error('[POST] Knowledge base initialization failed:', kbError);
      return NextResponse.json(
        { error: 'Service temporarily unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    // Search knowledge base
    const searchQuery: SearchQuery = {
      keywords: message.split(/\s+/).filter(Boolean),
      rawQuery: message,
      limit: 5,
      semantic: true,
    };

    const searchResult = await kb.search(searchQuery);

    // Load full content of top resources
    console.log('[POST] Search found resources:', searchResult.resources.map(r => ({ code: r.code, title: r.title, score: r.score })));
    
    const resourcesWithContent = await Promise.all(
      searchResult.resources.slice(0, 3).map(async (resource) => {
        try {
          console.log(`[POST] Loading content for ${resource.code}...`);
          const loadedResource = await kb.loadResource(resource.code);
          const content = loadedResource.content;
          const contentLength = content?.length || 0;
          console.log(`[POST] Loaded ${resource.code}: ${contentLength} chars`);
          return { meta: resource, content };
        } catch (error) {
          console.warn(`[POST] Failed to load content for ${resource.code}:`, error);
          return { meta: resource, content: null };
        }
      })
    );
    
    console.log('[POST] Resources with content:', resourcesWithContent.map(r => ({ code: r.meta.code, hasContent: !!r.content, length: r.content?.length })));

    // Build context from loaded content
    const contextContent = resourcesWithContent
      .filter(r => r.content)
      .map(r => `---\n**${r.meta.title}** by ${r.meta.author}\n\n${r.content?.slice(0, 2000)}\n---`)
      .join('\n\n');

    const citations = resourcesWithContent
      .filter(r => r.content)
      .map(r => `- **${r.meta.title}** by ${r.meta.author} (${r.meta.code})`)
      .join('\n');

    // Build system prompt with full context
    const SYSTEM_PROMPT = `你是 **YC Advisor**，一位经验丰富的 Y Combinator 合伙人。

## 你的背景
- 你在 Y Combinator 工作了多年，看过数千家创业公司
- 你熟悉 Paul Graham、Sam Altman、Dalton Caldwell 等 YC 合伙人的理念
- 你基于 Y Combinator 的 443+ 个精选资源提供建议

## 回答风格
- **直接、实用、不废话**：YC 风格就是直截了当
- **具体可操作**：给出明确的下一步行动
- **引用具体案例**：用真实的 YC 公司作为例子
- **诚实务实**：如果某个想法不好，直接说

## 引用规范（必须遵守）
- **每个观点都要标注来源**：使用 "[作者名 - 文章标题]" 格式
- **最后列出参考来源**：使用 "## 参考资料" 标题

## 可用的参考资料
${citations}

## 参考资料详细内容（基于这些内容回答）
${contextContent}

重要：你的回答必须基于上面提供的参考资料内容。如果用户的问题不在参考资料范围内，请坦诚说明。记住：每个观点都要标注来源，最后列出参考资料。`;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.slice(-4).map((h: {role: string; content: string}) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    // If streaming is requested, use streaming response
    if (stream) {
      const resources = searchResult.resources.map(r => ({ code: r.code, title: r.title, author: r.author }));
      
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // Send metadata first
            controller.enqueue(
              createSSE({
                type: 'metadata',
                resources,
                totalFound: searchResult.total,
              })
            );

            // Stream content from OpenRouter
            let fullContent = '';
            
            try {
              for await (const chunk of streamOpenRouter(apiKey, messages)) {
                fullContent += chunk;
                controller.enqueue(
                  createSSE({
                    type: 'content',
                    chunk,
                  })
                );
              }
            } catch (streamError) {
              console.error('[POST] Streaming error:', streamError);
              // Send fallback content
              const fallbackContent = generateFallbackResponse(message, resourcesWithContent);
              controller.enqueue(
                createSSE({
                  type: 'content',
                  chunk: fallbackContent,
                  fallback: true,
                })
              );
            }

            // Send completion
            const executionTime = Date.now() - startTime;
            controller.enqueue(
              createSSE({
                type: 'done',
                executionTime,
                totalTokens: fullContent.length / 4, // Rough estimate
              })
            );
            controller.close();
          } catch (error) {
            console.error('[POST] Stream error:', error);
            controller.enqueue(
              createSSE({
                type: 'error',
                error: 'Failed to generate response',
              })
            );
            controller.close();
          }
        },
      });

      return createStreamResponse(streamResponse);
    }

    // Non-streaming response
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'YC Advisor',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ text: '抱歉，没有收到回复。' });
    }

    return NextResponse.json({ 
      text: content,
      resources: searchResult.resources.map(r => ({ code: r.code, title: r.title, author: r.author })),
    });

  } catch (error) {
    console.error('[POST] Error:', error);
    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage = error instanceof Error && error.name === 'AbortError'
      ? '请求超时，请稍后重试'
      : 'Internal server error';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: isDev && error instanceof Error ? error.message : undefined 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler (Search)
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
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
    
    if (!params.q || params.q.trim().length < 2) {
      throw new InvalidQueryError('Query must be at least 2 characters');
    }
    
    const limit = Math.min(params.limit || CONFIG.defaultLimit, CONFIG.maxLimit);
    const offset = params.offset || 0;
    
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
    
    const searchPromise = kb.search(searchQuery);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Search timeout')), CONFIG.defaultSearchTimeout)
    );
    
    const result = await Promise.race([searchPromise, timeoutPromise]);
    
    const response: ApiSearchResponse = {
      results: result.resources.map(r => ({
        code: r.code,
        title: r.title,
        author: r.author,
        type: r.type,
        categories: r.categories,
        url: `https://www.ycombinator.com/library/${r.code}`,
      })),
      total: result.total,
      limit,
      offset,
      query: params.q,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[GET] Search error:', error);
    
    if (error instanceof InvalidQueryError) {
      return NextResponse.json(
        { error: error.message, code: 'INVALID_QUERY' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Search failed', code: 'SEARCH_ERROR' },
      { status: 500 }
    );
  }
}
