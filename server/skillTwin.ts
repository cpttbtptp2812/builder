/**
 * 数字孪生：改规则前，把这项技能最近真实办过的单子（开跑时的材料快照）在隔离会话里
 * 分别用线上版和草稿版各跑一遍真实引擎，逐单比较结论、拦截、交付表。
 * 线上版重放还要和当时记录的每步结果比对，证明重放忠实；不忠实的单子单独标出。
 */

import type { Hono } from "hono";
import { dbAll, dbRun } from "./db.ts";
import { enrichSkillCatalog, hydrateSkill } from "../src/lib/skillMarkdown.ts";
import { mustRunServerProcessSkill } from "../src/lib/customerSkillKernel.ts";
import { stepFingerprint } from "../src/lib/provingGround.ts";
import { requirementsForSkill } from "../src/lib/productSkillInputs.ts";
import type { AgentSkill, SkillTraceStep } from "../src/lib/agentSkills.ts";
import type { RunView } from "../src/lib/runReducer.ts";
import { runSkillManifestOnServer } from "./skills.ts";
import { currentSkillRaw, newLabSession } from "./labSession.ts";
import { endOfTrace, restoreMaterials, runView } from "./runEventStore.ts";

import type { TwinCase, TwinGridDiff, TwinOutcome, TwinReport } from "../src/lib/skillTwinTypes.ts";

type Grid = { columns: string[]; rows: string[][] };

const isEngineStep = (t: { tool: string }) => t.tool.startsWith("__") && !/llm/i.test(t.tool);

function hydrate(skillId: string, raw: string, tag: string): AgentSkill {
  return enrichSkillCatalog([hydrateSkill(raw, { id: skillId, skillPath: `${tag}://${skillId}` })], "server")[0] as unknown as AgentSkill;
}

