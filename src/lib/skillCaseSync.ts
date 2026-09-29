/** 浏览器 custom case ↔ .ownagent/cases.json（需本地 API） */

import { apiFetch } from "./apiClient";
import { exportCustomCasesJson, importCustomCasesJson, listAllCustomCases } from "./skillTraceCaseStore";

export async function pullCasesFromRepo(): Promise<{ skills: number; cases: number } | null> {
  const remote = await apiFetch<Record<string, unknown>>("/skill-gate/cases");
  if (!remote) return null;
  return importCustomCasesJson(JSON.stringify(remote));
}

export async function pushCasesToRepo(): Promise<{ cases: number } | null> {
  const body = JSON.parse(exportCustomCasesJson()) as Record<string, unknown>;
  const res = await apiFetch<{ ok: boolean; cases: number }>("/skill-gate/cases", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res?.ok ? { cases: res.cases } : null;
}

export function localCaseCount(): number {
  return listAllCustomCases().length;
}
