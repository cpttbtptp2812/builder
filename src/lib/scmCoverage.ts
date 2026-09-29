/** SCM exact vs sample 传播覆盖率 */

import { getSkill } from "./agentSkills";
import { identifyStepModes } from "./deterministicScm";
import { MOCK_PROFILES } from "./provingGround";
import type { SkillTraceStep } from "./agentSkills";

export type ScmCoverageReport = {
  skillId: string;
  total: number;
  exact: number;
  sample: number;
  exactPct: number;
  steps: { stepId: string; tool: string; mode: "exact" | "sample" }[];
  mockHints: string[];
};

export function computeScmCoverage(
  skillId: string,
  opts?: { observedTrace?: SkillTraceStep[]; liveTrace?: boolean },
): ScmCoverageReport | null {
  const skill = getSkill(skillId);
  if (!skill?.steps.length) return null;

  const hasMock = Boolean(MOCK_PROFILES[skillId]);
  const modes = identifyStepModes(skill, {
    hasMock,
    liveTrace: opts?.liveTrace ?? Boolean(opts?.observedTrace?.length),
    observedTrace: opts?.observedTrace,
  });

  const steps = skill.steps.map((s, i) => ({
    stepId: s.id,
    tool: s.tool,
    mode: modes[i] ?? "sample",
  }));
  const exact = steps.filter((s) => s.mode === "exact").length;
  const mockHints: string[] = [];
  for (const s of steps.filter((x) => x.mode === "sample")) {
    if (!MOCK_PROFILES[skillId]?.[s.tool]) {
      mockHints.push(`为 \`${s.tool}\` 补 MOCK_PROFILES 或 live trace obs`);
    }
  }

  return {
    skillId,
    total: steps.length,
    exact,
    sample: steps.length - exact,
    exactPct: steps.length ? Math.round((exact / steps.length) * 100) : 0,
    steps,
    mockHints: [...new Set(mockHints)].slice(0, 5),
  };
}
