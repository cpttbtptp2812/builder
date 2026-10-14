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
import {
  deleteServerDataset,
  getServerDataset,
  ProductDatasetNormalizeError,
  listDatasetCells,
  saveDatasetCells,
  saveServerDataset,
  serverDatasetRowCount,
} from "./productDataStore.ts";
import { workbookBufferToTable } from "../src/lib/workbookImport.ts";
import { paperForSkill } from "../src/lib/workPaper.ts";
import { synthesizeProductFinishMessage } from "../src/lib/skillResponseSynth.ts";
import { skillLabel } from "../src/lib/skillRouter.ts";
import {
  formatDatasetValidationMessage,
  validateDatasetForSlot,
} from "../src/lib/productDatasetValidate.ts";
import type { ProductLlmConfig } from "../src/lib/llmProductBrief.ts";
import { isDeskGuardCode } from "../src/lib/deskProgramMeta.ts";
import { requestIdentity } from "./security.ts";
import { recordProductRun, safeLog } from "./observability.ts";
import { productRunRecorder } from "./runEventStore.ts";

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
  /** 已导入时的材料名（客户可见，非 slot id） */
  materialTitle?: string;
  rowCount?: number;
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

function importParts(sessionId: string, processId: string, skillId: string): ProductRunImportPart[] {
  return requirementsForSkill(skillId).map((req) => {
    const ds = getServerDataset(sessionId, req.slot);
    const rowCount = ds?.rows.length ?? 0;
    const validation =
      rowCount > 0 ? validateDatasetForSlot(req.slot, ds!.columns, ds!.rows) : { ok: true as const };
    const ready = rowCount > 0 && validation.ok;
    return {
      kind: "import" as const,
      sessionId,
      processId,
      slot: req.slot,
      label: req.label,
      hint: req.hint,
      templateCsv: req.templateCsv,
      filename: req.filename,
      ready,
      materialTitle: rowCount > 0 ? ds!.title : undefined,
      rowCount: rowCount > 0 ? rowCount : undefined,
      schemaIssues: !validation.ok ? validation.issues : undefined,
    };
  });
}

/** 新开 process 门闩：清掉 session 里无法解析的旧 CSV，避免一进来就红字 */
function purgeInvalidDatasetsForSkill(sessionId: string, skillId: string) {
  for (const req of requirementsForSkill(skillId)) {
    const ds = getServerDataset(sessionId, req.slot);
    if (!ds?.rows.length) continue;
    const validation = validateDatasetForSlot(req.slot, ds.columns, ds.rows);
    if (!validation.ok) deleteServerDataset(sessionId, req.slot);
  }
}

function datasetBlockMessage(sessionId: string, skillId: string): string | null {
  for (const req of requirementsForSkill(skillId)) {
    const ds = getServerDataset(sessionId, req.slot);
    if (!ds?.rows.length) continue;
    const validation = validateDatasetForSlot(req.slot, ds.columns, ds.rows);
    if (!validation.ok) return formatDatasetValidationMessage(req.label, validation);
  }
  return null;
}

function gateMessage(skillName: string, missing: SkillDataRequirement[]): string {
  return [
    `办理 **${skillName}** 还需要您提供下面${missing.length > 1 ? ` ${missing.length} 份` : "这份"}材料：`,
    "",
    ...missing.map((m) => `- **${m.label}** — ${m.hint}`),
    "",
    "请在**下方**点 **下载模板** 或 **导入 CSV**，出现 **已导入 · N 行** 后再点 **继续执行**。",
  ].join("\n");
}

function gateReadyMessage(skillName: string, parts: ProductRunImportPart[]): string {
  const ready = parts.filter((p) => p.ready);
  const lines = [`办理 **${skillName}**：`];
  for (const p of ready) {
    const name = p.materialTitle?.trim() || p.label;
    lines.push(`- 已有材料 **${name}** · ${p.rowCount ?? "—"} 行`);
  }
  lines.push(
    "",
    "请在下方面板核对；若不是本单材料，请点 **换一份文件**。确认无误后点 **继续执行**。",
  );
  return lines.join("\n");
}

