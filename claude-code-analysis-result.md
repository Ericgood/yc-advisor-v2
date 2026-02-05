# 代码质量检查报告

## 1. app/api/chat/route.ts - API路由实现

### 🔴 高严重度问题

**1.1 输入验证不足 - 潜在注入风险**
- **文件**: `app/api/chat/route.ts:46`
- **问题**: `message` 和 `history` 直接从请求体解析并使用，没有验证类型和长度
- **修复建议**:
```typescript
const body = await req.json();
const { message, history = [] } = body;

// 验证 message
if (typeof message !== 'string' || message.length === 0 || message.length > 10000) {
  return NextResponse.json(
    { error: 'Invalid message' },
    { status: 400 }
  );
}

// 验证 history
if (!Array.isArray(history) || history.length > 50) {
  return NextResponse.json(
    { error: 'Invalid history' },
    { status: 400 }
  );
}

// 验证每条历史记录
for (const h of history) {
  if (typeof h?.role !== 'string' || typeof h?.content !== 'string') {
    return NextResponse.json(
      { error: 'Invalid history format' },
      { status: 400 }
    );
  }
}
```

**1.2 history.role 类型不安全**
- **文件**: `app/api/chat/route.ts:60-62`
- **问题**: `h.role` 被直接断言为 `'user' | 'assistant'`，但未验证实际值
- **修复建议**:
```typescript
...history
  .filter((h: {role: string; content: string}) => 
    h.role === 'user' || h.role === 'assistant'
  )
  .map((h: {role: string; content: string}) => ({
    role: h.role as 'user' | 'assistant',
    content: h.content,
  })),
```

### 🟡 中严重度问题

**1.3 敏感信息可能泄露到日志**
- **文件**: `app/api/chat/route.ts:92-93`
- **问题**: 错误响应体可能包含敏感信息被记录
- **修复建议**:
```typescript
// 只在开发环境记录详细错误
if (process.env.NODE_ENV === 'development') {
  console.error('OpenRouter error body:', error);
}
```

**1.4 缺少 Rate Limiting**
- **文件**: `app/api/chat/route.ts:44`
- **问题**: API 端点没有速率限制，可能被滥用
- **修复建议**: 使用 `next-rate-limit` 或自定义实现

### 🟢 低严重度问题

**1.5 硬编码超时值**
- **文件**: `app/api/chat/route.ts:69`
- **问题**: 30秒超时硬编码，应该提取为常量或配置
- **修复建议**:
```typescript
const API_TIMEOUT_MS = parseInt(process.env.API_TIMEOUT_MS || '30000', 10);
```

**1.6 未使用的依赖**
- **文件**: `package.json:12`
- **问题**: `@anthropic-ai/sdk` 已安装但代码中使用的是 OpenRouter API，未使用此 SDK

---

## 2. components/Chat.tsx - React聊天组件

### 🔴 高严重度问题

**2.1 潜在 XSS 风险 - ReactMarkdown**
- **文件**: `components/Chat.tsx:256-274`
- **问题**: `ReactMarkdown` 渲染用户提供的内容。虽然 ReactMarkdown 默认是安全的，但 `a` 组件的 `href` 可能包含 `javascript:` 协议
- **修复建议**:
```typescript
a: ({href, children}) => {
  // 只允许 http/https 协议
  const safeHref = href?.startsWith('http://') || href?.startsWith('https://') 
    ? href 
    : '#';
  return (
    <a href={safeHref} className="text-orange-600 hover:underline" 
       target="_blank" rel="noopener noreferrer">{children}</a>
  );
},
```

### 🟡 中严重度问题

**2.2 regenerate 函数逻辑问题**
- **文件**: `components/Chat.tsx:142-151`
- **问题**: 当没有用户消息时，`findIndex` 返回 -1，导致 `lastUserIndex` 计算错误
- **修复建议**:
```typescript
const regenerate = () => {
  const reversedIndex = [...messages].reverse().findIndex(m => m.role === 'user');
  if (reversedIndex === -1) return; // 没有用户消息
  
  const lastUserIndex = messages.length - 1 - reversedIndex;
  const lastUser = messages[lastUserIndex];
  // 删除助手回复后重新发送
  setMessages(prev => prev.slice(0, lastUserIndex));
  sendMessage(lastUser.content);
};
```

