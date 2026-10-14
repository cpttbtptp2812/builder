import { useCallback, useEffect, useState } from "react";
import { apiUrl, getTeamToken } from "../../lib/apiClient";
import type { ProductDataSlot } from "../../lib/productDataStore";
import { requirementsForSkill, type SkillDataRequirement } from "../../lib/productSkillInputs";
import { deskMetaFor } from "../../lib/deskProgramMeta";
import type { EvidenceBundle } from "../../lib/evidenceBundle";

export type LabResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** 和 apiFetch 一样带团队令牌，但把服务端的错误原文带回来 */
export async function labFetch<T>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<LabResult<T>> {
  try {
    const token = getTeamToken();
    const res = await fetch(apiUrl(path), {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !json) return { ok: false, error: json?.error ?? `服务返回 ${res.status}` };
    if (typeof json === "object" && json && "ok" in json && (json as { ok?: boolean }).ok === false) {
      return { ok: false, error: (json as { error?: string }).error ?? "处理失败" };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `连不上服务：${err.message}` : "连不上服务" };
  }
}

export type IssuedEvidence = { bundle: EvidenceBundle; files: { name: string; mediaType: string; text: string }[] };

/** 运行回放、分叉、证据包走哪套接口：实验台用 /api/runs，对话里办完的单子走带会话校验的 /api/product-run/insight */
export type RunApi = {
  streamUrl: (runId: string) => string;
  fork: (runId: string, stepId: string, args: Record<string, unknown>) => Promise<LabResult<{ runId: string }>>;
  evidence: (runId: string) => Promise<LabResult<IssuedEvidence>>;
  publicKey: () => Promise<LabResult<{ keyId: string; publicKey: string }>>;
};

export const labRunApi: RunApi = {
  streamUrl: (runId) => apiUrl(`/api/runs/${runId}/stream`),
  fork: (runId, stepId, args) => labFetch(`/api/runs/${runId}/fork`, { stepId, args }),
  evidence: (runId) => labFetch("/api/evidence/bundle", { runId }),
  publicKey: () => labFetch("/api/evidence/public-key"),
};

export function productRunApi(sessionId: string): RunApi {
  const q = (runId: string) => `sessionId=${encodeURIComponent(sessionId)}&runId=${encodeURIComponent(runId)}`;
  return {
    streamUrl: (runId) => apiUrl(`/api/product-run/insight/stream?${q(runId)}`),
    fork: (runId, stepId, args) => labFetch("/api/product-run/insight/fork", { sessionId, runId, stepId, args }),
    evidence: (runId) => labFetch("/api/product-run/insight/evidence", { sessionId, runId }),
    publicKey: () => labFetch("/api/product-run/insight/public-key"),
  };
}

export const LAB_SKILLS = [
  { id: "ledger-desk", label: "报销对账" },
  { id: "shift-desk", label: "门店排班" },
  { id: "ticket-desk", label: "客服工单" },
] as const;
export type LabSkillId = (typeof LAB_SKILLS)[number]["id"];

export function requirementsOf(skillId: string): SkillDataRequirement[] {
  const own = requirementsForSkill(skillId);
  return own.length ? own : deskMetaFor(skillId)?.requirements ?? [];
}

export type LabMaterial = { slot: ProductDataSlot; title: string; columns: string[]; rows: number; at: string };
type LabState = { sessionId: string | null; materials: LabMaterial[] };

const KEY = "ownagent:lab-session";
const EVENT = "ownagent:lab-session";

function read(): LabState {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || "null") as LabState | null;
    if (s && Array.isArray(s.materials)) return s;
  } catch {
    /* ignore */
  }
  return { sessionId: null, materials: [] };
}

function write(s: LabState) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** 实验台会话：材料只存服务端，这里记会话号和导入过什么 */
export function useLabSession() {
  const [state, setState] = useState<LabState>(read);
  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const upload = useCallback(async (slot: ProductDataSlot, file: File): Promise<LabResult<LabMaterial>> => {
    if (!/\.(csv|txt)$/i.test(file.name)) return { ok: false, error: "实验台目前只收 CSV（Excel 请先另存为 CSV）" };
    const csv = await file.text();
    const cur = read();
    const r = await labFetch<{ sessionId: string; slot: ProductDataSlot; title: string; columns: string[]; rows: number }>("/api/lab/dataset", {
      sessionId: cur.sessionId ?? undefined,
      csv,
      title: file.name,
      slot,
    });
    if (!r.ok) return r;
    const m: LabMaterial = { slot: r.data.slot, title: r.data.title, columns: r.data.columns, rows: r.data.rows, at: new Date().toISOString() };
    write({ sessionId: r.data.sessionId, materials: [...cur.materials.filter((x) => x.slot !== slot), m] });
    return { ok: true, data: m };
  }, []);

  const reset = useCallback(() => write({ sessionId: null, materials: [] }), []);
  const has = useCallback((slot: ProductDataSlot) => state.materials.some((m) => m.slot === slot), [state.materials]);
  return { ...state, upload, reset, has };
}

export function downloadText(name: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
