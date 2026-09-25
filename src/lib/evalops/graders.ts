/** 评分器 — 规则检查 / 参考答案相似度 / LLM 裁判（单答打分 + 交换顺序两两对比） */

import type { CheckResult, EvalCase, InvokeResult, JudgeVerdict, LlmFn, PairVerdict, SideGrade } from "./types";

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

function bigrams(s: string): Map<string, number> {
  const t = norm(s).replace(/[，。！？、；：“”‘’（）()[\],.!?;:'"`*#>\-_]/g, "");
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** 字符二元组 F1，衡量和参考答案的字面接近程度 */
export function similarity(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (!x.size || !y.size) return 0;
  let overlap = 0;
  let nx = 0;
  let ny = 0;
  for (const v of x.values()) nx += v;
  for (const v of y.values()) ny += v;
  for (const [g, v] of x) overlap += Math.min(v, y.get(g) ?? 0);
  const p = overlap / nx;
  const r = overlap / ny;
  return p + r ? (2 * p * r) / (p + r) : 0;
}

/** 参考答案的字符二元组有多少出现在回答里；回答比参考长不扣分 */
export function coverage(answer: string, reference: string): number {
  const x = bigrams(answer);
  const y = bigrams(reference);
  if (!y.size) return 0;
  let hit = 0;
  let total = 0;
  for (const [g, v] of y) {
    total += v;
    hit += Math.min(v, x.get(g) ?? 0);
  }
  return hit / total;
}

const COVERAGE_PASS = 0.5;

export function ruleChecks(c: EvalCase, r: InvokeResult): CheckResult[] {
  const checks: CheckResult[] = [];
  checks.push({
    id: "answered",
    label: "有回答",
    pass: !r.error && r.answer.trim().length > 0,
    detail: r.error,
  });
  const ans = norm(r.answer);
  for (const k of c.mustInclude ?? []) {
    checks.push({ id: `inc:${k}`, label: `包含「${k}」`, pass: ans.includes(norm(k)) });
  }
  for (const k of c.mustNotInclude ?? []) {
    checks.push({ id: `exc:${k}`, label: `不出现「${k}」`, pass: !ans.includes(norm(k)) });
  }
  if (c.expectSource) {
    const hay = norm(`${r.answer}\n${r.citations.join("\n")}`);
    checks.push({ id: "source", label: `引用「${c.expectSource}」`, pass: hay.includes(norm(c.expectSource)) });
  }
  return checks;
}

/** 从模型输出里抠出第一个 JSON 对象 */
export function parseJsonLoose<T>(text: string): T | null {
  const s = text.replace(/```(?:json)?/g, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const JUDGE_SYSTEM =
  "你是严格的问答质检员。只依据给定材料判断，不要自己补充知识。输出 JSON，不要输出其他内容。";

export async function judgeSingle(llm: LlmFn, c: EvalCase, r: InvokeResult): Promise<JudgeVerdict> {
  const parts = [
    `【用户问题】\n${c.question}`,
    c.reference ? `【参考答案】\n${c.reference}` : "",
    r.citations.length ? `【系统引用的资料】\n${r.citations.slice(0, 5).map((x, i) => `${i + 1}. ${x.slice(0, 400)}`).join("\n")}` : "",
    `【系统回答】\n${r.answer.slice(0, 3000)}`,
  ].filter(Boolean);
  const rule = c.reference
    ? "判断「系统回答」是否与「参考答案」的关键事实一致（措辞不同没关系；遗漏关键事实或说错算 fail）。"
    : r.citations.length
      ? "判断「系统回答」的内容是否都能在「系统引用的资料」里找到依据（有编造或与资料矛盾算 fail）。"
      : "判断「系统回答」是否切题、没有明显编造；如果它明确说不知道或转人工，算 pass。";
  const out = await llm([
    { role: "system", content: JUDGE_SYSTEM },
    {
      role: "user",
      content: `${parts.join("\n\n")}\n\n${rule}\n输出格式：{"verdict":"pass|fail|unsure","reason":"一句话中文理由"}`,
    },
  ]);
  const j = parseJsonLoose<{ verdict?: string; reason?: string }>(out);
  const v = j?.verdict === "pass" || j?.verdict === "fail" ? j.verdict : "unsure";
  return { verdict: v, reason: (j?.reason ?? out).slice(0, 200) };
}

async function pairOnce(llm: LlmFn, c: EvalCase, first: string, second: string): Promise<{ pick: "1" | "2" | "tie"; reason: string }> {
  const out = await llm([
    { role: "system", content: JUDGE_SYSTEM },
    {
      role: "user",
      content: [
        `【用户问题】\n${c.question}`,
        c.reference ? `【参考答案】\n${c.reference}` : "",
        `【回答1】\n${first.slice(0, 2500)}`,
        `【回答2】\n${second.slice(0, 2500)}`,
        "哪个回答更好？标准依次是：事实正确 > 解决了用户的问题 > 简洁。差不多就判 tie。",
        '输出格式：{"better":"1|2|tie","reason":"一句话中文理由"}',
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ]);
  const j = parseJsonLoose<{ better?: string; reason?: string }>(out);
  const pick = j?.better === "1" || j?.better === "2" ? j.better : "tie";
  return { pick, reason: (j?.reason ?? "").slice(0, 200) };
}

/** 交换顺序各判一次，两次一致才算有胜负，抵消「偏爱排在前面」的倾向 */
export async function judgePair(llm: LlmFn, c: EvalCase, a: string, b: string): Promise<PairVerdict> {
  const [x, y] = await Promise.all([pairOnce(llm, c, a, b), pairOnce(llm, c, b, a)]);
  const first = x.pick === "1" ? "A" : x.pick === "2" ? "B" : "tie";
  const second = y.pick === "1" ? "B" : y.pick === "2" ? "A" : "tie";
  if (first === second) return { winner: first, reason: x.reason || y.reason, consistent: true };
  return { winner: "tie", reason: `两次判断不一致（${first} / ${second}），按打平处理`, consistent: false };
}

export async function gradeSide(c: EvalCase, r: InvokeResult, llm?: LlmFn): Promise<SideGrade> {
  const checks = ruleChecks(c, r);
  const sim = c.reference && r.answer ? coverage(r.answer, c.reference) : undefined;
  let judge: JudgeVerdict | undefined;
  if (llm && !r.error && r.answer.trim()) {
    try {
      judge = await judgeSingle(llm, c, r);
    } catch (err) {
      judge = { verdict: "unsure", reason: `裁判调用失败：${err instanceof Error ? err.message : String(err)}` };
    }
  }
  const rulesPass = checks.every((k) => k.pass);
  // 没有裁判时，参考答案相似度过低也算不通过
  const refPass = judge ? judge.verdict !== "fail" : sim === undefined || sim >= COVERAGE_PASS;
  if (!judge && sim !== undefined) {
    checks.push({ id: "sim", label: "覆盖参考答案", pass: sim >= COVERAGE_PASS, detail: `参考答案的内容出现了 ${Math.round(sim * 100)}%` });
  }
  return { pass: rulesPass && refPass, checks, judge, similarity: sim };
}
