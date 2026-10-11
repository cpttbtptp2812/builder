/** 导入槽：在列名规范化之后做最低可用性检查（非字面模板克隆） */

import { normalizeMaterialDataset } from "./materialNormalize";
import type { ProductDataSlot, ProductDataset } from "./productDataStore";

export type DatasetValidation =
  | { ok: true }
  | { ok: false; issues: string[] };

export function validateDatasetForSlot(slot: ProductDataSlot, columnNames: string[], rows?: string[][]): DatasetValidation {
  const raw: ProductDataset = {
    slot,
    title: "",
    columns: columnNames,
    rows: rows ?? [["x"]],
    updatedAt: "",
  };
  const normalized = normalizeMaterialDataset(raw);
  if (!normalized.ok) return { ok: false, issues: normalized.issues };
  if (!rows?.length) return { ok: false, issues: ["没有数据行"] };
  return { ok: true };
}

export function formatDatasetValidationMessage(label: string, v: Extract<DatasetValidation, { ok: false }>): string {
  return `「${label}」${v.issues.join("；")}。请换本业务材料或调整表头后再导入。`;
}
