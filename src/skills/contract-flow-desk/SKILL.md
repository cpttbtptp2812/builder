---
name: contract-flow-desk
description: 合同审查（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 合同审查
  - 贷款合同
  - 合规审查
  - 合同风险
  - 审查合同
  - 借款合同
  - 审查这份借款合同
  - 审查借款合同
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: contract
      flowState: "{{creditFlowState}}"
---
