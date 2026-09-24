/** RAG 引擎 — 分块语料 + 混合检索 + TF-IDF 相似度 + Query Rewrite（可接向量库） */

import { matchProject, PROJECT_DETAILS } from "../data/knowledge";
import { shouldUseRagRewrite } from "./agentPromptRuntime";
import { knowledgeCorpusVersion, knowledgeDocsAsChunks } from "./ownKnowledge";
import { rewriteRagQueries } from "./ragQueryRewrite";

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
let corpusVer = "";

export function buildRagCorpus(): RagChunk[] {
  const ver = knowledgeCorpusVersion();
  if (corpusCache && corpusVer === ver) return corpusCache;

  const chunks: RagChunk[] = [];
  for (const p of PROJECT_DETAILS) {
    const push = (chunkId: string, section: RagSection, text: string | undefined, aspectKey?: string) => {
      const trimmed = typeof text === "string" ? text.trim() : "";
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
    push(`${p.id}:topics`, "topics", (p.interviewTopics ?? []).join(" · "));

    (p.narrative ?? "").split(/\n\n+/).forEach((para, i) => {
      push(`${p.id}:narr-${i}`, "narrative", para);
    });
    (p.challenges ?? []).forEach((c, i) => {
      push(`${p.id}:chal-${i}`, "challenge", c);
    });
    for (const [k, v] of Object.entries(p.aspects ?? {})) {
      push(`${p.id}:asp-${k}`, "aspect", v, k);
    }
  }

  for (const c of knowledgeDocsAsChunks()) {
    chunks.push({
      chunkId: c.chunkId,
      projectId: c.projectId,
      projectName: c.projectName,
      section: c.section,
      text: c.text,
      charCount: c.charCount,
    });
  }

  corpusCache = chunks;
  corpusVer = ver;
  return chunks;
}

export function clearRagCorpusCache() {
  corpusCache = null;
  corpusVer = "";
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

type TfidfIndex = {
  idf: Map<string, number>;
  docFreq: Map<string, number>;
  docCount: number;
};

let tfidfCache: TfidfIndex | null = null;
let tfidfVer = "";

function buildTfidfIndex(chunks: RagChunk[]): TfidfIndex {
  const ver = knowledgeCorpusVersion();
  if (tfidfCache && tfidfVer === ver) return tfidfCache;

  const docFreq = new Map<string, number>();
  for (const chunk of chunks) {
    const seen = new Set(tokenize(chunk.text));
    for (const t of seen) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }
  const docCount = chunks.length || 1;
  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log(1 + docCount / df));
  }
  tfidfCache = { idf, docFreq, docCount };
  tfidfVer = ver;
  return tfidfCache;
}

function tfidfVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vec = new Map<string, number>();
  for (const [term, count] of tf) {
    vec.set(term, (count / tokens.length) * (idf.get(term) ?? 0));
  }
  return vec;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const v of a.values()) normA += v * v;
  for (const v of b.values()) normB += v * v;
  for (const [term, va] of a) {
    const vb = b.get(term);
    if (vb) dot += va * vb;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function scoreChunk(chunk: RagChunk, q: string, qTokens: string[], tfidf: TfidfIndex, direct: ReturnType<typeof matchProject>): RagHit {
  const lower = chunk.text.toLowerCase();
  const matchedTerms = qTokens.filter((t) => lower.includes(t));
  let score = matchedTerms.length * 0.11;
  if (q.length > 2 && lower.includes(q.toLowerCase())) score += 0.25;
  if (direct?.id === chunk.projectId) score += 0.22;
  if (chunk.section === "desc" && matchedTerms.length > 0) score += 0.06;
  score += sectionBoost(chunk.section, q);
  if (chunk.chunkId.startsWith("custom:") && matchedTerms.length >= 2) score += 0.2;
  if (chunk.projectName && q.includes(chunk.projectName.slice(0, 6))) score += 0.12;

  const qVec = tfidfVector(qTokens, tfidf.idf);
  const cVec = tfidfVector(tokenize(chunk.text), tfidf.idf);
  const sim = cosineSim(qVec, cVec);
  score = score * 0.55 + sim * 0.45;

  return { ...chunk, score: Math.min(0.99, score), matchedTerms, rank: 0 };
}

function retrieveRagOnce(query: string, topK: number, pipeline: string[]): RagRetrieveResult {
  const t0 = performance.now();
  const q = query.trim();
  const chunks = buildRagCorpus();
  const qTokens = [...new Set(tokenize(q))];
  const direct = matchProject(q);
  const tfidf = buildTfidfIndex(chunks);

  const hits: RagHit[] = chunks
    .map((chunk) => scoreChunk(chunk, q, qTokens, tfidf, direct))
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
    pipeline,
    latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    directProjectId: direct?.id ?? null,
  };
}

