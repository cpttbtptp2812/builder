/** 产品办事：浏览器读 localStorage，服务端读 SQLite（按 sessionId） */

import {
  datasetToSheetTable,
  getProductDataset,
  ProductDataMissingError,
  type ProductDataSlot,
  type ProductDataset,
} from "./productDataStore";
import type { SheetTable } from "./sheetEngine";
import { tableFromEmbedded } from "./sheetEngine";

type ServerDatasetResolver = (sessionId: string, slot: ProductDataSlot) => ProductDataset | null;

let serverDatasetResolver: ServerDatasetResolver | null = null;

export function registerWorkbenchDatasetResolver(fn: ServerDatasetResolver) {
  serverDatasetResolver = fn;
}

export function getWorkbenchDataset(sessionId: string | undefined, slot: ProductDataSlot): ProductDataset | null {
  if (sessionId?.trim() && serverDatasetResolver) {
    const fromServer = serverDatasetResolver(sessionId.trim(), slot);
    if (fromServer?.rows.length) return fromServer;
  }
  try {
    const local = getProductDataset(slot);
    if (local?.rows.length) return local;
  } catch {
    /* SSR / Node without localStorage */
  }
  return null;
}

export function workbenchSheetTable(
  sessionId: string | undefined,
  slot: ProductDataSlot,
): SheetTable | null {
  const ds = getWorkbenchDataset(sessionId, slot);
  if (!ds?.rows.length) return null;
  return datasetToSheetTable(ds);
}

export type WorkbenchTableOpts = {
  productWorkbench?: boolean;
  sessionId?: string;
  dataSlot?: ProductDataSlot;
  allowLabSample?: boolean;
};

/** 产品模式：导入槽优先；无槽时仅认问句内嵌 CSV（发版 gate / 用户粘贴），禁止内置样例 */
export function resolveWorkbenchSheetTable(query: string, opts?: WorkbenchTableOpts): SheetTable {
  const slot = opts?.dataSlot ?? "expense-ledger";

  if (opts?.productWorkbench) {
    const fromSlot = workbenchSheetTable(opts.sessionId, slot);
    if (fromSlot) return fromSlot;
    const embedded = tableFromEmbedded(query);
    if (embedded?.rows.length) return { ...embedded, title: embedded.title === "问句里的表" ? "附表材料" : embedded.title };
    throw new ProductDataMissingError(slot, `请先导入材料（${slot}）后再继续办理。`);
  }

  const embedded = tableFromEmbedded(query);
  if (embedded) return embedded;

  if (!opts?.allowLabSample) {
    throw new ProductDataMissingError(slot, "请导入业务材料，或在问句中用 ```csv 附上表格后再执行。");
  }

  throw new ProductDataMissingError(slot, "实验室模式需要 allowLabSample 与内置引擎。");
}

export function tableOptsFromToolArgs(
  args: Record<string, unknown>,
  dataSlot: ProductDataSlot,
): WorkbenchTableOpts {
  return {
    productWorkbench: args.__productWorkbench === true,
    sessionId: typeof args.__sessionId === "string" ? args.__sessionId : undefined,
    dataSlot,
    allowLabSample: args.__allowLabSample === true,
  };
}
