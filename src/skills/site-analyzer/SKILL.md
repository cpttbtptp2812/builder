---
name: site-analyzer
description: 本站技术审计 — http_probe + DOM snapshot + Performance API 合成报告
triggers: 分析 · 审计 · 性能 · 探活 · 健康 · metrics
tools: [http_probe, browser_snapshot]
---

# site-analyzer

多工具 Skill 流水线：真实 fetch 探活 → 遍历 DOM 可交互节点 → 读取 Navigation Timing → 输出 DevTools 风格指标面板。
