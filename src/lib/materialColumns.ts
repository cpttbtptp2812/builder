/**
 * 按「列规格」把客户导出的表头映射成技能可读的标准列。
 * 每个办事技能声明自己的列（标准名 + 别名正则 + 是否必需），不要求客户表头字面一致。
 */

import type { ProductDataset } from "./productDataStore";

export type ColumnSpec = {
  canon: string;
  patterns: RegExp[];
  required?: boolean;
  /** 未识别到必需列时给客户看的说明 */
  hint?: string;
};

export type ColumnNormalizeResult =
  | { ok: true; dataset: ProductDataset; mappedFrom: string[] }
  | { ok: false; issues: string[] };

function normHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim();
}

/** 先精确匹配标准名，再按别名顺序匹配；同一源列不重复占用 */
export function mapColumns(headers: string[], specs: ColumnSpec[]): (string | null)[] {
  const used = new Set<string>();
  const out: (string | null)[] = specs.map(() => null);
  specs.forEach((spec, i) => {
    const exact = headers.find((h) => normHeader(h) === spec.canon && !used.has(h));
    if (exact) {
      out[i] = exact;
      used.add(exact);
    }
  });
  specs.forEach((spec, i) => {
    if (out[i]) return;
    for (const pattern of spec.patterns) {
      const hit = headers.find((h) => !used.has(h) && normHeader(h) && pattern.test(normHeader(h)));
      if (hit) {
        out[i] = hit;
        used.add(hit);
        return;
      }
    }
  });
  return out;
}

export function normalizeByColumns(
  raw: ProductDataset,
  specs: ColumnSpec[],
  opts: { emptyMessage: string; reject?: (headers: string[]) => string | null },
): ColumnNormalizeResult {
  const headers = raw.columns.map(normHeader);
  const rejected = opts.reject?.(headers);
  if (rejected) return { ok: false, issues: [rejected] };

  const sources = mapColumns(raw.columns, specs);
  const issues = specs
    .map((spec, i) => (spec.required && !sources[i] ? spec.hint ?? `未能识别「${spec.canon}」列` : ""))
    .filter(Boolean);
  if (issues.length) return { ok: false, issues };

  const index = sources.map((src) => (src ? raw.columns.indexOf(src) : -1));
  const rows = raw.rows
    .map((row) => index.map((i) => (i >= 0 ? String(row[i] ?? "").trim() : "")))
    .filter((cells) => cells.some((c) => c.length > 0));
  if (!rows.length) return { ok: false, issues: [opts.emptyMessage] };

  return {
    ok: true,
    mappedFrom: specs.flatMap((spec, i) => (sources[i] ? [`${spec.canon}←${sources[i]}`] : [])),
    dataset: {
      slot: raw.slot,
      title: raw.title,
      columns: specs.map((s) => s.canon),
      rows,
      updatedAt: raw.updatedAt,
    },
  };
}
