---
name: knowledge-lookup
description: 项目知识检索 — knowledge_search 分块召回，命中带 chunkId
triggers:
  - 检索
  - 知识库
  - 召回
  - chunkid
  - 语料
  - 文档块
tools:
  - knowledge_search
steps:
  - id: search
    label: knowledge_search · 分块召回
    tool: knowledge_search
    args:
      query: "{{query}}"
      topK: 5
  - id: compose
    label: 合成引用面板
    tool: __compose_knowledge__
    args:
      hits: $searchResult
      query: "{{query}}"
---

# knowledge-lookup

对作品集语料做分块检索。MCP 工具 knowledge_search 返回 title / chunkId / score / excerpt，合成步骤把命中摊成可对账面板。

和对话里的「介绍一下 iMean」不同：那条走 Guest 知识意图；这条是技能目录里可单独运行的检索技能。
