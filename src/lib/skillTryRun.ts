/** 技能页「用材料试跑」— 材料存进试跑专用会话，线上版 / 草稿各跑一次，逐步对比 */

import { apiUrl, getTeamToken } from "./apiClient";
import type { ProductLlmConfig } from "./llmProductBrief";
import type { ProductDataSlot } from "./productDataStore";
import { productHeaders } from "./productRun/client";
import { uploadProductSlotFile } from "./uploadProductFile";

export type TryMaterial = { slot: ProductDataSlot; title: string; csv: string };

export type TryStep = {
  stepId: string;
  tool: string;
  ok: boolean;
  ms: number;
  detail: string;
};

export type TryModelNote =
  | { state: "used"; model: string; text: string }
  | { state: "skipped"; text: string }
  | { state: "failed"; text: string };

export type TryRunSummary = {
  ok: boolean;
  steps: TryStep[];
  conclusion: string;
  failedStep: TryStep | null;
  model: TryModelNote | null;
  totalMs: number;
};

export type TryCompareRow = {
  stepId: string;
  online: TryStep | null;
  draft: TryStep | null;
  changed: boolean;
};

const LLM_TOOL = "__llm_product_brief__";
const SESSION_KEY = "oa-tryrun-session";
const MATERIAL_PREFIX = "oa-tryrun-material:";
const MAX_PERSIST_CHARS = 1_500_000;

function storage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function tryRunSessionId(skillId: string): string {
  const ls = storage();
  let base = ls?.getItem(SESSION_KEY) ?? "";
  if (!base) {
    base = `tryrun-${Math.random().toString(36).slice(2, 10)}`;
    ls?.setItem(SESSION_KEY, base);
  }
  return `${base}-${skillId}`;
}

function materialKey(skillId: string, slot: ProductDataSlot) {
  return `${MATERIAL_PREFIX}${skillId}:${slot}`;
}

export function loadTryMaterial(skillId: string, slot: ProductDataSlot): TryMaterial | null {
  try {
    const raw = storage()?.getItem(materialKey(skillId, slot));
    if (!raw) return null;
    const m = JSON.parse(raw) as TryMaterial;
    return m?.csv ? { slot, title: m.title || slot, csv: m.csv } : null;
  } catch {
    return null;
  }
}

