/** 资料库 QA 评测 — 从用户资料库自动生成 golden set，测 RAG 能否命中 */

import { listKnowledgeDocs } from "./ownKnowledge";
import { retrieveRagEnhanced } from "./ragEngine";

export type KnowledgeEvalRow = {
  id: string;
  query: string;
  docId: string;
  docTitle: string;
  pass: boolean;
  topScore: number;
  topChunk?: string;
  detail: string;
};

export function buildKnowledgeEvalCases(): Omit<KnowledgeEvalRow, "pass" | "topScore" | "detail">[] {
  const cases: Omit<KnowledgeEvalRow, "pass" | "topScore" | "detail">[] = [];
  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    const q = doc.prompts.map((p) => p.trim()).find(Boolean) ?? doc.title;
    cases.push({
      id: `kb-${doc.id}`,
      query: q,
      docId: doc.id,
      docTitle: doc.title,
    });
  }
  return cases;
}

export function runKnowledgeEval(
  cases = buildKnowledgeEvalCases(),
): KnowledgeEvalRow[] {
  return cases.map((c) => {
    const result = retrieveRagEnhanced(c.query, 5, { rewrite: true });
    const matched = result.hits.find((h) => h.projectId === c.docId);
    const top = result.hits[0];
    const pass = Boolean(matched && matched.score >= 0.12);
    return {
      ...c,
      pass,
      topScore: matched?.score ?? top?.score ?? 0,
      topChunk: matched?.chunkId ?? top?.chunkId,
      detail: pass
        ? `命中 ${matched!.projectName} · score ${matched!.score.toFixed(2)}`
        : top
          ? `未命中目标条目，top=${top.projectName} (${top.score.toFixed(2)})`
          : "知识库零命中",
    };
  });
}

export function knowledgeEvalSummary(rows: KnowledgeEvalRow[]) {
  const pass = rows.filter((r) => r.pass).length;
  return {
    total: rows.length,
    pass,
    accuracy: rows.length ? Math.round((pass / rows.length) * 100) : 0,
  };
}
