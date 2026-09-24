/** 逐行差异（LCS） */

export type DiffLine = { kind: "same" | "add" | "del"; text: string; oldNo?: number; newNo?: number };

export function lineDiff(a: string, b: string): DiffLine[] {
  const A = a.replace(/\r\n/g, "\n").split("\n");
  const B = b.replace(/\r\n/g, "\n").split("\n");
  const n = A.length;
  const m = B.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ kind: "same", text: A[i]!, oldNo: i + 1, newNo: j + 1 });
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: "del", text: A[i]!, oldNo: i + 1 });
      i += 1;
    } else {
      out.push({ kind: "add", text: B[j]!, newNo: j + 1 });
      j += 1;
    }
  }
  while (i < n) out.push({ kind: "del", text: A[i]!, oldNo: ++i });
  while (j < m) out.push({ kind: "add", text: B[j]!, newNo: ++j });
  return out;
}

export function diffStats(lines: DiffLine[]) {
  return {
    added: lines.filter((l) => l.kind === "add").length,
    removed: lines.filter((l) => l.kind === "del").length,
  };
}

export type DiffRow = DiffLine | { kind: "fold"; count: number };

/** 只保留改动行及上下文，其余折叠 */
export function foldDiff(lines: DiffLine[], context = 2): DiffRow[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, idx) => {
    if (l.kind === "same") return;
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k += 1) keep[k] = true;
  });
  const rows: DiffRow[] = [];
  let folded = 0;
  lines.forEach((l, idx) => {
    if (keep[idx]) {
      if (folded) rows.push({ kind: "fold", count: folded });
      folded = 0;
      rows.push(l);
    } else folded += 1;
  });
  if (folded) rows.push({ kind: "fold", count: folded });
  return rows;
}
