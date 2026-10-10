---
name: credit_calc-flow-desk
description: 授信额度测算（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 额度测算
  - 授信测算
  - 授信额度
  - 测算额度
  - 测算这笔授信额度
  - 测算授信额度
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: credit_calc
      flowState: "{{creditFlowState}}"
---
