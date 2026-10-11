/**
 * 合同审查办事程序 — 契约、条款分类守卫、对照、风险矩阵、签批守卫、多表交付。
 */

import {
  contractPolicyFromArgs,
  type ContractPolicy,
} from "./contractEngine";
import { ProductDataMissingError } from "./productDataStore";
import { tableFromEmbedded, type WorkGrid } from "./sheetEngine";
import { workbenchSheetTable } from "./workbenchDataset";

export type ContractProgramPolicy = ContractPolicy & {
  requireColumns: string[];
  /** 必须出现的条款类型（kind），缺则 schema 守卫失败 */
  requireKinds: string[];
  /** 存在「高」风险时是否 failFast 禁止出签批 */
  blockOnHigh: boolean;
};

export type ClauseRow = { id: string; name: string; contract: string; template: string; kind: string };

export type JudgedClause = ClauseRow & { level: "高" | "中" | "低" | "通过"; advice: string; rateGap: number | null };

export type ContractProgramState = {
  policy: ContractProgramPolicy;
  clauses: ClauseRow[];
  judged: JudgedClause[];
  schemaOk: boolean;
  schemaIssues: string[];
  kindsOk: boolean;
  missingKinds: string[];
  blocked: boolean;
  summary: string;
  clauseGrid: WorkGrid;
  riskGrid: WorkGrid;
  remediationGrid: WorkGrid;
  signoffGrid: WorkGrid;
};

const DEFAULT_REQUIRE_KINDS = ["amount", "rate"];

export function contractProgramPolicyFromArgs(args: Record<string, unknown> | undefined): ContractProgramPolicy {
  const base = contractPolicyFromArgs(args);
  const requireRaw = args?.requireColumns;
  const requireColumns = Array.isArray(requireRaw)
    ? requireRaw.map(String)
    : typeof requireRaw === "string"
      ? requireRaw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
      : ["条款号", "名称", "合同原文", "审批模板", "类型"];
  const kindsRaw = args?.requireKinds;
  const requireKinds = Array.isArray(kindsRaw)
    ? kindsRaw.map(String)
    : typeof kindsRaw === "string"
      ? kindsRaw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
      : DEFAULT_REQUIRE_KINDS;
  return {
    ...base,
    requireColumns,
    requireKinds,
    blockOnHigh: args?.blockOnHigh !== false && args?.blockOnHigh !== "false",
  };
}

function clausesFromTable(table: import("./sheetEngine").SheetTable): ClauseRow[] {
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
    kind: String(row[kindK] ?? "other").trim().toLowerCase(),
  }));
}

function resolveClauses(productWorkbench: boolean, query: string, sessionId?: string): ClauseRow[] {
  if (productWorkbench) {
    const fromSlot = workbenchSheetTable(sessionId, "contract-clauses");
    if (fromSlot?.rows.length) return clausesFromTable(fromSlot);
    const embedded = tableFromEmbedded(query);
    if (embedded?.rows.length) return clausesFromTable(embedded);
    throw new ProductDataMissingError("contract-clauses", "请先导入合同条款对照表后再执行审查。");
  }
  const embedded = tableFromEmbedded(query);
  if (embedded?.rows.length) return clausesFromTable(embedded);
  throw new ProductDataMissingError(
    "contract-clauses",
    "请先导入合同条款对照表，或在问句中用 ```csv 附上条款表后再执行。",
  );
}

