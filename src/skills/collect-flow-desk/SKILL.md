---
name: collect-flow-desk
description: 催收外呼（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 催收
  - 逾期
  - 外呼
  - 催款
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: collect
      flowState: "{{creditFlowState}}"
---
