---
name: contract-desk
description: 合同审查 — 条款契约、类型守卫、对照、利率/评估分支、签批守卫与多表交付
triggers:
  - 审查借款合同
  - 合同审查
  - 借款合同
  - 条款对照
  - 利率对不上
  - 评估过期
steps:
  - id: intake
    label: 读入
    tool: __contract_intake__
    args:
      query: "{{query}}"
  - id: schema
    label: 契约
    tool: __contract_validate_schema__
    args:
      query: "{{query}}"
      requireColumns: "条款号,名称,合同原文,审批模板,类型"
      failFast: true
      guard: fail
  - id: kinds
    label: 类型
    tool: __contract_validate_kinds__
    args:
      query: "{{query}}"
      requireKinds: "amount,rate"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: read
    label: 抽要素
    tool: __contract_read__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: norm
    label: 规范
    tool: __contract_normalize__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: diff
    label: 对照
    tool: __contract_diff__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: rate
    label: 利率
    tool: __contract_rate_pass__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: appraisal
    label: 评估
    tool: __contract_appraisal_pass__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: risk
    label: 风险
    tool: __contract_risk__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: block
    label: 签批
    tool: __contract_block_sign__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
      blockOnHigh: true
      guard: fail
  - id: d1
    label: 对照表
    tool: __contract_deliver_clauses__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: d2
    label: 风险表
    tool: __contract_deliver_risk__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: d3
    label: 整改
    tool: __contract_deliver_remediation__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: d4
    label: 签批表
    tool: __contract_deliver_signoff__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: report
    label: 意见
    tool: __contract_report__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
      blockOnHigh: true
---

# contract-desk

对 **您导入的条款对照表** 跑完整审查链：契约 → 必需条款类型 → 逐条对照 → 利率容差 / 评估时效分支 → 风险矩阵 → 高风险签批守卫 → 对照/风险/整改/签批四表交付。条数与风险来自本次数据；改 `rateTolerance`、`appraisalDays`、`strict`、`blockOnHigh` 即改业务。
