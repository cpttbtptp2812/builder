/** agent-copilot 终态合成 — 浏览器 / 服务端共用 */

export type KnowledgeHitLite = {
  title?: string;
  chunkId?: string;
  score?: number;
  excerpt?: string;
};

function normalizeHits(raw: unknown): KnowledgeHitLite[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as KnowledgeHitLite[];
  const o = raw as { hits?: KnowledgeHitLite[] };
  return o.hits ?? [];
}

function domProbeFromStep(raw: unknown): {
  totalNodes?: number;
  interactive?: number;
  density?: number;
} | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as { dashboard?: { domProbe?: Record<string, unknown> }; domProbe?: Record<string, unknown> };
  const p = o.dashboard?.domProbe ?? o.domProbe;
  if (!p) return undefined;
  return {
    totalNodes: p.totalNodes as number | undefined,
    interactive: p.interactive as number | undefined,
    density: p.density as number | undefined,
  };
}

export function composeAgentCopilot(args: Record<string, unknown>): {
  dashboard: Record<string, unknown>;
  markdown: string;
  meta: Record<string, unknown>;
} {
  const query = String(args.query ?? "");
  const probe = (args.probe ?? {}) as { ok?: boolean; status?: number; latencyMs?: number; url?: string };
  const snap = args.snapshot as { nodeCount?: number; nodes?: unknown[] } | undefined;
  const perf = (args.perf ?? {}) as {
    ttfbMs?: number | null;
    loadMs?: number | null;
    resourceCount?: number;
  };
  const hits = normalizeHits(args.knowledge);
  const dom = domProbeFromStep(args.dom);
  const wf = args.workflow as { runId?: string; workflowId?: string; status?: string; steps?: unknown[] } | undefined;
  const a11y = snap?.nodes?.length ?? snap?.nodeCount ?? 0;

  const pillars = {
    knowledge: { ok: hits.length > 0, hitCount: hits.length, topChunk: hits[0]?.chunkId ?? null },
    probe: {
      ok: probe.ok !== false && (probe.status == null || probe.status < 400),
      status: probe.status,
      latencyMs: probe.latencyMs,
      url: probe.url,
    },
    dom: { ok: a11y > 0 || (dom?.totalNodes ?? 0) > 0, a11yNodes: a11y, ...dom },
    perf: {
      ok: perf.ttfbMs == null || perf.ttfbMs < 800,
      ttfbMs: perf.ttfbMs,
      loadMs: perf.loadMs,
      resourceCount: perf.resourceCount,
    },
    workflow: {
      ok: Boolean(wf?.runId),
      runId: wf?.runId,
      workflowId: wf?.workflowId,
      status: wf?.status,
      steps: wf?.steps?.length ?? 0,
    },
  };

  let score = 0;
  if (pillars.knowledge.ok) score += 22;
  if (pillars.probe.ok) score += 22;
  if (pillars.dom.ok) score += 18;
  if (pillars.perf.ok) score += 18;
  if (pillars.workflow.ok) score += 10;
  if (hits.length >= 3) score += 10;
  score = Math.min(100, score);

  const toolCount = 5;
  const headline =
    score >= 80
      ? "五路 MCP 已联通 — 知识、探活、DOM、性能、自动化入队在同一面板"
      : score >= 50
        ? "部分链路已就绪 — 看下方哪一路未命中"
        : "流水线已跑完 — 有步骤需补材料或换环境（如无 Key / 非同源）";

  const hitLines = hits.slice(0, 4).map((h, i) => `${i + 1}. \`${h.chunkId ?? "—"}\` · ${h.title ?? "hit"} (${h.score ?? "—"})`);

  const markdown = [
    `## Agent Copilot`,
    "",
    `**${headline}** · 就绪度 **${score}/100**`,
    "",
    `- 问句：${query || "—"}`,
    `- Hybrid RAG：**${hits.length}** 块${hits[0]?.chunkId ? ` · 首块 \`${hits[0].chunkId}\`` : ""}`,
    `- http_probe：**${probe.status ?? "—"}** · ${probe.latencyMs ?? "—"}ms`,
    `- DOM：**${dom?.totalNodes ?? a11y}** 节点 · 可交互 **${dom?.interactive ?? "—"}**`,
    `- Performance：TTFB **${perf.ttfbMs ?? "—"}**ms · Load **${perf.loadMs ?? "—"}**ms`,
    `- workflow_run：${wf?.runId ? `\`${wf.runId.slice(0, 12)}…\` · ${wf.status ?? "—"}` : "（本步可选，未入队不影响报告）"}`,
    "",
    hits.length ? ["**语料 Top**", ...hitLines].join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n");

  const detail = `就绪度 ${score}/100 · ${headline}`;

  return {
    dashboard: {
      agentCopilot: {
        query,
        score,
        toolCount,
        headline,
        pillars,
        hits: hits.slice(0, 6),
      },
      http: pillars.probe.ok
        ? { status: probe.status, latencyMs: probe.latencyMs, ok: probe.ok, url: probe.url }
        : undefined,
      dom: { a11yNodes: a11y, domProbe: dom },
      perf,
      knowledge: { hitCount: hits.length, hits: hits.slice(0, 6) },
      workflow: wf ? { runId: wf.runId, workflowId: wf.workflowId, status: wf.status, replaySteps: wf.steps?.length ?? 0 } : undefined,
    },
    markdown,
    summary: headline,
    detail,
    meta: { skill: "agent-copilot", ts: Date.now(), readiness: score },
  };
}
