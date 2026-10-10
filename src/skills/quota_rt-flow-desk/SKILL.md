---
name: quota_rt-flow-desk
description: 额度实时核查（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 额度核查
  - 额度实时
  - 实时核查额度
  - 查这户额度占用
  - 查这户额度占用超没超
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: quota_rt
      flowState: "{{creditFlowState}}"
---