/** 办事技能：新开 process 一律门闩；只有「继续执行」才跑 executeProcess */
async function startAtGate(
  processId: string,
  sessionId: string,
  skillId: string,
  query: string,
  emit?: StreamEmit,
): Promise<ProductRunStartResult> {
  const skill = getSkill(skillId);
  if (!skill) return { ok: false, error: `未知技能 ${skillId}` };

  purgeInvalidDatasetsForSkill(sessionId, skillId);
  const missing = missingForSession(sessionId, skillId);
  const parts = importParts(sessionId, processId, skillId);
  const message = missing.length
    ? gateMessage(skillLabel(skill), missing)
    : gateReadyMessage(skillLabel(skill), parts);

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
  llmConfig?: ProductLlmConfig,
): Promise<ProductRunStartResult> {
  const skill = getSkill(skillId);
  if (!skill) return { ok: false, error: `未知技能 ${skillId}` };

  const missing = missingForSession(sessionId, skillId);
  if (missing.length) {
    return startAtGate(processId, sessionId, skillId, query, emit);
  }

  dbRun(`UPDATE product_processes SET status = ?, updated_at = ? WHERE process_id = ?`, [
    "running",
    nowIso(),
    processId,
  ]);
  await emit?.("running", { processId, skillId, query });

  const parts: ProductRunPart[] = [];
  const recorder = productRunRecorder(processId, sessionId, skillId, query);
  let ran: Awaited<ReturnType<typeof runSkillOnServer>>;
  try {
    ran = await runSkillOnServer(skillId, query, sessionId, {
      productWorkbench: true,
      llmConfig,
      ...(recorder ? { exec: recorder.exec } : {}),
      onStep: async (step) => {
        const part = stepToPart(processId, step);
        parts.push(part);
        await emit?.("step", part);
      },
    });
  } catch (err) {
    recorder?.finish([{ stepId: "run", label: "运行异常", tool: "", ms: 0, ok: false, result: { error: err instanceof Error ? err.message : String(err) } }], 0);
    throw err;
  }
  const { trace, result, totalMs } = ran;
  recorder?.finish(trace, totalMs);

  const allOk = trace.every((t) => t.ok);
  const llmNoteOnly =
    !allOk &&
    trace.every((t) => {
      if (t.ok) return true;
      if (t.tool !== "__llm_product_brief__") return false;
      const meta = (t.result as { meta?: { llm?: string } } | undefined)?.meta;
      return meta?.llm === "failed";
    });
  if (!allOk && !llmNoteOnly) {
    const failed = trace.find((t) => !t.ok);
    const body = failed?.result as { error?: string; detail?: string; code?: string } | undefined;
    const errText = body?.detail?.trim() || body?.error?.trim() || failed?.label || "办理未通过校验";
    const guardCode = body?.code;
    const businessGuard =
      guardCode === "SHEET_GUARD" ||
      guardCode === "CONTRACT_GUARD" ||
      guardCode === "DATA_GUARD" ||
      guardCode === "IMAGE_GUARD" ||
      isDeskGuardCode(guardCode);
    if (!businessGuard) {
      recordProductRun("error", totalMs);
      safeLog("product_run.error", { processId, skillId, code: guardCode ?? "step_error", totalMs });
      await emit?.("error", { error: errText });
      dbRun(`UPDATE product_processes SET status = ?, updated_at = ? WHERE process_id = ?`, [
        "waiting_import",
        nowIso(),
        processId,
      ]);
      return { ok: false, error: errText };
    }
    const text = errText;
    recordProductRun("guard", totalMs);
    safeLog("product_run.guard", { processId, skillId, code: guardCode, totalMs });
    parts.push({ kind: "finish", processId, summary: text.slice(0, 240) });
    const materialParts = importParts(sessionId, processId, skillId);
    const allParts = [...materialParts, ...parts];
    const paper = paperForSkill(skill, query, { productWorkbench: true, sessionId });
    dbRun(
      `UPDATE product_processes SET status = ?, trace_json = ?, result_json = ?, updated_at = ? WHERE process_id = ?`,
      ["finish", JSON.stringify(trace), JSON.stringify({ text, paper, totalMs, guard: guardCode }), nowIso(), processId],
    );
    const finish = {
      ok: true as const,
      processId,
      status: "finish" as const,
      message: text,
      parts: allParts,
      skillId,
      query,
      trace,
      paper,
      runtime: "server" as const,
    };
    await emit?.("finish", finish);
    return finish;
  }

  const text = synthesizeProductFinishMessage(
    skill.id,
    llmNoteOnly ? trace.find((t) => t.tool === "__llm_product_brief__")?.result : result,
  );
  const paper = paperForSkill(skill, query, { productWorkbench: true, sessionId });
  parts.push({ kind: "finish", processId, summary: text.slice(0, 240) });
  const materialParts = importParts(sessionId, processId, skillId);
  const allParts = [...materialParts, ...parts];

  dbRun(
    `UPDATE product_processes SET status = ?, trace_json = ?, result_json = ?, updated_at = ? WHERE process_id = ?`,
    ["finish", JSON.stringify(trace), JSON.stringify({ text, paper, totalMs }), nowIso(), processId],
  );
  recordProductRun("finish", totalMs);
  safeLog("product_run.finish", { processId, skillId, totalMs, ...(llmNoteOnly ? { llm: "failed" } : {}) });

  const finish = {
    ok: true as const,
    processId,
    status: "finish" as const,
    message: text,
    parts: allParts,
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
  llmConfig?: ProductLlmConfig;
}): Promise<ProductRunStartResult> {
  const skill = getSkill(opts.skillId);
  if (!skill) return { ok: false, error: `未知技能 ${opts.skillId}` };

  const processId = randomUUID();
  const now = nowIso();
  dbRun(
    `INSERT INTO product_processes (process_id, session_id, skill_id, query, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [processId, opts.sessionId, opts.skillId, opts.query, "starting", now, now],
  );

  if (productSkillUsesUserData(opts.skillId)) {
    return startAtGate(processId, opts.sessionId, opts.skillId, opts.query, opts.emit);
  }

  return executeProcess(processId, opts.sessionId, opts.skillId, opts.query, opts.emit, opts.llmConfig);
}

export async function continueProductRun(
  processId: string,
  sessionId: string,
  emit?: StreamEmit,
  llmConfig?: ProductLlmConfig,
  mode: "continue" | "rerun" = "continue",
): Promise<ProductRunStartResult> {
  const row = dbGet<{ skill_id: string; query: string; session_id: string; status: string }>(
    `SELECT skill_id, query, session_id, status FROM product_processes WHERE process_id = ?`,
    [processId],
  );
  if (!row) return { ok: false, error: "process 不存在或已过期" };
  if (row.session_id !== sessionId) return { ok: false, error: "session 与 process 不匹配" };
  if (row.status === "running") return { ok: false, error: "正在办理，请勿重复提交" };
  if (row.status === "cancelled") return { ok: false, error: "这次办理已取消，请重新发起" };
  if (row.status === "finish" && mode !== "rerun") return { ok: false, error: "这次办理已经完成" };
  const missing = missingForSession(sessionId, row.skill_id);
  if (missing.length) {
    return { ok: false, error: `请先导入：${missing.map((m) => m.label).join("、")}` };
  }
  const schemaBlock = datasetBlockMessage(sessionId, row.skill_id);
  if (schemaBlock) return { ok: false, error: schemaBlock };
  const locked = dbRun(
    `UPDATE product_processes SET status='running', run_token=?, updated_at=?
     WHERE process_id=? AND status<>'running'`,
    [randomUUID(), nowIso(), processId],
  );
  if (!Number(locked.changes)) return { ok: false, error: "正在办理，请勿重复提交" };
  return executeProcess(processId, sessionId, row.skill_id, row.query, emit, llmConfig);
}

export { saveServerDataset, getServerDataset };

export function archiveProductRun(processId: string, sessionId: string, actor: string) {
  const at = nowIso();
  const changed = dbRun(
    `UPDATE product_processes SET archived_at=?, archived_by=?, updated_at=?
     WHERE process_id=? AND session_id=? AND status='finish'`,
    [at, actor, at, processId, sessionId],
  );
  return Number(changed.changes) ? { ok: true as const, archivedAt: at } : { ok: false as const };
}

export function ownsSession(c: Parameters<typeof requestIdentity>[0], sessionId: string): boolean {
  const actor = requestIdentity(c);
  const ownerId = actor?.member.id ?? `browser:${sessionId}`;
  const existing = dbGet<{ owner_id: string }>(
    "SELECT owner_id FROM product_session_owners WHERE session_id=?",
    [sessionId],
  );
  if (existing) return existing.owner_id === ownerId;
  const now = nowIso();
  dbRun(
    "INSERT INTO product_session_owners(session_id,owner_id,created_at,updated_at) VALUES(?,?,?,?)",
    [sessionId, ownerId, now, now],
  );
  return true;
}

export function registerProductRun(app: Hono) {
  app.get("/api/product-run/active", (c) => {
    const sessionId = c.req.query("sessionId")?.trim();
    if (!sessionId) return c.json({ ok: false, error: "缺少 sessionId" }, 400);
    if (!ownsSession(c, sessionId)) return c.json({ ok: false, error: "forbidden" }, 403);
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
      | { action: "start"; sessionId: string; skillId: string; query: string; llmConfig?: ProductLlmConfig }
      | { action: "continue"; processId: string; sessionId: string; llmConfig?: ProductLlmConfig }
      | { action: "rerun"; processId: string; sessionId: string; llmConfig?: ProductLlmConfig }
    >();
    if (!body.sessionId?.trim() || !ownsSession(c, body.sessionId.trim())) {
      return c.json({ ok: false, error: "forbidden" }, 403);
    }

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
            llmConfig: body.llmConfig,
          });
          if (!result.ok) await emit("error", result);
        } else if (body.action === "continue" || body.action === "rerun") {
          if (!body.processId?.trim() || !body.sessionId?.trim()) {
            await emit("error", { error: "缺少 processId / sessionId" });
            return;
          }
          const result = await continueProductRun(
            body.processId.trim(),
            body.sessionId.trim(),
            emit,
            body.llmConfig,
            body.action,
          );
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
    if (!ownsSession(c, body.sessionId.trim())) return c.json({ ok: false, error: "forbidden" }, 403);
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
    if (!ownsSession(c, body.sessionId.trim())) return c.json({ ok: false, error: "forbidden" }, 403);
    const result = await continueProductRun(body.processId.trim(), body.sessionId.trim());
    return c.json(result);
  });

  app.post("/api/product-run/cancel", async (c) => {
    const body = await c.req.json<{ processId: string; sessionId: string }>();
    if (!body.processId?.trim() || !body.sessionId?.trim()) return c.json({ ok: false, error: "缺少 processId / sessionId" }, 400);
    if (!ownsSession(c, body.sessionId.trim())) return c.json({ ok: false, error: "forbidden" }, 403);
    const changed = dbRun(
      `UPDATE product_processes SET status='cancelled', updated_at=?
       WHERE process_id=? AND session_id=? AND status IN ('starting','waiting_import','running')`,
      [nowIso(), body.processId.trim(), body.sessionId.trim()],
    );
    if (Number(changed.changes) > 0) recordProductRun("cancelled");
    return c.json({ ok: Number(changed.changes) > 0, status: Number(changed.changes) > 0 ? "cancelled" : "unchanged" });
  });

  app.post("/api/product-run/archive", async (c) => {
    const body = await c.req.json<{ processId: string; sessionId: string }>();
    if (!body.processId?.trim() || !body.sessionId?.trim()) return c.json({ ok: false, error: "缺少 processId / sessionId" }, 400);
    if (!ownsSession(c, body.sessionId.trim())) return c.json({ ok: false, error: "forbidden" }, 403);
    const archived = archiveProductRun(body.processId.trim(), body.sessionId.trim(), requestIdentity(c)?.member.id ?? "local");
    return archived.ok
      ? c.json(archived)
      : c.json({ ok: false, error: "只有已完成的办理可以归档" }, 409);
  });

  app.get("/api/product-run/template", (c) => {
    const skillId = c.req.query("skillId")?.trim();
    const slot = c.req.query("slot")?.trim() as ProductDataSlot | undefined;
    if (!skillId || !slot) return c.json({ ok: false, error: "缺少 skillId / slot" }, 400);
    const req = requirementsForSkill(skillId).find((r) => r.slot === slot);
    if (!req) return c.json({ ok: false, error: "该技能无此材料槽" }, 404);
    return c.json({ ok: true, filename: req.filename, csv: req.templateCsv, label: req.label });
  });

  app.post("/api/product-run/dataset", async (c) => {
    const body = await c.req.json<{ sessionId: string; slot: ProductDataSlot; csv?: string; title?: string; workbookBase64?: string; filename?: string }>();
    const sessionId = body.sessionId?.trim() ?? "";
    if (!sessionId || !body.slot || (!body.csv?.trim() && !body.workbookBase64?.trim())) {
      return c.json({ ok: false, error: "缺少 sessionId / slot / 文件" }, 400);
    }
    if (!ownsSession(c, sessionId)) return c.json({ ok: false, error: "forbidden" }, 403);
    const maxCsvBytes = Number(process.env.MAX_CSV_BYTES ?? 5 * 1024 * 1024);
    let csv = body.csv ?? "";
    let title = body.title;
    let cells: { sheet: string; cell: string; row: number; column: string; value: string }[] = [];
    if (body.workbookBase64?.trim()) {
      const buf = Buffer.from(body.workbookBase64, "base64");
      if (buf.byteLength > maxCsvBytes) return c.json({ ok: false, error: "文件过大" }, 413);
      const table = await workbookBufferToTable(buf, body.filename || body.title || "材料");
      if ("error" in table) return c.json({ ok: false, error: table.error }, 400);
      csv = table.csv;
      title = title || table.title;
      cells = table.cells;
    }
    if (Buffer.byteLength(csv, "utf8") > maxCsvBytes) {
      return c.json({ ok: false, error: "CSV 文件过大" }, 413);
    }
    const parsed = parseCsvText(csv, title ?? body.slot, body.slot);
    if ("error" in parsed) return c.json({ ok: false, error: parsed.error }, 400);
    const maxRows = Number(process.env.MAX_CSV_ROWS ?? 50_000);
    if (parsed.rows.length > maxRows) return c.json({ ok: false, error: `CSV 超过 ${maxRows} 行上限` }, 413);
    try {
      saveServerDataset(sessionId, {
        slot: parsed.slot,
        title: parsed.title,
        columns: parsed.columns,
        rows: parsed.rows,
      });
      if (cells.length) saveDatasetCells(sessionId, parsed.slot, cells);
    } catch (err) {
      const msg =
        err instanceof ProductDatasetNormalizeError
          ? err.message
          : err instanceof Error
            ? err.message
            : "导入保存失败";
      return c.json({ ok: false, error: msg }, 400);
    }
    return c.json({
      ok: true,
      title: parsed.title,
      rows: parsed.rows.length,
      updatedAt: nowIso(),
      schemaOk: true,
      schemaIssues: [] as string[],
    });
  });

  app.get("/api/product-run/materials", (c) => {
    const sessionId = c.req.query("sessionId")?.trim() ?? "";
    const skillId = c.req.query("skillId")?.trim() ?? "";
    if (!sessionId || !skillId) return c.json({ error: "缺少 sessionId / skillId" }, 400);
    if (!ownsSession(c, sessionId)) return c.json({ error: "forbidden" }, 403);
    const materials = requirementsForSkill(skillId).map((req) => {
      const ds = getServerDataset(sessionId, req.slot);
      return {
        slot: req.slot,
        label: req.label,
        title: ds?.title ?? "",
        columns: ds?.columns ?? [],
        rows: ds?.rows ?? [],
        cells: listDatasetCells(sessionId, req.slot),
      };
    });
    return c.json({ materials });
  });
}
