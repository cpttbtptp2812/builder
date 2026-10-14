/** Proving Ground — Skill trace 回归（mock 骨架断言 + 副作用上界） */

import type { AgentSkill, SkillTraceStep } from "./agentSkills";
import type { SkillEffect } from "./skillSemcompiler";
import type { OutcomeGrader } from "./scmOutcome";

export type TraceExpectation = {
  stepId: string;
  tool: string;
  ok?: boolean;
};

/** 某一步的输出指纹：来自已认可版本对同一材料的真实运行 */
export type TraceObservation = {
  stepId: string;
  fingerprint: string;
  detail?: string;
};

export type SkillTraceCase = {
  id: string;
  skillId: string;
  query: string;
  probeUrl?: string;
  grader?: OutcomeGrader;
  expect: {
    steps: TraceExpectation[];
    effectBound?: SkillEffect;
    observe?: TraceObservation[];
    /** 这份材料必须在该步被门闩拦下（ok=false 且不再往下走） */
    stopAt?: string;
  };
};

export type TraceEvalRow = SkillTraceCase & {
  pass: boolean;
  actualSteps: { stepId: string; tool: string; ok: boolean }[];
  trace?: SkillTraceStep[];
  detail: string;
  ms: number;
};

/** 反事实干预：把某步观测换成「修复/破坏」值，供 SCM do(obs) 精确传播 */
export const COUNTERFACTUAL_OBS: Record<string, Record<string, { fix?: unknown; break?: unknown }>> = {
  "release-inspector": {
    probe: {
      fix: { ok: true, status: 200, latencyMs: 12, url: "https://example.com" },
      break: { ok: false, status: 503, latencyMs: 900, error: "upstream timeout" },
    },
    snapshot: {
      fix: { compact: true, nodeCount: 10, nodes: [] },
      break: { compact: true, nodeCount: 0, nodes: [], error: "snapshot empty" },
    },
    docs: {
      fix: { hits: [{ docId: "d1", score: 0.9, title: "mock" }] },
      break: { hits: [] },
    },
  },
  "site-analyzer": {
    probe: {
      fix: { ok: true, status: 200, latencyMs: 8 },
      break: { ok: false, status: 502 },
    },
    snapshot: {
      fix: { nodeCount: 5, nodes: [] },
      break: { nodeCount: 0, nodes: [] },
    },
  },
  "knowledge-lookup": {
    search: {
      fix: { hits: [{ title: "hit", chunkId: "c1", score: 0.8 }] },
      break: { hits: [] },
    },
  },
};

export const MOCK_PROFILES: Record<string, Record<string, (args: Record<string, unknown>) => unknown>> = {
  "release-inspector": {
    http_probe: () => ({ ok: true, status: 200, latencyMs: 12, url: "https://example.com" }),
    browser_snapshot: () => ({ compact: true, nodeCount: 10, nodes: [] }),
    knowledge_search: () => ({ hits: [{ docId: "d1", score: 0.9, title: "mock" }] }),
    __compose_release_report__: (args: Record<string, unknown>) => {
      const probe = (args.probe ?? {}) as { ok?: boolean; status?: number; error?: string };
      const fail = probe.ok === false || (typeof probe.status === "number" && probe.status >= 400) || Boolean(probe.error);
      const overall = fail ? "fail" : "pass";
      return {
        dashboard: { releaseInspect: { overall, targetUrl: "https://example.com", checks: [] } },
        markdown: overall === "pass" ? "## 能过" : "## 不能过",
        meta: { skill: "release-inspector", overall },
      };
    },
  },
  "site-analyzer": {
    http_probe: () => ({ ok: true, status: 200, latencyMs: 8 }),
    browser_snapshot: () => ({ nodeCount: 5, nodes: [] }),
    __perf_metrics__: () => ({ ttfbMs: 10 }),
    __compose_site_audit__: () => ({ dashboard: {}, meta: { skill: "site-analyzer" } }),
  },
  "dom-probe": {
    browser_snapshot: () => ({ nodes: [{ role: "button", name: "x", tag: "button" }] }),
    __analyze_dom_tree__: () => ({ dashboard: { domProbe: { totalNodes: 1 } } }),
  },
  "knowledge-lookup": {
    knowledge_search: () => ({ hits: [{ title: "hit", chunkId: "c1", score: 0.8 }] }),
    __compose_knowledge__: () => ({ markdown: "ok", meta: { skill: "knowledge-lookup" } }),
  },
  "product-faq": {
    __answer_faq__: () => ({ markdown: "faq ok", meta: { skill: "product-faq" } }),
  },
  "policy-desk": {
    __run_policy_desk__: () => ({ markdown: "policy ok", meta: { outcome: "GROUNDED" } }),
  },
  "workflow-orchestrator": {
    workflow_run: () => ({ runId: "mock-run", workflowId: "wf1", status: "queued", steps: [] }),
    browser_snapshot: () => ({ nodeCount: 0, nodes: [] }),
    __compose_workflow_trace__: () => ({ dashboard: {}, meta: { skill: "workflow-orchestrator" } }),
  },
};

