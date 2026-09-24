/** 发送前策略门禁 — 回答规则在对话入口硬拦截（LLM / Guest 共用） */

import type { PolicyTrustView, RouteScoreView } from "./chatFrontier";
import { runPolicyDesk, type TicketDraft } from "./policyDesk";

export type PolicyGateBlock = {
  markdown: string;
  policyTrust: PolicyTrustView;
  hitl?: TicketDraft;
  route: RouteScoreView;
};

/** abstain 全路径拦截；mutate 在 LLM 路径拦截（Guest 走 policy-desk skill） */
export function evaluatePolicyGate(
  query: string,
  opts?: { llmPath?: boolean },
): PolicyGateBlock | null {
  const desk = runPolicyDesk(query, {
    persistTicket: opts?.llmPath !== false,
  });

  if (desk.capability.cap === "abstain" && desk.capability.matched) {
    return {
      markdown: desk.markdown,
      policyTrust: {
        cap: desk.capability.cap,
        reason: desk.capability.reason,
        outcome: desk.outcome,
        citations: desk.citations,
      },
      route: {
        skillId: "policy-gate",
        skillName: "回答规则 · 拒绝",
        score: 5,
        hits: ["abstain"],
        path: "skill",
      },
    };
  }

  if (opts?.llmPath && desk.capability.cap === "mutate" && desk.capability.matched) {
    return {
      markdown: desk.markdown,
      policyTrust: {
        cap: desk.capability.cap,
        reason: desk.capability.reason,
        outcome: desk.outcome,
        citations: desk.citations,
      },
      hitl: desk.ticket ?? undefined,
      route: {
        skillId: "policy-desk",
        skillName: "人工审批 · HITL",
        score: 5,
        hits: ["mutate", "ticket"],
        path: "skill",
      },
    };
  }

  return null;
}