**2.3 useEffect 缺少依赖**
- **文件**: `components/Chat.tsx:125-130`
- **问题**: textarea 自动调整高度的 useEffect 只依赖 `input`，但使用了 `textareaRef`
- **说明**: 这里 ref 不需要作为依赖，但代码逻辑本身可以简化

**2.4 ID 生成可能冲突**
- **文件**: `components/Chat.tsx:64, 96, 104`
- **问题**: 使用 `Date.now().toString()` 生成 ID，快速操作时可能重复
- **修复建议**:
```typescript
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

### 🟢 低严重度问题

**2.5 confirm() 阻塞 UI**
- **文件**: `components/Chat.tsx:154`
- **问题**: 使用原生 `confirm()` 不符合现代 UI 设计，且会阻塞主线程
- **修复建议**: 使用自定义确认对话框组件

**2.6 欢迎消息重复定义**
- **文件**: `components/Chat.tsx:38-46, 158-166`
- **问题**: 欢迎消息在两处重复定义
- **修复建议**: 提取为常量
```typescript
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `你好！我是 **YC Advisor**...`,
};
```

**2.7 魔术数字**
- **文件**: `components/Chat.tsx:83, 128, 136`
- **问题**: `-6`（历史消息数）、`150`（最大高度）、`2000`（复制提示延迟）等应提取为常量

**2.8 动画延迟使用内联样式**
- **文件**: `components/Chat.tsx:313-314`
- **问题**: `style={{ animationDelay: '0.1s' }}` 使用内联样式
- **修复建议**: 使用 Tailwind 的 `animation-delay` 或 CSS 变量

---

## 3. lib/yc-knowledge.ts - YC知识库

### 🟢 低严重度问题

**3.1 知识库内容硬编码**
- **文件**: `lib/yc-knowledge.ts:1-109`
- **问题**: 大量文本硬编码在代码中，难以维护和更新
- **修复建议**: 考虑使用外部 JSON/YAML 文件或 CMS

---

## 4. next.config.mjs - Next.js配置

### 🟢 低严重度问题

**4.1 缺少安全头配置**
- **文件**: `next.config.mjs`
- **问题**: 未配置安全响应头
- **修复建议**:
```javascript
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
```

---

## 5. package.json - 依赖管理

### 🟡 中严重度问题

**5.1 未使用的依赖**
- **文件**: `package.json:12`
- **问题**: `@anthropic-ai/sdk` 已安装但未在代码中使用（代码使用 OpenRouter HTTP API）
- **修复建议**: 移除未使用的依赖
```bash
npm uninstall @anthropic-ai/sdk
```

### 🟢 低严重度问题

**5.2 React 版本范围过宽**
- **文件**: `package.json:15-16`
- **问题**: `"react": "^18"` 和 `"react-dom": "^18"` 范围太宽
- **修复建议**: 锁定到具体次版本如 `"^18.2.0"`

**5.3 缺少类型检查脚本**
- **文件**: `package.json:6-10`
- **问题**: 没有 TypeScript 类型检查脚本
- **修复建议**:
```json
"scripts": {
  "typecheck": "tsc --noEmit",
  ...
}
```

---

## 问题汇总

| 严重度 | 数量 | 主要类型 |
|--------|------|----------|
| 🔴 高 | 3 | 输入验证、类型安全、XSS |
| 🟡 中 | 5 | 逻辑错误、日志安全、未使用依赖 |
| 🟢 低 | 10 | 代码规范、最佳实践、配置 |

---

## 优先修复建议

1. **立即修复**: API 输入验证（route.ts:46）
2. **立即修复**: history.role 类型验证（route.ts:60-62）
3. **立即修复**: ReactMarkdown 链接安全（Chat.tsx:270）
4. **尽快修复**: regenerate 逻辑（Chat.tsx:142-151）
5. **尽快修复**: 移除未使用的依赖
