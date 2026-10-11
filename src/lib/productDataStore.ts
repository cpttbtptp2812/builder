/** 产品工作台：用户导入的业务数据（本机持久化，无内置样例） */

import type { SheetColumn, SheetRow, SheetTable } from "./sheetEngine";

export type ProductDataSlot =
  | "expense-ledger"
  | "cashflow-monthly"
  | "contract-clauses";

export type ProductDataset = {
  slot: ProductDataSlot;
  title: string;
  columns: string[];
  rows: string[][];
  updatedAt: string;
};

const STORAGE_KEY = "ownagent-product-datasets-v1";

function readAll(): Record<ProductDataSlot, ProductDataset | undefined> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {} as Record<ProductDataSlot, ProductDataset | undefined>;
    return JSON.parse(raw) as Record<ProductDataSlot, ProductDataset | undefined>;
  } catch {
    return {} as Record<ProductDataSlot, ProductDataset | undefined>;
  }
}

function writeAll(map: Record<ProductDataSlot, ProductDataset | undefined>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getProductDataset(slot: ProductDataSlot): ProductDataset | null {
  return readAll()[slot] ?? null;
}

export function saveProductDataset(dataset: ProductDataset) {
  const map = readAll();
  map[dataset.slot] = dataset;
  writeAll(map);
  window.dispatchEvent(new CustomEvent("ownagent:product-data", { detail: { slot: dataset.slot } }));
}

export function clearProductDataset(slot: ProductDataSlot) {
  const map = readAll();
  delete map[slot];
  writeAll(map);
  window.dispatchEvent(new CustomEvent("ownagent:product-data", { detail: { slot } }));
}

function looksNumber(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

/** 解析 CSV / TSV（首行表头） */
export function parseCsvText(
  text: string,
  title: string,
  slot: ProductDataSlot,
): ProductDataset | { error: string } {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { error: "文件为空" };
  const delimiter = trimmed.includes("\t") && !trimmed.includes(",") ? "\t" : ",";
  const lines = trimmed
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return { error: "至少需要表头 + 一行数据" };
  const split = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(delimiter)
      .map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]!);
  const width = header.length;
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = split(lines[i]!);
    if (cells.length !== width) return { error: `第 ${i + 1} 行列数与表头不一致` };
    rows.push(cells);
  }
  return {
    slot,
    title,
    columns: header,
    rows,
    updatedAt: new Date().toISOString(),
  };
}

export class ProductDataMissingError extends Error {
  slot: ProductDataSlot;
  constructor(slot: ProductDataSlot, message: string) {
    super(message);
    this.name = "ProductDataMissingError";
    this.slot = slot;
  }
}

export function datasetToSheetTable(ds: ProductDataset): SheetTable {
  const columns: SheetColumn[] = ds.columns.map((name) => {
    const values = ds.rows.map((row) => row[ds.columns.indexOf(name)] ?? "");
    const nums = values.filter((v) => v && looksNumber(v));
    const type =
      !values.some(Boolean) ? ("empty" as const) : nums.length === values.filter(Boolean).length ? ("number" as const) : ("text" as const);
    return { name, type };
  });
  const rows: SheetRow[] = ds.rows.map((cells) => {
    const row: SheetRow = {};
    ds.columns.forEach((name, i) => {
      const raw = cells[i] ?? "";
      if (!raw || raw === "—" || raw === "-" || raw === "空") row[name] = null;
      else if (looksNumber(raw)) row[name] = Number(raw);
      else row[name] = raw;
    });
    return row;
  });
  return { title: ds.title, columns, rows };
}

export function gridToCsv(columns: string[], rows: string[][]): string {
  const esc = (cell: string) => {
    const s = String(cell ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(","), ...rows.map((row) => columns.map((_, i) => esc(row[i] ?? "")).join(","))].join("\n");
}

export function datasetRowCount(slot: ProductDataSlot): number {
  return getProductDataset(slot)?.rows.length ?? 0;
}