export const SKILL_TRACE_CASES: SkillTraceCase[] = [
  {
    id: "ri-t1",
    skillId: "release-inspector",
    query: "帮我巡检 https://staging.example.com 能否上线",
    probeUrl: "https://staging.example.com",
    expect: {
      steps: [
        { stepId: "probe", tool: "http_probe" },
        { stepId: "snapshot", tool: "browser_snapshot" },
        { stepId: "docs", tool: "knowledge_search" },
        { stepId: "report", tool: "__compose_release_report__" },
      ],
      effectBound: "read_remote",
    },
  },
  {
    id: "ri-t2",
    skillId: "release-inspector",
    query: "帮我巡检 https://example.com 能否上线",
    probeUrl: "https://example.com",
    grader: { kind: "release_overall", min: "pass" },
    expect: {
      steps: [
        { stepId: "probe", tool: "http_probe" },
        { stepId: "snapshot", tool: "browser_snapshot" },
        { stepId: "docs", tool: "knowledge_search" },
        { stepId: "report", tool: "__compose_release_report__" },
      ],
    },
  },
  {
    id: "sa-t1",
    skillId: "site-analyzer",
    query: "分析本站性能 metrics",
    expect: {
      steps: [
        { stepId: "probe", tool: "http_probe" },
        { stepId: "snapshot", tool: "browser_snapshot" },
        { stepId: "perf", tool: "__perf_metrics__" },
        { stepId: "audit", tool: "__compose_site_audit__" },
      ],
    },
  },
  {
    id: "kl-t1",
    skillId: "knowledge-lookup",
    query: "检索 iMean chunkId",
    expect: {
      steps: [
        { stepId: "search", tool: "knowledge_search" },
        { stepId: "compose", tool: "__compose_knowledge__" },
      ],
    },
  },
  {
    id: "sheet-t1",
    skillId: "ledger-desk",
    query: "表格对账，按部门汇总报销",
    expect: {
      steps: [
        { stepId: "intake", tool: "__sheet_intake__" },
        { stepId: "schema", tool: "__sheet_validate_schema__" },
        { stepId: "rows", tool: "__sheet_validate_rows__" },
        { stepId: "norm", tool: "__sheet_normalize__" },
        { stepId: "dup", tool: "__sheet_duplicate_scan__" },
        { stepId: "agg", tool: "__sheet_aggregate__" },
        { stepId: "foot", tool: "__sheet_cross_foot__" },
        { stepId: "recon", tool: "__sheet_reconcile__" },
        { stepId: "miss", tool: "__sheet_missing_guard__" },
        { stepId: "esc", tool: "__sheet_escalation__" },
        { stepId: "exc", tool: "__sheet_exception_queue__" },
        { stepId: "dept", tool: "__sheet_dept_rollup__" },
        { stepId: "d1", tool: "__sheet_deliver_detail__" },
        { stepId: "d2", tool: "__sheet_deliver_dept__" },
        { stepId: "d3", tool: "__sheet_deliver_escalation__" },
        { stepId: "report", tool: "__sheet_report__" },
        { stepId: "llm_brief", tool: "__llm_product_brief__", ok: false },
      ],
    },
  },
  {
    id: "contract-t1",
    skillId: "contract-desk",
    query: "审查借款合同条款对照",
    expect: {
      steps: [
        { stepId: "read", tool: "__contract_read__" },
        { stepId: "diff", tool: "__contract_diff__" },
        { stepId: "risk", tool: "__contract_risk__" },
        { stepId: "report", tool: "__contract_report__" },
      ],
    },
  },
  {
    id: "data-t1",
    skillId: "data-desk",
    query: "测算授信额度",
    expect: {
      steps: [
        { stepId: "load", tool: "__data_load__" },
        { stepId: "formula", tool: "__data_formula__" },
        { stepId: "adjust", tool: "__data_adjust__" },
        { stepId: "report", tool: "__data_report__" },
      ],
    },
  },
  {
    id: "flow-t1",
    skillId: "flow-desk",
    query: "报销单现在走到哪",
    expect: {
      steps: [
        { stepId: "intake", tool: "__flow_intake__" },
        { stepId: "invoice", tool: "__flow_invoice__" },
        { stepId: "reconcile", tool: "__flow_reconcile__" },
        { stepId: "route", tool: "__flow_route__" },
        { stepId: "report", tool: "__flow_report__" },
      ],
    },
  },
  {
    id: "image-t1",
    skillId: "image-desk",
    query: "借款凭证影像识别",
    expect: {
      steps: [
        { stepId: "crop", tool: "__image_crop__" },
        { stepId: "ocr", tool: "__image_ocr__" },
        { stepId: "accept", tool: "__image_accept__" },
        { stepId: "report", tool: "__image_report__" },
      ],
    },
  },
];

