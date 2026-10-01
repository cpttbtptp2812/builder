/** Production trace ingestion -> failure clusters -> reviewed regression cases. */

import type { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dbAll, dbRun } from "./db.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASES_FILE = path.join(process.env.OWNAGENT_CONFIG_DIR ?? path.join(ROOT, ".ownagent"), "cases.json");

export type IngestTraceStep = {
  stepId: string;
  tool: string;
  ok: boolean;
  result?: unknown;
};

export type IngestTraceRecord = {
  idempotencyKey: string;
  skillId: string;
  query: string;
  trace: IngestTraceStep[];
  ok: boolean;
  environment?: string;
  error?: string;
  occurredAt?: string;
};

function initTraceFeedback() {
  dbRun(`CREATE TABLE IF NOT EXISTS skill_trace_ingest (
    id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, skill_id TEXT NOT NULL,
    query TEXT NOT NULL, trace_json TEXT NOT NULL, ok INTEGER NOT NULL,
    environment TEXT NOT NULL, error TEXT, fingerprint TEXT, occurred_at TEXT NOT NULL,
    received_at TEXT NOT NULL
  )`);
  dbRun(`CREATE INDEX IF NOT EXISTS idx_skill_trace_failure
    ON skill_trace_ingest(skill_id, ok, fingerprint)`);
  dbRun(`CREATE TABLE IF NOT EXISTS skill_trace_clusters (
    fingerprint TEXT PRIMARY KEY, skill_id TEXT NOT NULL, failed_step_id TEXT,
    tool TEXT, error_class TEXT, occurrence_count INTEGER NOT NULL,
    first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
  )`);
  dbRun(`CREATE TABLE IF NOT EXISTS skill_case_suggestions (
    id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, skill_id TEXT NOT NULL,
    query TEXT NOT NULL, case_json TEXT NOT NULL, source_trace_id TEXT NOT NULL,
    status TEXT NOT NULL, review_note TEXT, created_at TEXT NOT NULL, reviewed_at TEXT
  )`);
}

function errorClass(record: IngestTraceRecord): string {
  const failed = record.trace.find((step) => !step.ok);
  const raw =
    record.error ??
    (failed?.result && typeof failed.result === "object"
      ? String((failed.result as { error?: unknown }).error ?? "step_failed")
      : "step_failed");
  return raw.toLowerCase().replace(/\b\d+\b/g, "#").replace(/\s+/g, " ").slice(0, 160);
}

function fingerprint(record: IngestTraceRecord): string {
  const failed = record.trace.find((step) => !step.ok);
  return createHash("sha256")
    .update([record.skillId, failed?.stepId ?? "outcome", failed?.tool ?? "unknown", errorClass(record)].join("|"))
    .digest("hex");
}

function proposedCase(record: IngestTraceRecord) {
  return {
    id: `trace-${fingerprint(record).slice(0, 12)}`,
    skillId: record.skillId,
    query: record.query.trim(),
    grader: { kind: "all_ok" },
    expect: {
      steps: record.trace.map((step) => ({ stepId: step.stepId, tool: step.tool, ok: true })),
    },
    source: {
      type: "production-trace",
      fingerprint: fingerprint(record),
      environment: record.environment ?? "prod",
      occurredAt: record.occurredAt ?? new Date().toISOString(),
    },
  };
}

function authorized(header: string | undefined): boolean {
  const expected = process.env.OWNAGENT_INGEST_KEY;
  if (!expected) return process.env.NODE_ENV !== "production";
  return header === expected || header === `Bearer ${expected}`;
}

