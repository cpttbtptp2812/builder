---
name: risk_id-flow-desk
description: 贷后风险识别（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 贷后风险
  - 风险识别
  - 风险扫描
  - 贷后监控
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: risk_id
      flowState: "{{creditFlowState}}"
---
