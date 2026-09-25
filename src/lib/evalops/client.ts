/** 回归评测 — 前端数据层：后端在线存服务端并由服务端执行；离线退回浏览器本地存储 + 本地执行 */

import { apiUrl, checkBackendHealth } from "../apiClient";
import { isLlmConfigured, loadLlmConfig, resolveLlmBaseUrl } from "../llmConfig";
import { callChat, citationsFromTraces, invokeHttp, maskTarget, openAiToHttp, unmaskTarget } from "./targets";
import { runExperiment } from "./runner";
import { generateCases, type SourceDoc } from "./generate";
import {
  DEFAULT_RUN_OPTIONS,
  newId,
  type EvalCase,
  type EvalRun,
  type EvalSuite,
  type EvalTarget,
  type InvokeResult,
  type JudgeConfig,
  type LlmFn,
  type RunOptions,
} from "./types";

export type StoreMode = "server" | "local";

let mode: StoreMode | null = null;

export async function detectMode(force = false): Promise<StoreMode> {
  if (mode && !force) return mode;
  const h = await checkBackendHealth(force);
  mode = h?.ok ? "server" : "local";
  return mode;
}

export function currentMode(): StoreMode {
  return mode ?? "local";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

/** 浏览器里配置的模型作为裁判；服务端也可用自己的环境变量 Key */
export function browserJudge(): JudgeConfig | null {
  const cfg = loadLlmConfig();
  if (!isLlmConfigured(cfg)) return null;
  return { baseUrl: cfg.baseUrl, model: cfg.model, apiKey: cfg.apiKey };
}

function browserLlm(): LlmFn | undefined {
  const j = browserJudge();
  if (!j) return undefined;
  return (messages) => callChat(j, messages, { rewriteUrl: (u) => u.replace(j.baseUrl.replace(/\/$/, ""), resolveLlmBaseUrl(j.baseUrl)) });
}

/* ───────── 本地存储（离线回退） ───────── */

const K = { targets: "ownagent:evalops-targets", suites: "ownagent:evalops-suites", runs: "ownagent:evalops-runs" };

function readLocal<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeLocal<T>(key: string, rows: T[]) {
  localStorage.setItem(key, JSON.stringify(rows));
}
function upsertLocal<T extends { id: string }>(key: string, row: T, limit = 200) {
  const rows = readLocal<T>(key).filter((r) => r.id !== row.id);
  writeLocal(key, [row, ...rows].slice(0, limit));
}

const CORS_HINT = "（浏览器跨域被拦截。启动后端 npm run dev:server 后会由服务端转发，不受限制）";

async function invokeLocal(t: EvalTarget, q: string): Promise<InvokeResult> {
  const withHint = (r: InvokeResult) => (r.error && /Failed to fetch|NetworkError|Load failed/.test(r.error) ? { ...r, error: r.error + CORS_HINT } : r);
  if (t.kind === "http" && t.http) return withHint(await invokeHttp(t.http, q));
  if (t.kind === "openai" && t.openai) {
    const base = t.openai.baseUrl.replace(/\/$/, "");
    return withHint(await invokeHttp(openAiToHttp(t.openai), q, { rewriteUrl: (u) => u.replace(base, resolveLlmBaseUrl(base)) }));
  }
  const t0 = performance.now();
  try {
    if (t.builtin?.variant === "kb-only") {
      const { ragHitsForMcp } = await import("../ragEngine");
      const hits = ragHitsForMcp(q, 3).hits;
      return {
        answer: hits.length ? hits.map((h) => `${h.title}：${h.excerpt}`).join("\n") : "资料库里没有找到相关内容。",
        citations: hits.map((h) => `${h.title}：${h.excerpt}`),
        latencyMs: Math.round(performance.now() - t0),
      };
    }
    const { runGuestAgentTurn } = await import("../guestAgentRuntime");
    const r = await runGuestAgentTurn(q, {}, () => {});
    return { answer: r.assistantText, citations: citationsFromTraces((r as { traces?: unknown }).traces), latencyMs: Math.round(performance.now() - t0) };
  } catch (err) {
    return { answer: "", citations: [], latencyMs: Math.round(performance.now() - t0), error: err instanceof Error ? err.message : String(err) };
  }
}

const localStops = new Map<string, boolean>();

async function executeLocal(run: EvalRun, suite: EvalSuite, a: EvalTarget, b: EvalTarget | null) {
  run.status = "running";
  upsertLocal(K.runs, run, 20);
  try {
    const r = await runExperiment(suite, a, b, run.options, {
      invoke: invokeLocal,
      llm: run.options.useLlmJudge ? browserLlm() : undefined,
      shouldStop: () => localStops.get(run.id) === true,
      onProgress: (done, total, partial) => {
        run.progress = { done, total };
        run.results = partial;
        upsertLocal(K.runs, run, 20);
      },
    });
    run.results = r.results;
    run.summary = r.summary;
    run.status = r.stopped ? "cancelled" : "done";
  } catch (err) {
    run.status = "failed";
    run.error = err instanceof Error ? err.message : String(err);
  } finally {
    run.finishedAt = new Date().toISOString();
    localStops.delete(run.id);
    upsertLocal(K.runs, run, 20);
  }
}

/* ───────── 对外 API ───────── */

export const evalStore = {
  async listTargets(): Promise<EvalTarget[]> {
    if ((await detectMode()) === "server") return (await api<{ items: EvalTarget[] }>("/evalops/targets")).items;
    return readLocal<EvalTarget>(K.targets).map(maskTarget);
  },
  async saveTarget(t: EvalTarget): Promise<EvalTarget> {
    if ((await detectMode()) === "server") {
      return (await api<{ item: EvalTarget }>("/evalops/targets", { method: "POST", body: JSON.stringify(t) })).item;
    }
    const prev = readLocal<EvalTarget>(K.targets).find((x) => x.id === t.id);
    const now = new Date().toISOString();
    const row = unmaskTarget({ ...t, id: t.id || newId("tgt"), createdAt: prev?.createdAt ?? now, updatedAt: now }, prev);
    upsertLocal(K.targets, row);
    return maskTarget(row);
  },
  async deleteTarget(id: string) {
    if ((await detectMode()) === "server") return void (await api(`/evalops/targets/${id}`, { method: "DELETE" }));
    writeLocal(K.targets, readLocal<EvalTarget>(K.targets).filter((x) => x.id !== id));
  },
  async testTarget(t: EvalTarget, question: string): Promise<InvokeResult> {
    if ((await detectMode()) === "server") {
      return api<InvokeResult>("/evalops/test", { method: "POST", body: JSON.stringify({ target: t, question }) });
    }
    const prev = readLocal<EvalTarget>(K.targets).find((x) => x.id === t.id);
    return invokeLocal(unmaskTarget(t, prev), question);
  },

  async listSuites(): Promise<EvalSuite[]> {
    if ((await detectMode()) === "server") return (await api<{ items: EvalSuite[] }>("/evalops/suites")).items;
    return readLocal<EvalSuite>(K.suites);
  },
  async saveSuite(s: EvalSuite): Promise<EvalSuite> {
    if ((await detectMode()) === "server") {
      return (await api<{ item: EvalSuite }>("/evalops/suites", { method: "POST", body: JSON.stringify(s) })).item;
    }
    const now = new Date().toISOString();
    const prev = readLocal<EvalSuite>(K.suites).find((x) => x.id === s.id);
    const row = { ...s, id: s.id || newId("suite"), createdAt: prev?.createdAt ?? now, updatedAt: now };
    upsertLocal(K.suites, row);
    return row;
  },
  async deleteSuite(id: string) {
    if ((await detectMode()) === "server") return void (await api(`/evalops/suites/${id}`, { method: "DELETE" }));
    writeLocal(K.suites, readLocal<EvalSuite>(K.suites).filter((x) => x.id !== id));
  },

  async listRuns(): Promise<EvalRun[]> {
    if ((await detectMode()) === "server") return (await api<{ items: EvalRun[] }>("/evalops/runs")).items;
    return readLocal<EvalRun>(K.runs);
  },
  async getRun(id: string): Promise<EvalRun | null> {
    if ((await detectMode()) === "server") return (await api<{ item: EvalRun }>(`/evalops/runs/${id}`)).item;
    return readLocal<EvalRun>(K.runs).find((r) => r.id === id) ?? null;
  },
  async startRun(input: { name?: string; suiteId: string; targetAId: string; targetBId?: string | null; options: RunOptions }): Promise<EvalRun> {
    if ((await detectMode()) === "server") {
      return (
        await api<{ item: EvalRun }>("/evalops/runs", {
          method: "POST",
          body: JSON.stringify({ ...input, judge: input.options.useLlmJudge ? browserJudge() : null }),
        })
      ).item;
    }
    const suite = readLocal<EvalSuite>(K.suites).find((s) => s.id === input.suiteId);
    const targets = readLocal<EvalTarget>(K.targets);
    const a = targets.find((t) => t.id === input.targetAId);
    const b = input.targetBId ? targets.find((t) => t.id === input.targetBId) ?? null : null;
    if (!suite || !a) throw new Error("测试集或被测对象不存在");
    if (!suite.cases.length) throw new Error("测试集是空的");
    const judge = input.options.useLlmJudge ? browserJudge() : null;
    const run: EvalRun = {
      id: newId("run"),
      name: input.name?.trim() || `${a.name}${b ? ` vs ${b.name}` : ""}`,
      suiteId: suite.id,
      suiteName: suite.name,
      targetA: { id: a.id, name: a.name },
      targetB: b ? { id: b.id, name: b.name } : null,
      options: { ...DEFAULT_RUN_OPTIONS, ...input.options, useLlmJudge: Boolean(judge) },
      status: "queued",
      progress: { done: 0, total: suite.cases.length },
      results: [],
      judgeModel: judge?.model,
      createdAt: new Date().toISOString(),
    };
    upsertLocal(K.runs, run, 20);
    void executeLocal(run, suite, a, b);
    return run;
  },
  async cancelRun(id: string) {
    if ((await detectMode()) === "server") return void (await api(`/evalops/runs/${id}/cancel`, { method: "POST" }));
    localStops.set(id, true);
  },
  async deleteRun(id: string) {
    if ((await detectMode()) === "server") return void (await api(`/evalops/runs/${id}`, { method: "DELETE" }));
    localStops.set(id, true);
    writeLocal(K.runs, readLocal<EvalRun>(K.runs).filter((r) => r.id !== id));
  },

  async generate(docs: SourceDoc[], count: number): Promise<{ cases: EvalCase[]; engine: "llm" | "heuristic"; warnings: string[] }> {
    if ((await detectMode()) === "server") {
      return api("/evalops/generate", { method: "POST", body: JSON.stringify({ docs, count, judge: browserJudge() }) });
    }
    return generateCases(docs, count, browserLlm());
  },

  /** 裁判模型来源说明 */
  async judgeInfo(): Promise<{ model: string; source: "browser" | "server" } | null> {
    const b = browserJudge();
    if (b) return { model: b.model, source: "browser" };
    if ((await detectMode()) === "server") {
      const r = await api<{ serverJudge: { model: string } | null }>("/evalops/judge").catch(() => ({ serverJudge: null }));
      if (r.serverJudge) return { model: r.serverJudge.model, source: "server" };
    }
    return null;
  },
};
