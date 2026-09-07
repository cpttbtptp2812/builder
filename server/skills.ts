/** 服务端 Skill 运行时 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbRun, nowIso } from "./db.ts";
import { ragHitsForMcp } from "./rag.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "..", "src", "skills");

function readSkillMd(id: string) {
  const p = path.join(SKILLS_DIR, id, "SKILL.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

export type SkillTraceStep = {
  stepId: string;
  label: string;
  tool: string;
  ms: number;
  ok: boolean;
  result?: unknown;
};

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  skillPath: string;
  triggers: string[];
  tools: string[];
  plan: string[];
  manifest: string;
  steps: Array<{
    id: string;
    label: string;
    tool: string;
    args: Record<string, unknown> | "dynamic";
  }>;
};

const DEFAULT_PROBE_URL = process.env.PROBE_URL ?? "https://cpttbtptp2812.github.io/builder/index.html";

export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: "site-analyzer",
    name: "site-analyzer",
    skillPath: "src/skills/site-analyzer/SKILL.md",
    description: "本站技术审计 — http_probe + DOM snapshot + Performance API",
    triggers: ["分析", "审计", "性能", "探活", "健康", "metrics", "latency", "ttfb"],
    tools: ["http_probe", "browser_snapshot"],
    plan: ["http_probe HEAD", "browser_snapshot", "Performance API", "合成指标面板"],
    manifest: readSkillMd("site-analyzer"),
    steps: [
      { id: "probe", label: "http_probe · 真实 fetch", tool: "http_probe", args: { url: DEFAULT_PROBE_URL, method: "HEAD" } },
      { id: "snapshot", label: "browser_snapshot · a11y tree", tool: "browser_snapshot", args: { compact: true } },
      { id: "perf", label: "Performance API · Navigation Timing", tool: "__perf_metrics__", args: {} },
      { id: "audit", label: "合成 Site Audit Dashboard", tool: "__compose_site_audit__", args: "dynamic" },
    ],
  },
  {
    id: "dom-probe",
    name: "dom-probe",
    skillPath: "src/skills/dom-probe/SKILL.md",
    description: "DOM 定位探针",
    triggers: ["dom", "定位", "snapshot", "a11y", "元素", "locator", "shadow"],
    tools: ["browser_snapshot"],
    plan: ["browser_snapshot 全树", "节点角色统计"],
    manifest: readSkillMd("dom-probe"),
    steps: [
      { id: "snap", label: "browser_snapshot · full tree", tool: "browser_snapshot", args: { compact: false } },
      { id: "analyze", label: "DOM 树分析", tool: "__analyze_dom_tree__", args: "dynamic" },
    ],
  },
  {
    id: "workflow-orchestrator",
    name: "workflow-orchestrator",
    skillPath: "src/skills/workflow-orchestrator/SKILL.md",
    description: "workflow 入队 + 执行面 snapshot",
    triggers: ["workflow", "自动化", "流程", "回放", "改价", "taskqueue"],
    tools: ["workflow_run", "browser_snapshot"],
    plan: ["workflow_run 入队", "browser_snapshot 执行面"],
    manifest: readSkillMd("workflow-orchestrator"),
    steps: [
      { id: "run", label: "workflow_run · cloud", tool: "workflow_run", args: { workflowId: "price-update", mode: "cloud" } },
      { id: "snap", label: "browser_snapshot 执行面", tool: "browser_snapshot", args: { compact: true } },
      { id: "summary", label: "TaskQueue 入队摘要", tool: "__compose_workflow_trace__", args: "dynamic" },
    ],
  },
];

export function getSkill(id: string) {
  return AGENT_SKILLS.find((s) => s.id === id);
}

function scoreSkill(skill: AgentSkill, q: string) {
  const breakdown: { trigger: string; points: number }[] = [];
  let score = 0;
  const hits: string[] = [];
  for (const trigger of skill.triggers) {
    const t = trigger.toLowerCase();
    if (q.includes(t)) {
      const points = t.length >= 4 ? 2 : 1;
      score += points;
      hits.push(trigger);
      breakdown.push({ trigger, points });
    }
  }
  if (skill.name.includes(q) || q.includes(skill.name)) {
    score += 3;
    hits.push(skill.name);
    breakdown.push({ trigger: `name:${skill.name}`, points: 3 });
  }
  return { skill, score, hits, breakdown };
}

export function explainDiscovery(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return AGENT_SKILLS.map((s) => ({ skill: s, score: 0, hits: [] as string[], breakdown: [] }));
  return AGENT_SKILLS.map((s) => scoreSkill(s, q)).sort((a, b) => b.score - a.score);
}

async function probeHttp(url: string, method: "GET" | "HEAD" = "GET") {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method, cache: "no-store" });
    return {
      url,
      method,
      status: res.status,
      ok: res.ok,
      latencyMs: Math.round(performance.now() - t0),
      contentType: res.headers.get("content-type"),
    };
  } catch (err) {
    return {
      url,
      method,
      ok: false,
      latencyMs: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

function analyzeDomTree(snapshot: { nodes?: { role: string }[]; nodeCount?: number } | undefined) {
  const nodes = snapshot?.nodes ?? [];
  const byRole: Record<string, number> = {};
  for (const n of nodes) {
    byRole[n.role] = (byRole[n.role] ?? 0) + 1;
  }
  const interactive = (byRole.button ?? 0) + (byRole.link ?? 0) + (byRole.textbox ?? 0);
  return {
    totalNodes: nodes.length || snapshot?.nodeCount || 0,
    byRole,
    interactive,
    density: nodes.length ? Math.round((interactive / nodes.length) * 100) : 0,
    sample: (snapshot as { nodes?: unknown[] })?.nodes?.slice?.(0, 8) ?? [],
  };
}

function persistWorkflowRun(workflowId: string, mode: string, steps: unknown[]) {
  const runId = `run-${Date.now().toString(36)}`;
  dbRun(
    `INSERT INTO workflow_runs (run_id, workflow_id, mode, status, steps_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [runId, workflowId, mode, "queued", JSON.stringify(steps), nowIso()],
  );
  return {
    workflowId,
    mode,
    status: "queued",
    runId,
    steps,
    persisted: true,
    db: "sqlite:workflow_runs",
  };
}

type ClientCtx = {
  clientSnapshot?: { nodes?: { role: string; name: string; tag: string }[]; nodeCount?: number };
  clientPerf?: Record<string, unknown>;
  probeUrl?: string;
};

async function callTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ClientCtx & { vars: Record<string, unknown> },
) {
  switch (name) {
    case "http_probe":
      return {
        content: await probeHttp(String(args.url ?? ctx.probeUrl ?? DEFAULT_PROBE_URL), (args.method as "GET" | "HEAD") ?? "HEAD"),
      };
    case "knowledge_search":
      return { content: ragHitsForMcp(String(args.query ?? ""), Number(args.topK ?? 3)) };
    case "workflow_run": {
      const steps = [{ id: "open", action: "navigate" }, { id: "click", action: "submit" }];
      return {
        content: persistWorkflowRun(String(args.workflowId ?? "price-update"), String(args.mode ?? "cloud"), steps),
      };
    }
    case "browser_snapshot":
      return {
        content: ctx.clientSnapshot ?? {
          source: "server",
          hint: "客户端未上传 snapshot，请在浏览器内运行 Skill 或传入 clientSnapshot",
          nodeCount: 0,
          nodes: [],
        },
      };
    case "__perf_metrics__":
      return { content: ctx.clientPerf ?? { source: "server", note: "Performance API 需客户端上传 clientPerf" } };
    case "__compose_site_audit__": {
      const probe = ctx.vars.probeResult as Record<string, unknown>;
      const snap = ctx.vars.snapshotResult as { nodeCount?: number; nodes?: unknown[] };
      const perf = ctx.vars.perfResult as Record<string, unknown>;
      const nodes = snap?.nodes?.length ?? snap?.nodeCount ?? 0;
      return {
        content: {
          dashboard: {
            http: probe,
            dom: { a11yNodes: nodes },
            perf,
          },
          meta: { skill: "site-analyzer", ts: Date.now(), runtime: "server" },
        },
      };
    }
    case "__analyze_dom_tree__":
      return {
        content: {
          dashboard: { domProbe: analyzeDomTree(ctx.vars.snapshotResult as ClientCtx["clientSnapshot"]) },
          meta: { skill: "dom-probe", runtime: "server" },
        },
      };
    case "__compose_workflow_trace__": {
      const wf = ctx.vars.workflowResult as Record<string, unknown>;
      const snap = ctx.vars.snapshotResult as ClientCtx["clientSnapshot"];
      return {
        content: {
          dashboard: {
            workflow: wf,
            executionSurface: { interactiveNodes: analyzeDomTree(snap).interactive },
          },
          meta: { skill: "workflow-orchestrator", runtime: "server" },
        },
      };
    }
    default:
      return { content: { error: `unknown tool: ${name}` }, isError: true as const };
  }
}

function resolveArgs(step: AgentSkill["steps"][0], ctx: { vars: Record<string, unknown> }) {
  if (step.args === "dynamic") {
    if (step.tool === "__compose_site_audit__") {
      return { probe: ctx.vars.probeResult, snapshot: ctx.vars.snapshotResult, perf: ctx.vars.perfResult };
    }
    if (step.tool === "__analyze_dom_tree__") return { snapshot: ctx.vars.snapshotResult };
    if (step.tool === "__compose_workflow_trace__") {
      return { workflow: ctx.vars.workflowResult, snapshot: ctx.vars.snapshotResult };
    }
    return {};
  }
  return step.args;
}

export async function runSkillOnServer(
  skillId: string,
  query: string,
  sessionId: string,
  clientCtx: ClientCtx = {},
) {
  const skill = getSkill(skillId);
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);

  const ctx = { vars: {} as Record<string, unknown>, ...clientCtx };
  const trace: SkillTraceStep[] = [];
  const t0 = performance.now();
  let lastResult: unknown = null;

  for (const step of skill.steps) {
    const stepT0 = performance.now();
    const args = resolveArgs(step, ctx);
    const out = await callTool(step.tool, args, ctx);

    if (step.tool === "http_probe") ctx.vars.probeResult = out.content;
    if (step.tool === "browser_snapshot") ctx.vars.snapshotResult = out.content;
    if (step.tool === "workflow_run") ctx.vars.workflowResult = out.content;
    if (step.tool === "__perf_metrics__") ctx.vars.perfResult = out.content;

    const row: SkillTraceStep = {
      stepId: step.id,
      label: step.label,
      tool: step.tool,
      ms: Math.max(1, Math.round(performance.now() - stepT0)),
      ok: !("isError" in out && out.isError),
      result: out.content,
    };
    trace.push(row);
    lastResult = out.content;
    if ("isError" in out && out.isError) break;
  }

  const totalMs = Math.max(1, Math.round(performance.now() - t0));
  const ok = trace.every((t) => t.ok);

  dbRun(
    `INSERT INTO skill_runs (session_id, skill_id, query, trace_json, ok, total_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, skillId, query, JSON.stringify(trace), ok ? 1 : 0, totalMs, nowIso()],
  );

  return {
    trace,
    output: lastResult,
    result: lastResult,
    totalMs,
    runtime: "server" as const,
  };
}

export const ROUTER_EVAL_CASES = [
  { id: "r1", query: "分析本站性能 metrics 和 latency", expectedSkillId: "site-analyzer" },
  { id: "r2", query: "DOM 结构 role 分布和交互密度", expectedSkillId: "dom-probe" },
  { id: "r3", query: "workflow 入队执行 replay", expectedSkillId: "workflow-orchestrator" },
  { id: "r4", query: "http_probe 探活健康检查", expectedSkillId: "site-analyzer" },
  { id: "r5", query: "a11y snapshot 浏览器快照", expectedSkillId: "dom-probe" },
];

export function runRouterEval() {
  return ROUTER_EVAL_CASES.map((c) => {
    const rows = explainDiscovery(c.query);
    const top = rows[0];
    return {
      ...c,
      predictedSkillId: top?.skill.id ?? null,
      predictedScore: top?.score ?? 0,
      pass: top?.skill.id === c.expectedSkillId,
      top3: rows.slice(0, 3).map((r) => ({ id: r.skill.id, score: r.score })),
    };
  });
}

export async function runSkillBenchmark(sessionId: string) {
  const traces: SkillTraceStep[][] = [];
  for (const skill of AGENT_SKILLS) {
    const { trace } = await runSkillOnServer(skill.id, "benchmark", sessionId);
    traces.push(trace);
  }
  const flat = traces.flat();
  const latencies = flat.map((t) => t.ms);
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  const okCount = flat.filter((t) => t.ok).length;
  const byTool: Record<string, { calls: number; ok: number; avgMs: number }> = {};
  for (const t of flat) {
    if (!byTool[t.tool]) byTool[t.tool] = { calls: 0, ok: 0, avgMs: 0 };
    byTool[t.tool].calls += 1;
    if (t.ok) byTool[t.tool].ok += 1;
    byTool[t.tool].avgMs += t.ms;
  }
  for (const k of Object.keys(byTool)) {
    byTool[k].avgMs = Math.round(byTool[k].avgMs / byTool[k].calls);
  }
  return {
    traces,
    metrics: {
      totalCalls: flat.length,
      successRate: flat.length ? Math.round((okCount / flat.length) * 100) : 0,
      avgMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p50Ms: p50,
      p99Ms: p99,
      byTool,
    },
  };
}
