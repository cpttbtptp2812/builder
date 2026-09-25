/** 从文档自动出题 — 有模型时让 LLM 出「问题 + 参考答案 + 关键事实」，没有时按标题兜底 */

import { parseJsonLoose } from "./graders";
import { newId, type EvalCase, type LlmFn } from "./types";

export type SourceDoc = { title: string; body: string; prompts?: string[] };

export function chunkDoc(doc: SourceDoc, size = 1200): { title: string; text: string }[] {
  const paras = doc.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: { title: string; text: string }[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && buf.length + p.length > size) {
      out.push({ title: doc.title, text: buf });
      buf = "";
    }
    buf = buf ? `${buf}\n\n${p}` : p;
  }
  if (buf) out.push({ title: doc.title, text: buf });
  return out;
}

/** 均匀抽取片段，让题目覆盖所有文档 */
export function pickChunks(docs: SourceDoc[], want: number, size = 1200) {
  const all = docs.flatMap((d) => chunkDoc(d, size));
  if (all.length <= want) return all;
  const step = all.length / want;
  return Array.from({ length: want }, (_, i) => all[Math.floor(i * step)]!);
}

type GenItem = { question?: string; reference?: string; keywords?: string[]; kind?: string };

async function genFromChunk(llm: LlmFn, chunk: { title: string; text: string }, n: number): Promise<EvalCase[]> {
  const out = await llm([
    {
      role: "system",
      content: "你为企业问答系统出测试题。题目要像真实员工会问的口语问题，答案必须能在给定资料里找到。只输出 JSON。",
    },
    {
      role: "user",
      content: [
        `【资料：${chunk.title}】\n${chunk.text}`,
        `出 ${n} 道题，至少 1 道换个说法问（不照抄原文用词）。每题给出参考答案（一两句）和 1~3 个回答里必须出现的关键事实（数字、名词）。`,
        '输出格式：{"items":[{"question":"...","reference":"...","keywords":["..."]}]}',
      ].join("\n\n"),
    },
  ]);
  const j = parseJsonLoose<{ items?: GenItem[] }>(out);
  return (j?.items ?? [])
    .filter((it) => it.question?.trim())
    .map((it) => ({
      id: newId("case"),
      question: it.question!.trim(),
      reference: it.reference?.trim() || undefined,
      mustInclude: (it.keywords ?? []).map((k) => String(k).trim()).filter((k) => k && chunk.text.includes(k)).slice(0, 3),
      expectSource: chunk.title,
      origin: "generated" as const,
      tags: ["自动出题"],
    }));
}

/** 没有模型时兜底出题：推荐问题 → 标题/问句行 → 「名词：说明」句 → 整篇概述；各文档轮流取 */
export function heuristicCases(docs: SourceDoc[], want: number): EvalCase[] {
  const perDoc = docs.map((d) => {
    const list: EvalCase[] = [];
    const add = (question: string, reference?: string) => {
      if (list.some((c) => c.question === question)) return;
      list.push({ id: newId("case"), question, reference: reference?.slice(0, 200), expectSource: d.title, origin: "generated", tags: ["自动出题"] });
    };
    for (const p of d.prompts ?? []) if (p.trim()) add(p.trim());
    const lines = d.body.split(/\n/);
    lines.forEach((line, i) => {
      const h = line.match(/^#{1,4}\s+(.+)/)?.[1]?.trim();
      const q = line.trim().match(/^(?:Q[:：]|问[:：])?\s*(.{4,40}[？?])$/)?.[1];
      const title = q ?? h;
      if (title) {
        const answer = lines.slice(i + 1).find((l) => l.trim() && !l.startsWith("#"))?.trim();
        if (answer) add(q ?? `${title.replace(/[：:]$/, "")}是怎么规定的？`, answer);
        return;
      }
      const kv = line.trim().replace(/^[-*•\d.、\s]+/, "").match(/^([^：:，。]{2,16})[：:]\s*(.{6,})$/);
      if (kv) add(`${d.title}里的「${kv[1]}」是什么？`, kv[2]);
    });
    const intro = d.body.split(/\n\s*\n/).map((p) => p.replace(/^#+\s.*$/gm, "").trim()).find((p) => p.length >= 20);
    if (intro) add(`介绍一下《${d.title}》的主要内容`, intro);
    return list;
  });
  const out: EvalCase[] = [];
  for (let round = 0; out.length < want && perDoc.some((l) => l.length > round); round++) {
    for (const l of perDoc) if (l[round] && out.length < want) out.push(l[round]!);
  }
  return out;
}

export async function generateCases(
  docs: SourceDoc[],
  want: number,
  llm?: LlmFn,
  onProgress?: (done: number, total: number) => void,
): Promise<{ cases: EvalCase[]; engine: "llm" | "heuristic"; warnings: string[] }> {
  const usable = docs.filter((d) => d.body.trim().length > 40);
  if (!usable.length) return { cases: [], engine: "heuristic", warnings: ["文档内容太少，至少需要一段完整文字"] };
  if (!llm) {
    const cases = heuristicCases(usable, want);
    return {
      cases,
      engine: "heuristic",
      warnings: cases.length ? [] : ["文档里没找到能出题的内容（标题、问句或「名词：说明」这类句子）"],
    };
  }
  const perChunk = 2;
  const chunks = pickChunks(usable, Math.ceil(want / perChunk));
  const warnings: string[] = [];
  const cases: EvalCase[] = [];
  let done = 0;
  const queue = [...chunks];
  async function worker() {
    while (queue.length) {
      const ch = queue.shift()!;
      try {
        cases.push(...(await genFromChunk(llm!, ch, perChunk)));
      } catch (err) {
        warnings.push(`「${ch.title}」出题失败：${err instanceof Error ? err.message : String(err)}`);
      }
      onProgress?.(++done, chunks.length);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return { cases: cases.slice(0, want), engine: "llm", warnings };
}
