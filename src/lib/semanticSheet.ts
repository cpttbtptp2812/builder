/** 语义表格 — 修订追踪 + 一致性分析（浏览器内，不调模型） */

export type SheetFinding = {
  level: "info" | "warn" | "block";
  title: string;
  detail: string;
  cells: { r: number; c: number }[];
};

export type SheetAnalysis = {
  findings: SheetFinding[];
  /** 0–1，与 rows 同形 */
  risk: number[][];
  editCount: number;
  summary: string;
};

const ABOLISHED = /废止|已废止|(^|[^0-9])5\s*天/;
const CURRENT_DAYS = /10|15/;
const HITL = /vpn|开通|mutate|权限|工单/i;
const ABSTAIN = /上市|天气|股价|abstain|拒答/;

function nums(text: string): number[] {
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

export function analyzeSemanticSheet(
  columns: string[],
  rows: string[][],
  baseline: string[][],
): SheetAnalysis {
  const risk = rows.map((row) => row.map(() => 0));
  const findings: SheetFinding[] = [];
  let editCount = 0;
  const edited: { r: number; c: number; from: string; to: string }[] = [];

  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      const from = baseline[r]?.[c] ?? "";
      if (cell !== from) {
        editCount += 1;
        edited.push({ r, c, from, to: cell });
        risk[r]![c] = Math.max(risk[r]![c]!, 0.25);
      }
    });
  });

  // 数字列离群
  columns.forEach((col, c) => {
    const values = rows
      .map((row, r) => ({ r, n: nums(row[c] ?? "")[0] }))
      .filter((x): x is { r: number; n: number } => x.n != null && !Number.isNaN(x.n));
    if (values.length < 3) return;
    const mean = values.reduce((s, v) => s + v.n, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v.n - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance) || 1;
    const outliers = values.filter((v) => Math.abs(v.n - mean) > sd * 1.2);
    if (!outliers.length) return;
    for (const o of outliers) risk[o.r]![c] = Math.max(risk[o.r]![c]!, 0.55);
    findings.push({
      level: "warn",
      title: `「${col}」存在离群值`,
      detail: `均值 ${mean.toFixed(1)}，离群 ${outliers.map((o) => rows[o.r]?.[c]).join("、")}。建议核对是否把废止条文写进现行列。`,
      cells: outliers.map((o) => ({ r: o.r, c })),
    });
  });

  // 行级能力：分列对照不算冲突；同一格混写才熔断
  const currentCol = columns.findIndex((c) => /现行|天数/.test(c));
  const oldCol = columns.findIndex((c) => /废止/.test(c));
  const splitColumns = currentCol >= 0 && oldCol >= 0 && currentCol !== oldCol;

  rows.forEach((row, r) => {
    const line = row.join(" ");
    const currentCell = currentCol >= 0 ? row[currentCol] ?? "" : "";
    const oldCell = oldCol >= 0 ? row[oldCol] ?? "" : "";
    const mixedInOneCell = row.some((cell) => ABOLISHED.test(cell) && CURRENT_DAYS.test(cell));

    if (splitColumns && ABOLISHED.test(oldCell) && CURRENT_DAYS.test(currentCell) && !mixedInOneCell) {
      findings.push({
        level: "info",
        title: `第 ${r + 1} 行是分列对照`,
        detail: "现行与废止分属不同列，出处锁完好。不要把废止取值写进现行列。",
        cells: [
          { r, c: currentCol },
          { r, c: oldCol },
        ],
      });
    } else if ((ABOLISHED.test(line) && CURRENT_DAYS.test(line) && /年假|休假|天/.test(line)) || mixedInOneCell) {
      row.forEach((cell, c) => {
        if (ABOLISHED.test(cell) && (c === currentCol || mixedInOneCell)) risk[r]![c] = Math.max(risk[r]![c]!, 0.85);
      });
      findings.push({
        level: "block",
        title: `第 ${r + 1} 行冲突熔断`,
        detail: "现行取值和废止取值写进了同一语义位置。拒绝合成成一句制度。",
        cells: row
          .map((cell, c) => ({ cell, c }))
          .filter((x) => /5|废止|10|15/.test(x.cell))
          .map((x) => ({ r, c: x.c })),
      });
    }
    if (HITL.test(line)) {
      findings.push({
        level: "warn",
        title: `第 ${r + 1} 行需要人工确认`,
        detail: "检测到变更类动作（VPN / 权限）。表格可以起草，不能当已开通。",
        cells: [{ r, c: 0 }],
      });
      risk[r]![0] = Math.max(risk[r]![0]!, 0.45);
    }
    if (ABSTAIN.test(line)) {
      findings.push({
        level: "block",
        title: `第 ${r + 1} 行超出能力信封`,
        detail: "手册外事实。分析建议整行标为拒答，而不是补一个看起来合理的数。",
        cells: [{ r, c: Math.max(0, row.length - 1) }],
      });
    }
    if (row.some((cell) => !cell.trim())) {
      findings.push({
        level: "info",
        title: `第 ${r + 1} 行有空单元格`,
        detail: "空值不会被模型脑补。补全后再分析，或明确标成「—」。",
        cells: row.map((cell, c) => ({ cell, c })).filter((x) => !x.cell.trim()).map((x) => ({ r, c: x.c })),
      });
    }
  });

  // 修订把现行改成废止值
  for (const e of edited) {
    const becameAbolished = /(^|[^0-9])5/.test(e.to) && /10|15/.test(e.from) && !/10|15/.test(e.to);
    if (becameAbolished) {
      risk[e.r]![e.c] = 1;
      findings.unshift({
        level: "block",
        title: "修订击穿出处锁",
        detail: `「${columns[e.c] ?? "单元格"}」从「${e.from}」改成「${e.to}」。这是已废止取值，不能覆盖现行制度。`,
        cells: [{ r: e.r, c: e.c }],
      });
    }
  }

  if (!findings.length) {
    findings.push({
      level: "info",
      title: editCount ? "修订未触发熔断" : "表格与基线一致",
      detail: editCount
        ? `${editCount} 处修订都落在允许范围内，可以继续引用。`
        : "尚未修改。点单元格即可修订，再跑一次语义分析。",
      cells: [],
    });
  }

  const blocks = findings.filter((f) => f.level === "block").length;
  const warns = findings.filter((f) => f.level === "warn").length;
  const summary =
    blocks > 0
      ? `熔断 ${blocks} · 警示 ${warns} · 修订 ${editCount}`
      : `通过 · 警示 ${warns} · 修订 ${editCount}`;

  return { findings, risk, editCount, summary };
}
