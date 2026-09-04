/** Agent Skills — 技术向 Skill 注册表 + 流水线运行时 */

import { mcpServer } from "./mcpServer";

import domProbeMd from "../skills/dom-probe/SKILL.md?raw";
import siteAnalyzerMd from "../skills/site-analyzer/SKILL.md?raw";
import skillRouterMd from "../skills/skill-router/SKILL.md?raw";
import workflowOrchestratorMd from "../skills/workflow-orchestrator/SKILL.md?raw";

export type SkillStep = {
  id: string;
  label: string;
  tool: string;
  args: Record<string, unknown> | ((ctx: SkillRunContext) => Record<string, unknown>);
};

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  skillPath: string;
  triggers: string[];
  tools: string[];
  steps: SkillStep[];
  manifest: string;
  plan: string[];
};

export type SkillRunContext = {
  query: string;
  skillId: string;
  vars: Record<string, unknown>;
};

export type SkillTraceStep = {
  stepId: string;
  label: string;
  tool: string;
  ms: number;
  ok: boolean;
  result?: unknown;
};

export type SkillCandidate = {
  skill: AgentSkill;
  score: number;
  hits: string[];
};

export type TriggerBreakdown = { trigger: string; points: number };

export type SkillDiscoveryRow = SkillCandidate & { breakdown: TriggerBreakdown[] };

