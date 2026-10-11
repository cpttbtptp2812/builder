---
name: flow-desk
description: 流程推进 — 批量收单、同步对账结论、发票/差额守卫、部门 cap、双签与升级落点
triggers:
  - 流程走到哪
  - 报销流程
  - 停在谁
  - 缺票退回
  - 财务复核
  - 总监审批
  - 部门额度
steps:
  - id: batch
    label: 批量
    tool: __flow_batch_scan__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
      sheetTolerance: 0
      syncSheetBlock: true
  - id: intake
    label: 收单
    tool: __flow_intake__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
      sheetTolerance: 0
      syncSheetBlock: true
  - id: sync
    label: 对账同步
    tool: __flow_sheet_sync__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
      sheetTolerance: 0
      syncSheetBlock: true
  - id: invoice
    label: 核票
    tool: __flow_invoice__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
      sheetTolerance: 0
  - id: recon
    label: 差额
    tool: __flow_reconcile__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
      sheetTolerance: 0
  - id: cap
    label: 部门cap
    tool: __flow_dept_cap__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
      deptMonthlyCap: 50000
      sheetTolerance: 0
  - id: dual
    label: 双签
    tool: __flow_dual_sign__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      dualSignAt: 15000
      mismatch: block
      missing: return
      sheetTolerance: 0
  - id: route
    label: 路由
    tool: __flow_route__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
      sheetTolerance: 0
  - id: report
    label: 落点
    tool: __flow_report__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
      deptMonthlyCap: 50000
      dualSignAt: 15000
      sheetTolerance: 0
      syncSheetBlock: true
---

# flow-desk

在 **同一份报销明细** 上跑流程：先批量看对账拦截，再对焦点单做缺票/差额策略，核对部门月度 cap 与双签线，最后给出停在哪一关（与 sheet-desk 升级表同源）。

改 **args** 即改业务：`leadAt`/`directorAt`、`mismatch`、`missing`、`sheetTolerance`、`deptMonthlyCap`、`dualSignAt`、`syncSheetBlock`（是否硬跟对账拦截）。

## 与 sheet-desk 的关系

流程步 `__flow_sheet_sync__` 会调用同一套对账程序；`syncSheetBlock: true` 时，对账已拦截的单据不会进入出纳/负责人路由。
