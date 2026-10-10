---
name: disburse-flow-desk
description: 智能放款校验（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 放款校验
  - 放款条件
  - 智能放款
  - 智能放款校验
  - 核对放款
  - 满足放款
  - 核对这笔放款材料
  - 核对这笔放款材料齐不齐
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: disburse
      flowState: "{{creditFlowState}}"
---
