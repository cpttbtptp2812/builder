/** Eval Ops — Skill Router 回归 + 工具链路指标 */

import { AGENT_SKILLS, explainDiscovery, runSkill, getSkill } from "./agentSkills";
import type { SkillTraceStep } from "./agentSkills";

export type RouterEvalCase = {
  id: string;
  query: string;
  expectedSkillId: string;
  note?: string;
};

export type RouterEvalRow = RouterEvalCase & {
  predictedSkillId: string | null;
  predictedScore: number;
  pass: boolean;
  top3: { id: string; score: number }[];
};

export type ToolMetrics = {
  totalCalls: number;
  successRate: number;
  avgMs: number;
  p50Ms: number;
  p99Ms: number;
  byTool: Record<string, { calls: number; ok: number; avgMs: number }>;
};

export const ROUTER_EVAL_CASES: RouterEvalCase[] = [
  { id: "r1", query: "分析本站性能 metrics 和 latency", expectedSkillId: "site-analyzer", note: "性能审计" },
  { id: "r2", query: "DOM 结构 role 分布和交互密度", expectedSkillId: "dom-probe", note: "DOM 探针" },
  { id: "r3", query: "workflow 入队执行 replay", expectedSkillId: "workflow-orchestrator", note: "流程编排" },
  { id: "r4", query: "http_probe 探活健康检查", expectedSkillId: "site-analyzer", note: "探活 → 审计 Skill" },
  { id: "r5", query: "a11y snapshot 浏览器快照", expectedSkillId: "dom-probe", note: "快照 → DOM Skill" },
];

export function runRouterEval(): RouterEvalRow[] {
  return ROUTER_EVAL_CASES.map((c) => {
    const rows = explainDiscovery(c.query);
    const top = rows[0];
    const predictedSkillId = top?.skill.id ?? null;
    return {
      ...c,
      predictedSkillId,
      predictedScore: top?.score ?? 0,
      pass: predictedSkillId === c.expectedSkillId,
      top3: rows.slice(0, 3).map((r) => ({ id: r.skill.id, score: r.score })),
    };
  });
}

export function routerEvalSummary(rows: RouterEvalRow[]) {
  const pass = rows.filter((r) => r.pass).length;
  return {
    total: rows.length,
    pass,
    accuracy: rows.length ? Math.round((pass / rows.length) * 100) : 0,
    avgScore: rows.length ? Math.round((rows.reduce((s, r) => s + r.predictedScore, 0) / rows.length) * 100) / 100 : 0,
  };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

export function aggregateToolMetrics(traces: SkillTraceStep[][]): ToolMetrics {
  const flat = traces.flat();
  const latencies = flat.map((t) => t.ms);
  const byTool: ToolMetrics["byTool"] = {};

  for (const t of flat) {
    if (!byTool[t.tool]) byTool[t.tool] = { calls: 0, ok: 0, avgMs: 0 };
    byTool[t.tool].calls += 1;
    if (t.ok) byTool[t.tool].ok += 1;
    byTool[t.tool].avgMs += t.ms;
  }
  for (const tool of Object.keys(byTool)) {
    byTool[tool].avgMs = Math.round(byTool[tool].avgMs / byTool[tool].calls);
  }

  const okCount = flat.filter((t) => t.ok).length;
  return {
    totalCalls: flat.length,
    successRate: flat.length ? Math.round((okCount / flat.length) * 100) : 0,
    avgMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    p50Ms: percentile(latencies, 50),
    p99Ms: percentile(latencies, 99),
    byTool,
  };
}

/** 跑一遍全 Skill 流水线采样工具指标（浏览器内） */
export async function runSkillBenchmark(): Promise<{ traces: SkillTraceStep[][]; metrics: ToolMetrics }> {
  const traces: SkillTraceStep[][] = [];
  const sampleQuery = "platform lab benchmark";

  for (const skill of AGENT_SKILLS) {
    const s = getSkill(skill.id);
    if (!s) continue;
    const { trace } = await runSkill(s, sampleQuery);
    traces.push(trace);
  }

  return { traces, metrics: aggregateToolMetrics(traces) };
}

export function listSkillCoverage() {
  return AGENT_SKILLS.map((s) => ({
    id: s.id,
    tools: s.tools,
    triggerCount: s.triggers.length,
    stepCount: s.steps.length,
  }));
}
