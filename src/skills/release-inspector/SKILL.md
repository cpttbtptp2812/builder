---
name: release-inspector
description: 发布前巡检 — 任意 URL 探活 + HTML 预览 + 资料库对照
triggers:
  - 发布前
  - 上线
  - 发版
  - 验收
  - 巡检
  - smoke
  - inspect
  - release
  - 探活
  - 健康检查
  - 能不能访问
  - 打得开吗
tools:
  - http_probe
  - browser_snapshot
  - knowledge_search
steps:
  - id: probe
    label: http_probe · GET 全量
    tool: http_probe
    args:
      url: "{{probeUrl}}"
      method: GET
  - id: snapshot
    label: browser_snapshot · 同源 DOM
    tool: browser_snapshot
    args:
      compact: true
  - id: docs
    label: knowledge_search · 资料库对照
    tool: knowledge_search
    args:
      query: "{{query}}"
      topK: 3
  - id: report
    label: 合成发布前巡检报告
    tool: __compose_release_report__
    args:
      probe: $probeResult
      snapshot: $snapshotResult
      knowledge: $searchResult
      targetUrl: "{{probeUrl}}"
      query: "{{query}}"
---

# release-inspector

对 **任意 URL** 执行发布前验收：

1. `http_probe` GET — 状态码、延迟、HTML 预览（跨域可用）
2. 若与当前站 **同源** — 追加 `browser_snapshot`
3. `knowledge_search` — 与资料库预期对照
4. 输出 Pass / Warn / Fail 清单

对话示例：`/inspect https://staging.example.com` 或 `帮我巡检 https://example.com 能否上线`