/** 返回 false = 材料太大没存进浏览器，本次页面内仍可用 */
export function saveTryMaterial(skillId: string, m: TryMaterial): boolean {
  const ls = storage();
  if (!ls) return false;
  if (m.csv.length > MAX_PERSIST_CHARS) {
    ls.removeItem(materialKey(skillId, m.slot));
    return false;
  }
  try {
    ls.setItem(materialKey(skillId, m.slot), JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

export function clearTryMaterial(skillId: string, slot: ProductDataSlot) {
  storage()?.removeItem(materialKey(skillId, slot));
}

async function postJson(path: string, body: unknown): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  let res: Response;
  try {
    const token = getTeamToken();
    res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: `连不上办事服务（${apiUrl(path)}）` };
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    return { ok: false, error: msg ? String(msg) : `服务返回 ${res.status}` };
  }
  return { ok: true, data };
}

export async function uploadTryMaterial(
  sessionId: string,
  m: TryMaterial,
): Promise<{ ok: true; rows: number; title: string } | { ok: false; error: string }> {
  const out = await postJson("/product-run/dataset", { sessionId, slot: m.slot, csv: m.csv, title: m.title });
  if (!out.ok) return out;
  const d = out.data as { ok?: boolean; rows?: number; title?: string; error?: string };
  if (!d?.ok) return { ok: false, error: d?.error ?? "材料没存上" };
  return { ok: true, rows: Number(d.rows ?? 0), title: String(d.title ?? m.title) };
}

function rowsToCsv(columns: string[], rows: string[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [columns.map(esc).join(","), ...rows.map((r) => r.map((c) => esc(String(c ?? ""))).join(","))].join("\n");
}

async function fetchSlotCsv(sessionId: string, skillId: string, slot: ProductDataSlot): Promise<string | null> {
  const q = new URLSearchParams({ sessionId, skillId });
  let res: Response;
  try {
    res = await fetch(apiUrl(`/product-run/materials?${q}`), { headers: productHeaders() });
  } catch {
    return null;
  }
  const data = (await res.json()) as { materials?: { slot: string; columns: string[]; rows: string[][] }[] };
  const mat = data.materials?.find((m) => m.slot === slot);
  if (!mat?.columns?.length) return null;
  return rowsToCsv(mat.columns, mat.rows ?? []);
}

/** CSV / XLSX / PDF — 与 product-run 门闩同一套上传 */
export async function uploadTryMaterialFile(
  sessionId: string,
  skillId: string,
  slot: ProductDataSlot,
  file: File,
): Promise<{ ok: true; rows: number; title: string; csv: string } | { ok: false; error: string }> {
  const up = await uploadProductSlotFile({ sessionId, slot, file });
  if (!up.ok) return { ok: false, error: up.error ?? "导入失败" };
  if (up.schemaOk === false) {
    return { ok: false, error: up.error ?? (up.schemaIssues ?? []).join("；") ?? "表头或数据未通过校验" };
  }
  let csv = up.csv?.trim() ?? "";
  if (!csv) csv = (await fetchSlotCsv(sessionId, skillId, slot)) ?? "";
  if (!csv) return { ok: false, error: "文件已上传但未能读出表格，请换 CSV 或检查 Excel 表头" };
  return { ok: true, rows: Number(up.rows ?? 0), title: String(up.title ?? file.name), csv };
}

type RawTrace = { stepId: string; tool: string; ok: boolean; ms: number; label?: string; result?: unknown };

function resultText(result: unknown, key: "summary" | "detail"): string {
  if (!result || typeof result !== "object") return "";
  const v = (result as Record<string, unknown>)[key];
  return typeof v === "string" ? v.trim() : "";
}

function errorText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const v = (result as { error?: unknown }).error;
  return typeof v === "string" ? v.trim() : "";
}

export function summarizeTryRun(raw: { trace?: RawTrace[]; totalMs?: number }): TryRunSummary {
  const trace = Array.isArray(raw?.trace) ? raw.trace : [];
  const steps: TryStep[] = trace.map((t) => ({
    stepId: t.stepId,
    tool: t.tool,
    ok: Boolean(t.ok),
    ms: Number(t.ms ?? 0),
    detail: resultText(t.result, "detail") || errorText(t.result) || String(t.label ?? t.stepId),
  }));
  const failedStep = steps.find((s) => !s.ok && s.tool !== LLM_TOOL) ?? null;

  let conclusion = "";
  for (let i = trace.length - 1; i >= 0; i--) {
    const t = trace[i]!;
    if (t.tool === LLM_TOOL || !t.ok) continue;
    const s = resultText(t.result, "summary");
    if (s) {
      conclusion = s;
      break;
    }
  }
  if (!conclusion && failedStep) conclusion = `停在「${failedStep.detail}」`;
  if (!conclusion) conclusion = steps.filter((s) => s.ok).at(-1)?.detail ?? "";

  let model: TryModelNote | null = null;
  const llm = trace.find((t) => t.tool === LLM_TOOL);
  if (llm) {
    const meta = ((llm.result as { meta?: Record<string, unknown> } | undefined)?.meta ?? {}) as Record<string, unknown>;
    const text = resultText(llm.result, "summary") || resultText(llm.result, "detail");
    if (meta.llm === "used") model = { state: "used", model: String(meta.model ?? ""), text };
    else if (meta.llm === "failed" || !llm.ok) model = { state: "failed", text };
    else model = { state: "skipped", text: "没有接上大模型，这一步跳过，结论只用计算结果。" };
  }

  return {
    ok: steps.length > 0 && !failedStep,
    steps,
    conclusion,
    failedStep,
    model,
    totalMs: Number(raw?.totalMs ?? steps.reduce((n, s) => n + s.ms, 0)),
  };
}

export async function runSkillTry(opts: {
  skillId: string;
  raw: string;
  query: string;
  sessionId: string;
  productWorkbench: boolean;
  llmConfig?: ProductLlmConfig;
}): Promise<{ ok: true; summary: TryRunSummary } | { ok: false; error: string }> {
  const out = await postJson("/skills/run-inline", {
    skillId: opts.skillId,
    raw: opts.raw,
    query: opts.query,
    sessionId: opts.sessionId,
    productWorkbench: opts.productWorkbench,
    llmConfig: opts.llmConfig,
  });
  if (!out.ok) return out;
  return { ok: true, summary: summarizeTryRun(out.data as { trace?: RawTrace[]; totalMs?: number }) };
}

/** 模型那一步每次措辞都可能不同，不算「结果变了」 */
export function compareTryRuns(online: TryRunSummary, draft: TryRunSummary): { rows: TryCompareRow[]; changedCount: number } {
  const ids: string[] = [];
  for (const s of [...online.steps, ...draft.steps]) if (!ids.includes(s.stepId)) ids.push(s.stepId);
  const rows = ids.map((stepId) => {
    const a = online.steps.find((s) => s.stepId === stepId) ?? null;
    const b = draft.steps.find((s) => s.stepId === stepId) ?? null;
    const isModel = (a ?? b)?.tool === LLM_TOOL;
    const changed = isModel
      ? Boolean(a) !== Boolean(b) || a?.ok !== b?.ok
      : !a || !b || a.ok !== b.ok || a.detail !== b.detail;
    return { stepId, online: a, draft: b, changed };
  });
  return { rows, changedCount: rows.filter((r) => r.changed).length };
}
