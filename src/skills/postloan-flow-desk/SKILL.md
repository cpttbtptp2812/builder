---
name: postloan-flow-desk
description: 贷后现场检查（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 贷后检查
  - 检查任务
  - 现场检查
  - 贷后现场
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: postloan
      flowState: "{{creditFlowState}}"
---
