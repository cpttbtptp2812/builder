---
name: skill-router
description: Skill 路由调试 — trigger 加权打分 · manifest 加载 · 步骤编排
triggers:
  - skill
  - router
  - match
  - discover
  - 路由
tools: []
---

# skill-router

Skill 运行时核心：自然语言 → discoverSkills 加权矩阵 → 选中 manifest → runSkill 逐步 MCP tools/call。

本文件没有 steps，目录里可以浏览和解析，不会进入执行链——避免「路由」两个字把所有问句都吞掉。
