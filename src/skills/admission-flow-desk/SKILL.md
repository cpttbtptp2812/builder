---
name: admission-flow-desk
description: 客户准入（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 准入核查
  - 客户准入
  - 准入审查
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: admission
      flowState: "{{creditFlowState}}"
---
