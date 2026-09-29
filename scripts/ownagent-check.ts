/** OwnAgent CLI — skill.md 发版门禁 check */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichSkillCatalog, hydrateSkill, parseSkillMarkdown } from "../src/lib/skillMarkdown.ts";
import {
  MOCK_PROFILES,
  SKILL_TRACE_CASES,
  matchTrace,
  traceEvalSummary,
  type SkillTraceCase,
  type TraceEvalRow,
} from "../src/lib/provingGround.ts";
import { applyStepVarWrites } from "../src/lib/skillVarBindings.ts";
import { resolveStepArgs } from "../src/lib/skillMarkdown.ts";
import type { SkillManifest } from "../src/lib/skillMarkdown.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SKILLS_DIR = path.join(ROOT, "src", "skills");
const BASELINE_DIR = path.join(ROOT, ".ownagent", "baselines");
const CASES_FILE = path.join(ROOT, ".ownagent", "cases.json");

type GateLevel = "PASS" | "WARN" | "BLOCK";

type CheckResult = {
  skillId: string;
  gate: GateLevel;
  compileOk: boolean;
  tracePass: number;
  traceTotal: number;
  reasons: string[];
};

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = { all: false, ci: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--all") out.all = true;
    else if (a === "--ci") out.ci = true;
    else if (a === "--baseline" && argv[i + 1]) out.baseline = argv[++i];
    else if (a === "--cases" && argv[i + 1]) out.cases = argv[++i];
    else if (a === "--skill" && argv[i + 1]) out.skill = argv[++i];
    else if (a.endsWith(".md") || a.endsWith(".SKILL.md")) out.file = a;
  }
  return out;
}

function loadCases(extraPath?: string): SkillTraceCase[] {
  const file = extraPath ?? (fs.existsSync(CASES_FILE) ? CASES_FILE : null);
  const builtin = [...SKILL_TRACE_CASES];
  if (!file || !fs.existsSync(file)) return builtin;
  try {
    const store = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, SkillTraceCase[]>;
    const custom = Object.values(store).flat();
    const ids = new Set(custom.map((c) => c.id));
    return [...custom, ...builtin.filter((c) => !ids.has(c.id))];
  } catch {
    return builtin;
  }
}

function loadBaseline(skillId: string, fallbackRaw: string): { raw: string; version: string } {
  const p = path.join(BASELINE_DIR, `${skillId}.json`);
  if (fs.existsSync(p)) {
    const j = JSON.parse(fs.readFileSync(p, "utf8")) as { raw: string; version?: string };
    return { raw: j.raw, version: j.version ?? "baseline" };
  }
  return { raw: fallbackRaw, version: "builtin" };
}

async function runMockTrace(skill: SkillManifest, c: SkillTraceCase) {
  const mockProfile = MOCK_PROFILES[c.skillId];
  if (!mockProfile) throw new Error(`no mock for ${c.skillId}`);
  const query = c.query;
  const probeUrl = c.probeUrl ?? "https://example.com";
  const vars: Record<string, unknown> = {};
  const trace: { stepId: string; tool: string; ok: boolean }[] = [];
  for (const step of skill.steps) {
    const mockFn = mockProfile[step.tool];
    const args = resolveStepArgs(step.args, { query, probeUrl, vars });
    const content = mockFn ? mockFn(args) : { error: `no mock: ${step.tool}` };
    applyStepVarWrites(vars, step.id, step.tool, content);
    trace.push({ stepId: step.id, tool: step.tool, ok: true });
  }
  return trace;
}

