/** RAG 引擎 — 分块语料 + 混合检索 + 引用溯源（可接向量库） */

import { matchProject, PROJECT_DETAILS } from "../data/knowledge";

export type RagSection = "desc" | "architecture" | "narrative" | "challenge" | "aspect" | "topics";

export type RagChunk = {
  chunkId: string;
  projectId: string;
  projectName: string;
  section: RagSection;
  aspectKey?: string;
  text: string;
  charCount: number;
};

export type RagHit = RagChunk & {
  score: number;
  matchedTerms: string[];
  rank: number;
};

export type RagRetrieveResult = {
  query: string;
  topK: number;
  hits: RagHit[];
  corpusSize: number;
  chunkCount: number;
  pipeline: string[];
  latencyMs: number;
  directProjectId: string | null;
};

let corpusCache: RagChunk[] | null = null;

export function buildRagCorpus(): RagChunk[] {
  if (corpusCache) return corpusCache;

  const chunks: RagChunk[] = [];
  for (const p of PROJECT_DETAILS) {
    const push = (chunkId: string, section: RagSection, text: string, aspectKey?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      chunks.push({
        chunkId,
        projectId: p.id,
        projectName: p.name,
        section,
        aspectKey,
        text: trimmed,
        charCount: trimmed.length,
      });
    };

    push(`${p.id}:desc`, "desc", p.desc);
    push(`${p.id}:arch`, "architecture", p.architecture);
    push(`${p.id}:topics`, "topics", p.interviewTopics.join(" · "));

    p.narrative.split(/\n\n+/).forEach((para, i) => {
      push(`${p.id}:narr-${i}`, "narrative", para);
    });
    p.challenges.forEach((c, i) => {
      push(`${p.id}:chal-${i}`, "challenge", c);
    });
    for (const [k, v] of Object.entries(p.aspects)) {
      push(`${p.id}:asp-${k}`, "aspect", v, k);
    }
  }

  corpusCache = chunks;
  return chunks;
}

export function clearRagCorpusCache() {
  corpusCache = null;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\u4e00-\u9fff]{1,8}|[a-z0-9]{2,}/g) ?? [];
}

function sectionBoost(section: RagSection, query: string): number {
  if (/架构|设计|方案/.test(query) && section === "architecture") return 0.18;
  if (/难点|挑战|问题/.test(query) && section === "challenge") return 0.16;
  if (/性能|优化|指标/.test(query) && (section === "narrative" || section === "aspect")) return 0.1;
  return 0;
}

/** 混合检索：关键词重叠 + 项目直匹配 + 段落加权（生产可换 embedding） */
export function retrieveRag(query: string, topK = 5): RagRetrieveResult {
  const t0 = performance.now();
  const q = query.trim();
  const chunks = buildRagCorpus();
  const qTokens = [...new Set(tokenize(q))];
  const direct = matchProject(q);

  const hits: RagHit[] = chunks
    .map((chunk) => {
      const lower = chunk.text.toLowerCase();
      const matchedTerms = qTokens.filter((t) => lower.includes(t));
      let score = matchedTerms.length * 0.11;
      if (q.length > 2 && lower.includes(q.toLowerCase())) score += 0.25;
      if (direct?.id === chunk.projectId) score += 0.22;
      if (chunk.section === "desc" && matchedTerms.length > 0) score += 0.06;
      score += sectionBoost(chunk.section, q);
      score = Math.min(0.99, score);
      return { ...chunk, score, matchedTerms, rank: 0 };
    })
    .filter((h) => h.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((h, i) => ({ ...h, rank: i + 1 }));

  return {
    query: q,
    topK,
    hits,
    corpusSize: PROJECT_DETAILS.length,
    chunkCount: chunks.length,
    pipeline: ["buildCorpus", "tokenize", "hybrid-score", "direct-match", "topK"],
    latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    directProjectId: direct?.id ?? null,
  };
}

/** 将检索结果格式化为 Agent 上下文（带引用） */
export function formatRagContext(result: RagRetrieveResult): string {
  if (!result.hits.length) return "（知识库未命中相关内容）";
  return result.hits
    .map(
      (h) =>
        `[${h.rank}] ${h.projectName} · ${h.section}${h.aspectKey ? `/${h.aspectKey}` : ""} (score ${h.score.toFixed(2)})\n${h.text.slice(0, 280)}${h.text.length > 280 ? "…" : ""}`,
    )
    .join("\n\n");
}

/** 兼容 MCP knowledge_search 的扁平 hits */
export function ragHitsForMcp(query: string, topK = 3) {
  const result = retrieveRag(query, topK);
  return {
    query: result.query,
    topK: result.topK,
    hits: result.hits.map((h) => ({
      title: `${h.projectName} · ${h.section}`,
      projectId: h.projectId,
      chunkId: h.chunkId,
      score: h.score,
      excerpt: h.text.slice(0, 160),
      matchedTerms: h.matchedTerms,
    })),
    source: `ragEngine · ${result.chunkCount} chunks · ${result.latencyMs}ms`,
    pipeline: result.pipeline,
  };
}
