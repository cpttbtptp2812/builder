import { dbAll, dbGet, dbRun, nowIso } from "./db.ts";
import { normalizeMaterialDataset } from "../src/lib/materialNormalize.ts";
import type { ProductDataSlot, ProductDataset } from "../src/lib/productDataStore.ts";

export class ProductDatasetNormalizeError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues.join("；"));
    this.name = "ProductDatasetNormalizeError";
    this.issues = issues;
  }
}

export type ServerDataset = {
  slot: ProductDataSlot;
  title: string;
  columns: string[];
  rows: string[][];
  updatedAt: string;
};

export function saveServerDataset(sessionId: string, dataset: Omit<ServerDataset, "updatedAt"> & { updatedAt?: string }) {
  const updatedAt = dataset.updatedAt ?? nowIso();
  const normalized = normalizeMaterialDataset({
    slot: dataset.slot,
    title: dataset.title,
    columns: dataset.columns,
    rows: dataset.rows,
    updatedAt,
  } satisfies ProductDataset);
  if (!normalized.ok) throw new ProductDatasetNormalizeError(normalized.issues);
  const toSave = normalized.dataset;
  dbRun(
    `INSERT INTO product_datasets (session_id, slot, title, columns_json, rows_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id, slot) DO UPDATE SET
       title = excluded.title,
       columns_json = excluded.columns_json,
       rows_json = excluded.rows_json,
       updated_at = excluded.updated_at`,
    [
      sessionId,
      toSave.slot,
      toSave.title,
      JSON.stringify(toSave.columns),
      JSON.stringify(toSave.rows),
      updatedAt,
    ],
  );
}

export function getServerDataset(sessionId: string, slot: ProductDataSlot): ServerDataset | null {
  const row = dbGet<{
    slot: string;
    title: string;
    columns_json: string;
    rows_json: string;
    updated_at: string;
  }>(`SELECT slot, title, columns_json, rows_json, updated_at FROM product_datasets WHERE session_id = ? AND slot = ?`, [
    sessionId,
    slot,
  ]);
  if (!row) return null;
  const rows = JSON.parse(row.rows_json) as string[][];
  if (!rows.length) return null;
  return {
    slot: row.slot as ProductDataSlot,
    title: row.title,
    columns: JSON.parse(row.columns_json) as string[],
    rows,
    updatedAt: row.updated_at,
  };
}

export function serverDatasetRowCount(sessionId: string, slot: ProductDataSlot): number {
  return getServerDataset(sessionId, slot)?.rows.length ?? 0;
}

export function deleteServerDataset(sessionId: string, slot: ProductDataSlot) {
  dbRun(`DELETE FROM product_datasets WHERE session_id = ? AND slot = ?`, [sessionId, slot]);
}
