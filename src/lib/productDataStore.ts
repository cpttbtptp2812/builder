/** 产品工作台：用户导入的业务数据（本机持久化，无内置样例） */

import { normalizeMaterialDataset } from "./materialNormalize";
import type { SheetColumn, SheetRow, SheetTable } from "./sheetEngine";

export type ProductDataSlot =
  | "expense-ledger"
  | "cashflow-monthly"
  | "contract-clauses"
  | "voucher-ocr-blocks";

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
  const t = value.trim().replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(t);
}

/** Excel 另存 CSV 常为 GBK；UTF-8 误读会导致表头全部「未识别」 */
export function decodeUploadCsvText(buffer: ArrayBuffer): string {
  const encodings = ["utf-8", "gb18030"] as const;
  let bestText = "";
  let bestScore = -1;
  for (const enc of encodings) {
    let text: string;
    try {
      text = new TextDecoder(enc, { fatal: false }).decode(buffer);
    } catch {
      continue;
    }
    const score = csvHeaderRecognitionScore(text);
    if (score > bestScore) {
      bestScore = score;
      bestText = text;
    }
  }
  return bestText || new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

function csvHeaderRecognitionScore(text: string): number {
  const line =
    text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  if (!line) return 0;
  let score = 0;
  if (/部门|所属|成本中心/.test(line)) score += 35;
  if (/申请人|报销人|员工/.test(line)) score += 25;
  if (/金额|报销金额/.test(line)) score += 25;
  if (/[\uFFFD]/.test(line)) score -= 80;
  const parts = line.split(/[,，;\t]/).filter(Boolean);
  if (parts.length >= 4) score += 15;
  if (parts.length === 1 && /[,，]/.test(line)) score += 5;
  return score;
}

function stripCellQuotes(cell: string): string {
  return cell.trim().replace(/^"|"$/g, "").replace(/^\uFEFF/, "").trim();
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(stripCellQuotes(cur));
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(stripCellQuotes(cur));
  return out;
}

function detectDelimiter(sampleLines: string[]): string {
  const sample = sampleLines.slice(0, 8).join("\n");
  const commaCount = (sample.match(/,/g) ?? []).length;
  const semiCount = (sample.match(/;/g) ?? []).length;
  const tabCount = (sample.match(/\t/g) ?? []).length;
  if (tabCount > 0 && tabCount >= commaCount && tabCount >= semiCount) return "\t";
  if (semiCount > commaCount) return ";";
  return ",";
}

type ParsedGrid = { columns: string[]; rows: string[][] };

/** Excel 把整行塞进一个单元格再存 CSV 时，只有一列但内容里带逗号 */
function unwrapExcelSingleColumnGrid(lines: string[], delimiter: string): ParsedGrid | null {
  const split = (line: string) => splitCsvLine(line.replace(/^\|/, "").replace(/\|$/, ""), delimiter);
  let header = split(lines[0]!);
  if (header.length > 1) return null;
  const merged = header[0] ?? "";
  const innerSep = merged.includes(",") ? "," : merged.includes("，") ? "，" : null;
  if (!innerSep) return null;
  const innerParts = merged.split(innerSep).map(stripCellQuotes).filter((c) => c.length > 0);
  if (innerParts.length < 3) return null;
  header = innerParts;
  const width = header.length;
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i += 1) {
    let cells = split(lines[i]!);
    let raw = cells.length === 1 ? cells[0]! : cells.join(delimiter);
    if (cells.length === 1 && raw.includes(innerSep)) {
      cells = raw.split(innerSep).map(stripCellQuotes);
    } else if (cells.length > 1 && delimiter !== innerSep) {
      raw = cells.join(innerSep === "," ? "," : innerSep);
      cells = raw.split(innerSep).map(stripCellQuotes);
    }
    while (cells.length < width) cells.push("");
    rows.push(cells.slice(0, width));
  }
  return { columns: header, rows };
}

function parseGridFromText(text: string): ParsedGrid | { error: string } {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { error: "文件为空" };
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return { error: "至少需要表头 + 一行数据" };

  const strategies: (() => ParsedGrid | null)[] = [
    () => {
      const delimiter = detectDelimiter(lines);
      const split = (line: string) => splitCsvLine(line.replace(/^\|/, "").replace(/\|$/, ""), delimiter);
      const header = split(lines[0]!);
      if (header.length === 1) return unwrapExcelSingleColumnGrid(lines, delimiter);
      const width = header.length;
      const rows: string[][] = [];
      for (let i = 1; i < lines.length; i += 1) {
        let cells = split(lines[i]!);
        if (cells.length < width) {
          while (cells.length < width) cells.push("");
        } else if (cells.length > width) {
          cells = cells.slice(0, width);
        }
        rows.push(cells);
      }
      return { columns: header, rows };
    },
    () => unwrapExcelSingleColumnGrid(lines, ","),
    () => unwrapExcelSingleColumnGrid(lines, ";"),
    () => {
      const split = (line: string) => splitCsvLine(line, "\t");
      const header = split(lines[0]!);
      if (header.length < 2) return null;
      const width = header.length;
      const rows = lines.slice(1).map((line) => {
        let cells = split(line);
        while (cells.length < width) cells.push("");
        return cells.slice(0, width);
      });
      return { columns: header, rows };
    },
  ];

  for (const tryGrid of strategies) {
    const grid = tryGrid();
    if (grid && grid.columns.length >= 2 && grid.rows.length > 0) return grid;
  }
  return { error: "无法解析表格结构，请用下载模板填写后另存为 CSV（建议 UTF-8）" };
}

/** 解析 CSV / TSV（首行表头） */
export function parseCsvText(
  text: string,
  title: string,
  slot: ProductDataSlot,
): ProductDataset | { error: string } {
  const grid = parseGridFromText(text);
  if ("error" in grid) return grid;

  const raw: ProductDataset = {
    slot,
    title,
    columns: grid.columns,
    rows: grid.rows,
    updatedAt: new Date().toISOString(),
  };
  const normalized = normalizeMaterialDataset(raw);
  if (!normalized.ok) {
    return { error: normalized.issues.join("；") };
  }
  return normalized.dataset;
}

export function parseCsvUploadBuffer(
  buffer: ArrayBuffer,
  title: string,
  slot: ProductDataSlot,
): ProductDataset | { error: string } {
  return parseCsvText(decodeUploadCsvText(buffer), title, slot);
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
      else if (looksNumber(raw)) row[name] = Number(raw.replace(/,/g, ""));
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
