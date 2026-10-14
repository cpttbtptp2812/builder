/** Excel / PDF → 与现有 CSV 导入同一张表，并保留每个值的原位置 */

import ExcelJS from "exceljs";

export type SourceCell = {
  sheet: string;
  cell: string;
  row: number;
  column: string;
  value: string;
};

export type WorkbookTable = {
  csv: string;
  title: string;
  cells: SourceCell[];
};

function colLetters(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value && value.result != null && value.result !== undefined) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
  }
  return "";
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function tableToCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function xlsxBufferToTable(buf: Uint8Array, filename: string): Promise<WorkbookTable | { error: string }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(buf) as unknown as ExcelJS.Buffer);
  } catch {
    return { error: "这个 Excel 打不开。请另存为 .xlsx 后再导入。" };
  }
  const sheet = workbook.worksheets.find((item) => item.actualRowCount > 0);
  if (!sheet) return { error: "Excel 里没有数据。" };
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  const width = Math.max(headerRow.cellCount, sheet.actualColumnCount);
  for (let c = 1; c <= width; c += 1) {
    const text = cellText(headerRow.getCell(c).value).trim();
    if (text) headers.push(text);
    else if (headers.length) break;
  }
  if (headers.length < 2) return { error: "Excel 第一行需要是表头。" };
  const rows: string[][] = [];
  const cells: SourceCell[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = headers.map((_, i) => cellText(row.getCell(i + 1).value).trim());
    if (values.every((value) => !value)) return;
    rows.push(values);
    values.forEach((value, i) => {
      if (!value) return;
      const letter = colLetters(i + 1);
      cells.push({
        sheet: sheet.name,
        cell: `${letter}${rowNumber}`,
        row: rowNumber,
        column: headers[i] ?? letter,
        value,
      });
    });
  });
  if (!rows.length) return { error: "Excel 里只有表头，没有数据行。" };
  const title = filename.replace(/\.[^.]+$/, "") || sheet.name;
  return { csv: tableToCsv(headers, rows), title, cells };
}

type PdfItem = { str: string; x: number; y: number };

export async function pdfBufferToTable(buf: Uint8Array, filename: string): Promise<WorkbookTable | { error: string }> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    return { error: "PDF 解析组件没有装好。请改用 Excel 或 CSV。" };
  }
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data: buf, disableWorker: true, isEvalSupported: false, useSystemFonts: true }).promise;
  } catch {
    return { error: "这份 PDF 打不开。请改用 Excel 或 CSV，识别不准的内容不会入账。" };
  }
  const items: PdfItem[] = [];
  const pages = Math.min(doc.numPages, 20);
  for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4] ?? 0;
      const y = item.transform[5] ?? 0;
      items.push({ str: item.str.trim(), x, y });
    }
  }
  await doc.destroy();
  const lines = clusterLines(items);
  if (lines.length < 2) return { error: "这份 PDF 没能识别成表格。请改用 Excel 或 CSV，识别不准的内容不会入账。" };
  const headers = lines[0]!;
  if (headers.length < 2) return { error: "PDF 第一行没能分成至少两列。请改用 Excel 或 CSV。" };
  const ragged = lines.slice(1).some((line) => line.length !== headers.length);
  if (ragged) return { error: "PDF 各行的列数对不齐，不能当表格入账。请改用 Excel 或 CSV。" };
  const rows = lines.slice(1);
  const cells: SourceCell[] = [];
  rows.forEach((row, ri) => {
    row.forEach((value, ci) => {
      if (!value) return;
      cells.push({
        sheet: "第1页",
        cell: `${colLetters(ci + 1)}${ri + 2}`,
        row: ri + 2,
        column: headers[ci] ?? String(ci + 1),
        value,
      });
    });
  });
  return { csv: tableToCsv(headers, rows), title: filename.replace(/\.[^.]+$/, "") || "PDF", cells };
}

function clusterLines(items: PdfItem[]): string[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfItem[][] = [];
  for (const item of sorted) {
    const line = lines.find((group) => Math.abs(group[0]!.y - item.y) <= 2.5);
    if (line) line.push(item);
    else lines.push([item]);
  }
  return lines.map((line) => {
    const ordered = [...line].sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    for (const item of ordered) {
      const prev = ordered[ordered.indexOf(item) - 1];
      if (prev && item.x - prev.x < 8 && cells.length) cells[cells.length - 1] += item.str;
      else cells.push(item.str);
    }
    return cells.map((cell) => cell.trim()).filter(Boolean);
  });
}

export async function workbookBufferToTable(buf: Uint8Array, filename: string): Promise<WorkbookTable | { error: string }> {
  const lower = filename.toLowerCase();
  const isPdf = lower.endsWith(".pdf") || (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46);
  if (isPdf) return pdfBufferToTable(buf, filename);
  return xlsxBufferToTable(buf, filename);
}