export type SkillResult = {
  markdown?: string;
  dashboard?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

const PROBE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}${import.meta.env.BASE_URL}index.html`
    : "/index.html";

export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: "site-analyzer",
    name: "site-analyzer",
    skillPath: "src/skills/site-analyzer/SKILL.md",
    description: "本站技术审计 — http_probe + DOM snapshot + Performance API",
    triggers: ["分析", "审计", "性能", "探活", "健康", "metrics", "latency", "ttfb"],
    tools: ["http_probe", "browser_snapshot"],
    plan: ["http_probe HEAD", "browser_snapshot", "Performance API", "合成指标面板"],
    manifest: siteAnalyzerMd,
    steps: [
      {
        id: "probe",
        label: "http_probe · 真实 fetch",
        tool: "http_probe",
        args: { url: PROBE_URL, method: "HEAD" },
      },
      {
        id: "snapshot",
        label: "browser_snapshot · a11y tree",
        tool: "browser_snapshot",
        args: { compact: true },
      },
      {
        id: "perf",
        label: "Performance API · Navigation Timing",
        tool: "__perf_metrics__",
        args: {},
      },
      {
        id: "audit",
        label: "合成 Site Audit Dashboard",
        tool: "__compose_site_audit__",
        args: (ctx) => ({
          probe: ctx.vars.probeResult,
          snapshot: ctx.vars.snapshotResult,
          perf: ctx.vars.perfResult,
        }),
      },
    ],
  },
  {
    id: "dom-probe",
    name: "dom-probe",
    skillPath: "src/skills/dom-probe/SKILL.md",
    description: "DOM 定位探针 — 可交互节点分布 · 树深度 · Locator 同源",
    triggers: ["dom", "定位", "snapshot", "a11y", "元素", "locator", "shadow"],
    tools: ["browser_snapshot"],
    plan: ["browser_snapshot 全树", "节点角色统计", "深度 / 交互密度"],
    manifest: domProbeMd,
    steps: [
      {
        id: "snap",
        label: "browser_snapshot · full tree",
        tool: "browser_snapshot",
        args: { compact: false },
      },
      {
        id: "analyze",
        label: "DOM 树分析 · role 分布",
        tool: "__analyze_dom_tree__",
        args: (ctx) => ({ snapshot: ctx.vars.snapshotResult }),
      },
    ],
  },
  {
    id: "workflow-orchestrator",
    name: "workflow-orchestrator",
    skillPath: "src/skills/workflow-orchestrator/SKILL.md",
    description: "iMean workflow 入队 + 执行面 snapshot — TaskQueue 上游",
    triggers: ["workflow", "自动化", "流程", "回放", "改价", "taskqueue"],
    tools: ["workflow_run", "browser_snapshot"],
    plan: ["workflow_run 入队", "browser_snapshot 执行面", "runId + steps 摘要"],
    manifest: workflowOrchestratorMd,
    steps: [
      {
        id: "run",
        label: "workflow_run · cloud",
        tool: "workflow_run",
        args: { workflowId: "price-update", mode: "cloud" },
      },
      {
        id: "snap",
        label: "browser_snapshot 执行面",
        tool: "browser_snapshot",
        args: { compact: true },
      },
      {
        id: "summary",
        label: "TaskQueue 入队摘要",
        tool: "__compose_workflow_trace__",
        args: (ctx) => ({
          workflow: ctx.vars.workflowResult,
          snapshot: ctx.vars.snapshotResult,
        }),
      },
    ],
  },
];

export const SKILL_ROUTER_DOC = skillRouterMd;

export const ROUTER_EXAMPLES = [
  { label: "站点性能审计", query: "分析本站性能和探活 metrics" },
  { label: "DOM 定位探针", query: "dom snapshot 元素定位 a11y" },
  { label: "自动化 workflow", query: "执行 workflow 自动化回放流程" },
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getSkill(id: string) {
  return AGENT_SKILLS.find((s) => s.id === id);
}

function scoreSkillDetailed(skill: AgentSkill, q: string): SkillDiscoveryRow {
  const breakdown: TriggerBreakdown[] = [];
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

export function explainDiscovery(query: string): SkillDiscoveryRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return AGENT_SKILLS.map((s) => ({ skill: s, score: 0, hits: [], breakdown: [] }));
  return AGENT_SKILLS.map((s) => scoreSkillDetailed(s, q)).sort((a, b) => b.score - a.score);
}

export function discoverSkills(query: string): SkillCandidate[] {
  return explainDiscovery(query).filter((c) => c.score > 0);
}

type ProbeResult = { ok?: boolean; status?: number; latencyMs?: number; url?: string; error?: string };

type SnapNode = { role: string; name: string; tag: string };
type SnapResult = { nodes?: SnapNode[]; nodeCount?: number };

function collectPerfMetrics() {
  if (typeof performance === "undefined") return {};
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const resources = performance.getEntriesByType("resource");
  type PerfMem = Performance & { memory?: { usedJSHeapSize: number } };
  const mem = (performance as PerfMem).memory;
  return {
    ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
    loadMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
    resourceCount: resources.length,
    memoryMb: mem ? Math.round((mem.usedJSHeapSize / 1024 / 1024) * 10) / 10 : null,
  };
}

function analyzeDomTree(snapshot: SnapResult | undefined) {
  const nodes = snapshot?.nodes ?? [];
  const byRole: Record<string, number> = {};
  for (const n of nodes) {
    byRole[n.role] = (byRole[n.role] ?? 0) + 1;
  }
  const interactive = (byRole.button ?? 0) + (byRole.link ?? 0) + (byRole.textbox ?? 0);
  return {
    totalNodes: nodes.length,
    byRole,
    interactive,
    density: nodes.length ? Math.round((interactive / nodes.length) * 100) : 0,
    sample: nodes.slice(0, 8),
  };
}

function storeStepResult(ctx: SkillRunContext, step: SkillStep, result: unknown) {
  if (step.tool === "http_probe") ctx.vars.probeResult = result;
  if (step.tool === "browser_snapshot") ctx.vars.snapshotResult = result;
  if (step.tool === "workflow_run") ctx.vars.workflowResult = result;
  if (step.tool === "__perf_metrics__") ctx.vars.perfResult = result;
}

async function runInternalTool(name: string, args: Record<string, unknown>): Promise<{ content: unknown; isError?: boolean }> {
  switch (name) {
    case "__perf_metrics__":
      return { content: collectPerfMetrics() };

    case "__compose_site_audit__": {
      const probe = args.probe as ProbeResult;
      const snap = args.snapshot as SnapResult;
      const perf = args.perf as Record<string, unknown>;
      const nodes = snap?.nodes?.length ?? snap?.nodeCount ?? 0;
      return {
        content: {
          dashboard: {
            http: {
              status: probe?.status,
              latencyMs: probe?.latencyMs,
              ok: probe?.ok,
              url: probe?.url ?? PROBE_URL,
            },
            dom: { a11yNodes: nodes },
            perf,
          },
          meta: { skill: "site-analyzer", ts: Date.now() },
        },
      };
    }

    case "__analyze_dom_tree__": {
      const analysis = analyzeDomTree(args.snapshot as SnapResult);
      return {
        content: {
          dashboard: { domProbe: analysis },
          meta: { skill: "dom-probe", locatorLab: "/work/locator" },
        },
      };
    }

    case "__compose_workflow_trace__": {
      const wf = args.workflow as { runId?: string; workflowId?: string; steps?: unknown[]; status?: string };
      const snap = args.snapshot as SnapResult;
      return {
        content: {
          dashboard: {
            workflow: {
              runId: wf?.runId,
              workflowId: wf?.workflowId,
              status: wf?.status,
              replaySteps: wf?.steps?.length ?? 0,
            },
            executionSurface: { interactiveNodes: analyzeDomTree(snap).interactive },
          },
          meta: { skill: "workflow-orchestrator", sdkLab: "/work/sdk" },
        },
      };
    }

    default:
      return { content: { error: `unknown: ${name}` }, isError: true };
  }
}

export function parseSkillResult(output: unknown): SkillResult {
  if (output && typeof output === "object") {
    const o = output as SkillResult;
    if (o.dashboard || o.meta) return o;
  }
  return { meta: { raw: output } };
}

export async function runSkill(
  skill: AgentSkill,
  query: string,
  onStep?: (step: SkillTraceStep) => void,
  opts?: { snapshotRoot?: Element | null; onStepStart?: (step: SkillStep) => void },
): Promise<{ trace: SkillTraceStep[]; output: unknown; result: SkillResult }> {
  const ctx: SkillRunContext = { query, skillId: skill.id, vars: {} };
  const trace: SkillTraceStep[] = [];
  let lastResult: unknown = null;
  const snapRoot = opts?.snapshotRoot ?? null;

  for (const step of skill.steps) {
    opts?.onStepStart?.(step);
    const t0 = performance.now();
    const args = typeof step.args === "function" ? step.args(ctx) : step.args;

    const out = step.tool.startsWith("__")
      ? await runInternalTool(step.tool, args)
      : await mcpServer.callTool(step.tool, args, { snapshotRoot: snapRoot });

    const ms = Math.max(1, Math.round(performance.now() - t0));
    lastResult = out.content;
    storeStepResult(ctx, step, out.content);

    const row: SkillTraceStep = {
      stepId: step.id,
      label: step.label,
      tool: step.tool,
      ms,
      ok: !out.isError,
      result: out.content,
    };
    trace.push(row);
    onStep?.(row);
    if (out.isError) break;
    await sleep(step.tool.startsWith("__") ? 60 : 180);
  }

  return { trace, output: lastResult, result: parseSkillResult(lastResult) };
}
