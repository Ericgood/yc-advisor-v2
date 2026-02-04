import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { YC_KNOWLEDGE_BASE } from '@/lib/yc-knowledge';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return NextResponse.json({ text: content.text });
    }

    return NextResponse.json({ text: 'No response' });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
