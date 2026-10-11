import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { gridToCsv, parseCsvText, type ProductDataSlot } from "../src/lib/productDataStore.ts";
import {
  productSkillUsesUserData,
  requirementsForSkill,
  type SkillDataRequirement,
} from "../src/lib/productSkillInputs.ts";
import { getSkill, type SkillTraceStep } from "./skills.ts";
import { runSkillOnServer } from "./skills.ts";
import { dbAll, dbGet, dbRun, nowIso } from "./db.ts";
import { getServerDataset, saveServerDataset, serverDatasetRowCount } from "./productDataStore.ts";
import { paperForSkill } from "../src/lib/workPaper.ts";
import { synthesizeResponse } from "../src/lib/skillResponseSynth.ts";

export type ProductRunImportPart = {
  kind: "import";
  sessionId: string;
  processId: string;
  slot: string;
  label: string;
  hint: string;
  templateCsv: string;
  filename: string;
  ready: boolean;
};

export type ProductRunProcessPart = {
  kind: "process";
  processId: string;
  label: string;
  detail: string;
  ok: boolean;
};

export type ProductRunFinishPart = {
  kind: "finish";
  processId: string;
  summary: string;
};

export type ProductRunPart = ProductRunImportPart | ProductRunProcessPart | ProductRunFinishPart;

export type ProductRunStartResult =
  | {
      ok: true;
      processId: string;
      status: "waiting_import";
      message: string;
      parts: ProductRunImportPart[];
      skillId: string;
      query: string;
    }
  | {
      ok: true;
      processId: string;
      status: "finish";
      message: string;
      parts: ProductRunPart[];
      skillId: string;
      query: string;
      trace: unknown;
      paper: unknown;
      runtime: "server";
    }
  | { ok: false; error: string };

type StreamEmit = (event: string, data: unknown) => Promise<void>;

function missingForSession(sessionId: string, skillId: string): SkillDataRequirement[] {
  if (!productSkillUsesUserData(skillId)) return [];
  return requirementsForSkill(skillId).filter((req) => serverDatasetRowCount(sessionId, req.slot) < 1);
}

function augmentQuery(sessionId: string, skillId: string, query: string): string {
  let q = query.trim();
  for (const req of requirementsForSkill(skillId)) {
    const ds = getServerDataset(sessionId, req.slot);
    if (!ds) continue;
    const csv = gridToCsv(ds.columns, ds.rows);
    q += `\n\n\`\`\`csv\n${csv}\n\`\`\``;
  }
  return q;
}

function importParts(sessionId: string, processId: string, skillId: string): ProductRunImportPart[] {
  return missingForSession(sessionId, skillId).map((req) => ({
    kind: "import" as const,
    sessionId,
    processId,
    slot: req.slot,
    label: req.label,
    hint: req.hint,
    templateCsv: req.templateCsv,
    filename: req.filename,
    ready: serverDatasetRowCount(sessionId, req.slot) > 0,
  }));
}

function gateMessage(skillName: string, missing: SkillDataRequirement[]): string {
  return [
    `办理 **${skillName}** 还需要您提供下面这份材料：`,
    "",
    ...missing.map((m) => `- **${m.label}** — ${m.hint}`),
    "",
    "请在下方导入 CSV，导入完成后点 **继续执行**。",
  ].join("\n");
}

function stepToPart(processId: string, step: SkillTraceStep): ProductRunProcessPart {
  return {
    kind: "process",
    processId,
    label: step.label,
    detail:
      typeof step.result === "object" && step.result && "detail" in (step.result as object)
        ? String((step.result as { detail?: string }).detail ?? step.label)
        : step.label,
    ok: step.ok,
  };
}

async function executeProcess(
  processId: string,
  sessionId: string,
  skillId: string,
  query: string,
  emit?: StreamEmit,
): Promise<ProductRunStartResult> {
  const skill = getSkill(skillId);
  if (!skill) return { ok: false, error: `未知技能 ${skillId}` };

  const missing = missingForSession(sessionId, skillId);
  if (missing.length) {
    const parts = importParts(sessionId, processId, skillId);
    const message = gateMessage(skill.name, missing);
    dbRun(`UPDATE product_processes SET status = ?, updated_at = ? WHERE process_id = ?`, [
      "waiting_import",
      nowIso(),
      processId,
    ]);
    const gate = {
      ok: true as const,
      processId,
      status: "waiting_import" as const,
      message,
      parts,
      skillId,
      query,
    };
    await emit?.("gate", gate);
    return gate;
  }

  dbRun(`UPDATE product_processes SET status = ?, updated_at = ? WHERE process_id = ?`, [
    "running",
    nowIso(),
    processId,
  ]);
  await emit?.("running", { processId, skillId, query });

  const augmented = augmentQuery(sessionId, skillId, query);
  const parts: ProductRunPart[] = [];
  const { trace, result, totalMs } = await runSkillOnServer(skillId, augmented, sessionId, {
    productWorkbench: true,
    onStep: async (step) => {
      const part = stepToPart(processId, step);
      parts.push(part);
      await emit?.("step", part);
    },
  });

  const text = synthesizeResponse(skill, result as { dashboard?: unknown; meta?: unknown; markdown?: string }, augmented);
  const paper = paperForSkill(skill, augmented, { productWorkbench: true });
  parts.push({ kind: "finish", processId, summary: text.slice(0, 240) });

  dbRun(
    `UPDATE product_processes SET status = ?, trace_json = ?, result_json = ?, updated_at = ? WHERE process_id = ?`,
    ["finish", JSON.stringify(trace), JSON.stringify({ text, paper, totalMs }), nowIso(), processId],
  );

  const finish = {
    ok: true as const,
    processId,
    status: "finish" as const,
    message: text,
    parts,
    skillId,
    query,
    trace,
    paper,
    runtime: "server" as const,
  };
  await emit?.("finish", finish);
  return finish;
}

