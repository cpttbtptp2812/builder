/** 后端桥接 — 优先走 SQLite API，失败回退浏览器内运行时 */

import type { AgentTurnTrace } from "./agentRuntime";
import { apiFetch, apiUrl, checkBackendHealth } from "./apiClient";
import type { RagRetrieveResult } from "./ragEngine";
import { retrieveRag as retrieveRagLocal } from "./ragEngine";
import {
  explainDiscovery as explainDiscoveryLocal,
  runSkill as runSkillLocal,
  getSkill,
  type AgentSkill,
  type SkillDiscoveryRow,
  type SkillResult,
  type SkillTraceStep,
} from "./agentSkills";
import { runMultiAgentPipeline as runMultiAgentLocal, type MultiAgentResult, type MultiAgentStep } from "./multiAgentRuntime";
import {
  runRouterEval as runRouterEvalLocal,
  runSkillBenchmark as runSkillBenchmarkLocal,
  type RouterEvalRow,
  type ToolMetrics,
} from "./evalHarness";
import {
  buildMemoryContextBlock as buildMemoryLocal,
  getMemorySnapshot as getMemoryLocal,
  upsertMemory as upsertMemoryLocal,
  deleteMemory as deleteMemoryLocal,
  type MemoryEntry,
} from "./agentMemory";
import { captureDomSnapshot, collectClientPerf, getProbeUrl, getSessionId } from "./sessionId";

type ServerRagHit = {
  chunk_id: string;
  project_id: string;
  project_name: string;
  section: string;
  aspect_key: string | null;
  text: string;
  score: number;
  matched_terms: string[];
  rank: number;
};

function mapServerRag(data: {
  query: string;
  topK: number;
  hits: ServerRagHit[];
  corpusSize: number;
  chunkCount: number;
  pipeline: string[];
  latencyMs: number;
  directProjectId: string | null;
  source?: string;
}): RagRetrieveResult {
  return {
    query: data.query,
    topK: data.topK,
    corpusSize: data.corpusSize,
    chunkCount: data.chunkCount,
    pipeline: [...data.pipeline, "server"],
    latencyMs: data.latencyMs,
    directProjectId: data.directProjectId,
    hits: data.hits.map((h) => ({
      chunkId: h.chunk_id,
      projectId: h.project_id,
      projectName: h.project_name,
      section: h.section as RagRetrieveResult["hits"][0]["section"],
      aspectKey: h.aspect_key ?? undefined,
      text: h.text,
      charCount: h.text.length,
      score: h.score,
      matchedTerms: h.matched_terms,
      rank: h.rank,
    })),
  };
}

export async function retrieveRagAsync(query: string, topK = 5): Promise<RagRetrieveResult & { runtime: "server" | "local" }> {
  await checkBackendHealth();
  const remote = await apiFetch<Parameters<typeof mapServerRag>[0]>("/rag/retrieve", {
    method: "POST",
    body: JSON.stringify({ query, topK }),
  });
  if (remote) return { ...mapServerRag(remote), runtime: "server" };
  return { ...retrieveRagLocal(query, topK), runtime: "local" };
}

export async function explainDiscoveryAsync(query: string): Promise<{ rows: SkillDiscoveryRow[]; runtime: "server" | "local" }> {
  const remote = await apiFetch<{
    rows: Array<{ skill: { id: string; name: string; description: string; plan: string[] }; score: number; hits: string[]; breakdown: { trigger: string; points: number }[] }>;
  }>("/skills/discover", { method: "POST", body: JSON.stringify({ query }) });

  if (remote?.rows) {
    const rows: SkillDiscoveryRow[] = remote.rows.map((r) => {
      const full = getSkill(r.skill.id);
      return {
        skill: full ?? ({ id: r.skill.id, name: r.skill.name, description: r.skill.description, plan: r.skill.plan } as AgentSkill),
        score: r.score,
        hits: r.hits,
        breakdown: r.breakdown,
      };
    });
    return { rows, runtime: "server" };
  }
  return { rows: explainDiscoveryLocal(query), runtime: "local" };
}