function detailOf(result: unknown): string {
  const r = (result ?? {}) as { detail?: unknown; error?: unknown };
  return String(r.detail ?? r.error ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function gridOf(result: unknown): Grid | null {
  const g = (result as { grid?: Grid } | null)?.grid;
  return g && Array.isArray(g.columns) && Array.isArray(g.rows) ? g : null;
}

function outcomeOf(trace: SkillTraceStep[]): TwinOutcome {
  const end = endOfTrace(trace);
  if (end.type === "run.failed") return { kind: "failed", at: end.stoppedAt, note: end.error };
  if (end.stoppedAt) return { kind: "stopped", at: end.stoppedAt, note: end.error };
  return { kind: "done" };
}

function summaryOf(trace: SkillTraceStep[]): string {
  const report = [...trace].reverse().find((t) => t.ok && /_report__$/.test(t.tool));
  if (report) return detailOf(report.result);
  const failed = trace.find((t) => !t.ok);
  return failed ? detailOf(failed.result) || failed.label : "";
}

function diffGrid(name: string, a: Grid | null, b: Grid | null): TwinGridDiff | null {
  const before = a?.rows ?? [];
  const after = b?.rows ?? [];
  const key = (r: string[]) => JSON.stringify(r);
  const pool = new Map<string, number>();
  for (const r of before) pool.set(key(r), (pool.get(key(r)) ?? 0) + 1);
  let added = 0;
  for (const r of after) {
    const n = pool.get(key(r)) ?? 0;
    if (n > 0) pool.set(key(r), n - 1);
    else added += 1;
  }
  const removed = [...pool.values()].reduce((s, n) => s + n, 0);
  const sameColumns = JSON.stringify(a?.columns ?? []) === JSON.stringify(b?.columns ?? []);
  if (!added && !removed && sameColumns) return null;
  const sample: TwinGridDiff["sample"] = [];
  for (let i = 0; i < Math.max(before.length, after.length) && sample.length < 6; i += 1) {
    const x = before[i] ?? null;
    const y = after[i] ?? null;
    if (JSON.stringify(x) !== JSON.stringify(y)) sample.push({ before: x, after: y });
  }
  return { name, columns: b?.columns ?? a?.columns ?? [], rowsBefore: before.length, rowsAfter: after.length, added, removed, sample };
}

/** 线上版重放和当时记录的每个引擎步比指纹；当时版本与线上不同时不要求一致 */
function unfaithfulSteps(recorded: RunView, replay: SkillTraceStep[]): string[] {
  const bad: string[] = [];
  for (const n of recorded.nodes) {
    if (n.status !== "completed" || !isEngineStep(n)) continue;
    const t = replay.find((x) => x.stepId === n.stepId);
    if (!t || stepFingerprint(t.result) !== stepFingerprint(n.result)) bad.push(n.name || n.stepId);
  }
  return bad;
}

async function replayOnce(skill: AgentSkill, materials: RunView["materials"], query: string): Promise<SkillTraceStep[]> {
  const sessionId = newLabSession();
  try {
    restoreMaterials(materials, sessionId);
    const { trace } = await runSkillManifestOnServer(skill, query, sessionId, { productWorkbench: true });
    return trace;
  } finally {
    dbRun("DELETE FROM product_datasets WHERE session_id=?", [sessionId]);
  }
}

export async function runSkillTwin(skillId: string, candidateRaw: string, limit = 12): Promise<TwinReport> {
  const started = Date.now();
  const online = currentSkillRaw(skillId);
  const fail = (error: string): TwinReport => ({
    ok: false,
    error,
    skillId,
    onlineVersion: online?.version ?? "",
    cases: [],
    skipped: [],
    totals: { replayed: 0, changed: 0, newlyStopped: 0, newlyPassed: 0, unfaithful: 0 },
    ms: Date.now() - started,
  });
  if (!online) return fail("没有这项技能");
  if (!mustRunServerProcessSkill(skillId)) return fail("数字孪生只针对处理材料的办事技能");
  const base = hydrate(skillId, online.raw, "twin-online");
  const cand = hydrate(skillId, candidateRaw, "twin-draft");
  const compileErr = (s: AgentSkill) => ((s as unknown as { diagnostics?: { level: string; message: string }[] }).diagnostics ?? []).find((d) => d.level === "error");
  const err = compileErr(cand);
  if (err) return fail(`草稿编译不过：${err.message}`);

  const rows = dbAll<{ run_id: string; created_at: string }>(
    "SELECT run_id, created_at FROM agent_runs WHERE skill_id=? AND kind IN ('product','console') AND parent_run_id IS NULL AND status='completed' ORDER BY created_at DESC LIMIT 200",
    [skillId],
  );
  const slots = new Set<string>(requirementsForSkill(skillId).map((r) => r.slot));
  const own = (view: RunView) => (slots.size ? view.materials.filter((m) => slots.has(m.slot)) : view.materials);
  const seen = new Set<string>();
  const picked: { runId: string; at: string; view: RunView }[] = [];
  const skipped: TwinReport["skipped"] = [];
  for (const r of rows) {
    if (picked.length >= limit) break;
    const view = runView(r.run_id);
    if (!view || !own(view).length) continue;
    const key = own(view).map((m) => m.sha256).sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ runId: r.run_id, at: r.created_at, view });
  }
  if (!picked.length) return fail("这项技能还没有带材料的历史办理记录。先在对话里用真实材料办几单，孪生才有东西可重放。");

  const cases: TwinCase[] = [];
  for (const p of picked) {
    let a: SkillTraceStep[];
    let b: SkillTraceStep[];
    try {
      a = await replayOnce(base, p.view.materials, p.view.query);
      b = await replayOnce(cand, p.view.materials, p.view.query);
    } catch (e) {
      skipped.push({ runId: p.runId, reason: e instanceof Error ? e.message : String(e) });
      continue;
    }
    const recordedVersion = p.view.skillVersion ?? "";
    const faithChecked = Boolean(recordedVersion) && recordedVersion === online.version;
    const drift = faithChecked ? unfaithfulSteps(p.view, a) : [];
    const steps = b
      .filter(isEngineStep)
      .map((y) => {
        const x = a.find((t) => t.stepId === y.stepId);
        return { y, x };
      })
      .filter(({ x, y }) => !x || stepFingerprint(x.result) !== stepFingerprint(y.result) || x.ok !== y.ok)
      .map(({ x, y }) => ({ stepId: y.stepId, label: y.label, before: x ? detailOf(x.result) : "（线上版没有这一步）", after: detailOf(y.result) }));
    const grids: TwinGridDiff[] = [];
    for (const y of b) {
      if (!/_deliver_/.test(y.tool)) continue;
      const x = a.find((t) => t.stepId === y.stepId);
      const d = diffGrid(y.label, gridOf(x?.result), gridOf(y.result));
      if (d) grids.push(d);
    }
    const before = outcomeOf(a);
    const after = outcomeOf(b);
    const summaryBefore = summaryOf(a);
    const summaryAfter = summaryOf(b);
    cases.push({
      runId: p.runId,
      at: p.at,
      query: p.view.query,
      materials: own(p.view).map((m) => `${m.title}（${m.rows} 行）`),
      recordedVersion,
      faithChecked,
      faithful: drift.length === 0,
      unfaithfulSteps: drift,
      before,
      after,
      summaryBefore,
      summaryAfter,
      steps,
      grids,
      changed: grids.length > 0 || before.kind !== after.kind || before.at !== after.at || summaryBefore !== summaryAfter,
    });
  }

  const stoppedish = (o: TwinOutcome) => o.kind !== "done";
  return {
    ok: true,
    skillId,
    onlineVersion: online.version,
    cases,
    skipped,
    totals: {
      replayed: cases.length,
      changed: cases.filter((c) => c.changed).length,
      newlyStopped: cases.filter((c) => !stoppedish(c.before) && stoppedish(c.after)).length,
      newlyPassed: cases.filter((c) => stoppedish(c.before) && !stoppedish(c.after)).length,
      unfaithful: cases.filter((c) => !c.faithful).length,
    },
    ms: Date.now() - started,
  };
}

export function registerSkillTwin(app: Hono) {
  app.post("/api/lab/twin", async (c) => {
    const body = await c.req.json<{ skillId?: string; raw?: string; limit?: number }>().catch(() => null);
    const skillId = String(body?.skillId ?? "");
    const raw = typeof body?.raw === "string" ? body.raw : "";
    if (!skillId || !raw.trim()) return c.json({ error: "skillId 和 raw 必填" }, 400);
    const limit = Math.max(1, Math.min(30, Number(body?.limit) || 12));
    try {
      const r = await runSkillTwin(skillId, raw, limit);
      return r.ok ? c.json(r) : c.json(r, 400);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "孪生重放失败" }, 500);
    }
  });
}
