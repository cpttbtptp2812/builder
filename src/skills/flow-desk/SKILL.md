---
name: flow-desk
description: 流程推进 — 收单、核发票、对账、按金额升级
triggers:
  - 报销单现在走到哪
  - 走到哪
  - 审批走到哪
  - 流程走到哪
  - 下一关
steps:
  - id: intake
    label: 收单，点出部门和金额
    tool: __flow_intake__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
  - id: invoice
    label: 核发票，没有就退回
    tool: __flow_invoice__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
  - id: reconcile
    label: 差额大于 0 就停在财务复核
    tool: __flow_reconcile__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
  - id: route
    label: 5000 到部门负责人，10000 到总监
    tool: __flow_route__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
  - id: report
    label: 写出停在哪一关
    tool: __flow_report__
    args:
      query: "{{query}}"
      directorAt: 10000
      leadAt: 5000
      mismatch: block
      missing: return
---

# flow-desk

一张单据按固定顺序走：收单、核发票、对账、按金额升级。缺票退不退、差额拦不拦、总监线是多少，都是步骤上的守卫。换一版守卫，同一张单会停在不同的关。
