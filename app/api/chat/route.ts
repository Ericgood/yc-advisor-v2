/**
 * Chat API Route - YC Advisor Skill Implementation
 * Implements the proper 3-step workflow from SKILL.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getYCSkillKnowledge, SkillContent } from '../../../lib/knowledge';

// Force Node.js runtime (not Edge) for better compatibility
export const runtime = 'nodejs';

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
  maxDiscoveryResults: 5,
  maxDeepDiveResources: 3,
  openRouterTimeout: 30000,
};

// ============================================================================
// OpenRouter Streaming
// ============================================================================

async function* streamOpenRouter(
  apiKey: string, 
  messages: Array<{role: string; content: string}>,
  model: string = 'anthropic/claude-sonnet-4.5'
): AsyncGenerator<string> {
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
        model,
        messages,
        max_tokens: 4096,
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
// System Prompt Builder
// ============================================================================

function buildSystemPrompt(resources: SkillContent[]): string {
  console.log(`[buildSystemPrompt] Building prompt with ${resources.length} resources`);
  
  // Build citations
  const citations = resources
    .map(r => `- **${r.meta.title}** by ${r.meta.author} (${r.meta.code})`)
    .join('\n');

  // Build full context from resources - use full content
  const contexts = resources
    .map(r => {
      console.log(`[buildSystemPrompt] Adding ${r.meta.code}: ${r.content.length} chars`);
      return `---\n## ${r.meta.title}\n**Author:** ${r.meta.author}\n**Type:** ${r.meta.type}\n\n${r.content}\n---`;
    })
    .join('\n\n');
  
  console.log(`[buildSystemPrompt] Total context length: ${contexts.length} chars`);

  return `你是 **YC Advisor**，一位经验丰富的 Y Combinator 合伙人。

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
- **基于提供的参考资料回答**：不要编造信息
- **最后列出参考来源**：使用 "## 参考资料" 标题

## 本次回答可用的参考资料
${citations}

## 参考资料详细内容（基于这些内容回答）
${contexts}

重要：你的回答必须基于上面提供的参考资料内容。每个观点都要标注来源。`;
}

// ============================================================================
// POST Handler - YC Skill 3-Step Workflow
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

    // ========================================================================
    // Step 1: Discovery - Find relevant resources from quick-index
    // ========================================================================
    console.log('[POST] === Step 1: Discovery ===');
    const skillKB = getYCSkillKnowledge();
    await skillKB.initialize();

    const discoveredResources = await skillKB.discover(
      message, 
      CONFIG.maxDiscoveryResults
    );

    if (discoveredResources.length === 0) {
      return NextResponse.json({
        text: '抱歉，我在知识库中没有找到与你问题相关的资源。请尝试用不同的方式描述你的问题。',
        resources: [],
      });
    }

    // ========================================================================
    // Step 2: Deep Dive - Load full content of top resources
    // ========================================================================
    console.log('[POST] === Step 2: Deep Dive ===');
    const topCodes = discoveredResources
      .slice(0, CONFIG.maxDeepDiveResources)
      .map(r => r.code);

    const loadedContents = await skillKB.loadResources(topCodes);

    if (loadedContents.length === 0) {
      return NextResponse.json({
        text: '抱歉，找到了相关资源但无法加载内容。请稍后重试。',
        resources: discoveredResources.map(r => ({ 
          code: r.code, 
          title: r.title, 
          author: r.author 
        })),
      });
    }

    console.log(`[POST] Loaded ${loadedContents.length} resources with full content`);

    // ========================================================================
    // Step 3: Synthesize - Generate answer with proper citations
    // ========================================================================
    console.log('[POST] === Step 3: Synthesize ===');

    const systemPrompt = buildSystemPrompt(loadedContents);
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.slice(-4).map((h: {role: string; content: string}) => ({ 
        role: h.role as 'user' | 'assistant', 
        content: h.content 
      })),
      { role: 'user' as const, content: message },
    ];

    // If streaming is requested, use streaming response
    if (stream) {
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // Send metadata with discovered resources
            controller.enqueue(
              createSSE({
                type: 'metadata',
                resources: loadedContents.map(c => ({
                  code: c.meta.code,
                  title: c.meta.title,
                  author: c.meta.author,
                  type: c.meta.type,
                })),
                totalFound: discoveredResources.length,
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
              controller.enqueue(
                createSSE({
                  type: 'error',
                  error: 'Stream interrupted',
                })
              );
            }

            // Send completion
            const executionTime = Date.now() - startTime;
            controller.enqueue(
              createSSE({
                type: 'done',
                executionTime,
                totalTokens: fullContent.length / 4,
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
        max_tokens: 4096,
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
      resources: loadedContents.map(c => ({ 
        code: c.meta.code, 
        title: c.meta.title, 
        author: c.meta.author 
      })),
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
// GET Handler - List available resources
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    const skillKB = getYCSkillKnowledge();
    await skillKB.initialize();

    if (query) {
      // Search resources
      const resources = await skillKB.discover(query, 10);
      return NextResponse.json({
        resources: resources.map(r => ({
          code: r.code,
          title: r.title,
          author: r.author,
          type: r.type,
        })),
        query,
      });
    } else {
      // List all resources
      const allResources = skillKB.getAllResources();
      return NextResponse.json({
        resources: allResources.map(r => ({
          code: r.code,
          title: r.title,
          author: r.author,
          type: r.type,
        })),
        total: allResources.length,
      });
    }
    
  } catch (error) {
    console.error('[GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load resources' },
      { status: 500 }
    );
  }
}
