/** Skill 发版门禁 API — check / baseline / audit / publish */

import type { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { dbAll, dbRun } from "./db.ts";
import { parseSkillMarkdown, hydrateSkill, enrichSkillCatalog } from "../src/lib/skillMarkdown.ts";
import { SKILL_TRACE_CASES, type SkillTraceCase } from "../src/lib/provingGround.ts";
import { runMockGateComparison } from "../src/lib/mockGateRunner.ts";
import { applyGatePolicy, DEFAULT_GATE_POLICY, parseGatePolicy, resolveGatePolicy } from "../src/lib/gatePolicy.ts";
import { OWNAGENT_CHECK_SCHEMA } from "../src/lib/ownagentProtocol.ts";
import {
  authenticateTeamSession,
  canPerform,
  getApproval,
  listTeamMembers,
} from "./teamGovernance.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REPO_CONFIG_DIR = path.join(ROOT, ".ownagent");
const CONFIG_DIR = process.env.OWNAGENT_CONFIG_DIR ?? REPO_CONFIG_DIR;
const BASELINE_DIR = path.join(CONFIG_DIR, "baselines");
const CASES_FILE = path.join(CONFIG_DIR, "cases.json");
const POLICY_FILE = path.join(CONFIG_DIR, "policy.yml");

function seedConfigFile(name: string) {
  const target = path.join(CONFIG_DIR, name);
  const source = path.join(REPO_CONFIG_DIR, name);
  if (!fs.existsSync(target) && fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

seedConfigFile("cases.json");
seedConfigFile("policy.yml");
if (!fs.existsSync(BASELINE_DIR) && fs.existsSync(path.join(REPO_CONFIG_DIR, "baselines"))) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  for (const name of fs.readdirSync(path.join(REPO_CONFIG_DIR, "baselines"))) {
    fs.copyFileSync(path.join(REPO_CONFIG_DIR, "baselines", name), path.join(BASELINE_DIR, name));
  }
}

function loadGateCases(skillId: string): SkillTraceCase[] {
  let custom: SkillTraceCase[] = [];
  if (fs.existsSync(CASES_FILE)) {
    try {
      const store = JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as Record<string, SkillTraceCase[]>;
      custom = store[skillId] ?? [];
    } catch {
      custom = [];
    }
  }
  const ids = new Set(custom.map((row) => row.id));
  return [...custom, ...SKILL_TRACE_CASES.filter((row) => row.skillId === skillId && !ids.has(row.id))];
}

function teamAccess(
  authorization: string | undefined,
  environment: string,
  action: string,
): { ok: true; actor?: string; role?: string } | { ok: false; status: 401 | 403; error: string } {
  if (!listTeamMembers({ includeInactive: false }).length) return { ok: true };
  const token = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const session = authenticateTeamSession(token);
  if (!session) return { ok: false, status: 401, error: "team authentication required" };
  if (!canPerform(session.member.role, environment, action)) {
    return { ok: false, status: 403, error: `${session.member.role} cannot ${action} in ${environment}` };
  }
  return { ok: true, actor: session.member.id, role: session.member.role };
}

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
    const env = c.req.query("env") === "staging" ? "staging" : "prod";
    const p = path.join(BASELINE_DIR, env === "staging" ? `${skillId}.staging.json` : `${skillId}.json`);
    if (!fs.existsSync(p)) return c.json({ error: "baseline not found" }, 404);
    return c.json(JSON.parse(fs.readFileSync(p, "utf8")));
  });

  app.post("/api/skill-gate/baseline", async (c) => {
    const body = await c.req.json<{ skillId: string; raw: string; version?: string; env?: "staging" | "prod" }>();
    if (!body.skillId || !body.raw) return c.json({ error: "skillId and raw required" }, 400);
    const access = teamAccess(c.req.header("authorization"), body.env ?? "prod", "publish");
    if (!access.ok) return c.json({ error: access.error }, access.status);
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    const file = path.join(
      BASELINE_DIR,
      body.env === "staging" ? `${body.skillId}.staging.json` : `${body.skillId}.json`,
    );
    const payload = {
      skillId: body.skillId,
      version: body.version ?? "baseline",
      env: body.env ?? "prod",
      raw: body.raw,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    writeAudit({ skillId: body.skillId, action: "baseline.save", note: body.env });
    return c.json({ ok: true, path: file, environment: payload.env });
  });

  app.post("/api/skill-gate/check", async (c) => {
    const body = await c.req.json<{
      skillId: string;
      raw: string;
      actor?: string;
      environment?: string;
      candidateVersion?: string;
    }>();
    if (!body.skillId || !body.raw) return c.json({ error: "skillId and raw required" }, 400);

    const parsed = parseSkillMarkdown(body.raw);
    const skill = enrichSkillCatalog(
      [hydrateSkill(body.raw, { id: body.skillId, skillPath: `api://${body.skillId}` })],
      "server",
    )[0]!;
    const baselineFile = path.join(BASELINE_DIR, `${body.skillId}.json`);
    const baselineRaw = fs.existsSync(baselineFile)
      ? String((JSON.parse(fs.readFileSync(baselineFile, "utf8")) as { raw?: string }).raw ?? body.raw)
      : body.raw;
    const baselineSkill = enrichSkillCatalog(
      [hydrateSkill(baselineRaw, { id: body.skillId, skillPath: `baseline://${body.skillId}` })],
      "server",
    )[0]!;
    const comparison = await runMockGateComparison(baselineSkill, skill, loadGateCases(body.skillId));
    const environment = body.environment ?? "prod";
    const policy = fs.existsSync(POLICY_FILE)
      ? parseGatePolicy(fs.readFileSync(POLICY_FILE, "utf8"))
      : DEFAULT_GATE_POLICY;
    const rule = resolveGatePolicy(policy, body.skillId, environment);

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
    const decision = applyGatePolicy({
      compileOk: errors.length === 0,
      deltaSuccess: comparison.deltaSuccess,
      failedCaseCount: comparison.failedCases.length,
      caseCount: comparison.traceTotal,
      exactPct: comparison.coverage.exactPct,
      rule,
    });
    gate = decision.gate;
    if (comparison.failedCases.length) {
      reasons.push(...comparison.failedCases.map((row) => `[trace] ${row.id}: ${row.detail}`));
    }
    if (comparison.coverage.exactPct < 80) {
      reasons.push(`[coverage] exact ${comparison.coverage.exactPct}%（报告未看全）`);
    }
    reasons.push(...decision.reasons.filter((reason) => !reasons.includes(reason)));
    if (!reasons.length) reasons.push("compile + deterministic trace 全通过");

    const result = {
      schema: OWNAGENT_CHECK_SCHEMA,
      skillId: body.skillId,
      environment,
      gate,
      reasons,
      compileOk: errors.length === 0,
      stepCount: parsed.steps.length,
      triggerCount: parsed.triggers.length,
      deltaSuccess: comparison.deltaSuccess,
      pivotalStepId: comparison.pivotalStepId,
      pivotalTool: comparison.pivotalTool,
      failedCases: comparison.failedCases,
      coverage: comparison.coverage,
      baseline: {
        version: fs.existsSync(baselineFile)
          ? String((JSON.parse(fs.readFileSync(baselineFile, "utf8")) as { version?: string }).version ?? "baseline")
          : "candidate",
      },
      candidate: { version: body.candidateVersion ?? "candidate" },
      pivotal: comparison.pivotalStepId
        ? {
            stepId: comparison.pivotalStepId,
            tool: comparison.pivotalTool,
            exact: !comparison.coverage.incomplete,
          }
        : null,
      policy: {
        risk: rule.risk,
        minExactPct: rule.minExactPct,
        requireCases: rule.requireCases,
        requiresApproval: decision.requiresApproval,
      },
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

  app.get("/api/skill-gate/audit/export", (c) => {
    const format = c.req.query("format") === "csv" ? "csv" : "json";
    const skillId = c.req.query("skillId");
    const rows = dbAll<{
      id: string;
      skill_id: string;
      action: string;
      gate: string | null;
      actor: string | null;
      note: string | null;
      payload: string | null;
      created_at: string;
    }>(
      skillId
        ? "SELECT id, skill_id, action, gate, actor, note, payload, created_at FROM skill_gate_audit WHERE skill_id = ? ORDER BY created_at DESC"
        : "SELECT id, skill_id, action, gate, actor, note, payload, created_at FROM skill_gate_audit ORDER BY created_at DESC",
      skillId ? [skillId] : [],
    );
    if (format === "json") {
      return c.json({
        schema: "ownagent-audit/1",
        generatedAt: new Date().toISOString(),
        rows: rows.map((r) => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null })),
      });
    }
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["id", "skillId", "action", "gate", "actor", "version", "environment", "override", "overrideReason", "approvalId", "note", "payload", "createdAt"].map(quote).join(","),
      ...rows.map((r) => {
        const payload = r.payload ? JSON.parse(r.payload) as Record<string, unknown> : {};
        return [
          r.id, r.skill_id, r.action, r.gate, r.actor, payload.version, payload.environment,
          payload.override, payload.overrideReason, payload.approvalId, r.note, r.payload, r.created_at,
        ].map(quote).join(",");
      }),
    ].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ownagent-audit.csv"',
      },
    });
  });

  app.post("/api/skill-gate/publish", async (c) => {
    const body = await c.req.json<{
      skillId: string;
      raw: string;
      version: string;
      gate: string;
      actor?: string;
      note?: string;
      override?: boolean;
      overrideReason?: string;
      environment?: "staging" | "prod";
      approvalId?: string;
    }>();
    if (!body.skillId || !body.raw || !body.version) {
      return c.json({ error: "skillId, raw, version required" }, 400);
    }
    const environment = body.environment ?? "prod";
    const access = teamAccess(c.req.header("authorization"), environment, "publish");
    if (!access.ok) return c.json({ error: access.error }, access.status);
    if (body.gate === "BLOCK" && !body.override) {
      return c.json({ error: "BLOCK gate cannot publish" }, 403);
    }
    if (body.gate === "BLOCK" && body.override && !body.overrideReason?.trim()) {
      return c.json({ error: "overrideReason required for BLOCK override" }, 400);
    }
    if (body.gate === "BLOCK" && access.role && access.role !== "admin") {
      return c.json({ error: "only admin may override BLOCK" }, 403);
    }
    if (access.actor && environment === "prod" && body.gate !== "PASS") {
      const approval = body.approvalId ? getApproval(body.approvalId) : undefined;
      if (
        !approval ||
        approval.status !== "approved" ||
        approval.environment !== environment ||
        approval.resourceId !== `${body.skillId}@${body.version}`
      ) {
        return c.json({ error: "approved release approval required" }, 403);
      }
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
      action: body.override ? "publish.override" : "publish",
      gate: body.gate,
      actor: access.actor ?? body.actor,
      note: body.override ? body.overrideReason : body.note ?? `v${body.version}`,
      payload: {
        version: body.version,
        override: Boolean(body.override),
        overrideReason: body.overrideReason ?? null,
        environment,
        approvalId: body.approvalId ?? null,
      },
    });
    return c.json({ ok: true, skillId: body.skillId, version: body.version });
  });

  app.get("/api/skill-gate/cases", (c) => {
    if (!fs.existsSync(CASES_FILE)) return c.json({});
    return c.json(JSON.parse(fs.readFileSync(CASES_FILE, "utf8")));
  });

  app.post("/api/skill-gate/cases", async (c) => {
    const access = teamAccess(c.req.header("authorization"), "prod", "publish");
    if (!access.ok) return c.json({ error: access.error }, access.status);
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
