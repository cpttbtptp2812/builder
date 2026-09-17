---
name: dom-probe
description: DOM 定位探针 — 可交互节点分布 · 树深度 · Locator 同源
triggers:
  - dom
  - 定位
  - snapshot
  - a11y
  - 元素
  - locator
  - shadow
  - 节点
  - 可交互
  - 页面结构
  - 结构
  - 选择器
  - 无障碍
tools:
  - browser_snapshot
steps:
  - id: snap
    label: browser_snapshot · full tree
    tool: browser_snapshot
    args:
      compact: false
  - id: analyze
    label: DOM 树分析 · role 分布
    tool: __analyze_dom_tree__
    args:
      snapshot: $snapshotResult
---

# dom-probe

ReplaySDK / Locator 同源能力：对当前页面做 browser_snapshot，统计 button/link/textbox 分布与树深度 — 对接 /work/locator 实验室。
