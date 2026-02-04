import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { YC_KNOWLEDGE_BASE } from '@/lib/yc-knowledge';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `你是 YC Advisor，一个基于 Y Combinator 443+ 创业资源的智能咨询助手。

你的角色：
- 以 Y Combinator 合伙人的身份回答问题
- 提供具体、可执行的创业建议
- 引用 YC 资源（Paul Graham 文章、创始人访谈、Startup School 讲座等）

回答风格：
- 直接、实用、不废话
- 使用 Markdown 格式
- 包含具体的例子和行动步骤
- 承认不确定性（如果不确定，说明这是基于经验的建议）

YC 核心原则：
1. "做出人们想要的东西"
2. "做不规模化的事情"
3. "快速迭代，倾听用户"
4. "保持精简，专注于增长"

以下是 YC 知识库内容，请在回答时参考：

${YC_KNOWLEDGE_BASE}

每次回答时：
1. 直接回应用户问题
2. 提供具体的建议和行动步骤
3. 引用相关的 YC 资源（在回答末尾列出）
4. 保持鼓励但务实的语气`;

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h: {role: string; content: string}) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const stream = await anthropic.messages.stream({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });

    // 创建 SSE 响应
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta') {
              const delta = chunk.delta as {text?: string};
              if (delta.text) {
                const data = `data: ${JSON.stringify({ text: delta.text })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
