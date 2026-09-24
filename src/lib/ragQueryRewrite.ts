/** RAG Query Rewrite — 多 query 扩展（浏览器内，无需 embedding API） */

import type { AgentChatMessage } from "./agentRuntime";

const FILLER_PREFIX = /^(请|帮我|能不能|可以|麻烦|我想|想要)(我|你)?/;

export type RagRewriteResult = {
  primary: string;
  variants: string[];
  pipeline: string[];
};

export function rewriteRagQueries(
  query: string,
  history?: AgentChatMessage[],
  opts?: { multi?: boolean },
): RagRewriteResult {
  const pipeline: string[] = ["normalize"];
  let primary = query.trim().replace(/[？?！!。，,；;]+$/g, "").trim();
  primary = primary.replace(FILLER_PREFIX, "").trim() || query.trim();

  const variants = new Set<string>([primary]);

  const tokens = primary.match(/[\u4e00-\u9fff]{2,8}|[A-Za-z][A-Za-z0-9_-]{1,}/g) ?? [];
  if (tokens.length >= 2) {
    variants.add(tokens.slice(0, 5).join(" "));
    pipeline.push("keyword-core");
  }

  if (history?.length && primary.replace(/\s/g, "").length <= 14) {
    const lastUser = [...history].reverse().find((m) => m.role === "user" && m.content.trim());
    if (lastUser) {
      variants.add(`${lastUser.content.trim()} ${primary}`);
      pipeline.push("context-expand");
    }
  }

  if (/架构|设计|方案/.test(primary)) variants.add(primary.replace(/架构|设计/g, "方案"));
  if (/难点|挑战|问题/.test(primary)) variants.add(`${primary} 技术难点`);
  if (/性能|优化|指标/.test(primary)) variants.add(`${primary} 性能优化`);
  if (/项目|经历|背景/.test(primary)) variants.add(primary.replace(/项目|经历|背景/g, ""));

  if (opts?.multi) {
    for (const t of tokens.slice(0, 3)) {
      if (t.length >= 2) variants.add(t);
    }
    pipeline.push("multi-query");
  }

  return {
    primary,
    variants: [...variants].filter(Boolean).slice(0, 5),
    pipeline,
  };
}
