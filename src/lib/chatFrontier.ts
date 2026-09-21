import type { Capability, PolicyOutcome, PolicyHit } from "./policyDesk";
import { listKnowledgeDocs } from "./ownKnowledge";
import type { FlowJournalNode } from "./turnFlowJournal";
import {
  listVerifiedFollowUps,
  relatedDocIdsFromJournal,
  type FollowUpPrompt,
} from "./followUpPrompts";

export type { FollowUpPrompt };

export type PolicyTrustView = {
  cap: Capability;
  reason: string;
  outcome: PolicyOutcome;
  citations: Pick<PolicyHit, "id" | "text" | "status" | "value" | "slot">[];
};

export type RouteScoreView = {
  skillId: string;
  skillName: string;
  score: number;
  hits: string[];
  path: "skill" | "open" | "knowledge" | "about-site" | "multi" | "llm" | "eval";
};

export type InlineEvalView = {
  kind: "policy" | "router";
  accuracy: number;
  pass: number;
  total: number;
  rows: { id: string; query: string; pass: boolean; detail: string }[];
  leakedCommit?: number;
};

/** 跟进建议 — RAG 预检可答，优先推荐其他主题 */
export function followUpsFor(opts?: {
  policyTrust?: PolicyTrustView;
  route?: RouteScoreView;
  mode?: string;
  exclude?: string[];
  query?: string;
  flowJournal?: FlowJournalNode[];
  limit?: number;
}): FollowUpPrompt[] {
  const exclude = opts?.exclude ?? [];
  const answeredDoc = relatedDocIdsFromJournal(opts?.query, opts?.flowJournal);
  const preferOther = listKnowledgeDocs()
    .map((d) => d.id)
    .filter((id) => !answeredDoc.includes(id));

  return listVerifiedFollowUps(exclude, opts?.limit ?? 3, preferOther.length ? preferOther : answeredDoc);
}
