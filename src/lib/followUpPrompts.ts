import { retrieveRag } from "./ragEngine";
import { listKnowledgeDocs } from "./ownKnowledge";

export type FollowUpPrompt = {
  text: string;
  hint: string;
  docId: string;
  /** RAG 预检相关度 0–1，保证可答 */
  relevance: number;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

const MIN_RELEVANCE = 0.06;

/** 预检 RAG — 只返回知识库能命中的问句 */
export function listVerifiedFollowUps(
  exclude: string[] = [],
  limit = 3,
  preferDocIds: string[] = [],
): FollowUpPrompt[] {
  const blocked = new Set(exclude.map(norm));
  const prefer = new Set(preferDocIds);
  const candidates: FollowUpPrompt[] = [];

  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    for (const raw of doc.prompts) {
      const text = raw.trim();
      if (!text || blocked.has(norm(text))) continue;
      if (candidates.some((c) => norm(c.text) === norm(text))) continue;

      const rag = retrieveRag(text, 2);
      const top = rag.hits.find((h) => h.projectId === doc.id || h.score > MIN_RELEVANCE) ?? rag.hits[0];
      const relevance = top?.score ?? 0;
      if (relevance < MIN_RELEVANCE && !doc.body.includes(text.slice(0, 8))) continue;

      candidates.push({
        text,
        hint: doc.title,
        docId: doc.id,
        relevance: Math.max(relevance, 0.12),
      });
    }
  }

  candidates.sort((a, b) => {
    const aPrefer = prefer.has(a.docId) ? 0 : 1;
    const bPrefer = prefer.has(b.docId) ? 0 : 1;
    if (aPrefer !== bPrefer) return aPrefer - bPrefer;
    return b.relevance - a.relevance;
  });

  if (candidates.length < limit) {
    for (const doc of listKnowledgeDocs()) {
      if (!doc.body.trim()) continue;
      for (const raw of doc.prompts) {
        const text = raw.trim();
        if (!text || blocked.has(norm(text))) continue;
        if (candidates.some((c) => norm(c.text) === norm(text))) continue;
        candidates.push({ text, hint: doc.title, docId: doc.id, relevance: 0.15 });
        if (candidates.length >= limit) break;
      }
      if (candidates.length >= limit) break;
    }
  }

  return candidates.slice(0, limit);
}

export function relatedDocIdsFromJournal(
  query?: string,
  flowJournal?: { evidence?: { kind?: string; title?: string }[] }[],
): string[] {
  const ids = new Set<string>();
  const q = query?.toLowerCase() ?? "";
  if (q.includes("imean") || q.includes("架构")) ids.add("kb-imean");
  if (q.includes("ownagent") || q.includes("agent loop")) ids.add("kb-ownagent");
  if (q.includes("skillforge") || q.includes("技能")) ids.add("kb-skillforge");
  if (q.includes("剑池")) ids.add("kb-jianchi");

  for (const node of flowJournal ?? []) {
    for (const ev of node.evidence ?? []) {
      const t = ev.title?.toLowerCase() ?? "";
      if (t.includes("imean")) ids.add("kb-imean");
      if (t.includes("ownagent")) ids.add("kb-ownagent");
      if (t.includes("skillforge")) ids.add("kb-skillforge");
      if (t.includes("剑池")) ids.add("kb-jianchi");
    }
  }
  return [...ids];
}

export function normalizeFollowUps(raw: unknown): FollowUpPrompt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") {
        const doc = listKnowledgeDocs().find((d) => d.prompts.some((p) => norm(p) === norm(item)));
        return {
          text: item,
          hint: doc?.title ?? "知识库",
          docId: doc?.id ?? "kb",
          relevance: 0.2,
        } satisfies FollowUpPrompt;
      }
      if (item && typeof item === "object" && "text" in item) {
        const o = item as FollowUpPrompt;
        return {
          text: String(o.text),
          hint: o.hint ?? "知识库",
          docId: o.docId ?? "kb",
          relevance: typeof o.relevance === "number" ? o.relevance : 0.2,
        };
      }
      return null;
    })
    .filter((x): x is FollowUpPrompt => Boolean(x?.text));
}
