---
name: expense_flow-flow-desk
description: 报销审批流程（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 报销单现在走到哪
  - 走到哪
  - 审批走到哪
  - 流程走到哪
  - 市场部9600
  - 市场部9600报销单现在走到哪
  - 报销流程
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: expense_flow
      flowState: "{{creditFlowState}}"
---
