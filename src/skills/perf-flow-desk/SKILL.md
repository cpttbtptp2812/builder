---
name: perf-flow-desk
description: 业绩跟踪（多轮） — 对话内上传、表单、校验、逐步推进
triggers:
  - 业绩
  - 完成率
  - 任务进度
  - 业绩跟踪
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: perf
      flowState: "{{creditFlowState}}"
---
