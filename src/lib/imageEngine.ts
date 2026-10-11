/** 影像识别：按用户导入的 OCR 区块表，按置信度决定字段采不采用。 */

import { ProductDataMissingError, type ProductDataSlot } from "./productDataStore";
import { workbenchSheetTable } from "./workbenchDataset";
import { tableFromEmbedded, type WorkGrid } from "./sheetEngine";

export type ImagePolicy = { minConfidence: number };

export type ImagePhase = { id: string; label: string; detail: string };

export type ImageExecution = {
  policy: ImagePolicy;
  phases: ImagePhase[];
  summary: string;
  markdown: string;
  grid: WorkGrid;
};

const DEFAULT_POLICY: ImagePolicy = { minConfidence: 0.7 };

type RegionRow = { block: string; box: string; text: string; confidence: number; field: string };

function parseConfidence(raw: unknown): number {
  const n = Number(String(raw ?? "").replace(/%/g, ""));
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function regionsFromTable(table: import("./sheetEngine").SheetTable): RegionRow[] {
  const col = (names: string[]) => table.columns.find((c) => names.some((n) => c.name.includes(n)))?.name;
  const blockK = col(["区块", "block"]) ?? table.columns[0]?.name ?? "区块";
  const boxK = col(["坐标", "box"]) ?? "坐标";
  const textK = col(["识别", "文字", "text", "ocr"]) ?? "识别文字";
  const confK = col(["置信", "confidence"]) ?? "置信度";
  const fieldK = col(["字段", "field"]) ?? "字段";
  return table.rows.map((row, i) => ({
    block: String(row[blockK] ?? `区块${i + 1}`),
    box: String(row[boxK] ?? ""),
    text: String(row[textK] ?? ""),
    confidence: parseConfidence(row[confK]),
    field: String(row[fieldK] ?? ""),
  }));
}

function regionsFromEmbeddedQuery(query: string): RegionRow[] | null {
  const table = tableFromEmbedded(query);
  if (!table?.rows.length) return null;
  return regionsFromTable(table);
}

function resolveRegions(productWorkbench: boolean, query?: string, sessionId?: string): RegionRow[] {
  const slot: ProductDataSlot = "voucher-ocr-blocks";
  if (productWorkbench) {
    const fromSlot = workbenchSheetTable(sessionId, slot);
    if (fromSlot?.rows.length) return regionsFromTable(fromSlot);
    const embedded = query ? regionsFromEmbeddedQuery(query) : null;
    if (embedded?.length) return embedded;
    throw new ProductDataMissingError(slot, "请先导入凭证识别区块表后再执行影像识表。");
  }
  const embedded = query ? regionsFromEmbeddedQuery(query) : null;
  if (embedded?.length) return embedded;
  throw new ProductDataMissingError(
    "voucher-ocr-blocks",
    "请先导入凭证识别区块表，或在问句中用 ```csv 附上区块表后再执行。",
  );
}

export function imagePolicyFromArgs(args: Record<string, unknown> | undefined): ImagePolicy {
  const minConfidence = Number(args?.minConfidence ?? DEFAULT_POLICY.minConfidence);
  return { minConfidence: Number.isFinite(minConfidence) ? minConfidence : DEFAULT_POLICY.minConfidence };
}

export function imagePolicyFromSteps(steps: { tool: string; args?: Record<string, unknown> }[]): ImagePolicy | null {
  const mine = steps.filter((step) => step.tool.startsWith("__image_"));
  if (!mine.length) return null;
  return mine.reduce((policy, step) => ({ ...policy, ...imagePolicyFromArgs(step.args) }), { ...DEFAULT_POLICY });
}

export function executeImage(
  policy: ImagePolicy = DEFAULT_POLICY,
  opts?: { productWorkbench?: boolean; query?: string; sessionId?: string },
): ImageExecution {
  const regions = resolveRegions(Boolean(opts?.productWorkbench), opts?.query, opts?.sessionId);
  const rows = regions.map((region) => {
    const accept = region.confidence >= policy.minConfidence;
    return { ...region, accept };
  });
  const dropped = rows.filter((row) => !row.accept);
  const grid: WorkGrid = {
    columns: ["区块", "坐标", "识别文字", "置信度", "字段", "采用"],
    rows: rows.map((row) => [
      row.block,
      row.box,
      row.text,
      row.confidence.toFixed(2),
      row.field,
      row.accept ? "采用" : "弃用",
    ]),
  };
  const n = rows.length;
  const summary = dropped.length
    ? `${n} 个区块里 ${rows.length - dropped.length} 个采用。弃用 ${dropped.map((row) => `${row.block} ${row.confidence.toFixed(2)}`).join("、")}，低于 ${policy.minConfidence.toFixed(2)}。`
    : `${n} 个区块全部采用，置信度线 ${policy.minConfidence.toFixed(2)}。`;
  const phases: ImagePhase[] = [
    {
      id: "crop",
      label: "切块",
      detail: `凭证共 ${n} 个区块：${rows.map((r) => r.block).join("、")}。`,
    },
    {
      id: "ocr",
      label: "识别",
      detail: rows.map((row) => `${row.block} ${row.text} ${row.confidence.toFixed(2)}`).join("；") + "。",
    },
    { id: "accept", label: "取舍", detail: `置信度低于 ${policy.minConfidence.toFixed(2)} 的不写入字段。` },
    { id: "report", label: "字段表", detail: summary },
  ];
  const markdown = `结论：${summary}`;
  return { policy, phases, summary, markdown, grid };
}

export { runImageTool } from "./imageDeskProgram";
