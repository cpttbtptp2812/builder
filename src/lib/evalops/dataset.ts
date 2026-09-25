/** 测试集导入 — CSV / JSONL / JSON / 一行一题，中英文列名自动识别 */

import { newId, type CaseOrigin, type EvalCase } from "./types";

const COLUMN_ALIASES: Record<keyof Pick<EvalCase, "question" | "reference" | "mustInclude" | "mustNotInclude" | "expectSource" | "tags">, string[]> = {
  question: ["question", "query", "q", "input", "prompt", "问题", "提问", "用户问题", "问句"],
  reference: ["reference", "expected", "answer", "ground_truth", "golden", "参考答案", "标准答案", "期望回答", "答案"],
  mustInclude: ["must_include", "mustinclude", "include", "keywords", "必须包含", "关键词", "应包含"],
  mustNotInclude: ["must_not_include", "mustnotinclude", "exclude", "forbidden", "不能包含", "禁止出现", "不应包含"],
  expectSource: ["expect_source", "source", "doc", "应引用", "来源", "出处", "文档"],
  tags: ["tags", "tag", "category", "标签", "分类"],
};

function normKey(k: string) {
  return k.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function fieldOf(key: string): keyof typeof COLUMN_ALIASES | null {
  const k = normKey(key);
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => normKey(a) === k)) return field as keyof typeof COLUMN_ALIASES;
  }
  return null;
}

export function splitList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (v == null) return [];
  return String(v)
    .split(/[|;；，,、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function rowToCase(row: Record<string, unknown>, origin: CaseOrigin): EvalCase | null {
  const c: EvalCase = { id: newId("case"), question: "", origin };
  for (const [k, v] of Object.entries(row)) {
    const f = fieldOf(k);
    if (!f) continue;
    if (f === "mustInclude" || f === "mustNotInclude" || f === "tags") {
      const list = splitList(v);
      if (list.length) c[f] = list;
    } else {
      const s = v == null ? "" : String(v).trim();
      if (s) c[f] = s;
    }
  }
  return c.question ? c : null;
}

/** RFC4180 风格 CSV 解析（支持引号内逗号与换行） */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  const delim = (src.split(/\r?\n/)[0] ?? "").includes("\t") && !(src.split(/\r?\n/)[0] ?? "").includes(",") ? "\t" : ",";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export type ParseResult = { cases: EvalCase[]; format: string; warnings: string[] };

export function parseCases(text: string, origin: CaseOrigin = "import"): ParseResult {
  const src = text.trim();
  const warnings: string[] = [];
  if (!src) return { cases: [], format: "空", warnings: ["内容为空"] };

  if (src.startsWith("[") || src.startsWith("{")) {
    try {
      const parsed = JSON.parse(src) as unknown;
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as Record<string, unknown>).cases)
          ? ((parsed as Record<string, unknown>).cases as unknown[])
          : [parsed];
      const cases = arr
        .map((r) => (typeof r === "string" ? { question: r } : r))
        .map((r) => rowToCase(r as Record<string, unknown>, origin))
        .filter((c): c is EvalCase => Boolean(c));
      if (cases.length < arr.length) warnings.push(`${arr.length - cases.length} 条没找到问题字段，已跳过`);
      return { cases, format: "JSON", warnings };
    } catch {
      /* 可能是 JSONL */
    }
  }

  const lines = src.split(/\r?\n/).filter((l) => l.trim());
  if (lines.every((l) => l.trim().startsWith("{"))) {
    const cases: EvalCase[] = [];
    let bad = 0;
    for (const l of lines) {
      try {
        const c = rowToCase(JSON.parse(l) as Record<string, unknown>, origin);
        if (c) cases.push(c);
        else bad++;
      } catch {
        bad++;
      }
    }
    if (bad) warnings.push(`${bad} 行解析失败或没有问题字段，已跳过`);
    return { cases, format: "JSONL", warnings };
  }

  const rows = parseCsv(src);
  const header = rows[0] ?? [];
  const mapped = header.map(fieldOf);
  if (rows.length > 1 && mapped.includes("question")) {
    const cases: EvalCase[] = [];
    for (const r of rows.slice(1)) {
      const rec: Record<string, unknown> = {};
      header.forEach((h, i) => (rec[h] = r[i] ?? ""));
      const c = rowToCase(rec, origin);
      if (c) cases.push(c);
    }
    const unknown = header.filter((_, i) => !mapped[i]);
    if (unknown.length) warnings.push(`未识别的列已忽略：${unknown.join("、")}`);
    return { cases, format: "表格", warnings };
  }

  // 一行一题；「问题 ||| 参考答案」也支持
  const cases = lines.map((l) => {
    const [q, ref] = l.split(/\s*\|\|\|\s*|\t/);
    const c: EvalCase = { id: newId("case"), question: (q ?? "").trim(), origin: origin === "import" ? "paste" : origin };
    if (ref?.trim()) c.reference = ref.trim();
    return c;
  });
  return { cases: cases.filter((c) => c.question), format: "一行一题", warnings };
}

/** 去重：同一问题只保留一条（保留信息更全的） */
export function dedupeCases(cases: EvalCase[]): EvalCase[] {
  const map = new Map<string, EvalCase>();
  for (const c of cases) {
    const k = c.question.replace(/\s+/g, "").toLowerCase();
    const prev = map.get(k);
    const richness = (x: EvalCase) => (x.reference ? 2 : 0) + (x.mustInclude?.length ?? 0) + (x.expectSource ? 1 : 0);
    if (!prev || richness(c) > richness(prev)) map.set(k, c);
  }
  return [...map.values()];
}

export function casesToCsv(cases: EvalCase[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = "问题,参考答案,必须包含,不能包含,应引用,标签";
  const body = cases.map((c) =>
    [c.question, c.reference ?? "", (c.mustInclude ?? []).join("|"), (c.mustNotInclude ?? []).join("|"), c.expectSource ?? "", (c.tags ?? []).join("|")]
      .map(esc)
      .join(","),
  );
  return [head, ...body].join("\n");
}

export const SAMPLE_CSV = `问题,参考答案,必须包含,不能包含,应引用
年假有几天？,入职满一年 5 天，满十年 10 天,5 天,,员工手册
VPN 连不上怎么办？,先重启客户端，仍不行提 IT 工单,工单,,IT 指南
可以帮我改一下考勤记录吗？,不能直接修改，需要走补卡审批,审批,已修改,`;