export async function runSkillAsync(
  skill: AgentSkill,
  query: string,
  opts?: { snapshotRoot?: Element | null; onStep?: (s: SkillTraceStep) => void; onStepStart?: (step: unknown) => void },
): Promise<{ trace: SkillTraceStep[]; result: SkillResult; runtime: "server" | "local" }> {
  const clientSnapshot = captureDomSnapshot(opts?.snapshotRoot ?? null, skill.id !== "dom-probe");
  const remote = await apiFetch<{ trace: SkillTraceStep[]; result: unknown; runtime: string }>("/skills/run", {
    method: "POST",
    body: JSON.stringify({
      skillId: skill.id,
      query,
      sessionId: getSessionId(),
      clientSnapshot,
      clientPerf: collectClientPerf(),
      probeUrl: getProbeUrl(),
    }),
  });

  if (remote?.trace) {
    for (const step of remote.trace) opts?.onStep?.(step);
    const raw = remote.result as SkillResult & { dashboard?: Record<string, unknown> };
    const result: SkillResult =
      raw && typeof raw === "object" && raw.dashboard
        ? raw
        : { dashboard: (raw as { dashboard?: Record<string, unknown> })?.dashboard, meta: { runtime: "server" } };
    return { trace: remote.trace, result, runtime: "server" };
  }

  const local = await runSkillLocal(skill, query, opts?.onStep, {
    snapshotRoot: opts?.snapshotRoot,
    onStepStart: opts?.onStepStart as (step: import("./agentSkills").SkillStep) => void,
  });
  return { trace: local.trace, result: local.result, runtime: "local" };
}

export async function runGuestAgentAsync(
  query: string,
  ctx: { snapshotRoot?: Element | null },
): Promise<{ assistantText: string; traces: AgentTurnTrace[]; runtime: "server" | "local" } | null> {
  const remote = await apiFetch<{ assistantText: string; traces: AgentTurnTrace[] }>("/agent/guest", {
    method: "POST",
    body: JSON.stringify({
      query,
      sessionId: getSessionId(),
      clientSnapshot: captureDomSnapshot(ctx.snapshotRoot),
      clientPerf: collectClientPerf(),
      probeUrl: getProbeUrl(),
    }),
  });
  if (remote) return { ...remote, runtime: "server" };
  return null;
}

export async function runMultiAgentAsync(
  query: string,
  onStep?: (step: MultiAgentStep) => void,
): Promise<(MultiAgentResult & { runtime: "server" | "local" }) | null> {
  const remote = await apiFetch<{
    query: string;
    steps: MultiAgentStep[];
    answer: string;
    citations: MultiAgentResult["citations"];
    totalMs: number;
  }>("/multi-agent/run", {
    method: "POST",
    body: JSON.stringify({
      query,
      sessionId: getSessionId(),
      clientPerf: collectClientPerf(),
      probeUrl: getProbeUrl(),
    }),
  });

  if (remote) {
    for (const s of remote.steps) onStep?.(s);
    return { ...remote, runtime: "server" };
  }

  const local = await runMultiAgentLocal(query, onStep);
  return { ...local, runtime: "local" };
}

export async function runRouterEvalAsync(): Promise<{ rows: RouterEvalRow[]; runtime: "server" | "local" }> {
  const remote = await apiFetch<{ rows: RouterEvalRow[] }>("/eval/router");
  if (remote?.rows) return { rows: remote.rows, runtime: "server" };
  return { rows: runRouterEvalLocal(), runtime: "local" };
}

export async function runSkillBenchmarkAsync(): Promise<{ metrics: ToolMetrics; runtime: "server" | "local" } | null> {
  const remote = await apiFetch<{ metrics: ToolMetrics }>("/eval/benchmark", {
    method: "POST",
    body: JSON.stringify({ sessionId: getSessionId() }),
  });
  if (remote?.metrics) return { metrics: remote.metrics, runtime: "server" };
  const local = await runSkillBenchmarkLocal();
  return { metrics: local.metrics, runtime: "local" };
}

export async function syncMemoryFromServer(): Promise<{ longTerm: MemoryEntry[]; preview: string; runtime: "server" | "local" }> {
  const remote = await apiFetch<{ longTerm: MemoryEntry[]; preview: string }>(`/memory?sessionId=${encodeURIComponent(getSessionId())}`);
  if (remote) {
    return {
      longTerm: remote.longTerm.map((m) => ({ ...m, category: (m as MemoryEntry).category ?? "fact", updatedAt: (m as MemoryEntry).updatedAt ?? "" })),
      preview: remote.preview,
      runtime: "server",
    };
  }
  const snap = await getMemoryLocal();
  return { longTerm: snap.longTerm, preview: await buildMemoryLocal(), runtime: "local" };
}

export async function saveMemoryAsync(key: string, value: string, category: MemoryEntry["category"] = "fact") {
  const ok = await apiFetch("/memory", {
    method: "POST",
    body: JSON.stringify({ sessionId: getSessionId(), key, value, category }),
  });
  if (!ok) await upsertMemoryLocal(key, value, category);
}

export async function deleteMemoryAsync(key: string) {
  try {
    await fetch(apiUrl(`/memory/${encodeURIComponent(key)}?sessionId=${encodeURIComponent(getSessionId())}`), { method: "DELETE" });
  } catch {
    await deleteMemoryLocal(key);
  }
}

export { checkBackendHealth, isBackendOnline } from "./apiClient";
