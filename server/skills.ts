/** 服务端 Skill 运行时 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbRun, nowIso } from "./db.ts";
import { ragHitsForMcp } from "./rag.ts";
import { runPolicyDesk, searchPolicy, draftTicket, commitTicket } from "../src/lib/policyDesk.ts";
import { hydrateSkill, resolveStepArgs, type SkillManifest } from "../src/lib/skillMarkdown.ts";
import { loadRuntimeConfig } from "./runtimeConfig.ts";
import { buildProbeBodyFromHtml, readProbeHtml } from "../src/lib/htmlProbeMeta.ts";

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

export type AgentSkill = SkillManifest;

const DEFAULT_PROBE_URL = process.env.PROBE_URL ?? "https://cpttbtptp2812.github.io/builder/index.html";

const SKILL_ORDER = [
  "site-analyzer",
  "dom-probe",
  "workflow-orchestrator",
  "policy-desk",
  "knowledge-lookup",
  "skill-router",
];

function loadCatalog(): AgentSkill[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, "SKILL.md")))
    .map((d) => hydrateSkill(readSkillMd(d.name), { id: d.name, skillPath: `src/skills/${d.name}/SKILL.md` }))
    .sort((a, b) => {
      const ia = SKILL_ORDER.indexOf(a.id);
      const ib = SKILL_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

export const SKILL_CATALOG: AgentSkill[] = loadCatalog();
export const AGENT_SKILLS: AgentSkill[] = SKILL_CATALOG.filter((s) => s.runnable);

export function getSkill(id: string) {
  return SKILL_CATALOG.find((s) => s.id === id);
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

export async function probeHttpTool(url: string, method: "GET" | "HEAD" = "GET") {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    const latencyMs = Math.round(performance.now() - t0);
    const contentType = res.headers.get("content-type");
    let body: unknown = null;
    if (method === "GET") {
      if (contentType?.includes("json")) {
        try {
          body = await res.json();
        } catch {
          body = null;
        }
      } else {
        const text = await readProbeHtml(res);
        body = buildProbeBodyFromHtml(text);
      }
    }
    return {
      url,
      method,
      status: res.status,
      ok: res.ok,
      latencyMs,
      contentType,
      body,
      via: "server" as const,
    };
  } catch (err) {
    return {
      url,
      method,
      ok: false,
      latencyMs: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : "fetch failed",
      via: "server" as const,
    };
  }
}

async function probeHttp(url: string, method: "GET" | "HEAD" = "GET") {
  return probeHttpTool(url, method);
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
    case "policy_search":
      return {
        content: {
          query: String(args.query ?? ""),
          hits: searchPolicy(String(args.query ?? ""), Number(args.topK ?? 4)),
        },
      };
    case "ticket_draft":
      return { content: draftTicket(String(args.action ?? "vpn.provision"), String(args.title ?? "权限变更（预演）")) };
    case "ticket_commit": {
      const out = commitTicket(String(args.ticketId ?? ""));
      return out.ok ? { content: out } : { content: out, isError: true as const };
    }
    case "__run_policy_desk__": {
      const desk = runPolicyDesk(String(args.query ?? ctx.vars.query ?? ""), { persistTicket: false });
      return {
        content: {
          dashboard: { policy: { capability: desk.capability.cap, outcome: desk.outcome } },
          markdown: desk.markdown,
          meta: { skill: "policy-desk", outcome: desk.outcome },
        },
      };
    }
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
    case "__compose_knowledge__": {
      const payload = (args.hits ?? ctx.vars.searchResult) as { hits?: unknown[]; source?: string } | unknown[] | undefined;
      const hits = Array.isArray(payload) ? payload : payload?.hits ?? [];
      return {
        content: {
          dashboard: { knowledge: { query: args.query, hitCount: hits.length, hits } },
          markdown: `检索「${args.query ?? ""}」命中 ${hits.length} 块。`,
          meta: { skill: "knowledge-lookup", runtime: "server" },
        },
      };
    }
    default:
      return { content: { error: `unknown tool: ${name}` }, isError: true as const };
  }
}

function resolveArgs(
  step: AgentSkill["steps"][0],
  ctx: { vars: Record<string, unknown>; query: string; probeUrl: string },
) {
  return resolveStepArgs(step.args, { query: ctx.query, probeUrl: ctx.probeUrl, vars: ctx.vars });
}

export async function runSkillOnServer(
  skillId: string,
  query: string,
  sessionId: string,
  clientCtx: ClientCtx = {},
) {
  const skill = getSkill(skillId);
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);

  const ctx = {
    ...clientCtx,
    vars: { query } as Record<string, unknown>,
    query,
    probeUrl: clientCtx.probeUrl || DEFAULT_PROBE_URL,
  };
  const trace: SkillTraceStep[] = [];
  const t0 = performance.now();
  let lastResult: unknown = null;

  for (const step of skill.steps) {
    const stepT0 = performance.now();
    const args = resolveArgs(step, ctx);
    const out = await callTool(step.tool, args, ctx);

    ctx.vars[step.id] = out.content;
    if (step.tool === "http_probe") ctx.vars.probeResult = out.content;
    if (step.tool === "browser_snapshot") ctx.vars.snapshotResult = out.content;
    if (step.tool === "workflow_run") ctx.vars.workflowResult = out.content;
    if (step.tool === "__perf_metrics__") ctx.vars.perfResult = out.content;
    if (step.tool === "knowledge_search") ctx.vars.searchResult = out.content;

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
  { id: "r6", query: "满一年年假几天制度怎么规定", expectedSkillId: "policy-desk" },
  { id: "r7", query: "帮我开通公司 VPN 权限", expectedSkillId: "policy-desk" },
  { id: "r8", query: "检索 iMean 定位语料 chunkId", expectedSkillId: "knowledge-lookup" },
];

export function runRouterEval() {
  const cases = loadRuntimeConfig().eval.routerCases;
  return cases.map((c) => {
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
