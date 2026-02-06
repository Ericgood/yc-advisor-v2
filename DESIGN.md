# YC Advisor 知识库 V2 升级设计文档

## 1. 分析阶段总结

### 1.1 现有资源概况

| 指标 | 数值 |
|------|------|
| 总文档数 | 443 |
| 实际文件数 | 452 |
| 类别数 | 31 |
| 最大类别 | General (124个文档) |
| 第二大类别 | AI (84个文档) |

### 1.2 文档分类分布

| 类别 | 文档数 | 占比 |
|------|--------|------|
| General | 124 | 28.0% |
| AI | 84 | 19.0% |
| Accelerator | 47 | 10.6% |
| Co-Founders | 22 | 5.0% |
| Growth | 17 | 3.8% |
| Getting Started | 17 | 3.8% |
| Building | 16 | 3.6% |
| Customers | 14 | 3.2% |
| Culture | 10 | 2.3% |
| Fundraising | 10 | 2.3% |
| 其他21个类别 | 82 | 18.5% |

### 1.3 当前索引结构分析

**index.yaml 结构:**
```yaml
version: '1.0'
total_resources: 443
resources:
  - code: 8z
    file: 8z-how-to-get-startup-ideas.md
    title: How to Get Startup Ideas
    author: Paul Graham
    type: essay
    url: https://www.ycombinator.com/library/...
    topics: [general]
    founder_stage: [idea]
    related: []
    lines: 543
```

**quick-index.md 结构:**
- 按主题分组的轻量级索引
- 每行格式: `- **CODE** | Title | Author | type | lines | stage`
- 用于快速发现资源

### 1.4 问题识别

1. **检索效率低**: 依赖文件系统glob和文本搜索
2. **无类型安全**: 纯Markdown + YAML，无TypeScript类型
3. **无法增量加载**: 必须加载整个index.yaml(64K tokens)
4. **无向量化检索**: 无法基于语义相似度检索
5. **无API层**: 需要直接操作文件系统

---

## 2. 设计阶段

### 2.1 知识库存储方案

**采用构建时JSON方案** (推荐)

理由:
- YC知识库相对静态(季度更新)
- JSON比YAML解析更快
- 可预计算索引结构
- 支持增量加载

**JSON Schema设计:**

```typescript
// 主索引文件 knowledge-index.json
{
  "version": "2.0",
  "generatedAt": "2025-02-05T10:00:00Z",
  "stats": {
    "totalResources": 443,
    "categories": 31,
    "totalLines": 125000
  },
  "categories": {
    "general": { "count": 124, "resources": [...] },
    "ai": { "count": 84, "resources": [...] }
  },
  "resources": {
    "8z": { /* 完整资源元数据 */ },
    "JW": { /* 完整资源元数据 */ }
  },
  "searchIndex": {
    "byAuthor": { "Paul Graham": ["8z", "94", ...] },
    "byType": { "essay": [...], "video": [...] },
    "byStage": { "idea": [...], "building": [...] }
  }
}

// 单个资源文件 8z.json (可选懒加载)
{
  "code": "8z",
  "title": "...",
  "content": "...",  // 完整内容
  "chunks": [ /* 分块用于向量化 */ ]
}
```

### 2.2 检索算法设计

**三级检索策略:**

```
Level 1: 元数据过滤 (O(1))
  - 按类别、作者、类型、阶段快速筛选
  
Level 2: 关键词搜索 (O(n))
  - 标题/摘要匹配
  - 关键词倒排索引
  
Level 3: 语义检索 (O(log n) with vector index)
  - 查询向量化
  - 余弦相似度计算
  - 返回Top-K相关文档
```

**检索流程:**

```typescript
async function searchKnowledgeBase(query: SearchQuery): Promise<SearchResult> {
  // 1. 元数据预过滤
  let candidates = filterByMetadata(query.filters);
  
  // 2. 关键词匹配评分
  candidates = scoreByKeywords(candidates, query.keywords);
  
  // 3. 语义相似度排序 (可选)
  if (query.semantic) {
    candidates = await rankBySimilarity(candidates, query.embedding);
  }
  
  // 4. 返回Top-K
  return candidates.slice(0, query.limit);
}
```

