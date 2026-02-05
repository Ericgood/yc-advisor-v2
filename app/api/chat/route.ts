import { NextRequest, NextResponse } from 'next/server';
import { YC_KNOWLEDGE_BASE } from '@/lib/yc-knowledge';
import { checkRateLimit } from '@/lib/rate-limit';
import { 
  ChatMessage, 
  ValidationResult,
  AppError,
  successResponse,
  errorResponse 
} from '@/lib/types';

function validateChatRequest(body: unknown): ValidationResult<{ message: string; history: ChatMessage[] }> {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '请求体无效' };
  }

  const { message, history } = body as Record<string, unknown>;

  // 验证 message
  if (typeof message !== 'string') {
    return { valid: false, error: '消息必须是字符串' };
  }

  if (message.trim().length === 0) {
    return { valid: false, error: '消息不能为空' };
  }

  if (message.length > 10000) {
    return { valid: false, error: '消息过长，最多10000字符' };
  }

  // 验证 history
  const validatedHistory: ChatMessage[] = [];

  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return { valid: false, error: 'history 必须是数组' };
    }

    if (history.length > 20) {
      return { valid: false, error: 'history 最多20条消息' };
    }

    for (const item of history) {
      if (!item || typeof item !== 'object') {
        return { valid: false, error: 'history 消息格式无效' };
      }

      const { role, content } = item as Record<string, unknown>;

      if (role !== 'user' && role !== 'assistant') {
        return { valid: false, error: 'history 消息 role 必须是 user 或 assistant' };
      }

      if (typeof content !== 'string') {
        return { valid: false, error: 'history 消息 content 必须是字符串' };
      }

      if (content.length > 10000) {
        return { valid: false, error: 'history 消息过长' };
      }

      validatedHistory.push({ role: role as 'user' | 'assistant', content });
    }
  }

  return {
    valid: true,
    data: { message: message.trim(), history: validatedHistory },
  };
}

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

## 引用规范
- 当引用 Paul Graham、Sam Altman 等 YC 合伙人的观点时，明确指出
- 提及具体的 YC 公司案例（如 "Airbnb 早期..."、"Stripe 的做法是..."）
- 如果建议来自某篇特定的 YC 文章，可以提及标题

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
${YC_KNOWLEDGE_BASE}

记住：你的目标是帮助创始人做出更好的决策，而不是替他们做决定。提供建议、分享经验、指出风险，但最终决定权在他们。`;

export async function POST(req: NextRequest) {
  try {
    // Rate Limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
               req.headers.get('x-real-ip') ||
               'unknown';
    const rateLimitResult = checkRateLimit(ip);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        errorResponse('请求过于频繁，请稍后重试'),
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const body = await req.json();

    // 输入验证
    const validation = validateChatRequest(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        errorResponse(validation.error || '请求参数无效'),
        { status: 400 }
      );
    }

    const { message, history } = validation.data;

    // 验证 API Key（更严格的验证）
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      console.error('OPENROUTER_API_KEY not configured or invalid');
      return NextResponse.json(
        errorResponse('服务配置错误'),
        { status: 500 }
      );
    }

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.map((h: {role: string; content: string}) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // 添加请求超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

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
          model: 'anthropic/claude-3.5-sonnet',
          messages,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenRouter error status:', response.status);
        console.error('OpenRouter error body:', error);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        return NextResponse.json(successResponse({ text: '抱歉，没有收到回复。' }));
      }

      return NextResponse.json(successResponse({ text: content }));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('Chat API error:', error);
    // 生产环境隐藏详细错误信息
    const isDev = process.env.NODE_ENV === 'development';
    
    if (error instanceof AppError) {
      return NextResponse.json(
        errorResponse(error.message, isDev ? error.details : undefined),
        { status: error.statusCode }
      );
    }
    
    const errorMessage = error instanceof Error && error.name === 'AbortError'
      ? '请求超时，请稍后重试'
      : '服务器内部错误';
    
    return NextResponse.json(
      errorResponse(
        errorMessage,
        isDev && error instanceof Error ? error.message : undefined
      ),
      { status: 500 }
    );
  }
}
