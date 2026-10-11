---
name: sheet-desk
description: 表格对账 — 契约校验、行级守卫、含税汇总、发票对账、升级队列与多表交付
triggers:
  - 报销表
  - 按部门汇总
  - 发票对不上
  - 表格对账
  - 汇总报销
  - 不含税入账
  - 容差调到
  - 缺票先警告
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
    label: 结论
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
---

# sheet-desk

对 **您导入的报销明细** 跑完整办事链：表结构契约 → 行级上限 → 含税/不含税入账 → 部门汇总与交叉校验 → 发票容差对账 → 缺票守卫 → 按金额进出纳/负责人/总监/财务复核队列 → 输出明细、部门、升级、异常四张交付表。

业务规则只改 **steps.args**（`tax`、`tolerance`、`missing`、`groupBy`、`leadAt`、`directorAt`、`financeReviewAt`、`maxSingleAmount`、`requireColumns`）。列数、拦截条数、队列分布均由本次数据计算，SKILL 不写死。

## 参数说明（发版时对照改）

| 参数 | 含义 |
|------|------|
| tax | include 含税入账 / exclude 不含税 |
| tolerance | 金额与发票允许差额（元） |
| missing | block 缺票拦截 / pass 缺票警告 |
| groupBy | 汇总维度列名 |
| leadAt / directorAt / financeReviewAt | 升级队列金额线 |
| maxSingleAmount | 单行报销硬顶 |
| requireColumns | 契约必需列，缺则 schema 步 failFast 终止 |
| failFast + guard: fail | 契约/缺票守卫失败时停止后续 step |

## 交付物

- **detail**：逐行入账、对账、升级队列
- **dept**：部门汇总与占比
- **escalation**：审批排队
- **exception**：拦截与警告清单
