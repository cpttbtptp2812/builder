/**
 * 时间旅行运行台：事件溯源。
 * - run_events 只插不改，seq 在 BEGIN IMMEDIATE 里取，跨进程也连续；
 * - 每步结束写检查点（graphCodec 编码，按 SHA-256 内容寻址存 run_artifacts），回到第 n 步 = 合并前 n 步检查点；
 * - 分叉在新的实验台会话里还原开跑时那一份材料，从第 n 步用新参数接着跑真实引擎，原会话不动；
 * - 进程中途退出：启动时把 status=running 的运行台运行从最后一个完成步之后续跑。
 */
import type { Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createHash, randomUUID } from "node:crypto";
import { db, dbAll, dbGet, dbRun, nowIso } from "./db.ts";
import { getSkill, runSkillManifestOnServer, type ClientCtx } from "./skills.ts";
import { newLabSession, isLabSession, currentSkillRaw } from "./labSession.ts";
import { safeLog } from "./observability.ts";
import type { AgentSkill, SkillTraceStep } from "../src/lib/agentSkills.ts";
import type { RunEvent, RunEventType, RunStatus } from "../src/lib/platformProtocol.ts";
import { encodeGraph, decodeGraph, type EncodedGraph } from "../src/lib/graphCodec.ts";
import {
  reduceRun,
  type CheckpointRef,
  type NodeEndedPayload,
  type RunCreatedPayload,
  type RunMaterial,
  type RunView,
} from "../src/lib/runReducer.ts";
import { isDeskGuardCode } from "../src/lib/deskProgramMeta.ts";

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_runs (
    run_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    session_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    process_id TEXT,
    parent_run_id TEXT,
    status TEXT NOT NULL,
    skill_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);
  CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
  CREATE TABLE IF NOT EXISTS run_events (
    run_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    event_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    node_id TEXT,
    payload_json TEXT NOT NULL,
    at TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_run_events_node ON run_events(run_id, type, node_id) WHERE node_id IS NOT NULL;
  CREATE TABLE IF NOT EXISTS run_artifacts (
    sha256 TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

/** 单个检查点上限；超过就不存，界面上那一步不能作为分叉点 */
const CHECKPOINT_MAX_BYTES = 8 * 1024 * 1024;
const GUARD_CODES = new Set(["SHEET_GUARD", "CONTRACT_GUARD", "DATA_GUARD", "IMAGE_GUARD"]);

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/* ───────────── 事件与产物 ───────────── */

export function appendEvent(runId: string, type: RunEventType, payload: object, nodeId?: string): RunEvent {
  const at = nowIso();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (nodeId) {
      const dup = db
        .prepare("SELECT seq, event_id, payload_json, at FROM run_events WHERE run_id=? AND type=? AND node_id=?")
        .get(runId, type, nodeId) as { seq: number; event_id: string; payload_json: string; at: string } | undefined;
      if (dup) {
        db.exec("COMMIT");
        return { id: dup.event_id, runId, seq: Number(dup.seq), type, at: dup.at, nodeId, payload: JSON.parse(dup.payload_json) };
      }
    }
    const row = db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM run_events WHERE run_id=?").get(runId) as { s: number };
    const seq = Number(row.s) + 1;
    const id = randomUUID();
    db.prepare("INSERT INTO run_events (run_id, seq, event_id, type, node_id, payload_json, at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      runId,
      seq,
      id,
      type,
      nodeId ?? null,
      JSON.stringify(payload),
      at,
    );
    db.prepare("UPDATE agent_runs SET updated_at=? WHERE run_id=?").run(at, runId);
    db.exec("COMMIT");
    if (type === "run.completed" || type === "run.failed") {
      void import("./otelExport.ts").then((mod) => mod.exportRunTrace(runId));
    }
    return { id, runId, seq, type, at, nodeId, payload: payload as Record<string, unknown> };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function listEvents(runId: string, afterSeq = 0): RunEvent[] {
  return dbAll<{ seq: number; event_id: string; type: RunEventType; node_id: string | null; payload_json: string; at: string }>(
    "SELECT seq, event_id, type, node_id, payload_json, at FROM run_events WHERE run_id=? AND seq>? ORDER BY seq",
    [runId, afterSeq],
  ).map((r) => ({
    id: r.event_id,
    runId,
    seq: Number(r.seq),
    type: r.type,
    at: r.at,
    ...(r.node_id ? { nodeId: r.node_id } : {}),
    payload: JSON.parse(r.payload_json),
  }));
}

function putArtifact(kind: string, payload: string): { sha256: string; bytes: number } {
  const hash = sha256(payload);
  const bytes = Buffer.byteLength(payload);
  dbRun("INSERT OR IGNORE INTO run_artifacts (sha256, kind, bytes, payload, created_at) VALUES (?, ?, ?, ?, ?)", [hash, kind, bytes, payload, nowIso()]);
  return { sha256: hash, bytes };
}

export function getArtifact(hash: string): string | null {
  return dbGet<{ payload: string }>("SELECT payload FROM run_artifacts WHERE sha256=?", [hash])?.payload ?? null;
}

/* ───────────── 材料快照 ───────────── */

type MaterialBody = { slot: string; title: string; columns: string[]; rows: string[][] };

export function snapshotMaterials(sessionId: string): RunMaterial[] {
  return dbAll<{ slot: string; title: string; columns_json: string; rows_json: string }>(
    "SELECT slot, title, columns_json, rows_json FROM product_datasets WHERE session_id=? ORDER BY slot",
    [sessionId],
  ).map((r) => {
    const body: MaterialBody = { slot: r.slot, title: r.title, columns: JSON.parse(r.columns_json), rows: JSON.parse(r.rows_json) };
    const art = putArtifact("material", JSON.stringify(body));
    return { slot: r.slot, title: r.title, sha256: art.sha256, rows: body.rows.length, columns: body.columns };
  });
}

export function restoreMaterials(materials: RunMaterial[], sessionId: string) {
  for (const m of materials) {
    const text = getArtifact(m.sha256);
    if (!text) throw new Error(`材料「${m.title}」的快照不见了，不能分叉`);
    if (sha256(text) !== m.sha256) throw new Error(`材料「${m.title}」的快照哈希对不上，拒绝还原`);
    const body = JSON.parse(text) as MaterialBody;
    dbRun(
      `INSERT INTO product_datasets (session_id, slot, title, columns_json, rows_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, slot) DO UPDATE SET title=excluded.title, columns_json=excluded.columns_json, rows_json=excluded.rows_json, updated_at=excluded.updated_at`,
      [sessionId, body.slot, body.title, JSON.stringify(body.columns), JSON.stringify(body.rows), nowIso()],
    );
  }
}

/* ───────────── 检查点 ───────────── */

function saveCheckpoint(delta: Record<string, unknown>): CheckpointRef {
  let text: string;
  try {
    text = JSON.stringify(encodeGraph(delta));
  } catch (err) {
    safeLog("run.checkpoint.encode_failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
  if (Buffer.byteLength(text) > CHECKPOINT_MAX_BYTES) return null;
  return putArtifact("checkpoint", text);
}

/** 第 index 步开跑前的变量 = 前 index 步检查点按顺序合并 */
export function varsBefore(view: RunView, index: number): { vars: Record<string, unknown> } | { error: string } {
  const vars: Record<string, unknown> = {};
  for (const n of view.nodes.slice(0, index)) {
    if (n.status !== "completed") return { error: `第 ${n.index + 1} 步「${n.label}」没有完成，不能从后面接着跑` };
    if (!n.checkpoint) return { error: `第 ${n.index + 1} 步「${n.label}」没有检查点（状态过大或无法编码），不能从后面接着跑` };
    const text = getArtifact(n.checkpoint.sha256);
    if (!text || sha256(text) !== n.checkpoint.sha256) return { error: `第 ${n.index + 1} 步检查点损坏` };
    Object.assign(vars, decodeGraph<Record<string, unknown>>(JSON.parse(text) as EncodedGraph));
  }
  return { vars };
}

/* ───────────── 技能快照 ───────────── */

type StoredSkill = Pick<AgentSkill, "id" | "name"> & {
  version: string;
  steps: { id: string; label: string; tool: string; args: Record<string, unknown> }[];
};

function storableSkill(skill: AgentSkill): StoredSkill | null {
  if (skill.steps.some((s) => typeof s.args === "function")) return null;
  return {
    id: skill.id,
    name: skill.name,
    version: currentSkillRaw(skill.id)?.version ?? "",
    steps: skill.steps.map((s) => ({ id: s.id, label: s.label, tool: s.tool, args: s.args as Record<string, unknown> })),
  };
}

function runRow(runId: string) {
  return dbGet<{ run_id: string; kind: string; session_id: string; skill_id: string; status: string; skill_json: string | null; parent_run_id: string | null }>(
    "SELECT run_id, kind, session_id, skill_id, status, skill_json, parent_run_id FROM agent_runs WHERE run_id=?",
    [runId],
  );
}

function setStatus(runId: string, status: RunStatus) {
  dbRun("UPDATE agent_runs SET status=?, updated_at=? WHERE run_id=?", [status, nowIso(), runId]);
}

/** 签发证据包用：这次运行实际执行的技能快照原文 */
export function runSkillSnapshot(runId: string): string | null {
  return runRow(runId)?.skill_json ?? null;
}

export function runView(runId: string, uptoSeq?: number): RunView | null {
  if (!runRow(runId)) return null;
  return reduceRun(listEvents(runId), uptoSeq);
}

function createRunRecord(opts: {
  kind: RunCreatedPayload["kind"];
  sessionId: string;
  skill: AgentSkill;
  stored: StoredSkill | null;
  query: string;
  processId?: string;
  parentRunId?: string;
  fork?: RunCreatedPayload["fork"];
  materials?: RunMaterial[];
}): string {
  const runId = randomUUID();
  const at = nowIso();
  dbRun(
    "INSERT INTO agent_runs (run_id, kind, session_id, skill_id, process_id, parent_run_id, status, skill_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [runId, opts.kind, opts.sessionId, opts.skill.id, opts.processId ?? null, opts.parentRunId ?? null, "queued", opts.stored ? JSON.stringify(opts.stored) : null, at, at],
  );
  const payload: RunCreatedPayload = {
    kind: opts.kind,
    skillId: opts.skill.id,
    skillVersion: opts.stored?.version ?? currentSkillRaw(opts.skill.id)?.version ?? "",
    title: opts.skill.name,
    query: opts.query,
    sessionId: opts.sessionId,
    steps: opts.skill.steps.map((s) => ({ id: s.id, tool: s.tool, label: s.label })),
    materials: opts.materials ?? snapshotMaterials(opts.sessionId),
    ...(opts.parentRunId ? { parentRunId: opts.parentRunId } : {}),
    ...(opts.fork ? { fork: opts.fork } : {}),
  };
  appendEvent(runId, "run.created", payload);
  return runId;
}

function publicArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([k]) => !k.startsWith("__")));
}

type StepHooks = Required<Pick<NonNullable<ClientCtx["exec"]>, "onStepStart" | "onStepDone">>;

/** 运行事件钩子：记录失败只写日志，不影响这次办理本身 */
function recorderFor(runId: string, attempts: Map<number, number>): StepHooks {
  const safe = <A extends unknown[]>(name: string, fn: (...a: A) => void) => (...a: A) => {
    try {
      fn(...a);
    } catch (err) {
      safeLog("run.record_failed", { runId, at: name, error: err instanceof Error ? err.message : String(err) });
    }
  };
  return {
    onStepStart: safe("start", (step: AgentSkill["steps"][0], index: number, args: Record<string, unknown>) => {
      const attempt = (attempts.get(index) ?? 0) + 1;
      attempts.set(index, attempt);
      appendEvent(runId, "node.started", { stepId: step.id, index, tool: step.tool, attempt, args: publicArgs(args) }, `${runId}:${step.id}:${attempt}`);
    }),
    onStepDone: safe("done", (row: SkillTraceStep, index: number, _args: Record<string, unknown>, delta: Record<string, unknown>) => {
      const attempt = attempts.get(index) ?? 1;
      const payload: NodeEndedPayload = {
        stepId: row.stepId,
        index,
        tool: row.tool,
        attempt,
        label: row.label,
        ok: row.ok,
        ms: row.ms,
        result: row.result ?? null,
        checkpoint: saveCheckpoint(delta),
        gateway: row.gateway,
      };
      appendEvent(runId, row.ok ? "node.completed" : "node.failed", payload, `${runId}:${row.stepId}:${attempt}`);
    }),
  };
}

function priorAttempts(view: RunView): Map<number, number> {
  return new Map(view.nodes.filter((n) => n.attempt > 0).map((n) => [n.index, n.attempt]));
}

export function endOfTrace(trace: SkillTraceStep[]): { type: "run.completed" | "run.failed"; error?: string; stoppedAt?: string } {
  const failed = trace.find((t) => !t.ok);
  if (!failed) return { type: "run.completed" };
  const body = failed.result as { code?: string; detail?: string; error?: string; meta?: { llm?: string } } | undefined;
  if (failed.tool === "__llm_product_brief__" && body?.meta?.llm === "failed") return { type: "run.completed" };
  const text = body?.detail?.trim() || body?.error?.trim() || failed.label;
  if (body?.code && (GUARD_CODES.has(body.code) || isDeskGuardCode(body.code))) return { type: "run.completed", stoppedAt: failed.stepId, error: text };
  return { type: "run.failed", error: text, stoppedAt: failed.stepId };
}

/* ───────────── 执行 ───────────── */

async function execute(runId: string, opts: { startAt: number; initialVars?: Record<string, unknown> }) {
  const row = runRow(runId);
  if (!row?.skill_json) throw new Error("运行记录缺少技能快照");
  const stored = JSON.parse(row.skill_json) as StoredSkill;
  const skill = { ...(getSkill(row.skill_id) ?? {}), ...stored } as AgentSkill;
  const view = reduceRun(listEvents(runId));
  setStatus(runId, "running");
  if (opts.startAt === 0 && !view.resumes.length) appendEvent(runId, "run.started", {});
  const t0 = performance.now();
  try {
    const { trace } = await runSkillManifestOnServer(skill, view.query, row.session_id, {
      productWorkbench: true,
      exec: { startAt: opts.startAt, initialVars: opts.initialVars, ...recorderFor(runId, priorAttempts(view)) },
    });
    const end = endOfTrace(trace);
    appendEvent(runId, end.type, { totalMs: Math.round(performance.now() - t0), ...(end.error ? { error: end.error } : {}), ...(end.stoppedAt ? { stoppedAt: end.stoppedAt } : {}) });
    setStatus(runId, end.type === "run.completed" ? "completed" : "failed");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    appendEvent(runId, "run.failed", { totalMs: Math.round(performance.now() - t0), error });
    setStatus(runId, "failed");
  }
}

export function startConsoleRun(sessionId: string, skillId: string, query: string): { runId: string; done: Promise<void> } | { error: string } {
  const skill = getSkill(skillId);
  if (!skill) return { error: `没有技能 ${skillId}` };
  const stored = storableSkill(skill);
  if (!stored) return { error: "这项技能的步骤参数由代码生成，运行台无法保存快照" };
  const runId = createRunRecord({ kind: "console", sessionId, skill, stored, query });
  return { runId, done: execute(runId, { startAt: 0 }) };
}

/**
 * 分叉：stepId 这一步用新参数；后面步骤里声明了同名参数的也跟着用新值（台账引擎每步都带一份完整口径）。
 * 只允许改该步已声明的标量参数，不能借分叉注入 __ 开头的内部参数。
 */
export function forkRun(
  parentId: string,
  stepId: string,
  args: Record<string, unknown>,
): { runId: string; sessionId: string; done: Promise<void> } | { error: string } {
  const row = runRow(parentId);
  if (!row?.skill_json) return { error: "这次运行没有技能快照，不能分叉" };
  const stored = JSON.parse(row.skill_json) as StoredSkill;
  const index = stored.steps.findIndex((s) => s.id === stepId);
  if (index < 0) return { error: `没有步骤 ${stepId}` };
  const declared = stored.steps[index]!.args;
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k.startsWith("__") || !(k in declared)) return { error: `「${stored.steps[index]!.label}」没有参数 ${k}` };
    if (!["string", "number", "boolean"].includes(typeof v)) return { error: `参数 ${k} 只能是文字、数字或开关` };
    if (typeof v === "number" && !Number.isFinite(v)) return { error: `参数 ${k} 不是有效数字` };
    if (String(v) !== String(declared[k])) changes[k] = v;
  }
  if (!Object.keys(changes).length) return { error: "参数没有变化" };

  const parent = reduceRun(listEvents(parentId));
  if (parent.status === "running" || parent.status === "queued") return { error: "原运行还没结束" };
  const before = varsBefore(parent, index);
  if ("error" in before) return before;

  const overrides: Record<string, Record<string, unknown>> = {};
  stored.steps.forEach((s, j) => {
    if (j < index) return;
    const own = j === index ? changes : Object.fromEntries(Object.entries(changes).filter(([k]) => k in s.args));
    if (Object.keys(own).length) overrides[s.id] = own;
  });
  const forked: StoredSkill = {
    ...stored,
    steps: stored.steps.map((s) => (overrides[s.id] ? { ...s, args: { ...s.args, ...overrides[s.id] } } : s)),
  };

  const sessionId = newLabSession();
  try {
    restoreMaterials(parent.materials, sessionId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  const skill = { ...(getSkill(row.skill_id) ?? {}), ...forked } as AgentSkill;
  const forkSeq = parent.nodes[index - 1]?.endedSeq ?? 1;
  const runId = createRunRecord({
    kind: "console",
    sessionId,
    skill,
    stored: forked,
    query: parent.query,
    parentRunId: parentId,
    fork: { fromSeq: forkSeq, stepId, index, args: changes },
    materials: parent.materials,
  });
  appendEvent(runId, "run.started", {});
  for (const n of parent.nodes.slice(0, index)) {
    const payload: NodeEndedPayload = {
      stepId: n.stepId,
      index: n.index,
      tool: n.tool,
      attempt: n.attempt,
      label: n.label,
      ok: true,
      ms: n.ms ?? 0,
      result: n.result,
      checkpoint: n.checkpoint,
      inherited: true,
    };
    appendEvent(runId, "node.completed", payload, `${runId}:${n.stepId}:${n.attempt}`);
  }
  appendEvent(parentId, "run.branched", { childRunId: runId, stepId, index });
  return { runId, sessionId, done: execute(runId, { startAt: index, initialVars: before.vars }) };
}

/** 从最后一个完成步之后接着跑（进程中途退出后的恢复） */
export function resumeRun(runId: string): { runId: string; fromIndex: number; done: Promise<void> } | { error: string } {
  const row = runRow(runId);
  if (!row) return { error: "没有这次运行" };
  if (row.status !== "running") return { error: `运行状态是 ${row.status}，不需要恢复` };
  const view = reduceRun(listEvents(runId));
  let fromIndex = view.nodes.findIndex((n) => n.status !== "completed");
  if (fromIndex < 0) fromIndex = view.nodes.length;
  const before = varsBefore(view, fromIndex);
  if ("error" in before) return before;
  appendEvent(runId, "run.resumed", { fromIndex, reason: "进程中断后恢复" });
  return { runId, fromIndex, done: execute(runId, { startAt: fromIndex, initialVars: before.vars }) };
}

export function resumeInterruptedRuns(): string[] {
  const ids = dbAll<{ run_id: string }>("SELECT run_id FROM agent_runs WHERE status='running' AND kind='console'").map((r) => r.run_id);
  const resumed: string[] = [];
  for (const id of ids) {
    const r = resumeRun(id);
    if ("error" in r) {
      appendEvent(id, "run.failed", { totalMs: 0, error: `恢复失败：${r.error}` });
      setStatus(id, "failed");
    } else {
      resumed.push(id);
      void r.done;
    }
  }
  if (ids.length) safeLog("run.resume_on_boot", { found: ids.length, resumed: resumed.length });
  return resumed;
}

/* ───────────── 客户办事主链记录（只写事件，不改办理语义） ───────────── */

export function productRunRecorder(processId: string, sessionId: string, skillId: string, query: string): {
  exec: StepHooks;
  finish: (trace: SkillTraceStep[], totalMs: number) => void;
} | null {
  try {
    const skill = getSkill(skillId);
    if (!skill) return null;
    const runId = createRunRecord({ kind: "product", sessionId, skill, stored: storableSkill(skill), query, processId });
    appendEvent(runId, "run.started", {});
    setStatus(runId, "running");
    return {
      exec: recorderFor(runId, new Map()),
      finish: (trace, totalMs) => {
        try {
          const end = endOfTrace(trace);
          appendEvent(runId, end.type, { totalMs, ...(end.error ? { error: end.error } : {}), ...(end.stoppedAt ? { stoppedAt: end.stoppedAt } : {}) });
          setStatus(runId, end.type === "run.completed" ? "completed" : "failed");
        } catch (err) {
          safeLog("run.record_failed", { runId, at: "finish", error: err instanceof Error ? err.message : String(err) });
        }
      },
    };
  } catch (err) {
    safeLog("run.record_failed", { processId, at: "create", error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/* ───────────── 列表 ───────────── */

export function listRuns(sessionIds: string[]): { runId: string; kind: string; skillId: string; status: string; parentRunId: string | null; createdAt: string; updatedAt: string }[] {
  if (!sessionIds.length) return [];
  return dbAll<{ run_id: string; kind: string; skill_id: string; status: string; parent_run_id: string | null; created_at: string; updated_at: string }>(
    `SELECT run_id, kind, skill_id, status, parent_run_id, created_at, updated_at FROM agent_runs WHERE session_id IN (${sessionIds.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT 50`,
    sessionIds,
  ).map((r) => ({ runId: r.run_id, kind: r.kind, skillId: r.skill_id, status: r.status, parentRunId: r.parent_run_id, createdAt: r.created_at, updatedAt: r.updated_at }));
}

/* ───────────── 路由（runId 是不可猜的 UUID，持有即可读；新建只接受实验台会话） ───────────── */

export function registerRunConsole(app: Hono) {
  app.post("/api/runs", async (c) => {
    const body = await c.req.json<{ sessionId?: string; skillId?: string; query?: string }>().catch(() => null);
    if (!isLabSession(body?.sessionId)) return c.json({ error: "请先在实验台导入材料" }, 400);
    if (!body?.skillId) return c.json({ error: "skillId 必填" }, 400);
    const r = startConsoleRun(body.sessionId, body.skillId, body.query?.trim() || "按导入的材料办理");
    if ("error" in r) return c.json(r, 400);
    void r.done;
    return c.json({ runId: r.runId });
  });
  app.get("/api/runs", (c) => {
    const ids = (c.req.query("sessionIds") ?? "").split(",").filter((s) => isLabSession(s));
    return c.json({ runs: listRuns(ids) });
  });
  app.get("/api/runs/:id/events", (c) => {
    const id = c.req.param("id");
    if (!runRow(id)) return c.json({ error: "没有这次运行" }, 404);
    return c.json({ events: listEvents(id, Number(c.req.query("after") ?? 0) || 0) });
  });
  app.get("/api/runs/:id/state", (c) => {
    const seq = c.req.query("seq");
    const view = runView(c.req.param("id"), seq ? Number(seq) : undefined);
    if (!view) return c.json({ error: "没有这次运行" }, 404);
    return c.json(view);
  });
  app.post("/api/runs/:id/fork", async (c) => {
    const body = await c.req.json<{ stepId?: string; args?: Record<string, unknown> }>().catch(() => null);
    if (!body?.stepId || !body.args || typeof body.args !== "object") return c.json({ error: "stepId 和 args 必填" }, 400);
    const r = forkRun(c.req.param("id"), body.stepId, body.args);
    if ("error" in r) return c.json(r, 400);
    void r.done;
    return c.json({ runId: r.runId, sessionId: r.sessionId });
  });
  app.get("/api/runs/:id/stream", (c) => {
    const id = c.req.param("id");
    if (!runRow(id)) return c.json({ error: "没有这次运行" }, 404);
    return streamRunEvents(c, id, Number(c.req.query("after") ?? 0) || 0);
  });
}

/** 运行或它的祖先运行属于这个会话（分叉会落在新的实验会话里，归属跟着根运行走） */
export function runOwnedBySession(runId: string, sessionId: string): boolean {
  let id: string | null = runId;
  for (let depth = 0; id && depth < 32; depth += 1) {
    const row: { session_id: string; parent_run_id: string | null } | undefined = dbGet<{ session_id: string; parent_run_id: string | null }>("SELECT session_id, parent_run_id FROM agent_runs WHERE run_id=?", [id]);
    if (!row) return false;
    if (row.session_id === sessionId) return true;
    id = row.parent_run_id;
  }
  return false;
}

export function streamRunEvents(c: Context, id: string, from: number) {
  let after = from;
  return streamSSE(c, async (stream) => {
    const deadline = Date.now() + 10 * 60_000;
    while (!stream.aborted && Date.now() < deadline) {
      for (const ev of listEvents(id, after)) {
        await stream.writeSSE({ event: "run-event", data: JSON.stringify(ev), id: String(ev.seq) });
        after = ev.seq;
      }
      const status = runRow(id)?.status;
      if (status !== "running" && status !== "queued") break;
      await stream.sleep(150);
    }
    for (const ev of listEvents(id, after)) await stream.writeSSE({ event: "run-event", data: JSON.stringify(ev), id: String(ev.seq) });
    await stream.writeSSE({ event: "end", data: "{}" });
  });
}
