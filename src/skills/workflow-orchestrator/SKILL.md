---
name: workflow-orchestrator
description: 工作流编排 — iMean workflow 入队 + 执行面 snapshot，TaskQueue 上游
triggers:
  - workflow
  - 自动化
  - 回放
  - taskqueue
  - 入队
  - 编排
  - 执行任务
tools:
  - workflow_run
  - browser_snapshot
steps:
  - id: run
    label: workflow_run · cloud
    tool: workflow_run
    args:
      workflowId: execute
      mode: local
  - id: snap
    label: browser_snapshot 执行面
    tool: browser_snapshot
    args:
      compact: true
  - id: summary
    label: TaskQueue 入队摘要
    tool: __compose_workflow_trace__
    args:
      workflow: $workflowResult
      snapshot: $snapshotResult
---

# workflow-orchestrator

workflow_run 真实入队 scenarios.ts 步骤，随后 snapshot 捕获执行面对象数量 — SDK TaskQueue 消费端见 /work/sdk。
