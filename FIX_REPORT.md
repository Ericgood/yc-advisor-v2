# YC Advisor API 超时问题修复报告

## 问题诊断

### 1. 发现的问题

#### 问题 1: Vercel Serverless 超时限制不匹配
- **症状**: API 返回 "请求超时"
- **原因**: 
  - Vercel Hobby 计划默认超时 10 秒
  - 代码设置 OpenRouter 超时 30 秒
  - 知识库初始化可能耗时 3-5 秒
  - 总耗时超过 Vercel 限制

#### 问题 2: 知识库初始化冷启动问题
- **症状**: 首次请求特别慢，后续请求正常
- **原因**:
  - 每次 Serverless 冷启动都会重新初始化知识库
  - 单例模式正确，但跨请求不保持状态
  - 文件系统读取可能耗时较长

#### 问题 3: OpenRouter 调用缺乏重试和降级
- **症状**: 偶发性超时，没有优雅降级
- **原因**:
  - 单次调用，失败后直接报错
  - 没有缓存机制
  - 没有备用响应策略

#### 问题 4: 前端超时过长
- **症状**: 用户等待很久后才看到超时提示
- **原因**: 前端设置 30 秒超时，与后端不匹配

---

## 修复措施

### 修复 1: 增加 Vercel 函数超时配置 (vercel.json)

```json
{
  "functions": {
    "app/api/chat/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**说明**: 
- Hobby 计划最大支持 10 秒（此配置无效）
- Pro 计划支持 60 秒（此配置生效）
- 建议升级到 Pro 计划以获得更好体验

### 修复 2: 知识库单例模式增强 (app/api/chat/route.ts)

```typescript
let kbInstance: KnowledgeBase | null = null;
let kbInitializing: Promise<KnowledgeBase> | null = null;

async function getKB(): Promise<KnowledgeBase> {
  // 返回现有实例
  if (kbInstance) return kbInstance;
  
  // 返回正在初始化的 Promise，防止重复初始化
  if (kbInitializing) return kbInitializing;
  
  // 创建新的初始化 Promise
  kbInitializing = (async () => {
    // 初始化逻辑...
    // 添加 5 秒超时保护
  })();
  
  return kbInitializing;
}
```

**改进**:
- 添加 `kbInitializing` 变量防止并发初始化
- 添加初始化超时 5 秒
- 更好的错误处理和日志

### 修复 3: OpenRouter 调用优化

```typescript
const CONFIG = {
  openRouterTimeout: 10000,  // 减少到 10 秒
  maxRetries: 2,             // 增加重试机制
};

async function callOpenRouterWithRetry(
  apiKey: string,
  messages: { role: 'system' | 'user'; content: string }[],
  retries = CONFIG.maxRetries
): Promise<{ content: string }> {
  // 带指数退避的重试逻辑
  // 第一次失败等待 500ms
  // 第二次失败等待 1000ms
}
```

**改进**:
- 超时从 30 秒减少到 10 秒
- 添加最多 2 次重试
- 指数退避策略

### 修复 4: 降级策略

```typescript
function generateFallbackResponse(query: string, resources: {...}[]): string {
  // 当 OpenRouter 失败时，返回基于知识库的简单回复
  // 列出相关资源供用户参考
}
```

**改进**:
- OpenRouter 失败时返回知识库资源列表
- 而不是直接报错
- 保持用户体验

### 修复 5: 前端超时优化 (components/Chat.tsx)

```typescript
// 从 30 秒减少到 15 秒
const timeoutId = setTimeout(() => controller.abort(), 15000);
```

**改进**:
- 前端超时与后端匹配
- 更快的超时反馈

### 修复 6: 知识库初始化增强 (lib/knowledge/knowledge-base.ts)

```typescript
async initialize(): Promise<void> {
  const initStartTime = Date.now();
  
  // 添加更多搜索路径
  const possiblePaths = [
    // ...原有路径
    path.join(process.cwd(), 'public/data/knowledge-index.json'),
    '/var/task/data/knowledge-index.json',
  ];
  
  // 添加 fetch 超时 3 秒
  const fetchController = new AbortController();
  const fetchTimeout = setTimeout(() => fetchController.abort(), 3000);
}
```

**改进**:
- 添加更多 Vercel 特定路径
- fetch fallback 添加 3 秒超时
- 更好的性能日志

---

## 性能优化

### 优化 1: 减少资源加载数量
- 从加载 3 个资源减少到 2 个
- 减少内容截断长度从 2000 到 1500

### 优化 2: 减少 Token 消耗
- max_tokens 从 4096 减少到 2048
- 简化 SYSTEM_PROMPT

### 优化 3: 添加执行时间日志
```typescript
const executionTime = Date.now() - startTime;
console.log(`[POST] Request completed in ${executionTime}ms, fallback=${usedFallback}`);
```

---

## 部署建议

### 1. 升级到 Vercel Pro 计划
- Hobby 计划限制 10 秒超时
- Pro 计划支持 60 秒超时
- 可以完整支持 AI 响应时间

### 2. 监控和日志
- 在 Vercel Dashboard 查看函数执行时间
- 关注冷启动时间
- 监控 OpenRouter API 成功率

### 3. 可选: 实现流式响应
- 使用 Edge Runtime + Streaming
- 可以绕过 Serverless 超时限制
- 提供更好的用户体验

---

## 文件修改清单

1. ✅ `vercel.json` - 新增，配置函数超时
2. ✅ `app/api/chat/route.ts` - 重写，添加超时控制和降级策略
3. ✅ `components/Chat.tsx` - 修改，减少前端超时
4. ✅ `lib/knowledge/knowledge-base.ts` - 修改，增强初始化

---

## 测试建议

1. **本地测试**: `npm run build && npm start`
2. **部署测试**: 部署到 Vercel 并测试多种查询
3. **冷启动测试**: 等待函数休眠后测试首次请求
4. **超时测试**: 测试网络不佳情况下的降级行为

---

## 后续优化方向

1. **流式响应**: 实现真正的流式 SSE 响应
2. **Edge Runtime**: 迁移到 Edge Functions 获得更长超时
3. **预加载**: 使用 CRON 定期调用保持函数热启动
4. **缓存**: 添加 Redis 缓存常见查询结果
