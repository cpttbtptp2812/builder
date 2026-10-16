/** 办事材料上传 — 对话门闩 / product-run / 技能试跑共用 */

import { decodeUploadCsvText, type ProductDataSlot } from "./productDataStore";
import { apiUploadProductDataset } from "./productRun/client";

export const PRODUCT_FILE_ACCEPT =
  ".csv,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function isWorkbookUploadFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".pdf");
}

export async function uploadProductSlotFile(opts: {
  sessionId: string;
  slot: ProductDataSlot;
  file: File;
}): Promise<{
  ok: boolean;
  error?: string;
  title?: string;
  rows?: number;
  schemaOk?: boolean;
  schemaIssues?: string[];
  csv?: string;
}> {
  const buf = await opts.file.arrayBuffer();
  const workbook = isWorkbookUploadFilename(opts.file.name);
  const up = await apiUploadProductDataset({
    sessionId: opts.sessionId,
    slot: opts.slot,
    csv: workbook ? undefined : decodeUploadCsvText(buf),
    workbookBase64: workbook ? arrayBufferToBase64(buf) : undefined,
    filename: opts.file.name,
    title: opts.file.name.replace(/\.[^.]+$/, ""),
  });
  if (!up.ok) return up;
  const csv = workbook ? undefined : decodeUploadCsvText(buf);
  return { ...up, csv };
}
