import { mustRunServerProcessSkill } from "./customerSkillKernel";
import { runLiveGateComparison } from "./liveGateRunner";
import { runMockGateComparison, type MockGateResult } from "./mockGateRunner";
import type { SkillTraceCase } from "./provingGround";
import type { SkillManifest } from "./skillMarkdown";

export async function runGateComparison(
  baseline: SkillManifest,
  candidate: SkillManifest,
  cases: SkillTraceCase[],
): Promise<MockGateResult> {
  if (mustRunServerProcessSkill(candidate.id)) {
    return runLiveGateComparison(baseline, candidate, cases);
  }
  return runMockGateComparison(baseline, candidate, cases);
}
