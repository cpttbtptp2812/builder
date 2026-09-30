/** 真实回流 Gate — 用对话里真实问过、且曾交给本技能的句子再跑现用版 vs 新版 */

import { extractUrlFromText } from "./releaseInspect";
import { listRecentQueriesForSkill } from "./skillQueryLog";
import { routeKeyLabel } from "./skillRouter";
import { runSkillCompare } from "./skillCompareEngine";

export type ShadowReplayRow = {
  query: string;
  askedAt: string;
  baselineRoute: string;
  candidateRoute: string;
  baselineRouteLabel: string;
  candidateRouteLabel: string;
  routeDrift: boolean;
  baselineTraceOk: boolean;
  candidateTraceOk: boolean;
  executionRegressed: boolean;
};

export type ShadowReplayReport = {
  skillId: string;
  windowDays: number;
  queried: number;
  routeDriftCount: number;
  executionRegressCount: number;
  rows: ShadowReplayRow[];
  emptyReason?: string;
};

export async function runShadowReplayGate(opts: {
  skillId: string;
  baselineRaw: string;
  candidateRaw: string;
  windowDays?: number;
  maxQueries?: number;
}): Promise<ShadowReplayReport> {
  const windowDays = opts.windowDays ?? 14;
  const entries = listRecentQueriesForSkill(opts.skillId, { days: windowDays, max: opts.maxQueries ?? 12 });
  if (!entries.length) {
    return {
      skillId: opts.skillId,
      windowDays,
      queried: 0,
      routeDriftCount: 0,
      executionRegressCount: 0,
      rows: [],
      emptyReason:
        "最近没有记录到由这个技能处理的真实问句。请在「对话」里再问一遍（例如 `/inspect https://…` 或「帮我巡检 https://… 能否上线」），然后重新检查。",
    };
  }

  const rows: ShadowReplayRow[] = [];
  for (const entry of entries) {
    const probeUrl = extractUrlFromText(entry.q) ?? undefined;
    const cmp = await runSkillCompare({
      skillId: opts.skillId,
      baselineRaw: opts.baselineRaw,
      candidateRaw: opts.candidateRaw,
      query: entry.q,
      probeUrl,
    });
    const baselineRoute = cmp.baseline.routedSkillId ?? "@open";
    const candidateRoute = cmp.candidate.routedSkillId ?? "@open";
    const routeDrift = baselineRoute !== candidateRoute;
    const executionRegressed = cmp.baseline.traceOk && !cmp.candidate.traceOk;
    rows.push({
      query: entry.q,
      askedAt: entry.at,
      baselineRoute,
      candidateRoute,
      baselineRouteLabel: cmp.baseline.routedSkillName ?? routeKeyLabel(baselineRoute),
      candidateRouteLabel: cmp.candidate.routedSkillName ?? routeKeyLabel(candidateRoute),
      routeDrift,
      baselineTraceOk: cmp.baseline.traceOk,
      candidateTraceOk: cmp.candidate.traceOk,
      executionRegressed,
    });
  }

  return {
    skillId: opts.skillId,
    windowDays,
    queried: rows.length,
    routeDriftCount: rows.filter((r) => r.routeDrift).length,
    executionRegressCount: rows.filter((r) => r.executionRegressed).length,
    rows,
  };
}
