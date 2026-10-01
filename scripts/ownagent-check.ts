/** OwnAgent CLI — skill.md 发版门禁 check */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichSkillCatalog, hydrateSkill, parseSkillMarkdown } from "../src/lib/skillMarkdown.ts";
import {
  SKILL_TRACE_CASES,
  type SkillTraceCase,
} from "../src/lib/provingGround.ts";
import { evaluateSkillGate } from "../src/lib/evaluateSkillGate.ts";
import { DEFAULT_GATE_POLICY, parseGatePolicy } from "../src/lib/gatePolicy.ts";
import { OWNAGENT_CHECK_SCHEMA } from "../src/lib/ownagentProtocol.ts";
import {
  buildSkillDependencyGraph,
  propagateReverseImpact,
  reportAmbiguousRoutes,
} from "../src/lib/skillGovernance.ts";
import { scoreSkillDetailed } from "../src/lib/agentSkills.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SKILLS_DIR = path.join(ROOT, "src", "skills");
const BASELINE_DIR = path.join(ROOT, ".ownagent", "baselines");
const CASES_FILE = path.join(ROOT, ".ownagent", "cases.json");
const POLICY_FILE = path.join(ROOT, ".ownagent", "policy.yml");

type GateLevel = "PASS" | "WARN" | "BLOCK";

type CheckResult = {
  skillId: string;
  environment: string;
  gate: GateLevel;
  compileOk: boolean;
  tracePass: number;
  traceTotal: number;
  deltaSuccess: number;
  pivotalStepId: string | null;
  pivotalTool: string | null;
  failedCases: Array<{ id: string; query: string; detail: string }>;
  coverage: {
    exact: number;
    total: number;
    exactPct: number;
    missingTools: string[];
  };
  reasons: string[];
  baseline: { version: string };
  candidate: { version: string };
  pivotal: { stepId: string; tool: string | null; exact: boolean } | null;
  policy: {
    risk: "low" | "medium" | "high";
    minExactPct: number;
    requireCases: boolean;
    requiresApproval: boolean;
  };
  impact?: { direct: string[]; transitive: string[]; ambiguousRoutes: number };
};

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = { all: false, ci: false, env: "prod" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--all") out.all = true;
    else if (a === "--ci") out.ci = true;
    else if (a === "--baseline" && argv[i + 1]) out.baseline = argv[++i];
    else if (a === "--cases" && argv[i + 1]) out.cases = argv[++i];
    else if (a === "--skill" && argv[i + 1]) out.skill = argv[++i];
    else if (a === "--env" && argv[i + 1]) out.env = argv[++i];
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

async function checkSkill(skillId: string, candidateRaw: string, cases: SkillTraceCase[], environment: string): Promise<CheckResult> {
  const baseline = loadBaseline(skillId, candidateRaw);
  const candidate = enrichSkillCatalog(
    [hydrateSkill(candidateRaw, { id: skillId, skillPath: `check://${skillId}` })],
    "server",
  )[0]!;
  const baselineSkill = enrichSkillCatalog(
    [hydrateSkill(baseline.raw, { id: skillId, skillPath: `baseline://${skillId}` })],
    "server",
  )[0]!;
  const skillCases = cases.filter((c) => c.skillId === skillId);
  const policy = fs.existsSync(POLICY_FILE)
    ? parseGatePolicy(fs.readFileSync(POLICY_FILE, "utf8"))
    : DEFAULT_GATE_POLICY;
  const decision = await evaluateSkillGate({
    baseline: baselineSkill,
    candidate,
    cases: skillCases,
    policy,
    environment,
    baselineVersion: baseline.version,
    candidateVersion: "candidate",
  });
  return {
    skillId,
    environment,
    gate: decision.gate,
    compileOk: decision.compileOk,
    tracePass: decision.tracePass,
    traceTotal: decision.traceTotal,
    deltaSuccess: decision.deltaSuccess,
    pivotalStepId: decision.pivotalStepId,
    pivotalTool: decision.pivotalTool,
    failedCases: decision.failedCases,
    coverage: decision.coverage,
    reasons: decision.reasons,
    baseline: decision.baseline,
    candidate: decision.candidate,
    pivotal: decision.pivotal,
    policy: decision.policy,
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
  const environment = typeof args.env === "string" ? args.env : "prod";
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
    results.push(await checkSkill(t.skillId, t.raw, cases, environment));
  }

  const catalog = enrichSkillCatalog(
    targets.map((target) =>
      hydrateSkill(target.raw, { id: target.skillId, skillPath: `check://${target.skillId}` }),
    ),
    "server",
  );
  const dependencyGraph = buildSkillDependencyGraph(catalog);
  const ambiguity = reportAmbiguousRoutes(
    catalog,
    cases.map((row) => ({ id: row.id, query: row.query, source: "regression-case" })),
    scoreSkillDetailed,
  );
  const changed = targets
    .filter((target) => loadBaseline(target.skillId, target.raw).raw.trim() !== target.raw.trim())
    .map((target) => target.skillId);
  const impact = propagateReverseImpact(dependencyGraph, changed);
  for (const result of results) {
    const affected = impact.impacted.filter((row) => row.path.includes(result.skillId));
    result.impact = {
      direct: affected.filter((row) => row.distance <= 1).map((row) => row.skillId),
      transitive: affected.filter((row) => row.distance > 1).map((row) => row.skillId),
      ambiguousRoutes: ambiguity.routes.filter((route) => route.rivals.some((rival) => rival.skillId === result.skillId)).length,
    };
  }
  const out = {
    schema: OWNAGENT_CHECK_SCHEMA,
    generatedAt: new Date().toISOString(),
    environment,
    governance: { dependencyGraph, ambiguity, impact },
    results,
  };
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
