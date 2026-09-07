/** 服务端 RAG — 从 SQLite 检索 */

import { matchProject } from "../src/data/knowledge.ts";
import { getAllChunks, type RagChunkRow } from "./seed.ts";

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\u4e00-\u9fff]{1,8}|[a-z0-9]{2,}/g) ?? [];
}

function sectionBoost(section: string, query: string): number {
  if (/架构|设计|方案/.test(query) && section === "architecture") return 0.18;
  if (/难点|挑战|问题/.test(query) && section === "challenge") return 0.16;
  if (/性能|优化|指标/.test(query) && (section === "narrative" || section === "aspect")) return 0.1;
  return 0;
}

export type RagHit = RagChunkRow & {
  score: number;
  matched_terms: string[];
  rank: number;
};

export function retrieveRagFromDb(query: string, topK = 5) {
  const t0 = performance.now();
  const q = query.trim();
  const chunks = getAllChunks();
  const qTokens = [...new Set(tokenize(q))];
  const direct = matchProject(q);

  const hits: RagHit[] = chunks
    .map((chunk) => {
      const lower = chunk.text.toLowerCase();
      const matchedTerms = qTokens.filter((t) => lower.includes(t));
      let score = matchedTerms.length * 0.11;
      if (q.length > 2 && lower.includes(q.toLowerCase())) score += 0.25;
      if (direct?.id === chunk.project_id) score += 0.22;
      if (chunk.section === "desc" && matchedTerms.length > 0) score += 0.06;
      score += sectionBoost(chunk.section, q);
      score = Math.min(0.99, score);
      return { ...chunk, score, matched_terms: matchedTerms, rank: 0 };
    })
    .filter((h) => h.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((h, i) => ({ ...h, rank: i + 1 }));

  return {
    query: q,
    topK,
    hits,
    corpusSize: new Set(chunks.map((c) => c.project_id)).size,
    chunkCount: chunks.length,
    pipeline: ["sqlite", "tokenize", "hybrid-score", "topK"],
    latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    directProjectId: direct?.id ?? null,
    source: "sqlite:rag_chunks",
  };
}

export function ragHitsForMcp(query: string, topK = 3) {
  const result = retrieveRagFromDb(query, topK);
  return {
    query: result.query,
    topK: result.topK,
    hits: result.hits.map((h) => ({
      title: `${h.project_name} · ${h.section}`,
      projectId: h.project_id,
      chunkId: h.chunk_id,
      score: h.score,
      excerpt: h.text.slice(0, 160),
      matchedTerms: h.matched_terms,
    })),
    source: result.source,
    pipeline: result.pipeline,
  };
}

export function formatRagContext(result: ReturnType<typeof retrieveRagFromDb>): string {
  if (!result.hits.length) return "（知识库未命中相关内容）";
  return result.hits
    .map(
      (h) =>
        `[${h.rank}] ${h.project_name} · ${h.section}${h.aspect_key ? `/${h.aspect_key}` : ""} (score ${h.score.toFixed(2)})\n${h.text.slice(0, 280)}${h.text.length > 280 ? "…" : ""}`,
    )
    .join("\n\n");
}
