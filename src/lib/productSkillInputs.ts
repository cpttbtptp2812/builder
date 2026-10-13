/** 办事技能 ↔ 用户数据槽（产品模式必须导入，无内置业务数据） */

import { datasetRowCount, type ProductDataSlot } from "./productDataStore";
import { DESK_METAS } from "./deskProgramMeta";

export type SkillDataRequirement = {
  slot: ProductDataSlot;
  label: string;
  hint: string;
  templateCsv: string;
  filename: string;
};

function tpl(lines: string[]): string {
  return lines.join("\n");
}

/** 下载后可原样导入过门闩；数字请改成贵司真实值后再跑业务 */
/** 8 行示例 + 一行发票不一致，便于改数字试跑；表头与列名勿删改 */
const EXPENSE_TEMPLATE = tpl([
  "部门,申请人,金额,税额,发票额,状态,费用类型",
  "研发,经办A,1500,195,1500,待审,差旅",
  "研发,经办B,880,114,880,待审,办公用品",
  "市场,经办C,2400,312,2400,待审,活动物料",
  "市场,经办D,800,104,750,待审,投放费",
  "财务,经办E,320,42,320,已审,培训",
  "行政,经办F,560,73,560,待审,物业",
  "研发,经办G,1200,156,1200,待审,外包",
  "市场,经办H,430,56,430,待审,设计",
]);

const CASHFLOW_TEMPLATE = tpl([
  "月份,流入万元",
  "2025-01,10",
  "2025-02,11",
  "2025-03,12",
  "2025-04,11",
  "2025-05,12",
  "2025-06,13",
]);

const CONTRACT_TEMPLATE = tpl([
  "条款号,名称,合同原文,审批模板,类型",
  "1.1,借款金额,100万,审批上限80万,amount",
  "2.1,年化利率,7.5%,审批上限6.5%,rate",
]);

const VOUCHER_OCR_TEMPLATE = tpl([
  "区块,坐标,识别文字,置信度,字段",
  "标题,0,业务凭证,0.98,文种",
  "借款人,0,借款人姓名,0.95,借款人",
  "金额,0,100000,0.92,本次借款金额",
]);

export const SKILL_DATA_REQUIREMENTS: Record<string, SkillDataRequirement[]> = {
  ...Object.fromEntries(DESK_METAS.map((m) => [m.skillId, m.requirements])),
  "ledger-desk": [
    {
      slot: "expense-ledger",
      label: "报销明细表",
      hint: "下载模板可直接导入试跑；也可导入公司报销导出表，列名支持别名。",
      templateCsv: EXPENSE_TEMPLATE,
      filename: "报销明细-导入模板.csv",
    },
  ],
  "sheet-desk": [
    {
      slot: "expense-ledger",
      label: "报销明细表",
      hint: "下载模板可直接导入试跑；也可导入公司报销导出表，列名支持别名。",
      templateCsv: EXPENSE_TEMPLATE,
      filename: "报销明细-导入模板.csv",
    },
  ],
  "flow-desk": [
    {
      slot: "expense-ledger",
      label: "报销明细表",
      hint: "下载模板可直接导入；或导入公司 CSV 后点继续查流程进度。",
      templateCsv: EXPENSE_TEMPLATE,
      filename: "报销明细-导入模板.csv",
    },
  ],
  "data-desk": [
    {
      slot: "cashflow-monthly",
      label: "按月经营流水",
      hint: "下载模板可直接导入；月份与流入请改成真实流水后再测算。",
      templateCsv: CASHFLOW_TEMPLATE,
      filename: "经营流水-导入模板.csv",
    },
  ],
  "contract-desk": [
    {
      slot: "contract-clauses",
      label: "合同条款对照表",
      hint: "下载模板可直接导入；每行一条条款，改合同原文与审批口径后审查。",
      templateCsv: CONTRACT_TEMPLATE,
      filename: "合同条款-导入模板.csv",
    },
  ],
  "image-desk": [
    {
      slot: "voucher-ocr-blocks",
      label: "凭证识别区块表",
      hint: "下载模板可直接导入；按 OCR 区块填写识别文字与字段映射。",
      templateCsv: VOUCHER_OCR_TEMPLATE,
      filename: "凭证区块-导入模板.csv",
    },
  ],
};

export function requirementsForSkill(skillId: string): SkillDataRequirement[] {
  return SKILL_DATA_REQUIREMENTS[skillId] ?? [];
}

export function requirementForSlot(skillId: string, slot: ProductDataSlot): SkillDataRequirement | undefined {
  return requirementsForSkill(skillId).find((r) => r.slot === slot);
}

export function missingDataForSkill(skillId: string): SkillDataRequirement[] {
  return requirementsForSkill(skillId).filter((req) => datasetRowCount(req.slot) < 1);
}

export function productSkillUsesUserData(skillId: string): boolean {
  return requirementsForSkill(skillId).length > 0;
}

export function gateQueryWithSampleData(skillId: string, query: string): string {
  let q = query.trim();
  for (const req of requirementsForSkill(skillId)) {
    q += `\n\n\`\`\`csv\n${req.templateCsv}\n\`\`\``;
  }
  return q;
}

export function allDeskTemplateRequirements(): { skillId: string; req: SkillDataRequirement }[] {
  const deskIds = ["ledger-desk", ...DESK_METAS.map((m) => m.skillId)];
  return deskIds.flatMap((skillId) => requirementsForSkill(skillId).map((req) => ({ skillId, req })));
}
