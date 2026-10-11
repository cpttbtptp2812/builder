import { dbAll, dbGet, dbRun, nowIso } from "./db.ts";
import type { ProductDataSlot } from "../src/lib/productDataStore.ts";

export type ServerDataset = {
  slot: ProductDataSlot;
  title: string;
  columns: string[];
  rows: string[][];
  updatedAt: string;
};

export function saveServerDataset(sessionId: string, dataset: Omit<ServerDataset, "updatedAt"> & { updatedAt?: string }) {
  const updatedAt = dataset.updatedAt ?? nowIso();
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
      dataset.slot,
      dataset.title,
      JSON.stringify(dataset.columns),
      JSON.stringify(dataset.rows),
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
