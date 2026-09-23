/** OwnAgent 运行时配置 — 前后端共享默认值，Admin / API 可覆盖 */

import type { RouterEvalCase } from "../lib/evalHarness";

export type AgentRuntimeConfig = {
  features: {
    /** 优先 SQLite Hybrid RAG，失败回退浏览器语料 */
    preferServerRag: boolean;
    /** Guest Agent 优先走 /api/agent/guest */
    preferServerGuest: boolean;
    /** Multi-Agent 优先走 /api/multi-agent/run */
    preferServerMultiAgent: boolean;
    /** Eval 优先走服务端 API */
    preferServerEval: boolean;
  };
  plaza: {
    matchThreshold: number;
    hintThreshold: number;
  };
  rag: {
    defaultTopK: number;
    minHitScore: number;
  };
  neuralTrace: {
    enabled: boolean;
    steps: Array<"read" | "route" | "fetch" | "write">;
  };
  eval: {
    routerCases: RouterEvalCase[];
  };
};

export const DEFAULT_ROUTER_EVAL_CASES: RouterEvalCase[] = [
  { id: "r1", query: "分析本站性能 metrics 和 latency", expectedSkillId: "site-analyzer", note: "性能审计" },
  { id: "r2", query: "DOM 结构 role 分布和交互密度", expectedSkillId: "dom-probe", note: "DOM 探针" },
  { id: "r3", query: "workflow 入队执行 replay", expectedSkillId: "workflow-orchestrator", note: "流程编排" },
  { id: "r4", query: "http_probe 探活健康检查", expectedSkillId: "site-analyzer", note: "探活 → 审计 Skill" },
  { id: "r5", query: "a11y snapshot 浏览器快照", expectedSkillId: "dom-probe", note: "快照 → DOM Skill" },
  { id: "r6", query: "满一年年假几天制度怎么规定", expectedSkillId: "policy-desk", note: "制度值班" },
  { id: "r7", query: "帮我开通公司 VPN 权限", expectedSkillId: "policy-desk", note: "改权限走工单" },
  { id: "r8", query: "检索 iMean 定位语料 chunkId", expectedSkillId: "knowledge-lookup", note: "知识检索技能" },
];

export const DEFAULT_AGENT_RUNTIME_CONFIG: AgentRuntimeConfig = {
  features: {
    preferServerRag: true,
    preferServerGuest: true,
    preferServerMultiAgent: true,
    preferServerEval: true,
  },
  plaza: {
    matchThreshold: 70,
    hintThreshold: 40,
  },
  rag: {
    defaultTopK: 5,
    minHitScore: 0.12,
  },
  neuralTrace: {
    enabled: true,
    steps: ["read", "route", "fetch", "write"],
  },
  eval: {
    routerCases: DEFAULT_ROUTER_EVAL_CASES,
  },
};

/** 深合并远程配置（仅一层对象） */
export function mergeRuntimeConfig(
  base: AgentRuntimeConfig,
  patch?: Partial<AgentRuntimeConfig> & {
    plaza_match_threshold?: string | number;
    plaza_hint_threshold?: string | number;
  },
): AgentRuntimeConfig {
  if (!patch) return base;
  const plazaMatch = patch.plaza?.matchThreshold ?? Number(patch.plaza_match_threshold);
  const plazaHint = patch.plaza?.hintThreshold ?? Number(patch.plaza_hint_threshold);
  return {
    features: { ...base.features, ...patch.features },
    plaza: {
      matchThreshold: Number.isFinite(plazaMatch) ? Number(plazaMatch) : base.plaza.matchThreshold,
      hintThreshold: Number.isFinite(plazaHint) ? Number(plazaHint) : base.plaza.hintThreshold,
    },
    rag: { ...base.rag, ...patch.rag },
    neuralTrace: { ...base.neuralTrace, ...patch.neuralTrace },
    eval: {
      routerCases: patch.eval?.routerCases?.length ? patch.eval.routerCases : base.eval.routerCases,
    },
  };
}