### 2.3 API设计

**RESTful API:**

```typescript
// GET /api/knowledge/search?q=fundraising&stage=seed&limit=5
interface SearchRequest {
  q: string;              // 查询字符串
  category?: string;      // 类别过滤
  stage?: FounderStage;   // 阶段过滤
  author?: string;        // 作者过滤
  type?: ResourceType;    // 类型过滤
  semantic?: boolean;     // 是否使用语义搜索
  limit?: number;         // 返回数量
}

interface SearchResponse {
  results: ResourceMeta[];
  total: number;
  query: string;
  filters: FilterState;
}

// GET /api/knowledge/resource/:code
interface ResourceResponse {
  meta: ResourceMeta;
  content: string;
  related: ResourceMeta[];
}

// GET /api/knowledge/categories
interface CategoriesResponse {
  categories: CategoryInfo[];
}
```

### 2.4 类型定义

```typescript
// types/knowledge.ts
type ResourceType = 'essay' | 'video' | 'podcast';
type FounderStage = 'pre-idea' | 'idea' | 'building' | 'launched' | 'scaling' | 'all';

interface ResourceMeta {
  code: string;
  title: string;
  author: string;
  type: ResourceType;
  url: string;
  topics: string[];
  founderStage: FounderStage[];
  lines: number;
  filePath: string;
  hasTranscript: boolean;
}

interface Resource extends ResourceMeta {
  content: string;
  summary?: string;
  related: string[];
}

interface SearchQuery {
  keywords: string[];
  filters: {
    categories?: string[];
    stages?: FounderStage[];
    authors?: string[];
    types?: ResourceType[];
  };
  semantic?: boolean;
  limit: number;
}

interface SearchResult {
  resources: ResourceMeta[];
  total: number;
  facets: {
    categories: Record<string, number>;
    authors: Record<string, number>;
    stages: Record<string, number>;
  };
}
```

---

## 3. 实施计划

### Phase 1: 基础设施 (5分钟)
- [x] 创建目录结构
- [ ] 创建类型定义
- [ ] 创建构建脚本

### Phase 2: 数据迁移 (5分钟)
- [ ] 解析现有index.yaml
- [ ] 生成knowledge-index.json
- [ ] 验证数据完整性

### Phase 3: 检索引擎 (10分钟)
- [ ] 实现KnowledgeBase类
- [ ] 实现三级检索
- [ ] 添加缓存层

### Phase 4: API层 (5分钟)
- [ ] 创建API路由
- [ ] 实现错误处理
- [ ] 添加中间件

---

## 4. 目录结构

```
yc-advisor-v2/
├── lib/
│   ├── knowledge/
│   │   ├── types.ts          # TypeScript类型定义
│   │   ├── index.ts          # 主入口
│   │   ├── knowledge-base.ts # 知识库核心类
│   │   ├── search.ts         # 检索算法
│   │   └── utils.ts          # 工具函数
│   └── types/
│       └── index.ts          # 导出所有类型
├── app/
│   └── api/
│       └── chat/
│           └── route.ts      # API路由
├── data/
│   └── knowledge-index.json  # 构建生成的索引
├── scripts/
│   └── build-index.ts        # 索引构建脚本
└── tests/
    └── search.test.ts        # 单元测试
```

---

## 5. 性能目标

| 指标 | 目标 |
|------|------|
| 索引加载时间 | < 50ms |
| 元数据检索 | < 5ms |
| 关键词搜索 | < 50ms |
| 内存占用 | < 10MB |
| 构建时间 | < 30s |

---

## 6. 向后兼容

- 保留原有Markdown文件结构
- 原有脚本继续工作
- 新增JSON索引为只读优化层