function writeCase(skillId: string, proposed: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(CASES_FILE), { recursive: true });
  let store: Record<string, unknown[]> = {};
  if (fs.existsSync(CASES_FILE)) store = JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as Record<string, unknown[]>;
  const rows = store[skillId] ?? [];
  const id = String(proposed.id ?? "");
  store[skillId] = [...rows.filter((row) => String((row as { id?: unknown }).id ?? "") !== id), proposed];
  const temp = `${CASES_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, CASES_FILE);
}

export function registerTraceFeedback(app: Hono) {
  initTraceFeedback();

  app.post("/api/skill-gate/traces/ingest", async (c) => {
    const key = c.req.header("authorization") ?? c.req.header("x-ownagent-key");
    if (!authorized(key)) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json<{ records?: IngestTraceRecord[] }>();
    const records = Array.isArray(body.records) ? body.records.slice(0, 100) : [];
    if (!records.length) return c.json({ error: "records required" }, 400);
    let accepted = 0;
    let duplicates = 0;
    let suggested = 0;
    for (const record of records) {
      if (!record.idempotencyKey || !record.skillId || !record.query || !Array.isArray(record.trace)) continue;
      const id = randomUUID();
      const now = new Date().toISOString();
      const fp = record.ok ? null : fingerprint(record);
      try {
        dbRun(
          `INSERT INTO skill_trace_ingest
           (id,idempotency_key,skill_id,query,trace_json,ok,environment,error,fingerprint,occurred_at,received_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
          [
            id, record.idempotencyKey, record.skillId, record.query, JSON.stringify(record.trace),
            record.ok ? 1 : 0, record.environment ?? "prod", record.error ?? null, fp,
            record.occurredAt ?? now, now,
          ],
        );
        accepted += 1;
      } catch {
        duplicates += 1;
        continue;
      }
      if (!record.ok && fp) {
        const failed = record.trace.find((step) => !step.ok);
        dbRun(
          `INSERT INTO skill_trace_clusters
           (fingerprint,skill_id,failed_step_id,tool,error_class,occurrence_count,first_seen,last_seen)
           VALUES(?,?,?,?,?,1,?,?)
           ON CONFLICT(fingerprint) DO UPDATE SET
             occurrence_count=occurrence_count+1,last_seen=excluded.last_seen`,
          [fp, record.skillId, failed?.stepId ?? null, failed?.tool ?? null, errorClass(record), now, now],
        );
        try {
          dbRun(
            `INSERT INTO skill_case_suggestions
             (id,fingerprint,skill_id,query,case_json,source_trace_id,status,created_at)
             VALUES(?,?,?,?,?,?,?,?)`,
            [randomUUID(), fp, record.skillId, record.query, JSON.stringify(proposedCase(record)), id, "pending", now],
          );
          suggested += 1;
        } catch {
          /* one pending suggestion per failure fingerprint */
        }
      }
    }
    return c.json({ schema: "ownagent-trace-ingest/1", accepted, duplicates, suggested });
  });

  app.get("/api/skill-gate/trace-suggestions", (c) => {
    const status = c.req.query("status") ?? "pending";
    const rows = dbAll<{
      id: string; fingerprint: string; skill_id: string; query: string; case_json: string;
      source_trace_id: string; status: string; created_at: string;
    }>(
      `SELECT id,fingerprint,skill_id,query,case_json,source_trace_id,status,created_at
       FROM skill_case_suggestions WHERE status=? ORDER BY created_at DESC LIMIT 100`,
      [status],
    );
    return c.json({
      suggestions: rows.map((row) => ({
        id: row.id,
        fingerprint: row.fingerprint,
        skillId: row.skill_id,
        query: row.query,
        proposedCase: JSON.parse(row.case_json),
        sourceTraceId: row.source_trace_id,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  });

  app.post("/api/skill-gate/trace-suggestions/:id/review", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ decision?: "accept" | "reject"; note?: string }>();
    if (body.decision !== "accept" && body.decision !== "reject") {
      return c.json({ error: "decision must be accept or reject" }, 400);
    }
    const rows = dbAll<{ skill_id: string; case_json: string; status: string }>(
      "SELECT skill_id,case_json,status FROM skill_case_suggestions WHERE id=?",
      [id],
    );
    const row = rows[0];
    if (!row) return c.json({ error: "suggestion not found" }, 404);
    if (row.status !== "pending") return c.json({ error: "suggestion already reviewed" }, 409);
    if (body.decision === "accept") writeCase(row.skill_id, JSON.parse(row.case_json) as Record<string, unknown>);
    dbRun(
      "UPDATE skill_case_suggestions SET status=?,review_note=?,reviewed_at=? WHERE id=?",
      [body.decision === "accept" ? "accepted" : "rejected", body.note ?? null, new Date().toISOString(), id],
    );
    return c.json({ ok: true, status: body.decision === "accept" ? "accepted" : "rejected" });
  });

  app.get("/api/skill-gate/trace-clusters", (c) => {
    const rows = dbAll(
      `SELECT fingerprint,skill_id as skillId,failed_step_id as failedStepId,tool,error_class as errorClass,
              occurrence_count as occurrenceCount,first_seen as firstSeen,last_seen as lastSeen
       FROM skill_trace_clusters ORDER BY occurrence_count DESC,last_seen DESC LIMIT 100`,
    );
    return c.json({ clusters: rows });
  });
}