export async function startProductRun(opts: {
  sessionId: string;
  skillId: string;
  query: string;
  emit?: StreamEmit;
}): Promise<ProductRunStartResult> {
  const skill = getSkill(opts.skillId);
  if (!skill) return { ok: false, error: `未知技能 ${opts.skillId}` };

  const processId = randomUUID();
  const now = nowIso();
  dbRun(
    `INSERT INTO product_processes (process_id, session_id, skill_id, query, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [processId, opts.sessionId, opts.skillId, opts.query, "starting", now, now],
  );

  return executeProcess(processId, opts.sessionId, opts.skillId, opts.query, opts.emit);
}

export async function continueProductRun(
  processId: string,
  sessionId: string,
  emit?: StreamEmit,
): Promise<ProductRunStartResult> {
  const row = dbGet<{ skill_id: string; query: string; session_id: string }>(
    `SELECT skill_id, query, session_id FROM product_processes WHERE process_id = ?`,
    [processId],
  );
  if (!row) return { ok: false, error: "process 不存在或已过期" };
  if (row.session_id !== sessionId) return { ok: false, error: "session 与 process 不匹配" };
  return executeProcess(processId, sessionId, row.skill_id, row.query, emit);
}

export { saveServerDataset, getServerDataset };

export function registerProductRun(app: Hono) {
  app.get("/api/product-run/active", (c) => {
    const sessionId = c.req.query("sessionId")?.trim();
    if (!sessionId) return c.json({ ok: false, error: "缺少 sessionId" }, 400);
    const rows = dbAll<{
      process_id: string;
      skill_id: string;
      query: string;
      status: string;
      updated_at: string;
    }>(
      `SELECT process_id, skill_id, query, status, updated_at FROM product_processes
       WHERE session_id = ? AND status IN ('waiting_import', 'running')
       ORDER BY updated_at DESC LIMIT 5`,
      [sessionId],
    );
    return c.json({ ok: true, processes: rows });
  });

  app.post("/api/product-run/stream", async (c) => {
    const body = await c.req.json<
      | { action: "start"; sessionId: string; skillId: string; query: string }
      | { action: "continue"; processId: string; sessionId: string }
    >();

    return streamSSE(c, async (stream) => {
      const emit: StreamEmit = async (event, data) => {
        await stream.writeSSE({ event, data: JSON.stringify(data) });
      };

      try {
        if (body.action === "start") {
          if (!body.sessionId?.trim() || !body.skillId?.trim() || !body.query?.trim()) {
            await emit("error", { error: "缺少 sessionId / skillId / query" });
            return;
          }
          const result = await startProductRun({
            sessionId: body.sessionId.trim(),
            skillId: body.skillId.trim(),
            query: body.query.trim(),
            emit,
          });
          if (!result.ok) await emit("error", result);
        } else if (body.action === "continue") {
          if (!body.processId?.trim() || !body.sessionId?.trim()) {
            await emit("error", { error: "缺少 processId / sessionId" });
            return;
          }
          const result = await continueProductRun(body.processId.trim(), body.sessionId.trim(), emit);
          if (!result.ok) await emit("error", result);
        } else {
          await emit("error", { error: "未知 action" });
        }
      } catch (err) {
        await emit("error", { error: err instanceof Error ? err.message : "执行失败" });
      } finally {
        await stream.writeSSE({ event: "done", data: "{}" });
      }
    });
  });

  app.post("/api/product-run/start", async (c) => {
    const body = await c.req.json<{ sessionId: string; skillId: string; query: string }>();
    if (!body.sessionId?.trim() || !body.skillId?.trim() || !body.query?.trim()) {
      return c.json({ ok: false, error: "缺少 sessionId / skillId / query" }, 400);
    }
    const result = await startProductRun({
      sessionId: body.sessionId.trim(),
      skillId: body.skillId.trim(),
      query: body.query.trim(),
    });
    return c.json(result);
  });

  app.post("/api/product-run/continue", async (c) => {
    const body = await c.req.json<{ processId: string; sessionId: string }>();
    if (!body.processId?.trim() || !body.sessionId?.trim()) {
      return c.json({ ok: false, error: "缺少 processId / sessionId" }, 400);
    }
    const result = await continueProductRun(body.processId.trim(), body.sessionId.trim());
    return c.json(result);
  });

  app.post("/api/product-run/dataset", async (c) => {
    const body = await c.req.json<{ sessionId: string; slot: ProductDataSlot; csv: string; title?: string }>();
    if (!body.sessionId?.trim() || !body.slot || !body.csv?.trim()) {
      return c.json({ ok: false, error: "缺少 sessionId / slot / csv" }, 400);
    }
    const parsed = parseCsvText(body.csv, body.title ?? body.slot, body.slot);
    if ("error" in parsed) return c.json({ ok: false, error: parsed.error }, 400);
    saveServerDataset(body.sessionId.trim(), {
      slot: parsed.slot,
      title: parsed.title,
      columns: parsed.columns,
      rows: parsed.rows,
    });
    return c.json({ ok: true, rows: parsed.rows.length, updatedAt: nowIso() });
  });
}
