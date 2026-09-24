/** 知识缺口向导 — Eval / Gap 检测 → 资料库预填草稿 */

export type GapDraft = {
  title: string;
  body: string;
  prompts: string[];
  reason: string;
  source: "eval" | "gap" | "manual";
  createdAt: number;
};

const KEY = "oa-gap-draft";

export function saveGapDraft(draft: Omit<GapDraft, "createdAt">) {
  const row: GapDraft = { ...draft, createdAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(row));
  window.dispatchEvent(new CustomEvent("ownagent:gap-draft"));
  return row;
}

export function peekGapDraft(): GapDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GapDraft) : null;
  } catch {
    return null;
  }
}

export function consumeGapDraft(): GapDraft | null {
  const d = peekGapDraft();
  if (d) sessionStorage.removeItem(KEY);
  return d;
}

export function gapDraftFromEval(query: string, docTitle: string, detail: string): GapDraft {
  return saveGapDraft({
    title: docTitle || `补充：${query.slice(0, 24)}`,
    body: `<!-- 由回答质检自动生成 -->\n\n针对问句「${query}」目前检索未命中。\n\n请在此补充正文：\n\n`,
    prompts: [query],
    reason: detail,
    source: "eval",
  });
}
