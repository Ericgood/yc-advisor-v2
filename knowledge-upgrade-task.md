# YC Advisor 知识库升级任务

## 任务目标
将 OpenClaw YC Advisor Skill 的完整知识库系统（443个文档 + 检索逻辑）集成到 yc-advisor-v2 项目中，取代当前的简化版知识库。

## 项目现状

### 当前项目结构（yc-advisor-v2）
```
/tmp/yc-advisor-v2/
├── app/
│   ├── api/chat/route.ts      # API路由，使用简化版 SYSTEM_PROMPT
│   └── ...
├── components/
│   └── Chat.tsx               # 聊天组件
├── lib/
│   ├── yc-knowledge.ts        # 简化版知识库（100+行）
│   ├── types.ts               # 类型定义
│   └── rate-limit.ts          # 限流
└── ...
```

### 当前知识库问题
- 只有100行简化摘要
- 缺少完整内容
- 无法检索特定资源
- 回答质量受限

## YC Skill 现状

### Skill 结构
```
~/.openclaw/workspace/skills/yc-advisor/
├── SKILL.md                           # 使用说明
└── references/
    ├── quick-index.md                 # 快速索引（~500行，按主题分组）
    ├── summaries.md                   # 详细摘要（~4300行）
    ├── learning-paths.md              # 学习路径
    ├── frameworks/                    # 决策框架
    │   ├── should-i-start-a-startup.md
    │   ├── solo-vs-cofounder.md
    │   └── ...
    └── {CODE}-*.md                    # 443个完整资源文件
        ├── DZ-how-to-get-startup-ideas.md
        ├── 8z-do-things-that-dont-scale.md
        └── ...
```

### 关键文件说明

#### quick-index.md
- 轻量级索引（~500行）
- 按主题分组
- 每行包含：Code, 标题, 作者, 类型, 行数, 创始人阶段
- 用于快速发现资源

#### {CODE}-*.md（443个文件）
- 完整文章内容
- 命名格式：`[CODE]-[descriptive-name].md`
- 包含元数据：作者、类型、URL
- 示例：
  ```markdown
  # How to Get Startup Ideas
  
  **Author:** Paul Graham
  **Type:** Essay
  **URL:** https://www.ycombinator.com/library/DZ-how-to-get-startup-ideas
  
  ---
  
  [完整文章内容]
  ```

## 需求分析

### 需要实现的功能

1. **知识库存储**
   - 将443个文档迁移到项目中
   - 保持文件结构或改为数据库/JSON
   - 考虑构建时优化（Tree Shaking）

2. **检索系统**
   - 根据用户问题找到相关资源
   - 实现 quick-index.md 的检索逻辑
   - 支持关键词匹配

3. **动态 Prompt 构建**
   - 不再使用固定 SYSTEM_PROMPT
   - 根据用户问题动态选择相关知识
   - 构建上下文感知的 Prompt

4. **API 层改造**
   - 修改 route.ts 支持动态知识检索
   - 保持现有的限流、验证逻辑
   - 优化 Token 使用（只发送相关知识）

5. **前端优化（可选）**
   - 显示引用的资源来源
   - 添加相关资源推荐

## 技术方案选项

### 方案A：文件系统（简单）
- 直接复制 references/ 到项目中
- 运行时读取文件
- 优点：简单直接
- 缺点：服务器less环境可能受限

### 方案B：构建时处理（推荐）
- 构建时将文档处理为JSON
- 按主题/标签索引
- 优点：性能好，适合Vercel
- 缺点：构建时间增加

### 方案C：向量数据库（高级）
- 使用向量嵌入（OpenAI Embedding）
- 语义检索
- 优点：最智能的匹配
- 缺点：复杂，需要额外服务

## 执行计划

### Phase 1: 分析和规划
1. 统计443个文档的大小和分布
2. 分析 quick-index.md 结构
3. 确定技术方案
4. 设计数据模型

### Phase 2: 知识库迁移
1. 复制/转换文档到项目
2. 创建索引系统
3. 构建检索逻辑

### Phase 3: API 改造
1. 修改 route.ts 支持动态Prompt
2. 实现知识检索函数
3. 优化Token使用

### Phase 4: 测试和优化
1. 测试检索准确性
2. 优化响应时间
3. 验证构建和部署

## 执行命令

```bash
cd /tmp/yc-advisor-v2 && \
claude -p --dangerously-skip-permissions \
"请对 /tmp/yc-advisor-v2 项目进行完整的知识库升级。

## 背景
当前项目使用简化的知识库（lib/yc-knowledge.ts），需要将 OpenClaw YC Skill 的完整知识库（443个文档）集成进来。

## 可用资源
- YC Skill 位置: ~/.openclaw/workspace/skills/yc-advisor/
- 关键文件:
  - references/quick-index.md （快速索引，~500行）
  - references/{CODE}-*.md （443个完整文档）
  - references/learning-paths.md （学习路径）
  - references/frameworks/*.md （决策框架）

## 任务

1. **分析现有结构**
   - 读取 ~/.openclaw/workspace/skills/yc-advisor/references/quick-index.md
   - 统计文档数量和大小
   - 分析索引结构

2. **设计技术方案**
   - 选择知识库存储方式（文件/JSON/向量）
   - 设计检索算法
   - 规划API改造方案

3. **实施迁移**
   - 创建 lib/knowledge/ 目录结构
   - 迁移知识库文件或转换为JSON
   - 创建检索模块 lib/knowledge/search.ts

4. **改造API**
   - 修改 app/api/chat/route.ts
   - 实现动态Prompt构建
   - 集成知识检索逻辑

5. **优化和测试**
   - 确保TypeScript编译通过
   - 测试知识检索准确性
   - 验证Vercel部署

## 输出要求
- 详细的设计文档（DESIGN.md）
- 实现代码
- 修改日志

请开始执行这个复杂的重构任务。" \
> /tmp/yc-advisor-v2/knowledge-upgrade-log.md 2>&1
```

## 状态
🟡 **等待执行**

## 预期成果
1. 完整的知识库系统
2. 智能检索功能
3. 更高质量的回答
4. 详细的实现文档