/** 办事技能 ↔ 用户数据槽（产品模式必须导入，无内置业务数据） */

import { datasetRowCount, type ProductDataSlot } from "./productDataStore";

export type SkillDataRequirement = {
  slot: ProductDataSlot;
  label: string;
  hint: string;
  templateCsv: string;
  filename: string;
};

const EXPENSE_TEMPLATE = `部门,申请人,金额,税额,发票额,状态
研发,张三,12800,1664,12800,待审
市场,李四,4200,546,,缺票`;

const CASHFLOW_TEMPLATE = `月份,流入万元
2025-05,72
2025-06,81
2025-07,88
2025-08,90
2025-09,86
2025-10,94`;

const CONTRACT_TEMPLATE = `条款号,名称,合同原文,审批模板,类型
1.2,借款金额,30万,审批50万,amount
2.1,年化利率,8.5%,审批6.2%,rate
附,评估报告,出具已210天,须在有效期内,appraisal`;

export const SKILL_DATA_REQUIREMENTS: Record<string, SkillDataRequirement[]> = {
  "sheet-desk": [
    {
      slot: "expense-ledger",
      label: "报销明细表",
      hint: "对账技能会按配方逐行汇总、对发票容差。",
      templateCsv: EXPENSE_TEMPLATE,
      filename: "expense-ledger-template.csv",
    },
  ],
  "flow-desk": [
    {
      slot: "expense-ledger",
      label: "报销明细表",
      hint: "流程技能会从表中定位本单（可带金额/部门/姓名），再跑关卡。",
      templateCsv: EXPENSE_TEMPLATE,
      filename: "expense-ledger-template.csv",
    },
  ],
  "data-desk": [
    {
      slot: "cashflow-monthly",
      label: "经营流水（按月）",
      hint: "额度技能用近月流入算月均，再乘系数核定。",
      templateCsv: CASHFLOW_TEMPLATE,
      filename: "cashflow-monthly-template.csv",
    },
  ],
  "contract-desk": [
    {
      slot: "contract-clauses",
      label: "合同条款对照表",
      hint: "每行一条条款：合同原文 vs 审批/模板，技能会标风险。",
      templateCsv: CONTRACT_TEMPLATE,
      filename: "contract-clauses-template.csv",
    },
  ],
};

export function requirementsForSkill(skillId: string): SkillDataRequirement[] {
  return SKILL_DATA_REQUIREMENTS[skillId] ?? [];
}

export function missingDataForSkill(skillId: string): SkillDataRequirement[] {
  return requirementsForSkill(skillId).filter((req) => datasetRowCount(req.slot) < 1);
}

export function productSkillUsesUserData(skillId: string): boolean {
  return requirementsForSkill(skillId).length > 0;
}