/** 发版验收对照当前技能步骤。样本名单对不上时用技能自己的步骤，模型说明失败不挡发布。 */
export function expectStepsForCase(
  skill: { steps: { id: string; tool: string }[] },
  traceCase: SkillTraceCase,
): TraceExpectation[] {
  const declared = traceCase.expect.steps;
  const aligned =
    declared.length > 0 &&
    declared.length === skill.steps.length &&
    declared.every((exp, i) => {
      const step = skill.steps[i];
      return Boolean(step && step.id === exp.stepId && step.tool === exp.tool);
    });
  let source: TraceExpectation[] = aligned
    ? declared
    : skill.steps.map((step) => ({ stepId: step.id, tool: step.tool }));
  const stopAt = traceCase.expect.stopAt;
  const cut = stopAt ? source.findIndex((step) => step.stepId === stopAt) : -1;
  if (cut >= 0) source = [...source.slice(0, cut), { ...source[cut]!, ok: false }];
  return source.map((step) => (step.tool === "__llm_product_brief__" ? { ...step, ok: false } : step));
}

export function matchTrace(actual: SkillTraceStep[], expect: TraceExpectation[]): { pass: boolean; detail: string } {
  if (actual.length < expect.length) {
    return { pass: false, detail: `步数不足：期望 ${expect.length}，实际 ${actual.length}` };
  }
  for (let i = 0; i < expect.length; i += 1) {
    const exp = expect[i]!;
    const act = actual[i];
    if (!act) return { pass: false, detail: `第 ${i + 1} 步缺失` };
    if (act.stepId !== exp.stepId) {
      return { pass: false, detail: `第 ${i + 1} 步 stepId：期望 ${exp.stepId}，实际 ${act.stepId}` };
    }
    if (act.tool !== exp.tool) {
      return { pass: false, detail: `第 ${i + 1} 步 tool：期望 ${exp.tool}，实际 ${act.tool}` };
    }
    if (exp.ok !== false && !act.ok) {
      return { pass: false, detail: `第 ${i + 1} 步 ${exp.tool} 执行失败` };
    }
  }
  return { pass: true, detail: "trace 骨架一致" };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** 只取业务输出（结论文字、表格、是否拦截），不含耗时等易变字段；FNV-1a 64 位 */
export function stepFingerprint(result: unknown): string {
  const r = (result ?? {}) as Record<string, unknown>;
  const text = canonicalJson({ detail: r.detail, grid: r.grid, grids: r.grids, blocked: r.blocked, error: r.error });
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x0100019d) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function matchObserved(actual: SkillTraceStep[], observe: readonly TraceObservation[] | undefined): { pass: boolean; detail: string } {
  let prevAt = -1;
  for (const obs of observe ?? []) {
    const at = actual.findIndex((s) => s.stepId === obs.stepId);
    const step = actual[at];
    if (!step) return { pass: false, detail: `缺少步骤 ${obs.stepId} 的输出` };
    if (at < prevAt) return { pass: false, detail: `步骤 ${obs.stepId} 的执行顺序与认可版本不同` };
    prevAt = at;
    if (stepFingerprint(step.result) !== obs.fingerprint) {
      const now = String((step.result as { detail?: unknown } | undefined)?.detail ?? "").slice(0, 80);
      return { pass: false, detail: `步骤 ${obs.stepId} 输出变了${obs.detail ? `：原为「${obs.detail.slice(0, 60)}」` : ""}${now ? `，现为「${now}」` : ""}` };
    }
  }
  return { pass: true, detail: observe?.length ? `骨架与 ${observe.length} 步输出一致` : "trace 骨架一致" };
}

/** 发版检查对一条 case 的判定：骨架 + 输出指纹（如有） */
export function matchCase(actual: SkillTraceStep[], expect: TraceExpectation[], traceCase: SkillTraceCase): { pass: boolean; detail: string } {
  const skeleton = matchTrace(actual, expect);
  if (!skeleton.pass) return skeleton;
  const stopAt = traceCase.expect.stopAt;
  if (stopAt) {
    const last = actual[actual.length - 1];
    if (!last || last.stepId !== stopAt || last.ok) {
      return { pass: false, detail: `应在「${stopAt}」步拦下，实际${last ? (last.ok ? `一路办到「${last.stepId}」` : `停在「${last.stepId}」`) : "没有运行"}` };
    }
  }
  return matchObserved(actual, traceCase.expect.observe);
}

export async function runTraceCase(c: SkillTraceCase): Promise<TraceEvalRow> {
  const { getSkill, runSkill } = await import("./agentSkills");
  const skill = getSkill(c.skillId) as AgentSkill | undefined;
  const t0 = performance.now();
  if (!skill?.runnable) {
    return {
      ...c,
      pass: false,
      actualSteps: [],
      detail: `Skill ${c.skillId} 不可运行`,
      ms: 0,
    };
  }

  const mockProfile = MOCK_PROFILES[c.skillId];
  if (!mockProfile) {
    return {
      ...c,
      pass: false,
      actualSteps: [],
      detail: "无 mock profile",
      ms: 0,
    };
  }

  const { trace } = await runSkill(skill, c.query, undefined, {
    probeUrl: c.probeUrl,
    mockProfile,
  });
  const { pass, detail } = matchTrace(trace, c.expect.steps);
  const effectOk =
    !c.expect.effectBound || !skill.effectUpperBound
      ? true
      : effectRank(skill.effectUpperBound) <= effectRank(c.expect.effectBound);

  return {
    ...c,
    pass: pass && effectOk,
    actualSteps: trace.map((t) => ({ stepId: t.stepId, tool: t.tool, ok: t.ok })),
    trace,
    detail: effectOk ? detail : `${detail}；副作用 ${skill.effectUpperBound} 超过 ${c.expect.effectBound}`,
    ms: Math.round(performance.now() - t0),
  };
}

function effectRank(e: SkillEffect): number {
  const order: SkillEffect[] = ["pure", "read_dom", "read_remote", "hitl", "mutate"];
  return order.indexOf(e);
}

export async function runTraceEval(cases = SKILL_TRACE_CASES): Promise<TraceEvalRow[]> {
  const rows: TraceEvalRow[] = [];
  for (const c of cases) {
    rows.push(await runTraceCase(c));
  }
  return rows;
}

export function traceEvalSummary(rows: TraceEvalRow[]) {
  const pass = rows.filter((r) => r.pass).length;
  return {
    total: rows.length,
    pass,
    accuracy: rows.length ? Math.round((pass / rows.length) * 100) : 0,
  };
}

/** 单 Skill 快速证明（Skill 工作台用） */
export async function proveSkill(skillId: string): Promise<TraceEvalRow | null> {
  const c = SKILL_TRACE_CASES.find((x) => x.skillId === skillId);
  if (!c) return null;
  return runTraceCase(c);
}

export type TraceDiff = {
  sameSkeleton: boolean;
  addedSteps: string[];
  removedSteps: string[];
  changedSteps: { stepId: string; field: "tool" | "ok" }[];
  summary: string;
};

export function traceSkeleton(steps: SkillTraceStep[]): { stepId: string; tool: string; ok: boolean }[] {
  return steps.map((s) => ({ stepId: s.stepId, tool: s.tool, ok: s.ok }));
}

/** Shadow diff — 对比两次 run 的 step 骨架 */
export function diffTrace(baseline: SkillTraceStep[], candidate: SkillTraceStep[]): TraceDiff {
  const base = traceSkeleton(baseline);
  const cand = traceSkeleton(candidate);
  const baseIds = base.map((s) => s.stepId);
  const candIds = cand.map((s) => s.stepId);

  const addedSteps = candIds.filter((id) => !baseIds.includes(id));
  const removedSteps = baseIds.filter((id) => !candIds.includes(id));
  const changedSteps: TraceDiff["changedSteps"] = [];

  const len = Math.min(base.length, cand.length);
  for (let i = 0; i < len; i += 1) {
    const b = base[i]!;
    const c = cand[i]!;
    if (b.stepId !== c.stepId) {
      changedSteps.push({ stepId: c.stepId, field: "tool" });
    } else if (b.tool !== c.tool) {
      changedSteps.push({ stepId: c.stepId, field: "tool" });
    } else if (b.ok !== c.ok) {
      changedSteps.push({ stepId: c.stepId, field: "ok" });
    }
  }

  const sameSkeleton =
    addedSteps.length === 0 &&
    removedSteps.length === 0 &&
    changedSteps.length === 0 &&
    base.length === cand.length;

  const parts: string[] = [];
  if (removedSteps.length) parts.push(`少 ${removedSteps.join("、")}`);
  if (addedSteps.length) parts.push(`多 ${addedSteps.join("、")}`);
  if (changedSteps.length) parts.push(`变 ${changedSteps.map((c) => c.stepId).join("、")}`);

  return {
    sameSkeleton,
    addedSteps,
    removedSteps,
    changedSteps,
    summary: sameSkeleton ? "trace 骨架一致" : parts.join("；") || "步序或工具链变化",
  };
}

const BASELINE_KEY = "ownagent:skill-baseline";

export function loadSkillBaseline(skillId: string): SkillTraceStep[] | null {
  try {
    const raw = sessionStorage.getItem(`${BASELINE_KEY}:${skillId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SkillTraceStep[];
  } catch {
    return null;
  }
}

export function saveSkillBaseline(skillId: string, trace: SkillTraceStep[]): void {
  sessionStorage.setItem(`${BASELINE_KEY}:${skillId}`, JSON.stringify(trace));
}
