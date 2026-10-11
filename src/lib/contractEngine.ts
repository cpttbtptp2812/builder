/** 借款合同审查：逐条对照审批模板，标出金额、期限、利率、还款、违约金和评估时效。 */

import { datasetToSheetTable, getProductDataset, ProductDataMissingError } from "./productDataStore";
import { workbenchSheetTable } from "./workbenchDataset";
import { tableFromEmbedded, type WorkGrid } from "./sheetEngine";

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

type ClauseRow = { id: string; name: string; contract: string; template: string; kind: string };

function clausesFromProductImport(): ClauseRow[] {
  const ds = getProductDataset("contract-clauses");
  if (!ds?.rows.length) {
    throw new ProductDataMissingError("contract-clauses", "请先导入合同条款对照表后再执行审查。");
  }
  const table = datasetToSheetTable(ds);
  const col = (names: string[]) => table.columns.find((c) => names.some((n) => c.name.includes(n)))?.name;
  const idK = col(["条款号", "条款", "id"]) ?? table.columns[0]?.name ?? "条款号";
  const nameK = col(["名称", "name"]) ?? "名称";
  const contractK = col(["合同原文", "合同"]) ?? "合同原文";
  const templateK = col(["审批", "模板"]) ?? "审批模板";
  const kindK = col(["类型", "kind"]) ?? "类型";
  return table.rows.map((row, i) => ({
    id: String(row[idK] ?? i + 1),
    name: String(row[nameK] ?? `条款${i + 1}`),
    contract: String(row[contractK] ?? ""),
    template: String(row[templateK] ?? ""),
    kind: String(row[kindK] ?? "other"),
  }));
}

function clausesFromEmbeddedQuery(query: string): ClauseRow[] | null {
  const table = tableFromEmbedded(query);
  if (!table?.rows.length) return null;
  const col = (names: string[]) => table.columns.find((c) => names.some((n) => c.name.includes(n)))?.name;
  const idK = col(["条款号", "条款", "id"]) ?? table.columns[0]?.name ?? "条款号";
  const nameK = col(["名称", "name"]) ?? "名称";
  const contractK = col(["合同原文", "合同"]) ?? "合同原文";
  const templateK = col(["审批", "模板"]) ?? "审批模板";
  const kindK = col(["类型", "kind"]) ?? "类型";
  return table.rows.map((row, i) => ({
    id: String(row[idK] ?? i + 1),
    name: String(row[nameK] ?? `条款${i + 1}`),
    contract: String(row[contractK] ?? ""),
    template: String(row[templateK] ?? ""),
    kind: String(row[kindK] ?? "other"),
  }));
}

function resolveClauses(productWorkbench: boolean, query?: string, sessionId?: string): ClauseRow[] {
  if (productWorkbench) {
    const fromSlot = workbenchSheetTable(sessionId, "contract-clauses");
    if (fromSlot?.rows.length) {
      return fromSlot.rows.map((row, i) => {
        const col = (names: string[]) => fromSlot.columns.find((c) => names.some((n) => c.name.includes(n)))?.name;
        const idK = col(["条款号", "条款", "id"]) ?? fromSlot.columns[0]?.name ?? "条款号";
        const nameK = col(["名称", "name"]) ?? "名称";
        const contractK = col(["合同原文", "合同"]) ?? "合同原文";
        const templateK = col(["审批", "模板"]) ?? "审批模板";
        const kindK = col(["类型", "kind"]) ?? "类型";
        return {
          id: String(row[idK] ?? i + 1),
          name: String(row[nameK] ?? `条款${i + 1}`),
          contract: String(row[contractK] ?? ""),
          template: String(row[templateK] ?? ""),
          kind: String(row[kindK] ?? "other"),
        };
      });
    }
    const embedded = query ? clausesFromEmbeddedQuery(query) : null;
    if (embedded?.length) return embedded;
    throw new ProductDataMissingError("contract-clauses", "请先导入合同条款对照表后再执行审查。");
  }
  const embedded = query ? clausesFromEmbeddedQuery(query) : null;
  if (embedded?.length) return embedded;
  throw new ProductDataMissingError("contract-clauses", "请先导入合同条款对照表，或在问句中用 ```csv 附上条款表后再执行。");
}

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

function parseAppraisalDays(text: string): number | null {
  const m = text.match(/(\d+)\s*天/);
  return m ? Number(m[1]) : null;
}

function parseRateGap(contract: string, template: string): number | null {
  const pick = (s: string) => {
    const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Number(m[1]) : null;
  };
  const a = pick(contract);
  const b = pick(template);
  if (a == null || b == null) return null;
  return Math.abs(a - b);
}

function levelOf(clause: ClauseRow, policy: ContractPolicy): "高" | "中" | "低" | "通过" {
  const kind = clause.kind;
  if (kind === "amount" && clause.contract.trim() !== clause.template.trim()) return "高";
  if (kind === "rate") {
    const gap = parseRateGap(clause.contract, clause.template);
    if (gap != null && gap > policy.rateTolerance) return "高";
    if (clause.contract.trim() !== clause.template.trim() && gap == null) return policy.strict ? "高" : "中";
    return "通过";
  }
  if (kind === "appraisal") {
    const days = parseAppraisalDays(clause.contract);
    if (days != null && days > policy.appraisalDays) return policy.strict ? "高" : "低";
    return "通过";
  }
  if (kind === "term" || kind === "repay" || kind === "penalty") {
    return clause.contract.trim() !== clause.template.trim() ? (policy.strict ? "高" : "中") : "通过";
  }
  if (clause.contract.trim() !== clause.template.trim()) return policy.strict ? "中" : "低";
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

export function executeContract(
  policy: ContractPolicy = DEFAULT_POLICY,
  opts?: { productWorkbench?: boolean; query?: string; sessionId?: string },
): ContractExecution {
  const clauses = resolveClauses(Boolean(opts?.productWorkbench), opts?.query, opts?.sessionId);
  const judged = clauses.map((clause) => {
    const level = levelOf(clause, policy);
    return { ...clause, level, advice: advice(clause.kind, level) };
  });
  const blocked = judged.filter((row) => row.level === "高");
  const grid: WorkGrid = {
    columns: ["条款", "合同原文", "审批/模板", "风险", "建议"],
    rows: judged.map((row) => [`${row.id} ${row.name}`, row.contract, row.template, row.level, row.advice]),
  };
  const summary = blocked.length
    ? `合同有 ${blocked.length} 条高风险：${blocked.map((row) => row.name).join("、")}。改完再签。`
    : judged.some((row) => row.level !== "通过")
      ? `共 ${judged.length} 条，${judged.filter((r) => r.level !== "通过").length} 条需关注。`
      : "条款和审批模板一致，可以签。";
  const readDetail = judged.slice(0, 4).map((r) => `${r.name} ${r.contract}`).join("；") || "已读入导入条款。";
  const phases: ContractPhase[] = [
    { id: "read", label: "抽要素", detail: `从导入表读出 ${judged.length} 条：${readDetail}。` },
    { id: "diff", label: "对照模板", detail: judged.map((r) => `${r.name}：合同「${r.contract}」↔ 模板「${r.template}」`).join("；") + "。" },
    { id: "risk", label: "标风险", detail: judged.map((row) => `${row.name}${row.level}`).join("、") + "。" },
    { id: "report", label: "审查意见", detail: summary },
  ];
  const markdown = `结论：${summary}`;
  return { policy, phases, summary, markdown, grid };
}

export { runContractTool } from "./contractDeskProgram";
