/**
 * 办事材料：表头别名 → 技能可读的标准列（不要求与公司模板字面一致）。
 */

import type { ProductDataSlot, ProductDataset } from "./productDataStore";
import { deskColumnsForSlot } from "./deskProgramMeta";
import { normalizeByColumns } from "./materialColumns";

export type MaterialNormalizeResult =
  | { ok: true; dataset: ProductDataset; mappedFrom: string[] }
  | { ok: false; issues: string[] };

function normHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim();
}

function pickColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const raw of headers) {
    const h = normHeader(raw);
    if (!h) continue;
    if (patterns.some((p) => p.test(h))) return raw;
  }
  return null;
}

function colIndex(headers: string[], name: string): number {
  return headers.indexOf(name);
}

function remapRows(
  headers: string[],
  rows: string[][],
  mapping: { canon: string; source: string | null }[],
): string[][] {
  const mapped = rows.map((row) =>
    mapping.map(({ source }) => {
      if (!source) return "";
      const i = colIndex(headers, source);
      return i >= 0 ? (row[i] ?? "").trim() : "";
    }),
  );
  return mapped.filter((cells) => cells.some((c) => c.length > 0));
}

function looksLikeCashflowHeaders(headers: string[]): boolean {
  const hasPeriod = headers.some((h) => /月|period|date|期间/i.test(h));
  const hasFlow = headers.some((h) => /流入|inflow|收入|流水/i.test(h));
  return hasPeriod && hasFlow && !headers.some((h) => /部门|申请人|报销/i.test(h));
}

function normalizeExpenseLedger(raw: ProductDataset): MaterialNormalizeResult {
  const headers = raw.columns.map(normHeader);
  if (looksLikeCashflowHeaders(headers)) {
    return {
      ok: false,
      issues: ["表结构像「按月流水」，不是报销明细。请在本技能下导入含部门/报销人/金额的材料，或改办额度测算。"],
    };
  }

  const dept = pickColumn(raw.columns, [/部门/, /department/i, /成本中心/, /cost/i, /中心$/]);
  const person = pickColumn(raw.columns, [/申请人/, /报销人/, /员工/, /姓名/, /employee/i, /提报/]);
  const amount = pickColumn(raw.columns, [/报销金额/, /金额/, /amount/i, /^费用$/, /报销额/, /含税/]);
  const tax = pickColumn(raw.columns, [/税额/, /税金/, /tax/i]);
  const invoice = pickColumn(raw.columns, [/发票/, /invoice/i]);
  const status = pickColumn(raw.columns, [/状态/, /status/i, /审批/, /环节/]);

  const issues: string[] = [];
  if (!dept) issues.push("未能识别「部门」类列（可叫：部门、成本中心等）");
  if (!person) issues.push("未能识别「申请人/报销人」类列");
  if (!amount) issues.push("未能识别「金额」类列（可叫：报销金额、费用等）");

  if (issues.length) return { ok: false, issues };

  const canon = ["部门", "申请人", "金额", "税额", "发票额", "状态"] as const;
  const mapping = [
    { canon: "部门", source: dept! },
    { canon: "申请人", source: person! },
    { canon: "金额", source: amount! },
    { canon: "税额", source: tax },
    { canon: "发票额", source: invoice },
    { canon: "状态", source: status },
  ];

  const mappedFrom = mapping.filter((m) => m.source).map((m) => `${m.canon}←${m.source}`);

  const rows = remapRows(raw.columns, raw.rows, mapping);
  if (!rows.length) return { ok: false, issues: ["没有有效数据行，请至少填写一行报销明细"] };

  return {
    ok: true,
    mappedFrom,
    dataset: {
      slot: raw.slot,
      title: raw.title,
      columns: [...canon],
      rows,
      updatedAt: raw.updatedAt,
    },
  };
}

