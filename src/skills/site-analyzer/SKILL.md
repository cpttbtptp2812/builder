---
name: site-analyzer
description: 本站技术审计 — http_probe + DOM snapshot + Performance API 合成报告
triggers:
  - 分析
  - 审计
  - 性能
  - 探活
  - 健康
  - 体检
  - 检查
  - 正常
  - 可用
  - 打得开
  - 响应
  - 速度
  - 加载
  - 慢
  - metrics
  - latency
  - ttfb
  - probe
  - status
tools:
  - http_probe
  - browser_snapshot
steps:
  - id: probe
    label: http_probe · 真实 fetch
    tool: http_probe
    args:
      url: "{{probeUrl}}"
      method: HEAD
  - id: snapshot
    label: browser_snapshot · a11y tree
    tool: browser_snapshot
    args:
      compact: true
  - id: perf
    label: Performance API · Navigation Timing
    tool: __perf_metrics__
    args: {}
  - id: audit
    label: 合成 Site Audit Dashboard
    tool: __compose_site_audit__
    args:
      probe: $probeResult
      snapshot: $snapshotResult
      perf: $perfResult
---

# site-analyzer

多工具 Skill 流水线：真实 fetch 探活 → 遍历 DOM 可交互节点 → 读取 Navigation Timing → 输出 DevTools 风格指标面板。

`{{probeUrl}}` 运行时替换成当前 origin；`$probeResult` 引用上一步 MCP 返回值，不把对象打成字符串。
