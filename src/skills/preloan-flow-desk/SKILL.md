---
name: preloan-flow-desk
description: 贷前调查（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 贷前调查
  - 尽调
  - 调查报告
  - 贷前
  - 万邦蔬菜
  - 贷前调研
  - 张老板
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: preloan
      flowState: "{{creditFlowState}}"
---
