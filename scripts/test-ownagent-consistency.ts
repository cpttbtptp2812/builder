import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { enrichSkillCatalog, hydrateSkill } from "../src/lib/skillMarkdown.ts";
import { runMockGateComparison } from "../src/lib/mockGateRunner.ts";
import { MOCK_PROFILES, SKILL_TRACE_CASES, type SkillTraceCase } from "../src/lib/provingGround.ts";
import { runSkill } from "../src/lib/agentSkills.ts";
import { scmSummaryForCompare } from "../src/lib/deterministicScm.ts";
import { canonicalGateSummary, evaluateSkillGate, mergeSkillGateCases } from "../src/lib/evaluateSkillGate.ts";
import { DEFAULT_GATE_POLICY, parseGatePolicy } from "../src/lib/gatePolicy.ts";

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
const policyRaw = fs.readFileSync(path.join(root, ".ownagent", "policy.yml"), "utf8");
const policy = policyRaw ? parseGatePolicy(policyRaw) : DEFAULT_GATE_POLICY;
const decision = await evaluateSkillGate({
  baseline: baseline!,
  candidate: candidate!,
  cases: mergeSkillGateCases(skillId, customRows, SKILL_TRACE_CASES),
  policy,
  environment: "prod",
  baselineVersion: "baseline",
  candidateVersion: "candidate",
});
assert.equal(decision.deltaSuccess, shared.deltaSuccess);
assert.equal(decision.pivotalStepId, shared.pivotalStepId);
assert.equal(decision.pivotalTool, shared.pivotalTool);
assert.deepEqual(decision.failedCases, shared.failedCases);
assert.deepEqual(decision.coverage, shared.coverage);

const summary = canonicalGateSummary(decision);
assert.equal(summary.gate, decision.gate);
assert.equal(summary.deltaSuccess, decision.deltaSuccess);
assert.equal(summary.pivotalStepId, decision.pivotalStepId);
assert.equal(summary.pivotalTool, decision.pivotalTool);
assert.deepEqual(summary.reasons, decision.reasons.slice(0, 8));

const cli = spawnSync("npx", ["tsx", "scripts/ownagent-check.ts", "--skill", skillId], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});
assert.equal(cli.status === 0 || cli.status === 2, true, cli.stderr);
const cliReport = JSON.parse(cli.stdout) as { results: Array<Record<string, unknown>> };
const cliRow = cliReport.results[0]!;
assert.equal(cliRow.gate, decision.gate);
assert.equal(cliRow.deltaSuccess, decision.deltaSuccess);
assert.equal(cliRow.pivotalStepId, decision.pivotalStepId);
assert.equal(cliRow.pivotalTool, decision.pivotalTool);
assert.deepEqual(cliRow.failedCases, decision.failedCases);
assert.deepEqual(cliRow.coverage, decision.coverage);
assert.deepEqual(cliRow.reasons, decision.reasons);
console.log(`ownagent consistency: ΔP=${shared.deltaSuccess}, pivotal=${shared.pivotalStepId ?? "none"}, gate=${decision.gate}`);