function normalizeCashflow(raw: ProductDataset): MaterialNormalizeResult {
  const period = pickColumn(raw.columns, [/月份/, /^月$/, /period/i, /期间/, /date/i, /年月/]);
  const inflow = pickColumn(raw.columns, [/流入/, /inflow/i, /收入/, /流水/, /金额/, /万元/]);
  if (!period || !inflow) {
    return {
      ok: false,
      issues: [
        !period ? "未能识别「月份/期间」列" : "",
        !inflow ? "未能识别「流入/收入/金额」数值列" : "",
      ].filter(Boolean),
    };
  }
  const canon = ["月份", "流入万元"] as const;
  const mapping = [
    { canon: "月份", source: period },
    { canon: "流入万元", source: inflow },
  ];
  const rows = remapRows(raw.columns, raw.rows, mapping);
  if (!rows.length) return { ok: false, issues: ["没有有效数据行，请至少填写一行流水"] };

  return {
    ok: true,
    mappedFrom: mapping.map((m) => `${m.canon}←${m.source}`),
    dataset: {
      slot: raw.slot,
      title: raw.title,
      columns: [...canon],
      rows,
      updatedAt: raw.updatedAt,
    },
  };
}

function normalizeContract(raw: ProductDataset): MaterialNormalizeResult {
  const clause = pickColumn(raw.columns, [/条款/, /条号/, /序号/]);
  const name = pickColumn(raw.columns, [/名称/, /项目/, /name/i]);
  const contract = pickColumn(raw.columns, [/合同/, /原文/, /现稿/]);
  const approval = pickColumn(raw.columns, [/审批/, /模板/, /标准/, /口径/]);
  const kind = pickColumn(raw.columns, [/类型/, /type/i, /分类/]);
  const issues: string[] = [];
  if (!contract) issues.push("未能识别「合同原文」类列");
  if (!approval) issues.push("未能识别「审批/模板」类列");
  if (issues.length) return { ok: false, issues };

  const canon = ["条款号", "名称", "合同原文", "审批模板", "类型"] as const;
  const mapping = [
    { canon: "条款号", source: clause },
    { canon: "名称", source: name },
    { canon: "合同原文", source: contract! },
    { canon: "审批模板", source: approval! },
    { canon: "类型", source: kind },
  ];
  return {
    ok: true,
    mappedFrom: mapping.filter((m) => m.source).map((m) => `${m.canon}←${m.source}`),
    dataset: {
      slot: raw.slot,
      title: raw.title,
      columns: [...canon],
      rows: remapRows(raw.columns, raw.rows, mapping),
      updatedAt: raw.updatedAt,
    },
  };
}

function normalizeVoucherOcr(raw: ProductDataset): MaterialNormalizeResult {
  const block = pickColumn(raw.columns, [/区块/, /block/i, /区域/]);
  const text = pickColumn(raw.columns, [/识别/, /文字/, /ocr/i, /内容/]);
  const conf = pickColumn(raw.columns, [/置信/, /confidence/i, /分数/]);
  const field = pickColumn(raw.columns, [/字段/, /field/i, /映射/]);
  const issues: string[] = [];
  if (!text) issues.push("未能识别「识别文字/OCR 结果」列");
  if (!field) issues.push("未能识别「字段名/映射」列");
  if (issues.length) return { ok: false, issues };

  const canon = ["区块", "坐标", "识别文字", "置信度", "字段"] as const;
  const coord = pickColumn(raw.columns, [/坐标/, /bbox/i, /位置/]);
  const mapping = [
    { canon: "区块", source: block },
    { canon: "坐标", source: coord },
    { canon: "识别文字", source: text! },
    { canon: "置信度", source: conf },
    { canon: "字段", source: field! },
  ];
  return {
    ok: true,
    mappedFrom: mapping.filter((m) => m.source).map((m) => `${m.canon}←${m.source}`),
    dataset: {
      slot: raw.slot,
      title: raw.title,
      columns: [...canon],
      rows: remapRows(raw.columns, raw.rows, mapping.map((m) => ({ canon: m.canon, source: m.source ?? null }))),
      updatedAt: raw.updatedAt,
    },
  };
}

export function normalizeMaterialDataset(raw: ProductDataset): MaterialNormalizeResult {
  switch (raw.slot) {
    case "expense-ledger":
      return normalizeExpenseLedger(raw);
    case "cashflow-monthly":
      return normalizeCashflow(raw);
    case "contract-clauses":
      return normalizeContract(raw);
    case "voucher-ocr-blocks":
      return normalizeVoucherOcr(raw);
    default: {
      const desk = deskColumnsForSlot(raw.slot);
      if (desk) return normalizeByColumns(raw, desk.specs, { emptyMessage: desk.emptyMessage, reject: desk.reject });
      return { ok: true, dataset: raw, mappedFrom: [] };
    }
  }
}
