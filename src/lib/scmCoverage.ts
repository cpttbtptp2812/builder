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

export function computeSkillCoverage(
  skill: Pick<NonNullable<ReturnType<typeof getSkill>>, "id" | "steps">,
  opts?: { observedTrace?: SkillTraceStep[]; liveTrace?: boolean },
): ScmCoverageReport {
  const hasMock = Boolean(MOCK_PROFILES[skill.id]);
  const modes = identifyStepModes(skill as NonNullable<ReturnType<typeof getSkill>>, {
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
  const mockHints = steps
    .filter((s) => s.mode === "sample" && !MOCK_PROFILES[skill.id]?.[s.tool])
    .map((s) => `为 \`${s.tool}\` 补 MOCK_PROFILES 或录制 trace`);

  return {
    skillId: skill.id,
    total: steps.length,
    exact,
    sample: steps.length - exact,
    exactPct: steps.length ? Math.round((exact / steps.length) * 100) : 100,
    steps,
    mockHints: [...new Set(mockHints)].slice(0, 5),
  };
}

export function computeScmCoverage(
  skillId: string,
  opts?: { observedTrace?: SkillTraceStep[]; liveTrace?: boolean },
): ScmCoverageReport | null {
  const skill = getSkill(skillId);
  if (!skill?.steps.length) return null;

  return computeSkillCoverage(skill, opts);
}
