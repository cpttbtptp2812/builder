---
name: agent-copilot
description: 全站智能诊断 — 知识召回 · 探活 · DOM · 性能 · 自动化入队，一次跑通五路 MCP 出联合报告
triggers:
  - agent copilot
  - copilot
  - 总线
  - 联合
  - 一条龙
  - 综合诊断
  - 全站助手
  - 帮我调研
  - 一键审计
  - 联合报告
  - 多工具
  - 指挥面板
  - 五路
  - 全能
  - 看看这个站
  - 站点和文档
  - 知识加探活
  - 调研本站
tools:
  - knowledge_search
  - http_probe
  - browser_snapshot
  - workflow_run
depends:
  - knowledge-lookup
  - site-analyzer
  - dom-probe
  - workflow-orchestrator
steps:
  - id: search
    label: knowledge_search · Hybrid RAG 召回
    tool: knowledge_search
    args:
      query: "{{query}}"
      topK: 5
  - id: probe
    label: http_probe · 本站探活
    tool: http_probe
    args:
      url: "{{probeUrl}}"
      method: HEAD
  - id: snapshot
    label: browser_snapshot · 执行面
    tool: browser_snapshot
    args:
      compact: true
  - id: dom
    label: DOM 树分析 · Locator 同源
    tool: __analyze_dom_tree__
    args:
      snapshot: $snapshotResult
  - id: perf
    label: Performance API · Navigation Timing
    tool: __perf_metrics__
    args: {}
  - id: workflow
    label: workflow_run · TaskQueue 入队（可选）
    tool: workflow_run
    args:
      workflowId: execute
      mode: local
  - id: report
    label: Agent Copilot · 联合指挥面板
    tool: __compose_agent_copilot__
    args:
      query: "{{query}}"
      knowledge: $searchResult
      probe: $probeResult
      snapshot: $snapshotResult
      dom: $domResult
      perf: $perfResult
      workflow: $workflowResult
---

# agent-copilot

**对外展示用总线 Skill** — 把 SkillForge 里分散的 MCP 能力收成一条可见流水线，Run 后在右侧出现 **就绪度分数 + 五路支柱**，不是话术模板。

1. **知识**：`knowledge_search` 返回 chunkId / score，可点回语料段。  
2. **探活**：真实 `http_probe`（默认当前站点 origin）。  
3. **DOM**：snapshot → `__analyze_dom_tree__`，与 Locator Lab 同源。  
4. **性能**：浏览器内 `Performance` API。  
5. **自动化**：`workflow_run` 本地入队；失败只标记 workflow 柱，不拖垮整链。

与 **release-inspector** 区别：release 面向任意 URL 发版验收；copilot 面向「问句 + 本站上下文」的综合展示。与办事 desk 无交集，不占 product-run 门闩。
