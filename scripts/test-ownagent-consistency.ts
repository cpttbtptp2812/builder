import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { enrichSkillCatalog, hydrateSkill } from "../src/lib/skillMarkdown.ts";
import { runMockGateComparison } from "../src/lib/mockGateRunner.ts";
import { MOCK_PROFILES, SKILL_TRACE_CASES, type SkillTraceCase } from "../src/lib/provingGround.ts";
import { runSkill } from "../src/lib/agentSkills.ts";
import { scmSummaryForCompare } from "../src/lib/deterministicScm.ts";

const root = path.resolve(import.meta.dirname, "..");
const skillId = "release-inspector";
const candidateRaw = fs.readFileSync(path.join(root, "src", "skills", skillId, "SKILL.md"), "utf8");
const baselineData = JSON.parse(
  fs.readFileSync(path.join(root, ".ownagent", "baselines", `${skillId}.json`), "utf8"),
) as { raw: string };
const custom = JSON.parse(fs.readFileSync(path.join(root, ".ownagent", "cases.json"), "utf8")) as Record<string, SkillTraceCase[]>;
const customRows = custom[skillId] ?? [];
const customIds = new Set(customRows.map((row) => row.id));
const cases = [
  ...customRows,
  ...SKILL_TRACE_CASES.filter((row) => row.skillId === skillId && !customIds.has(row.id)),
];
const [baseline, candidate] = enrichSkillCatalog([
  hydrateSkill(baselineData.raw, { id: skillId, skillPath: "golden://baseline" }),
  hydrateSkill(candidateRaw, { id: skillId, skillPath: "golden://candidate" }),
], "browser");

const shared = await runMockGateComparison(baseline!, candidate!, cases);
const runs = [];
for (const traceCase of cases) {
  const [before, after] = await Promise.all([
    runSkill(baseline!, traceCase.query, undefined, {
      probeUrl: traceCase.probeUrl,
      mockProfile: MOCK_PROFILES[skillId],
    }),
    runSkill(candidate!, traceCase.query, undefined, {
      probeUrl: traceCase.probeUrl,
      mockProfile: MOCK_PROFILES[skillId],
    }),
  ]);
  runs.push({ query: traceCase.query, baselineTrace: before.trace, candidateTrace: after.trace });
}
const browser = await scmSummaryForCompare(skillId, runs, {
  baselineSkill: baseline!,
  candidateSkill: candidate!,
  mockProfile: MOCK_PROFILES[skillId],
});
assert(browser);
assert.equal(browser.deltaSuccess, shared.deltaSuccess);
assert.equal(browser.pivotalStepId, shared.pivotalStepId);
assert.equal(browser.pivotalTool, shared.pivotalTool);
console.log(`ownagent consistency: ΔP=${shared.deltaSuccess}, pivotal=${shared.pivotalStepId ?? "none"}`);
