/** 团队发版 — 审批流 · staging/prod baseline 标签（浏览器 localStorage） */

const KEY = "ownagent:team-gate";

export type BaselineEnv = "staging" | "prod";

export type PendingApproval = {
  id: string;
  skillId: string;
  draftVersion: string;
  gate: "PASS" | "WARN" | "BLOCK";
  requestedBy: string;
  requestedAt: string;
  note?: string;
};

type TeamStore = {
  stagingBaseline: Record<string, string>;
  prodBaseline: Record<string, string>;
  pending: PendingApproval[];
};

function read(): TeamStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw
      ? (JSON.parse(raw) as TeamStore)
      : { stagingBaseline: {}, prodBaseline: {}, pending: [] };
  } catch {
    return { stagingBaseline: {}, prodBaseline: {}, pending: [] };
  }
}

function write(store: TeamStore) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function listPendingApprovals(): PendingApproval[] {
  return read().pending;
}

export function requestApproval(row: Omit<PendingApproval, "id" | "requestedAt">): PendingApproval {
  const store = read();
  const item: PendingApproval = {
    ...row,
    id: `apr-${Date.now().toString(36)}`,
    requestedAt: new Date().toISOString(),
  };
  store.pending = [item, ...store.pending.filter((p) => p.skillId !== row.skillId)].slice(0, 20);
  write(store);
  return item;
}

export function approvePending(id: string): PendingApproval | null {
  const store = read();
  const item = store.pending.find((p) => p.id === id);
  if (!item) return null;
  store.pending = store.pending.filter((p) => p.id !== id);
  store.prodBaseline[item.skillId] = item.draftVersion;
  write(store);
  return item;
}

export function rejectPending(id: string): boolean {
  const store = read();
  const before = store.pending.length;
  store.pending = store.pending.filter((p) => p.id !== id);
  write(store);
  return store.pending.length < before;
}

export function tagBaselineEnv(skillId: string, version: string, env: BaselineEnv) {
  const store = read();
  if (env === "staging") store.stagingBaseline[skillId] = version;
  else store.prodBaseline[skillId] = version;
  write(store);
}

export function getBaselineTag(skillId: string, env: BaselineEnv): string | null {
  const store = read();
  return env === "staging" ? store.stagingBaseline[skillId] ?? null : store.prodBaseline[skillId] ?? null;
}
