# YC Advisor 优化日志

> 执行时间: 2026-02-06
> 基于: OPTIMIZATION-REPORT.md P0 高优先级任务

---

## 已完成的优化

### 1. 修复 ReactMarkdown 组件重复创建

**文件**: `components/Chat.tsx`

**修改内容**:
- 将 `markdownComponents` 对象提取到组件外部，避免每次渲染重新创建
- 将 `remarkPlugins` 数组提取为常量

**代码位置**: 第 17-57 行

```tsx
// 在组件外部定义 Markdown 组件配置，避免每次渲染重复创建
const markdownComponents = {
  h1: ({children}: {children: React.ReactNode}) => (
    <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">{children}</h1>
  ),
  // ... 其他组件
};

const remarkPlugins = [remarkGfm];
```

**预期收益**: 减少不必要的重渲染，提升列表滚动性能

---

### 2. 添加按钮 aria-label 可访问性标签

**文件**: `components/Chat.tsx`

**修改的按钮**:
- 侧边栏切换按钮: 添加 `aria-label={sidebarOpen ? '关闭侧边栏' : '打开侧边栏'}` 和 `aria-expanded`
- 发送按钮: 添加 `aria-label="发送消息"`
- 复制按钮: 添加 `aria-label={copiedId === msg.id ? '已复制到剪贴板' : '复制消息'}`
- 重新生成按钮: 添加 `aria-label="重新生成回复"`
- 清空对话按钮: 添加 `aria-label="清空所有对话"`

**预期收益**: 提升可访问性，符合 WCAG 标准

---

### 3. 添加 textarea label 关联

**文件**: `components/Chat.tsx`

**修改内容**:
- 添加隐藏的 `<label htmlFor="chat-input">` 标签
- 为 textarea 添加 `id="chat-input"` 和 `aria-describedby="input-hint"`
- 为提示文字添加 `id="input-hint"`

**代码位置**: 第 361-380 行

```tsx
<label htmlFor="chat-input" className="sr-only">
  输入你的创业问题
</label>
<textarea
  id="chat-input"
  aria-describedby="input-hint"
  // ...
/>
<p id="input-hint" className="...">按 Enter 发送，Shift + Enter 换行</p>
```

**预期收益**: 屏幕阅读器用户可以正确理解输入框用途

---

### 4. 创建 Error Boundary 组件

**新文件**: `components/ErrorBoundary.tsx`

**功能**:
- 捕获子组件渲染错误，防止整个应用崩溃
- 显示友好的错误提示和重试按钮
- 支持自定义 fallback UI

**在 Chat.tsx 中使用**:
```tsx
<ErrorBoundary fallback={<p className="text-gray-500">消息渲染出错</p>}>
  <ReactMarkdown ...>
    {msg.content}
  </ReactMarkdown>
</ErrorBoundary>
```

**预期收益**: 防止 ReactMarkdown 等组件错误导致整个应用白屏

---

### 5. 提取欢迎消息为常量

**文件**: `components/Chat.tsx`

**修改内容**:
- 将重复定义的欢迎消息提取为 `WELCOME_MESSAGE` 常量
- 在 `useState` 初始化和 `clearChat` 函数中复用

**代码位置**: 第 75-87 行

```tsx
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `你好！我是 **YC Advisor**，你的创业咨询助手。...`,
};

// 使用
const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
const clearChat = () => {
  if (confirm('确定清空对话？')) {
    setMessages([WELCOME_MESSAGE]);
  }
};
```

**预期收益**: 代码更易维护，减少不一致风险

---

### 6. 添加 API 输入验证

**文件**: `app/api/chat/route.ts`

**新增内容**:
- `ChatMessage` 和 `ChatRequest` 接口定义
- `validateChatRequest` 验证函数

**验证规则**:
- `message` 必须是非空字符串，最多 10000 字符
- `history` 可选，必须是数组，最多 20 条消息
- 每条 history 消息必须有有效的 `role` 和 `content`

**代码位置**: 第 4-80 行

```tsx
function validateChatRequest(body: unknown): ValidationResult {
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
  // ... 验证 history
}
```

**预期收益**: 防止恶意输入，提高 API 健壮性

---

### 7. 实现 Rate Limiting

**新文件**: `lib/rate-limit.ts`

**功能**:
- 基于 IP 的内存限流
- 每分钟最多 20 次请求
- 自动清理过期记录，避免内存泄漏

**在 API 路由中使用** (`app/api/chat/route.ts`):
```tsx
const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
           req.headers.get('x-real-ip') ||
           'unknown';
const rateLimitResult = checkRateLimit(ip);

if (!rateLimitResult.allowed) {
  return NextResponse.json(
    { error: '请求过于频繁，请稍后重试' },
    {
      status: 429,
      headers: {
        'Retry-After': String(rateLimitResult.retryAfter || 60),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}
```

**预期收益**: 防止 API 滥用，保护服务稳定性

---

## 文件变更总结

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `components/Chat.tsx` | 修改 | 性能优化、可访问性、代码重构 |
| `components/ErrorBoundary.tsx` | 新增 | 错误边界组件 |
| `app/api/chat/route.ts` | 修改 | 输入验证、限流 |
| `lib/rate-limit.ts` | 新增 | 限流工具 |

---

## 后续建议（中/低优先级）

1. **统一 API 响应格式** - 使用 `{ success: boolean, data?: T, error?: { code, message } }` 格式
2. **添加结构化日志** - 使用 `logger.info/warn/error` 替代 `console.log`
3. **组件拆分** - 将 Chat.tsx 拆分为 ChatHeader、ChatSidebar、ChatInput、MessageList 等
4. **消息列表虚拟化** - 使用 `@tanstack/react-virtual` 处理大量消息
5. **移除未使用依赖** - `@anthropic-ai/sdk` 已安装但未使用

---

*优化完成*
