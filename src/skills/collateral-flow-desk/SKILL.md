---
name: collateral-flow-desk
description: 押品重估（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 押品
  - 重估
  - 抵押物
  - 押品价值
  - 重估这批押品
  - 押品重估
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: collateral
      flowState: "{{creditFlowState}}"
---
