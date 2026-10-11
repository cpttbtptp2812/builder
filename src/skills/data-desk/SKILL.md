---
name: data-desk
description: 额度测算 — 流水契约、月数/波动守卫、加权月均、公式链、上限与委员会分支
triggers:
  - 测算授信额度
  - 额度测算
  - 授信额度
  - 现金流测算
  - 经营流水
steps:
  - id: intake
    label: 读入
    tool: __data_intake__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: schema
    label: 契约
    tool: __data_validate_schema__
    args:
      query: "{{query}}"
      requireColumns: "月份,流入万元"
      failFast: true
      guard: fail
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: months
    label: 月数
    tool: __data_validate_months__
    args:
      query: "{{query}}"
      minMonths: 3
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: load
    label: 月均
    tool: __data_load__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: weighted
    label: 加权
    tool: __data_weighted__
    args:
      query: "{{query}}"
      recentWeight: 0.45
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: vol
    label: 波动
    tool: __data_volatility__
    args:
      query: "{{query}}"
      volatilityWarn: 0.35
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: trend
    label: 趋势
    tool: __data_trend__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: formula
    label: 现金流
    tool: __data_formula__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: adjust
    label: 系数
    tool: __data_adjust__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: cap
    label: 上限
    tool: __data_cap_compare__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: committee
    label: 委员会
    tool: __data_committee__
    args:
      query: "{{query}}"
      committeeRatio: 0.95
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: min
    label: 底线
    tool: __data_min_guard__
    args:
      query: "{{query}}"
      minApproved: 0
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: t1
    label: 流水表
    tool: __data_deliver_trend__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: t2
    label: 公式表
    tool: __data_deliver_formula__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: t3
    label: 决策表
    tool: __data_deliver_decision__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: report
    label: 核定
    tool: __data_report__
    args:
      query: "{{query}}"
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
      recentWeight: 0.45
      minMonths: 3
---

# data-desk

月均流入 **只来自您导入的按月流水**（SKILL 不写死月数）；`stability`、`debtRatio`、`credit`、`industry`、`years`、`policyCap`、`minMonths`、`recentWeight` 等在 args 里改即改核定逻辑。
