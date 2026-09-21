/** Agent Skills — SKILL.md 解析注册表 + 流水线运行时 */

import { loadImportedSkills } from "./importedSkills";
import { mcpServer } from "./mcpServer";
import { runPolicyDesk } from "./policyDesk";
import { hydrateSkill, resolveStepArgs, skillIdFromPath, type SkillManifest } from "./skillMarkdown";

export type SkillStep = {
  id: string;
  label: string;
  tool: string;
  args: Record<string, unknown> | ((ctx: SkillRunContext) => Record<string, unknown>);
};

export type AgentSkill = SkillManifest & { steps: SkillStep[] };

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

const SKILL_ORDER = [
  "site-analyzer",
  "dom-probe",
  "workflow-orchestrator",
  "policy-desk",
  "knowledge-lookup",
  "skill-router",
];

const skillFiles = import.meta.glob("../skills/*/SKILL.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function loadCatalog(): AgentSkill[] {
  const loaded = Object.entries(skillFiles).map(([filePath, raw]) => {
    const id = skillIdFromPath(filePath);
    return hydrateSkill(raw, { id, skillPath: `src/skills/${id}/SKILL.md` });
  });
  return loaded.sort((a, b) => {
    const ia = SKILL_ORDER.indexOf(a.id);
    const ib = SKILL_ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

/** 目录里所有 SKILL.md（含仅解析、不可运行） */
export const SKILL_CATALOG: AgentSkill[] = loadCatalog();

/** 进入路由 / 执行链的技能：解析成功且有 steps */
export const AGENT_SKILLS: AgentSkill[] = SKILL_CATALOG.filter((s) => s.runnable);

/** 内置技能 + 访客导入的可运行技能 */
export function allRunnableSkills(): AgentSkill[] {
  try {
    const extra = loadImportedSkills().filter((s) => s.runnable && s.steps.length > 0) as AgentSkill[];
    const seen = new Set(AGENT_SKILLS.map((s) => s.id));
    return [...AGENT_SKILLS, ...extra.filter((s) => !seen.has(s.id))];
  } catch {
    return AGENT_SKILLS;
  }
}

export const SKILL_ROUTER_DOC = SKILL_CATALOG.find((s) => s.id === "skill-router")?.manifest ?? "";

export const ROUTER_EXAMPLES = [
  { label: "站点性能审计", query: "分析本站性能和探活 metrics" },
  { label: "DOM 定位探针", query: "dom snapshot 元素定位 a11y" },
  { label: "自动化 workflow", query: "执行 workflow 自动化回放流程" },
  { label: "制度值班", query: "满一年年假几天" },
  { label: "知识检索", query: "检索 iMean 定位语料 chunkId" },
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getSkill(id: string) {
  return SKILL_CATALOG.find((s) => s.id === id);
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
  const skills = allRunnableSkills();
  const q = query.trim().toLowerCase();
  if (!q) return skills.map((s) => ({ skill: s, score: 0, hits: [], breakdown: [] }));
  return skills.map((s) => scoreSkillDetailed(s, q)).sort((a, b) => b.score - a.score);
}

export function discoverSkills(query: string): SkillCandidate[] {
  return explainDiscovery(query).filter((c) => c.score > 0);
}

type ProbeResult = { ok?: boolean; status?: number; latencyMs?: number; url?: string; error?: string };
type SnapNode = { role: string; name: string; tag: string };
type SnapResult = { nodes?: SnapNode[]; nodeCount?: number };
type KnowledgeHit = { title?: string; chunkId?: string; score?: number; excerpt?: string };

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
  ctx.vars[step.id] = result;
  if (step.tool === "http_probe") ctx.vars.probeResult = result;
  if (step.tool === "browser_snapshot") ctx.vars.snapshotResult = result;
  if (step.tool === "workflow_run") ctx.vars.workflowResult = result;
  if (step.tool === "__perf_metrics__") ctx.vars.perfResult = result;
  if (step.tool === "knowledge_search") ctx.vars.searchResult = result;
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

    case "__run_policy_desk__": {
      const desk = runPolicyDesk(String(args.query ?? ""));
      return {
        content: {
          dashboard: {
            policy: {
              capability: desk.capability.cap,
              reason: desk.capability.reason,
              outcome: desk.outcome,
              ticketId: desk.ticket?.id,
              ticketStatus: desk.ticket?.status,
              citations: desk.citations.map((c) => ({
                id: c.id,
                text: c.text,
                status: c.status,
                value: c.value,
                slot: c.slot,
              })),
            },
          },
          markdown: desk.markdown,
          meta: { skill: "policy-desk", outcome: desk.outcome },
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

    case "__compose_knowledge__": {
      const payload = args.hits as { hits?: KnowledgeHit[]; source?: string } | KnowledgeHit[] | undefined;
      const hits = Array.isArray(payload) ? payload : payload?.hits ?? [];
      const source = Array.isArray(payload) ? "" : payload?.source ?? "";
      const lines = hits.map(
        (h, i) => `${i + 1}. **${h.title ?? "hit"}** \`${h.chunkId ?? ""}\` score ${h.score ?? "—"} — ${h.excerpt ?? ""}`,
      );
      return {
        content: {
          dashboard: {
            knowledge: {
              query: args.query,
              hitCount: hits.length,
              source,
              hits,
            },
          },
          markdown: [`检索「${args.query ?? ""}」命中 ${hits.length} 块。`, "", ...lines].join("\n"),
          meta: { skill: "knowledge-lookup" },
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
    const rawArgs = typeof step.args === "function" ? step.args(ctx) : step.args;
    const args = resolveStepArgs(rawArgs, { query: ctx.query, probeUrl: PROBE_URL, vars: ctx.vars });

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
