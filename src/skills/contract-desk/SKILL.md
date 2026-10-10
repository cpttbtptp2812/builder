---
name: contract-desk
description: 合同审查 — 逐条对照金额、期限、利率、还款和评估
triggers:
  - 审查借款合同
  - 合同审查
  - 借款合同
  - 条款对照
steps:
  - id: read
    label: 从合同抽出金额期限利率
    tool: __contract_read__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: diff
    label: 逐条对审批模板
    tool: __contract_diff__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: risk
    label: 给每条标高中低
    tool: __contract_risk__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
  - id: report
    label: 写出要改的条款
    tool: __contract_report__
    args:
      query: "{{query}}"
      rateTolerance: 0.5
      appraisalDays: 180
      strict: false
---

# contract-desk

把借款合同拆成条款，和审批结论、行内模板逐格对照。金额、期限、利率、还款方式、提前还款违约金、评估报告时效各占一行，标风险和建议改法。
