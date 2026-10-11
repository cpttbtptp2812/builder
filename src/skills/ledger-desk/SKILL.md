---
name: ledger-desk
description: 智能报销对账 — 引擎算数 + 大模型读材料写办结说明（金额锁引擎）
triggers:
  - 报销表
  - 按部门汇总
  - 发票对不上
  - 表格对账
  - 汇总报销
  - 智能对账
  - 报销对账
  - 对账拦截
  - 升级审批
steps:
  - id: intake
    label: 读入
    tool: __sheet_intake__
    args:
      query: "{{query}}"
  - id: schema
    label: 契约
    tool: __sheet_validate_schema__
    args:
      query: "{{query}}"
      requireColumns: "部门,申请人,金额,税额,发票额,状态"
      failFast: true
      guard: fail
  - id: rows
    label: 行检
    tool: __sheet_validate_rows__
    args:
      query: "{{query}}"
      maxSingleAmount: 200000
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: norm
    label: 入账
    tool: __sheet_normalize__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: dup
    label: 去重
    tool: __sheet_duplicate_scan__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: agg
    label: 汇总
    tool: __sheet_aggregate__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: foot
    label: 交叉
    tool: __sheet_cross_foot__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: recon
    label: 对账
    tool: __sheet_reconcile__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: miss
    label: 缺票
    tool: __sheet_missing_guard__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
      guard: fail
  - id: esc
    label: 升级
    tool: __sheet_escalation__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
      leadAt: 5000
      directorAt: 10000
      financeReviewAt: 8000
  - id: exc
    label: 异常
    tool: __sheet_exception_queue__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: dept
    label: 部门表
    tool: __sheet_dept_rollup__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: d1
    label: 明细
    tool: __sheet_deliver_detail__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: d2
    label: 汇总表
    tool: __sheet_deliver_dept__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: d3
    label: 队列表
    tool: __sheet_deliver_escalation__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
      leadAt: 5000
      directorAt: 10000
      financeReviewAt: 8000
  - id: report
    label: 引擎结论
    tool: __sheet_report__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
      leadAt: 5000
      directorAt: 10000
      financeReviewAt: 8000
  - id: llm_brief
    label: 模型说明
    tool: __llm_product_brief__
    args:
      query: "{{query}}"
---

# ledger-desk

产品办事 **唯一主 skill**：对用户导入的报销明细跑完整引擎链，最后用 **已配置 LLM** 根据引擎事实与材料摘要写办结说明；**金额/合计/条数不得改**，校验失败则退回引擎结论。

业务规则改 **steps.args**（tax、tolerance、groupBy、升级线等）。`__llm_product_brief__` 须在接入配置中启用 LLM；未配置时仍办结，仅无模型说明。