/** 混合检索：关键词 + TF-IDF 余弦 + 项目直匹配 */
export function retrieveRag(query: string, topK = 5): RagRetrieveResult {
  return retrieveRagOnce(query, topK, ["buildCorpus", "tokenize", "hybrid-score", "tfidf-cosine", "topK"]);
}

/** 增强检索：可选 Query Rewrite + 多 query 融合 */
export function retrieveRagEnhanced(
  query: string,
  topK = 5,
  opts?: { rewrite?: boolean },
): RagRetrieveResult {
  const useRewrite = opts?.rewrite ?? shouldUseRagRewrite();
  if (!useRewrite) return retrieveRag(query, topK);

  const rewritten = rewriteRagQueries(query, undefined, { multi: true });
  const merged = new Map<string, RagHit>();
  const pipeline = ["query-rewrite", ...rewritten.pipeline, "multi-merge"];

  for (const q of rewritten.variants) {
    for (const h of retrieveRagOnce(q, topK + 2, pipeline).hits) {
      const prev = merged.get(h.chunkId);
      if (!prev || h.score > prev.score) {
        merged.set(h.chunkId, { ...h, score: Math.min(0.99, h.score + (prev ? 0.04 : 0)) });
      }
    }
  }

  const hits = [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((h, i) => ({ ...h, rank: i + 1 }));

  const base = retrieveRagOnce(rewritten.primary, topK, pipeline);
  return {
    ...base,
    query: rewritten.primary,
    hits,
    pipeline,
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

function mapRagHitsForMcp(result: RagRetrieveResult, runtime: "server" | "local" = "local") {
  return {
    query: result.query,
    topK: result.topK,
    hits: result.hits.map((h) => ({
      title: `${h.projectName} · ${h.section}`,
      projectId: h.projectId,
      chunkId: h.chunkId,
      score: h.score,
      excerpt: h.text.slice(0, 480),
      matchedTerms: h.matchedTerms,
    })),
    source: `Hybrid RAG · ${runtime} · ${result.chunkCount} chunks · ${result.latencyMs}ms`,
    pipeline: result.pipeline,
    runtime,
  };
}

/** 兼容 MCP knowledge_search 的扁平 hits（本地语料） */
export function ragHitsForMcp(query: string, topK = 3) {
  return mapRagHitsForMcp(retrieveRagEnhanced(query, topK, { rewrite: true }), "local");
}

/** Hybrid RAG — 优先服务端 SQLite，失败回退浏览器语料 */
export async function ragHitsForMcpAsync(query: string, topK = 3) {
  const { retrieveRagAsync } = await import("./backendBridge");
  const { peekRuntimeConfig } = await import("./runtimeConfig");
  if (peekRuntimeConfig().features.preferServerRag) {
    const result = await retrieveRagAsync(query, topK);
    if (result.runtime === "server") return mapRagHitsForMcp(result, "server");
  }
  return mapRagHitsForMcp(retrieveRagEnhanced(query, topK, { rewrite: true }), "local");
}
