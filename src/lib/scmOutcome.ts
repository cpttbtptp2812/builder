/** SCM outcome 评分 — skeleton / release overall / 自定义 grader */

import type { SkillTraceStep } from "./agentSkills";
import { matchTrace, type SkillTraceCase } from "./provingGround";
import type { InspectCheckStatus } from "./releaseInspect";

export type OutcomeGrader =
  | { kind: "skeleton" }
  | { kind: "release_overall"; min: InspectCheckStatus }
  | { kind: "all_ok" }
  | { kind: "min_steps"; count: number };

export type ScmOutcome = {
  pass: boolean;
  score: number;
  detail: string;
  grader: OutcomeGrader["kind"];
};

export function graderForCase(traceCase: SkillTraceCase & { grader?: OutcomeGrader }): OutcomeGrader {
  if (traceCase.grader) return traceCase.grader;
  return { kind: "skeleton" };
}

function releaseOverallFromTrace(trace: SkillTraceStep[]): InspectCheckStatus | null {
  for (let i = trace.length - 1; i >= 0; i -= 1) {
    const r = trace[i]?.result;
    if (!r || typeof r !== "object") continue;
    const o = r as {
      dashboard?: { releaseInspect?: { overall?: InspectCheckStatus } };
      meta?: { overall?: InspectCheckStatus };
    };
    const overall = o.dashboard?.releaseInspect?.overall ?? o.meta?.overall;
    if (overall) return overall;
  }
  return null;
}

const STATUS_RANK: Record<InspectCheckStatus, number> = { pass: 2, warn: 1, fail: 0 };

function meetsReleaseMin(actual: InspectCheckStatus, min: InspectCheckStatus): boolean {
  return STATUS_RANK[actual] >= STATUS_RANK[min];
}

export function evaluateOutcome(
  trace: SkillTraceStep[],
  traceCase: SkillTraceCase & { grader?: OutcomeGrader },
  _result?: unknown,
): ScmOutcome {
  const grader = graderForCase(traceCase);

  if (grader.kind === "skeleton") {
    const { pass, detail } = matchTrace(trace, traceCase.expect.steps);
    return { pass, score: pass ? 1 : 0, detail, grader: "skeleton" };
  }

  if (grader.kind === "all_ok") {
    const pass = trace.length > 0 && trace.every((t) => t.ok);
    return {
      pass,
      score: pass ? 1 : 0,
      detail: pass ? "全部步骤 ok" : `第 ${trace.findIndex((t) => !t.ok) + 1} 步失败`,
      grader: "all_ok",
    };
  }

  if (grader.kind === "min_steps") {
    const pass = trace.length >= grader.count;
    return {
      pass,
      score: pass ? 1 : 0,
      detail: pass ? `≥ ${grader.count} 步` : `仅 ${trace.length} 步，期望 ≥ ${grader.count}`,
      grader: "min_steps",
    };
  }

  if (grader.kind === "release_overall") {
    const overall = releaseOverallFromTrace(trace);
    if (!overall) {
      const sk = matchTrace(trace, traceCase.expect.steps);
      return {
        pass: sk.pass,
        score: sk.pass ? 0.5 : 0,
        detail: sk.pass ? "骨架通过，但未产出 release overall" : sk.detail,
        grader: "release_overall",
      };
    }
    const pass = meetsReleaseMin(overall, grader.min);
    return {
      pass,
      score: pass ? 1 : overall === "warn" ? 0.5 : 0,
      detail: `release overall = ${overall}（要求 ≥ ${grader.min}）`,
      grader: "release_overall",
    };
  }

  const { pass, detail } = matchTrace(trace, traceCase.expect.steps);
  return { pass, score: pass ? 1 : 0, detail, grader: "skeleton" };
}
