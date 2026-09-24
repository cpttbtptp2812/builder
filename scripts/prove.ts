/** Proving Ground CLI — compile + trace mock 门禁（不加载浏览器 agentSkills） */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichSkillCatalog, hydrateSkill, resolveStepArgs } from "../src/lib/skillMarkdown.ts";
import {
  MOCK_PROFILES,
  SKILL_TRACE_CASES,
  matchTrace,
  traceEvalSummary,
  type SkillTraceCase,
  type TraceEvalRow,
} from "../src/lib/provingGround.ts";
import { applyStepVarWrites } from "../src/lib/skillVarBindings.ts";
import type { SkillManifest } from "../src/lib/skillMarkdown.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "..", "src", "skills");

function loadSkills(): SkillManifest[] {
  return enrichSkillCatalog(
    fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, "SKILL.md")))
      .map((d) => {
        const raw = fs.readFileSync(path.join(SKILLS_DIR, d.name, "SKILL.md"), "utf8");
        return hydrateSkill(raw, { id: d.name, skillPath: `src/skills/${d.name}/SKILL.md` });
      }),
    "server",
  );
}

async function runMockTrace(skill: SkillManifest, c: SkillTraceCase) {
  const mockProfile = MOCK_PROFILES[c.skillId];
  if (!mockProfile) throw new Error(`no mock for ${c.skillId}`);

  const query = c.query;
  const probeUrl = c.probeUrl ?? "https://example.com";
  const vars: Record<string, unknown> = {};
  const trace: TraceEvalRow["actualSteps"] & { label?: string; ms?: number; result?: unknown }[] = [];

  for (const step of skill.steps) {
    const mockFn = mockProfile[step.tool];
    const args = resolveStepArgs(step.args, { query, probeUrl, vars });
    const content = mockFn ? mockFn(args) : { error: `no mock: ${step.tool}` };
    applyStepVarWrites(vars, step.id, step.tool, content);
    trace.push({ stepId: step.id, tool: step.tool, ok: true });
  }

  return trace.map((t) => ({ stepId: t.stepId, tool: t.tool, ok: t.ok }));
}

async function runTraceCaseNode(c: SkillTraceCase, skill: SkillManifest | undefined): Promise<TraceEvalRow> {
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

async function main() {
  const skills = loadSkills();
  const byId = new Map(skills.map((s) => [s.id, s]));
  let compileFail = 0;

  console.log("=== Semcompiler ===");
  for (const s of skills) {
    const errors = s.diagnostics.filter((d) => d.level === "error");
    if (errors.length) {
      compileFail += 1;
      console.log(`FAIL ${s.id}`);
      for (const e of errors) console.log(`  [${e.code}] ${e.message}`);
    } else {
      console.log(`OK   ${s.id} · ${s.effectUpperBound ?? "—"}`);
    }
  }

  console.log("\n=== Proving Ground (mock trace) ===");
  const rows: TraceEvalRow[] = [];
  for (const c of SKILL_TRACE_CASES) {
    rows.push(await runTraceCaseNode(c, byId.get(c.skillId)));
  }
  const summary = traceEvalSummary(rows);
  for (const r of rows) {
    console.log(`${r.pass ? "OK  " : "FAIL"} ${r.id} ${r.skillId} — ${r.detail}`);
  }
  console.log(`\nTrace: ${summary.pass}/${summary.total} (${summary.accuracy}%)`);

  if (compileFail > 0 || summary.pass < summary.total) {
    process.exit(1);
  }
  console.log("\nprove: all green");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
