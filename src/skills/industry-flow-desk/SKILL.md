---
name: industry-flow-desk
description: 行业分析（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 行业分析
  - 行业风险
  - 行业报告
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: industry
      flowState: "{{creditFlowState}}"
---
