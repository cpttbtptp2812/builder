/** 借款合同审查：逐条对照审批模板，标出金额、期限、利率、还款、违约金和评估时效。 */

import type { WorkGrid } from "./sheetEngine";

export type ContractPolicy = {
  rateTolerance: number;
  appraisalDays: number;
  strict: boolean;
};

export type ContractPhase = { id: string; label: string; detail: string };

export type ContractExecution = {
  policy: ContractPolicy;
  phases: ContractPhase[];
  summary: string;
  markdown: string;
  grid: WorkGrid;
};

const DEFAULT_POLICY: ContractPolicy = { rateTolerance: 0.5, appraisalDays: 180, strict: false };

const CLAUSES: { id: string; name: string; contract: string; template: string; kind: string }[] = [
  { id: "1.2", name: "借款金额", contract: "30万", template: "审批 50万", kind: "amount" },
  { id: "1.3", name: "借款期限", contract: "24个月", template: "模板 36个月", kind: "term" },
  { id: "2.1", name: "年化利率", contract: "8.5%", template: "审批 6.2%", kind: "rate" },
  { id: "3.1", name: "还款方式", contract: "按月付息到期还本", template: "等额本息", kind: "repay" },
  { id: "8", name: "提前还款违约金", contract: "未写计算基数", template: "剩余本金的 1%", kind: "penalty" },
  { id: "附", name: "评估报告", contract: "出具已 210 天", template: "须在有效期内", kind: "appraisal" },
];

export function contractPolicyFromArgs(args: Record<string, unknown> | undefined): ContractPolicy {
  const rateTolerance = Number(args?.rateTolerance ?? DEFAULT_POLICY.rateTolerance);
  const appraisalDays = Number(args?.appraisalDays ?? DEFAULT_POLICY.appraisalDays);
  return {
    rateTolerance: Number.isFinite(rateTolerance) ? rateTolerance : DEFAULT_POLICY.rateTolerance,
    appraisalDays: Number.isFinite(appraisalDays) ? appraisalDays : DEFAULT_POLICY.appraisalDays,
    strict: args?.strict === true || args?.strict === "true",
  };
}

export function contractPolicyFromSteps(steps: { tool: string; args?: Record<string, unknown> }[]): ContractPolicy | null {
  const mine = steps.filter((step) => step.tool.startsWith("__contract_"));
  if (!mine.length) return null;
  return mine.reduce((policy, step) => ({ ...policy, ...contractPolicyFromArgs(step.args) }), { ...DEFAULT_POLICY });
}

function levelOf(kind: string, policy: ContractPolicy): "高" | "中" | "低" | "通过" {
  if (kind === "amount") return "高";
  if (kind === "rate") return 2.3 > policy.rateTolerance ? "高" : "通过";
  if (kind === "appraisal") return 210 > policy.appraisalDays ? (policy.strict ? "高" : "低") : "通过";
  if (kind === "term" || kind === "repay" || kind === "penalty") return policy.strict ? "高" : "中";
  return "通过";
}

function advice(kind: string, level: string): string {
  if (level === "通过") return "保持";
  if (kind === "amount") return "改回审批额度 50万";
  if (kind === "term") return "改回 36 个月";
  if (kind === "rate") return "改回审批利率 6.2%";
  if (kind === "repay") return "改成等额本息";
  if (kind === "penalty") return "写明按剩余本金的 1%";
  if (kind === "appraisal") return "重新评估后再质押";
  return "修改后再签";
}

export function executeContract(policy: ContractPolicy = DEFAULT_POLICY): ContractExecution {
  const judged = CLAUSES.map((clause) => {
    const level = levelOf(clause.kind, policy);
    return { ...clause, level, advice: advice(clause.kind, level) };
  });
  const blocked = judged.filter((row) => row.level === "高");
  const grid: WorkGrid = {
    columns: ["条款", "合同原文", "审批/模板", "风险", "建议"],
    rows: judged.map((row) => [`${row.id} ${row.name}`, row.contract, row.template, row.level, row.advice]),
  };
  const summary = blocked.length
    ? `合同有 ${blocked.length} 条高风险：${blocked.map((row) => row.name).join("、")}。改完再签。`
    : "条款和审批模板一致，可以签。";
  const phases: ContractPhase[] = [
    { id: "read", label: "抽要素", detail: "读出金额 30万、期限 24个月、利率 8.5%、还款方式、违约金、评估日期。" },
    { id: "diff", label: "对照模板", detail: "金额对审批 50万，期限对 36个月，利率对 6.2%，还款对等额本息。" },
    { id: "risk", label: "标风险", detail: judged.map((row) => `${row.name}${row.level}`).join("、") + "。" },
    { id: "report", label: "审查意见", detail: summary },
  ];
  const markdown = `结论：${summary}`;
  return { policy, phases, summary, markdown, grid };
}

const PHASE_INDEX: Record<string, number> = {
  __contract_read__: 0,
  __contract_diff__: 1,
  __contract_risk__: 2,
  __contract_report__: 3,
};

export function runContractTool(name: string, args: Record<string, unknown>): { content: unknown } | null {
  const index = PHASE_INDEX[name];
  if (index == null) return null;
  const ran = executeContract(contractPolicyFromArgs(args));
  const phase = ran.phases[index]!;
  return {
    content: {
      markdown: name === "__contract_report__" ? ran.markdown : phase.detail,
      detail: phase.detail,
      summary: ran.summary,
      dashboard: { contract: { phase: phase.id, summary: ran.summary } },
      meta: { skill: "contract-desk" },
    },
  };
}
