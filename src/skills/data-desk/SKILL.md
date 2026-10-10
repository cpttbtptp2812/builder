---
name: data-desk
description: 额度测算 — 流水、现金流、风险系数、政策上限
triggers:
  - 测算授信额度
  - 额度测算
  - 授信额度
  - 现金流测算
  - 额度占用
steps:
  - id: load
    label: 取近 6 个月月均流入
    tool: __data_load__
    args:
      query: "{{query}}"
      monthly: 85
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: formula
    label: 月均乘稳定系数再乘偿债比例
    tool: __data_formula__
    args:
      query: "{{query}}"
      monthly: 85
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: adjust
    label: 再乘信用、行业、年限
    tool: __data_adjust__
    args:
      query: "{{query}}"
      monthly: 85
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
  - id: report
    label: 和客群上限比较后核定
    tool: __data_report__
    args:
      query: "{{query}}"
      monthly: 85
      stability: 0.7
      debtRatio: 0.2
      credit: 1.15
      industry: 0.9
      years: 1.1
      policyCap: 50
---

# data-desk

先取月均经营流入，按「月均 × 稳定系数 × 偿债比例」得到现金流额度，再乘信用、行业、年限，最后不超过客群政策上限。系数一变，核定金额就变。
