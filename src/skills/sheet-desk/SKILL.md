---
name: sheet-desk
description: 表格对账 — 读表、认类型、含税汇总、按容差对发票
triggers:
  - 报销表
  - 按部门汇总
  - 发票对不上
  - 表格对账
  - 汇总报销
  - 不含税入账
  - 容差调到
  - 缺票先警告
  - 这批押品
steps:
  - id: parse
    label: 读入六列，认出数字和空发票
    tool: __sheet_parse__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: price
    label: 金额含税，按部门求和
    tool: __sheet_aggregate__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: check
    label: 容差 0，缺票直接拦截
    tool: __sheet_reconcile__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
  - id: report
    label: 写出部门合计和被拦截的行
    tool: __sheet_report__
    args:
      query: "{{query}}"
      tax: include
      tolerance: 0
      missing: block
      groupBy: 部门
---

# sheet-desk

先认列和类型，再按配方把金额汇总到部门，最后用容差对发票。含税还是去税、缺票拦不拦，都写在步骤参数里，换一版参数，同一张表的合计和拦截行会变。
