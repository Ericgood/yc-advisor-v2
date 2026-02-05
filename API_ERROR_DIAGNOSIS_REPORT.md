# YC Advisor API 错误诊断报告

## 问题描述
用户发送消息时，API 返回 "Internal server error"

## 根本原因
**Standalone 输出模式未包含数据文件**

在 `next.config.mjs` 中配置了 `output: 'standalone'`，但默认情况下 standalone 输出不会包含 `data/` 和 `references/` 目录中的文件。这导致在 Vercel serverless 环境中运行时，知识库无法加载索引文件和资源内容。

## 诊断过程

### 1. 检查 `app/api/chat/route.ts` 的 POST 处理逻辑
- ✅ POST 处理逻辑正确，包含完整的错误处理
- ✅ 使用 OpenRouter API 调用 Claude 模型
- ✅ 正确集成了知识库搜索功能
- ⚠️ 路径配置使用相对路径 `'./data/knowledge-index.json'` 和 `'./references'`

### 2. 检查 `lib/knowledge/knowledge-base.ts`
- ✅ `initialize()` 方法设计合理
- ❌ **问题**: 路径解析在 Vercel serverless 环境中可能失败
- ❌ **问题**: 未检查文件是否存在就直接读取
- ✅ `loadResource()` 已有 fallback 机制

### 3. 确认 `data/knowledge-index.json` 存在且可解析
- ✅ 文件存在 (339KB)
- ✅ JSON 结构正确，包含 443 个资源、60 个分类、109 位作者

### 4. 确认 `references/` 目录包含文档
- ✅ 目录存在，包含 450+ 个 markdown 文件
- ✅ 文件命名与 `knowledge-index.json` 中的 `filePath` 匹配

### 5. 环境变量检查
- ⚠️ 代码依赖 `OPENROUTER_API_KEY`（已在别处配置）
- ⚠️ 可添加 `KNOWLEDGE_INDEX_PATH` 和 `KNOWLEDGE_CONTENT_PATH` 环境变量作为覆盖

## 修复措施

### 1. 更新 `next.config.mjs`
添加 `experimental.outputFileTracingIncludes` 配置，确保数据文件包含在 standalone 输出中：

```javascript
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/api/chat': ['./data/**/*', './references/**/*'],
      '/api/knowledge/categories': ['./data/**/*', './references/**/*'],
      '/api/knowledge/resource/[code]': ['./data/**/*', './references/**/*'],
    },
  },
};
```

### 2. 增强 `lib/knowledge/knowledge-base.ts`
- 改进 `initialize()` 方法：尝试多个可能的路径，添加 fetch fallback
- 改进 `loadResource()` 方法：尝试多个路径，更好的错误处理
- 移除未使用的变量，修复 TypeScript 严格模式错误

### 3. 更新 `app/api/chat/route.ts`
- 调整路径配置，移除不必要的 `./` 前缀

## 修复后的 Standalone 输出结构

```
.next/standalone/
├── server.js
├── package.json
├── node_modules/
├── .next/
├── data/
│   └── knowledge-index.json       ✅ (339KB, 443 resources)
└── references/                    ✅ (450+ markdown files)
    ├── 1k-benchmarks.md
    ├── 4b-how-to-pitch-your-company.md
    └── ...
```

## 环境变量（可选）

为更灵活的配置，可在 Vercel 设置以下环境变量：

```
OPENROUTER_API_KEY=<your-api-key>
KNOWLEDGE_INDEX_PATH=data/knowledge-index.json      # 可选覆盖
KNOWLEDGE_CONTENT_PATH=references                   # 可选覆盖
KNOWLEDGE_INDEX_URL=/data/knowledge-index.json      # fetch fallback URL
KNOWLEDGE_CONTENT_URL=/references                   # fetch fallback URL
```

## 验证步骤

1. ✅ TypeScript 编译通过 (`npx tsc --noEmit`)
2. ✅ Next.js 构建成功 (`npm run build`)
3. ✅ Standalone 输出包含数据文件
4. ✅ 知识库索引文件在正确位置
5. ✅ 参考资料文件在正确位置

## 部署建议

1. 重新部署到 Vercel：
   ```bash
   vercel --prod
   ```

2. 验证 API 健康状态：
   ```
   GET https://yc-advisor-v2.vercel.app/api/test
   ```

3. 测试聊天功能：
   ```
   POST https://yc-advisor-v2.vercel.app/api/chat
   Body: { "message": "如何找到联合创始人？" }
   ```

## 常见问题预防

### Serverless 文件系统路径问题
- ✅ 已修复：使用多路径尝试策略
- ✅ 已修复：添加 fetch fallback 机制
- ✅ 已修复：使用 `outputFileTracingIncludes` 确保文件被打包

### 环境检测
- ✅ 代码正确检测 Node.js vs 浏览器环境 (`typeof window === 'undefined'`)
- ✅ 同时支持 fs 和 fetch API

## 总结

**问题**: Standalone 模式未包含数据文件 → Vercel 部署后文件系统缺失

**解决方案**: 
1. 配置 `outputFileTracingIncludes` 包含数据目录
2. 增强代码路径解析，添加多路径尝试和 fallback

**状态**: ✅ 已修复并验证