function validateSchema(table: import("./sheetEngine").SheetTable | null, requireColumns: string[]): string[] {
  if (!table?.rows.length) return ["没有条款数据"];
  const have = new Set(table.columns.map((c) => c.name));
  const issues: string[] = [];
  for (const need of requireColumns) {
    if (![...have].some((h) => h.includes(need) || need.includes(h))) issues.push(`缺列「${need}」`);
  }
  return issues;
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

function levelOf(clause: ClauseRow, policy: ContractProgramPolicy): { level: JudgedClause["level"]; rateGap: number | null } {
  const kind = clause.kind;
  const rateGap = kind === "rate" ? parseRateGap(clause.contract, clause.template) : null;
  if (kind === "amount" && clause.contract.trim() !== clause.template.trim()) return { level: "高", rateGap };
  if (kind === "rate") {
    if (rateGap != null && rateGap > policy.rateTolerance) return { level: "高", rateGap };
    if (clause.contract.trim() !== clause.template.trim() && rateGap == null) {
      return { level: policy.strict ? "高" : "中", rateGap };
    }
    return { level: "通过", rateGap };
  }
  if (kind === "appraisal") {
    const days = parseAppraisalDays(clause.contract);
    if (days != null && days > policy.appraisalDays) return { level: policy.strict ? "高" : "低", rateGap: null };
    return { level: "通过", rateGap: null };
  }
  if (kind === "term" || kind === "repay" || kind === "penalty") {
    return {
      level: clause.contract.trim() !== clause.template.trim() ? (policy.strict ? "高" : "中") : "通过",
      rateGap: null,
    };
  }
  if (clause.contract.trim() !== clause.template.trim()) return { level: policy.strict ? "中" : "低", rateGap: null };
  return { level: "通过", rateGap: null };
}

function advice(kind: string, level: string): string {
  if (level === "通过") return "保持";
  if (kind === "amount") return "与审批额度对齐后再签";
  if (kind === "term") return "与审批期限对齐";
  if (kind === "rate") return "利率回到审批区间";
  if (kind === "repay") return "还款方式与审批一致";
  if (kind === "penalty") return "补全违约金计算基数";
  if (kind === "appraisal") return "评估报告在有效期内";
  return "修改后再签";
}

export function buildContractProgramState(
  query: string,
  policy: ContractProgramPolicy,
  productWorkbench: boolean,
  sessionId?: string,
): ContractProgramState {
  let table: import("./sheetEngine").SheetTable | null = null;
  try {
    if (productWorkbench) {
      table = workbenchSheetTable(sessionId, "contract-clauses") ?? tableFromEmbedded(query);
    } else {
      table = tableFromEmbedded(query);
    }
  } catch {
    table = null;
  }

  const schemaIssues = validateSchema(table, policy.requireColumns);
  const schemaOk = schemaIssues.length === 0;
  const clauses = schemaOk ? resolveClauses(productWorkbench, query, sessionId) : [];
  const presentKinds = new Set(clauses.map((c) => c.kind));
  const missingKinds = policy.requireKinds.filter((k) => !presentKinds.has(k.toLowerCase()));
  const kindsOk = missingKinds.length === 0;

  const judged: JudgedClause[] = clauses.map((clause) => {
    const { level, rateGap } = levelOf(clause, policy);
    return { ...clause, level, advice: advice(clause.kind, level), rateGap };
  });

  const high = judged.filter((j) => j.level === "高");
  const blocked = !schemaOk || !kindsOk || (policy.blockOnHigh && high.length > 0);

  const summary = !schemaOk
    ? `表结构未通过：${schemaIssues.join("；")}。`
    : !kindsOk
      ? `缺必需条款类型：${missingKinds.join("、")}。`
      : high.length
        ? `${judged.length} 条中 ${high.length} 条高风险：${high.map((h) => h.name).join("、")}。${policy.blockOnHigh ? "暂不可签。" : "可附条件签。"}`
        : judged.some((j) => j.level !== "通过")
          ? `共 ${judged.length} 条，${judged.filter((j) => j.level !== "通过").length} 条需关注。`
          : `${judged.length} 条与审批模板一致，可以签。`;

  const clauseGrid: WorkGrid = {
    columns: ["条款", "类型", "合同原文", "审批/模板", "风险", "建议"],
    rows: judged.map((row) => [`${row.id} ${row.name}`, row.kind, row.contract, row.template, row.level, row.advice]),
  };
  const riskGrid: WorkGrid = {
    columns: ["风险", "条数", "条款"],
    rows: (["高", "中", "低", "通过"] as const).map((level) => {
      const rows = judged.filter((j) => j.level === level);
      return [level, String(rows.length), rows.map((r) => r.name).join("、") || "—"];
    }),
  };
  const remediationGrid: WorkGrid = {
    columns: ["条款", "风险", "合同现状", "应对"],
    rows: judged
      .filter((j) => j.level !== "通过")
      .map((j) => [j.name, j.level, j.contract, j.advice]),
  };
  const signoffGrid: WorkGrid = {
    columns: ["项", "结论"],
    rows: [
      ["条款条数", String(judged.length)],
      ["高风险", String(high.length)],
      ["签批", blocked ? "暂缓" : high.length ? "附条件" : "可签"],
      ["严格模式", policy.strict ? "是" : "否"],
      ["利率容差", `${policy.rateTolerance}%`],
      ["评估时效", `${policy.appraisalDays} 天`],
    ],
  };

  return {
    policy,
    clauses,
    judged,
    schemaOk,
    schemaIssues,
    kindsOk,
    missingKinds,
    blocked,
    summary,
    clauseGrid,
    riskGrid,
    remediationGrid,
    signoffGrid,
  };
}

type ContractPhaseId =
  | "intake"
  | "validate_schema"
  | "validate_kinds"
  | "read"
  | "normalize"
  | "diff"
  | "rate_pass"
  | "appraisal_pass"
  | "risk_score"
  | "block_sign"
  | "deliver_clauses"
  | "deliver_risk"
  | "deliver_remediation"
  | "deliver_signoff"
  | "report"
  | "read_legacy"
  | "diff_legacy"
  | "risk_legacy";

function phasePayload(state: ContractProgramState, phase: ContractPhaseId): {
  detail: string;
  grid?: WorkGrid;
  guardFailed?: boolean;
  markdown?: string;
} {
  const j = state.judged;
  switch (phase) {
    case "intake":
      return { detail: `读入条款对照表，待审 ${state.clauses.length || "—"} 条。` };
    case "validate_schema":
      return {
        detail: state.schemaOk ? `契约通过：${state.policy.requireColumns.join("、")}。` : `契约失败：${state.schemaIssues.join("；")}。`,
        guardFailed: !state.schemaOk,
      };
    case "validate_kinds":
      return {
        detail: state.kindsOk
          ? `必需类型 ${state.policy.requireKinds.join("、")} 均已出现。`
          : `缺类型：${state.missingKinds.join("、")}。`,
        guardFailed: !state.kindsOk,
      };
    case "read":
    case "read_legacy":
      return {
        detail: j.length
          ? `抽出 ${j.length} 条：${j.slice(0, 5).map((r) => `${r.name}(${r.kind})`).join("；")}${j.length > 5 ? "…" : ""}。`
          : "无条款可读。",
      };
    case "normalize":
      return { detail: `类型已规范为小写；strict=${state.policy.strict ? "开" : "关"}。` };
    case "diff":
    case "diff_legacy":
      return {
        detail: j.map((r) => `${r.name}：「${r.contract}」↔「${r.template}」`).join("；") + (j.length ? "。" : ""),
        grid: state.clauseGrid,
      };
    case "rate_pass": {
      const rates = j.filter((r) => r.kind === "rate");
      const bad = rates.filter((r) => r.level !== "通过");
      return {
        detail: rates.length
          ? `利率条款 ${rates.length} 条，容差 ${state.policy.rateTolerance}%：${bad.length ? bad.map((b) => `${b.name}${b.level}`).join("、") : "均在容差内"}。`
          : "无 rate 类型条款。",
      };
    }
    case "appraisal_pass": {
      const ap = j.filter((r) => r.kind === "appraisal");
      const bad = ap.filter((r) => r.level !== "通过");
      return {
        detail: ap.length
          ? `评估时效线 ${state.policy.appraisalDays} 天：${bad.length ? bad.map((b) => b.name).join("、") : "均在有效期内"}。`
          : "无 appraisal 类型条款。",
      };
    }
    case "risk_score":
    case "risk_legacy":
      return {
        detail: `高 ${j.filter((x) => x.level === "高").length} · 中 ${j.filter((x) => x.level === "中").length} · 低 ${j.filter((x) => x.level === "低").length} · 通过 ${j.filter((x) => x.level === "通过").length}。`,
        grid: state.riskGrid,
      };
    case "block_sign":
      return {
        detail: state.blocked
          ? state.policy.blockOnHigh && j.some((x) => x.level === "高")
            ? "存在高风险且 blockOnHigh 开启，签批守卫：暂缓。"
            : "守卫未通过，暂缓签批。"
          : "签批守卫通过。",
        guardFailed: state.blocked && state.policy.blockOnHigh,
      };
    case "deliver_clauses":
      return { detail: "交付：条款对照全表。", grid: state.clauseGrid };
    case "deliver_risk":
      return { detail: "交付：风险分布矩阵。", grid: state.riskGrid };
    case "deliver_remediation":
      return { detail: "交付：整改清单。", grid: state.remediationGrid };
    case "deliver_signoff":
      return { detail: "交付：签批摘要。", grid: state.signoffGrid };
    case "report":
      return { detail: state.summary, markdown: `结论：${state.summary}`, grid: state.clauseGrid };
    default:
      return { detail: state.summary };
  }
}

const TOOL_PHASE: Record<string, ContractPhaseId> = {
  __contract_intake__: "intake",
  __contract_validate_schema__: "validate_schema",
  __contract_validate_kinds__: "validate_kinds",
  __contract_read__: "read",
  __contract_normalize__: "normalize",
  __contract_diff__: "diff",
  __contract_rate_pass__: "rate_pass",
  __contract_appraisal_pass__: "appraisal_pass",
  __contract_risk__: "risk_score",
  __contract_block_sign__: "block_sign",
  __contract_deliver_clauses__: "deliver_clauses",
  __contract_deliver_risk__: "deliver_risk",
  __contract_deliver_remediation__: "deliver_remediation",
  __contract_deliver_signoff__: "deliver_signoff",
  __contract_report__: "report",
};

export function runContractTool(name: string, args: Record<string, unknown>): { content: unknown; isError?: boolean } | null {
  const phaseId = TOOL_PHASE[name];
  if (!phaseId) return null;
  const productWorkbench = args.__productWorkbench === true;
  const failFast = args.failFast === true || args.guard === "fail";
  try {
    const policy = contractProgramPolicyFromArgs(args);
    const state = buildContractProgramState(
      String(args.query ?? ""),
      policy,
      productWorkbench,
      typeof args.__sessionId === "string" ? args.__sessionId : undefined,
    );
    const payload = phasePayload(state, phaseId);
    if (payload.guardFailed && failFast) {
      return {
        content: { error: payload.detail, code: "CONTRACT_GUARD", detail: payload.detail, meta: { skill: "contract-desk" } },
        isError: true,
      };
    }
    const isReport = name === "__contract_report__";
    return {
      content: {
        markdown: isReport ? payload.markdown ?? payload.detail : payload.detail,
        detail: payload.detail,
        summary: state.summary,
        blocked: state.blocked,
        dashboard: { contract: { phase: phaseId, summary: state.summary, blocked: state.blocked } },
        meta: { skill: "contract-desk", phase: phaseId },
        grid: payload.grid ?? (isReport ? state.clauseGrid : undefined),
        grids: {
          clauses: state.clauseGrid,
          risk: state.riskGrid,
          remediation: state.remediationGrid,
          signoff: state.signoffGrid,
        },
      },
    };
  } catch (err) {
    if (err instanceof ProductDataMissingError) {
      return { content: { error: err.message, code: "PRODUCT_DATA_MISSING", slot: err.slot }, isError: true };
    }
    if (err instanceof Error) {
      return { content: { error: err.message }, isError: true };
    }
    throw err;
  }
}
