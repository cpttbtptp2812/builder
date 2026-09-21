import type { FlowJournalNode } from "./turnFlowJournal";
import { flowJournalStats } from "./turnFlowJournal";
import type { RouteScoreView } from "./chatFrontier";

export type AnswerInsight = {
  groundedness: number;
  hitCount: number;
  avgRelevance: number;
  ms: number;
  mode: string;
  tags: string[];
};

export function buildAnswerInsight(opts: {
  flowJournal?: FlowJournalNode[];
  ms?: number;
  mode?: string;
  route?: RouteScoreView;
  toolCount?: number;
}): AnswerInsight {
  const stats = flowJournalStats(opts.flowJournal ?? []);
  const avg = stats.avgScore ?? 0;
  const hitCount = stats.hitCount;
  const groundedness = Math.min(
    100,
    Math.round(avg * 70 + hitCount * 8 + (opts.mode === "guest" || opts.mode === "multi" ? 12 : 6)),
  );

  const tags: string[] = ["Hybrid RAG"];
  if (hitCount > 0) tags.push(`${hitCount} 段溯源`);
  if (opts.flowJournal?.length) tags.push("Neural Trace");
  if (opts.route?.path === "knowledge") tags.push("Knowledge Route");
  if (opts.toolCount) tags.push(`${opts.toolCount} Tool Calls`);
  if (opts.mode === "multi") tags.push("Multi-Agent");
  if (opts.ms != null && opts.ms < 800) tags.push("Sub-second");

  return {
    groundedness: hitCount ? groundedness : Math.min(groundedness, 35),
    hitCount,
    avgRelevance: avg,
    ms: opts.ms ?? 0,
    mode: opts.mode ?? "guest",
    tags: tags.slice(0, 5),
  };
}
