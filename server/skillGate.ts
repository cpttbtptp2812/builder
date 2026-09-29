/** Skill 发版门禁 API — check / baseline / audit / publish */

import type { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { dbAll, dbRun } from "./db.ts";
import { parseSkillMarkdown, hydrateSkill, enrichSkillCatalog } from "../src/lib/skillMarkdown.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASELINE_DIR = path.join(ROOT, ".ownagent", "baselines");
const CASES_FILE = path.join(ROOT, ".ownagent", "cases.json");

function ensureAuditTable() {
  dbRun(`
    CREATE TABLE IF NOT EXISTS skill_gate_audit (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      action TEXT NOT NULL,
      gate TEXT,
      actor TEXT,
      note TEXT,
      payload TEXT,
      created_at TEXT NOT NULL
    )
  `);
}

function writeAudit(row: {
  skillId: string;
  action: string;
  gate?: string;
  actor?: string;
  note?: string;
  payload?: unknown;
}) {
  ensureAuditTable();
  dbRun(
    `INSERT INTO skill_gate_audit (id, skill_id, action, gate, actor, note, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      row.skillId,
      row.action,
      row.gate ?? null,
      row.actor ?? "api",
      row.note ?? null,
      row.payload ? JSON.stringify(row.payload) : null,
      new Date().toISOString(),
    ],
  );
}

export function registerSkillGate(app: Hono) {
  ensureAuditTable();

  app.get("/api/skill-gate/baseline/:skillId", (c) => {
    const skillId = c.req.param("skillId");
    const p = path.join(BASELINE_DIR, `${skillId}.json`);
    if (!fs.existsSync(p)) return c.json({ error: "baseline not found" }, 404);
    return c.json(JSON.parse(fs.readFileSync(p, "utf8")));
  });

  app.post("/api/skill-gate/baseline", async (c) => {
    const body = await c.req.json<{ skillId: string; raw: string; version?: string; env?: "staging" | "prod" }>();
    if (!body.skillId || !body.raw) return c.json({ error: "skillId and raw required" }, 400);
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    const file = path.join(BASELINE_DIR, `${body.skillId}.json`);
    const payload = {
      skillId: body.skillId,
      version: body.version ?? "baseline",
      env: body.env ?? "prod",
      raw: body.raw,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    writeAudit({ skillId: body.skillId, action: "baseline.save", note: body.env });
    return c.json({ ok: true, path: `.ownagent/baselines/${body.skillId}.json` });
  });

  app.post("/api/skill-gate/check", async (c) => {
    const body = await c.req.json<{ skillId: string; raw: string; actor?: string }>();
    if (!body.skillId || !body.raw) return c.json({ error: "skillId and raw required" }, 400);

    const parsed = parseSkillMarkdown(body.raw);
    const skill = enrichSkillCatalog(
      [hydrateSkill(body.raw, { id: body.skillId, skillPath: `api://${body.skillId}` })],
      "server",
    )[0]!;

    const errors = skill.diagnostics.filter((d) => d.level === "error");
    let gate: "PASS" | "WARN" | "BLOCK" = "PASS";
    const reasons: string[] = [];

    if (errors.length) {
      gate = "BLOCK";
      reasons.push(...errors.map((e) => e.message));
    }
    if (!parsed.triggers.length) {
      gate = gate === "BLOCK" ? "BLOCK" : "WARN";
      reasons.push("缺少 triggers");
    }
    if (!parsed.steps.length) {
      gate = "BLOCK";
      reasons.push("缺少 steps");
    }
    if (!reasons.length) reasons.push("静态检查通过（完整 SCM 请在浏览器发版检查）");

    const result = {
      schema: "ownagent-skill-gate-api/1",
      skillId: body.skillId,
      gate,
      reasons,
      compileOk: errors.length === 0,
      stepCount: parsed.steps.length,
      triggerCount: parsed.triggers.length,
    };

    writeAudit({ skillId: body.skillId, action: "check", gate, actor: body.actor, payload: result });
    return c.json(result);
  });

  app.get("/api/skill-gate/audit", (c) => {
    const skillId = c.req.query("skillId");
    const rows = dbAll<{
      id: string;
      skill_id: string;
      action: string;
      gate: string | null;
      actor: string | null;
      note: string | null;
      created_at: string;
    }>(
      skillId
        ? "SELECT id, skill_id, action, gate, actor, note, created_at FROM skill_gate_audit WHERE skill_id = ? ORDER BY created_at DESC LIMIT 50"
        : "SELECT id, skill_id, action, gate, actor, note, created_at FROM skill_gate_audit ORDER BY created_at DESC LIMIT 100",
      skillId ? [skillId] : [],
    );
    return c.json({ rows });
  });

  app.post("/api/skill-gate/publish", async (c) => {
    const body = await c.req.json<{
      skillId: string;
      raw: string;
      version: string;
      gate: string;
      actor?: string;
      note?: string;
    }>();
    if (!body.skillId || !body.raw || !body.version) {
      return c.json({ error: "skillId, raw, version required" }, 400);
    }
    if (body.gate === "BLOCK") {
      return c.json({ error: "BLOCK gate cannot publish" }, 403);
    }
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(BASELINE_DIR, `${body.skillId}.json`),
      JSON.stringify({
        skillId: body.skillId,
        version: body.version,
        raw: body.raw,
        publishedAt: new Date().toISOString(),
      }, null, 2),
    );
    writeAudit({
      skillId: body.skillId,
      action: "publish",
      gate: body.gate,
      actor: body.actor,
      note: body.note ?? `v${body.version}`,
    });
    return c.json({ ok: true, skillId: body.skillId, version: body.version });
  });

  app.get("/api/skill-gate/cases", (c) => {
    if (!fs.existsSync(CASES_FILE)) return c.json({});
    return c.json(JSON.parse(fs.readFileSync(CASES_FILE, "utf8")));
  });

  app.post("/api/skill-gate/cases", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ error: "cases object required" }, 400);
    }
    fs.mkdirSync(path.dirname(CASES_FILE), { recursive: true });
    fs.writeFileSync(CASES_FILE, JSON.stringify(body, null, 2));
    const count = Object.values(body).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0);
    writeAudit({ skillId: "*", action: "cases.sync", note: `${count} cases` });
    return c.json({ ok: true, path: ".ownagent/cases.json", cases: count });
  });

  app.post("/api/skill-gate/rollback", async (c) => {
    const body = await c.req.json<{ skillId: string; version: string; actor?: string }>();
    writeAudit({ skillId: body.skillId, action: "rollback", note: body.version, actor: body.actor });
    return c.json({ ok: true, skillId: body.skillId, rolledBackTo: body.version });
  });
}