async function runCase(c: SkillTraceCase, skill: SkillManifest | undefined): Promise<TraceEvalRow> {
  const t0 = performance.now();
  if (!skill?.runOk) {
    return { ...c, pass: false, actualSteps: [], detail: `Skill ${c.skillId} 不可运行`, ms: 0 };
  }
  try {
    const actual = await runMockTrace(skill, c);
    const { pass, detail } = matchTrace(
      actual.map((a) => ({ ...a, label: a.stepId, ms: 1 })),
      c.expect.steps,
    );
    return { ...c, pass, actualSteps: actual, detail, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return {
      ...c,
      pass: false,
      actualSteps: [],
      detail: err instanceof Error ? err.message : "trace failed",
      ms: Math.round(performance.now() - t0),
    };
  }
}

async function checkSkill(skillId: string, candidateRaw: string, cases: SkillTraceCase[]): Promise<CheckResult> {
  const baseline = loadBaseline(skillId, candidateRaw);
  const skills = enrichSkillCatalog(
    [hydrateSkill(candidateRaw, { id: skillId, skillPath: `check://${skillId}` })],
    "server",
  );
  const skill = skills[0]!;
  const reasons: string[] = [];
  let gate: GateLevel = "PASS";

  const errors = skill.diagnostics.filter((d) => d.level === "error");
  if (errors.length) {
    gate = "BLOCK";
    reasons.push(...errors.map((e) => `[compile] ${e.message}`));
  }

  if (baseline.raw.trim() !== candidateRaw.trim()) {
    reasons.push("相对 baseline 有内容变更");
  }

  const skillCases = cases.filter((c) => c.skillId === skillId);
  const rows: TraceEvalRow[] = [];
  for (const c of skillCases) rows.push(await runCase(c, skill));

  const summary = traceEvalSummary(rows);
  if (summary.pass < summary.total) {
    gate = gate === "BLOCK" ? "BLOCK" : "WARN";
    for (const r of rows.filter((x) => !x.pass)) {
      reasons.push(`[trace] ${r.id}: ${r.detail}`);
    }
  }

  if (!reasons.length) reasons.push("compile + trace 全通过");

  return {
    skillId,
    gate,
    compileOk: errors.length === 0,
    tracePass: summary.pass,
    traceTotal: summary.total,
    reasons,
  };
}

function loadSkillFromFile(file: string): { skillId: string; raw: string } {
  const raw = fs.readFileSync(path.resolve(file), "utf8");
  const parsed = parseSkillMarkdown(raw);
  const skillId = parsed.name || path.basename(file).replace(/\.(md|SKILL\.md)$/i, "");
  return { skillId, raw };
}

function loadAllBuiltin(): { skillId: string; raw: string }[] {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, "SKILL.md")))
    .map((d) => {
      const raw = fs.readFileSync(path.join(SKILLS_DIR, d.name, "SKILL.md"), "utf8");
      return { skillId: d.name, raw };
    });
}

async function main() {
  const args = parseArgs(process.argv);
  const cases = loadCases(typeof args.cases === "string" ? args.cases : undefined);
  const targets: { skillId: string; raw: string }[] = [];

  if (typeof args.file === "string") targets.push(loadSkillFromFile(args.file));
  else if (typeof args.skill === "string") {
    const p = path.join(SKILLS_DIR, args.skill, "SKILL.md");
    targets.push({ skillId: args.skill, raw: fs.readFileSync(p, "utf8") });
  } else if (args.all) targets.push(...loadAllBuiltin());
  else {
    console.error(`Usage:
  ownagent check skill.md [--baseline dir] [--cases .ownagent/cases.json]
  ownagent check --skill release-inspector
  ownagent check --all`);
    process.exit(2);
  }

  const results: CheckResult[] = [];
  for (const t of targets) {
    results.push(await checkSkill(t.skillId, t.raw, cases));
  }

  const out = { schema: "ownagent-check/1", generatedAt: new Date().toISOString(), results };
  console.log(JSON.stringify(out, null, 2));

  for (const r of results) {
    console.error(`${r.gate.padEnd(6)} ${r.skillId} · trace ${r.tracePass}/${r.traceTotal}`);
    for (const reason of r.reasons.slice(0, 3)) console.error(`       ${reason}`);
  }

  if (results.some((r) => r.gate === "BLOCK")) process.exit(1);
  if (!args.ci && results.some((r) => r.gate === "WARN")) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
