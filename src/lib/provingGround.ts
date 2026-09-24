/** Proving Ground — Skill trace 回归（mock 骨架断言 + 副作用上界） */

import type { AgentSkill, SkillTraceStep } from "./agentSkills";
import type { SkillEffect } from "./skillSemcompiler";

export type TraceExpectation = {
  stepId: string;
  tool: string;
  ok?: boolean;
};

export type SkillTraceCase = {
  id: string;
  skillId: string;
  query: string;
  probeUrl?: string;
  expect: {
    steps: TraceExpectation[];
    effectBound?: SkillEffect;
  };
};

export type TraceEvalRow = SkillTraceCase & {
  pass: boolean;
  actualSteps: { stepId: string; tool: string; ok: boolean }[];
  detail: string;
  ms: number;
};

export const MOCK_PROFILES: Record<string, Record<string, (args: Record<string, unknown>) => unknown>> = {
  "release-inspector": {
    http_probe: () => ({ ok: true, status: 200, latencyMs: 12, url: "https://example.com" }),
    browser_snapshot: () => ({ compact: true, nodeCount: 10, nodes: [] }),
    knowledge_search: () => ({ hits: [{ docId: "d1", score: 0.9, title: "mock" }] }),
    __compose_release_report__: () => ({ markdown: "## Pass", meta: { skill: "release-inspector" } }),
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
];

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
