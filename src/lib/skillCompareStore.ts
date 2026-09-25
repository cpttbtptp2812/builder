/** 技能发布生命周期 — 提交 → 对比 → 批准上线 → 更新 / 回滚 */

import { bumpSkillMinor, compareSkillVersion, INITIAL_SKILL_VERSION } from "./skillVersion";

export const SKILL_PUBLISH_EVENT = "ownagent:skill-published";
export const SKILL_OPEN_EVENT = "ownagent:skill-open";
const PENDING_OPEN_KEY = "ownagent:skill-open-pending";

/** 从别处跳到「技能管理」并直接打开某个技能（面板未挂载时靠 sessionStorage 交接） */
export function requestSkillOpen(skillId: string) {
  sessionStorage.setItem(PENDING_OPEN_KEY, skillId);
  window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "compare" } }));
  window.dispatchEvent(new CustomEvent(SKILL_OPEN_EVENT));
}

export function takePendingSkillOpen(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const id = sessionStorage.getItem(PENDING_OPEN_KEY);
  if (id) sessionStorage.removeItem(PENDING_OPEN_KEY);
  return id;
}

function dispatchSkillPublished(skillId: string, version: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SKILL_PUBLISH_EVENT, { detail: { skillId, version } }));
}

export type CompareDraft = {
  draftId: string;
  skillId: string;
  name: string;
  raw: string;
  submittedAt: string;
  note?: string;
  /** 候选整包版本，如 0.11 */
  version: string;
  /** 提交时记录的现用版版本号（用于检测过期） */
  baselineVersion: string;
};

export type AppliedSkill = {
  skillId: string;
  raw: string;
  appliedAt: string;
  label: string;
  version: string;
  /** 批准时附带的对比报告摘要（可选） */
  reportNote?: string;
};

export type VersionHistoryEntry = {
  recordId: string;
  skillId: string;
  version: string;
  raw: string;
  label: string;
  savedAt: string;
  kind: "publish" | "rollback" | "revert-builtin";
  note?: string;
};

const DRAFTS_KEY = "ownagent:skill-compare-drafts";
const APPLIED_KEY = "ownagent:skill-applied";
const HISTORY_KEY = "ownagent:skill-version-history";
const MAX_HISTORY = 20;

function readDrafts(): CompareDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompareDraft[];
    return Array.isArray(parsed)
      ? parsed
          .filter((d) => d?.draftId && d?.skillId && d?.raw)
          .map((d) => ({
            ...d,
            version: d.version ?? bumpSkillMinor(INITIAL_SKILL_VERSION),
            baselineVersion: d.baselineVersion ?? INITIAL_SKILL_VERSION,
          }))
      : [];
  } catch {
    return [];
  }
}

function writeDrafts(rows: CompareDraft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(rows));
}

function readApplied(): AppliedSkill[] {
  try {
    const raw = localStorage.getItem(APPLIED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppliedSkill[];
    return Array.isArray(parsed)
      ? parsed.map((a) => ({ ...a, version: a.version ?? INITIAL_SKILL_VERSION }))
      : [];
  } catch {
    return [];
  }
}

function writeApplied(rows: AppliedSkill[]) {
  localStorage.setItem(APPLIED_KEY, JSON.stringify(rows));
}

function readHistory(): VersionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VersionHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(rows: VersionHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(rows));
}

function pushHistory(entry: Omit<VersionHistoryEntry, "recordId" | "savedAt">) {
  const row: VersionHistoryEntry = {
    ...entry,
    recordId: `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
  };
  const kept = [row, ...readHistory()].slice(0, MAX_HISTORY * 8);
  writeHistory(kept);
}

export function getPublishedVersion(skillId: string): string {
  return readApplied().find((a) => a.skillId === skillId)?.version ?? INITIAL_SKILL_VERSION;
}

export function listPublishedSkills(): AppliedSkill[] {
  return readApplied().sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}

export function listCompareDrafts(): CompareDraft[] {
  return readDrafts().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function listDraftsForSkill(skillId: string): CompareDraft[] {
  return listCompareDrafts().filter((d) => d.skillId === skillId);
}

export function isDraftStale(draft: CompareDraft): boolean {
  return draft.baselineVersion !== getPublishedVersion(draft.skillId);
}

export function draftStaleReason(draft: CompareDraft): string | null {
  if (!isDraftStale(draft)) return null;
  const live = getPublishedVersion(draft.skillId);
  return `提交后现用版已从 v${draft.baselineVersion} 更新到 v${live}，请重新全量对比后再批准。`;
}

/** 该技能出现过的最高版本号（现用 + 发布记录），保证版本号只增不减 */
export function maxKnownVersion(skillId: string): string {
  let max = getPublishedVersion(skillId);
  for (const h of readHistory()) {
    if (h.skillId === skillId && compareSkillVersion(h.version, max) > 0) max = h.version;
  }
  return max;
}

export function nextVersionFor(skillId: string): string {
  return bumpSkillMinor(maxKnownVersion(skillId));
}

/** 开发者提交：每技能只保留一条待对比 */
export function submitCompareDraft(skillId: string, raw: string, name: string, note?: string): CompareDraft {
  const baselineVersion = getPublishedVersion(skillId);
  const draft: CompareDraft = {
    draftId: `draft-${Date.now().toString(36)}`,
    skillId,
    name,
    raw,
    submittedAt: new Date().toISOString(),
    note,
    baselineVersion,
    version: nextVersionFor(skillId),
  };
  const others = readDrafts().filter((d) => d.skillId !== skillId);
  writeDrafts([draft, ...others]);
  return draft;
}

/** 现用版已变：刷新草稿基线并重算候选版本号 */
export function refreshDraftBaseline(draftId: string): CompareDraft | null {
  const drafts = readDrafts();
  const idx = drafts.findIndex((d) => d.draftId === draftId);
  if (idx < 0) return null;
  const live = getPublishedVersion(drafts[idx].skillId);
  const next: CompareDraft = {
    ...drafts[idx],
    baselineVersion: live,
    version: bumpSkillMinor(live),
  };
  drafts[idx] = next;
  writeDrafts(drafts);
  return next;
}

export function removeCompareDraft(draftId: string) {
  writeDrafts(readDrafts().filter((d) => d.draftId !== draftId));
}

export function getAppliedSkill(skillId: string): AppliedSkill | null {
  return readApplied().find((a) => a.skillId === skillId) ?? null;
}

export function resolveBaselineRaw(skillId: string, builtinRaw: string): string {
  return getAppliedSkill(skillId)?.raw ?? builtinRaw;
}

export function isUsingBuiltin(skillId: string): boolean {
  return !getAppliedSkill(skillId);
}

export function listVersionHistory(skillId: string): VersionHistoryEntry[] {
  return readHistory()
    .filter((h) => h.skillId === skillId)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, MAX_HISTORY);
}

function setApplied(next: AppliedSkill) {
  const rest = readApplied().filter((a) => a.skillId !== next.skillId);
  writeApplied([...rest, next]);
  dispatchSkillPublished(next.skillId, next.version);
}

/** 运维批准上线 — 新版整包替换现用版，旧版进历史 */
export function applyCompareDraft(draftId: string, reportNote?: string): AppliedSkill | null {
  const draft = readDrafts().find((d) => d.draftId === draftId);
  if (!draft) return null;
  if (isDraftStale(draft)) return null;

  const prev = getAppliedSkill(draft.skillId);
  if (prev) {
    pushHistory({
      skillId: prev.skillId,
      version: prev.version,
      raw: prev.raw,
      label: prev.label,
      kind: "publish",
      note: `被 v${draft.version} 替换`,
    });
  }

  const applied: AppliedSkill = {
    skillId: draft.skillId,
    raw: draft.raw,
    appliedAt: new Date().toISOString(),
    label: draft.name,
    version: draft.version,
    reportNote,
  };
  setApplied(applied);
  writeDrafts(readDrafts().filter((d) => d.draftId !== draftId));
  return applied;
}

/** 回滚到历史某一版 */
export function rollbackToVersion(skillId: string, version: string): AppliedSkill | null {
  const hit = readHistory().find((h) => h.skillId === skillId && h.version === version);
  if (!hit) return null;

  const prev = getAppliedSkill(skillId);
  if (prev) {
    pushHistory({
      skillId: prev.skillId,
      version: prev.version,
      raw: prev.raw,
      label: prev.label,
      kind: "rollback",
      note: `回滚到 v${version} 前备份`,
    });
  }

  const applied: AppliedSkill = {
    skillId,
    raw: hit.raw,
    appliedAt: new Date().toISOString(),
    label: hit.label,
    version: hit.version,
    reportNote: `回滚自 v${prev?.version ?? "?"} → v${version}`,
  };
  setApplied(applied);
  pushHistory({
    skillId,
    version: hit.version,
    raw: hit.raw,
    label: hit.label,
    kind: "rollback",
    note: "运维回滚恢复",
  });
  return applied;
}

/** 恢复为内置出厂版（清除现用覆盖） */
export function revertToBuiltin(skillId: string, label: string): boolean {
  const prev = getAppliedSkill(skillId);
  if (!prev) return false;
  pushHistory({
    skillId: prev.skillId,
    version: prev.version,
    raw: prev.raw,
    label: prev.label,
    kind: "revert-builtin",
    note: "恢复出厂设置前备份",
  });
  writeApplied(readApplied().filter((a) => a.skillId !== skillId));
  dispatchSkillPublished(skillId, INITIAL_SKILL_VERSION);
  return true;
}

export function skillsWithPendingDrafts(): string[] {
  return [...new Set(listCompareDrafts().map((d) => d.skillId))];
}

export function pendingDraftCount(): number {
  return readDrafts().length;
}

export function newestDraftForSkill(skillId: string): CompareDraft | null {
  return listDraftsForSkill(skillId)[0] ?? null;
}

export function canApproveDraft(draft: CompareDraft): { ok: boolean; reason?: string } {
  if (isDraftStale(draft)) {
    return { ok: false, reason: draftStaleReason(draft)! };
  }
  if (compareSkillVersion(draft.version, draft.baselineVersion) <= 0) {
    return { ok: false, reason: "候选版本号必须高于现用版。" };
  }
  return { ok: true };
}

/** 从现用版编辑内容生成新版草稿 */
export function createNewVersionDraft(skillId: string, raw: string, name: string): CompareDraft {
  return submitCompareDraft(skillId, raw, name, "从现用版生成");
}

/** 保存新版编辑器内容（不触发上线） */
export function saveNewVersionDraft(skillId: string, raw: string, name: string): CompareDraft {
  const baselineVersion = getPublishedVersion(skillId);
  const existing = newestDraftForSkill(skillId);
  if (existing) {
    const next: CompareDraft = {
      ...existing,
      raw,
      name,
      submittedAt: new Date().toISOString(),
      baselineVersion,
      version: nextVersionFor(skillId),
    };
    writeDrafts([next, ...readDrafts().filter((d) => d.draftId !== existing.draftId)]);
    return next;
  }
  return submitCompareDraft(skillId, raw, name, "技能管理页编辑");
}

export function discardDraftsForSkill(skillId: string) {
  writeDrafts(readDrafts().filter((d) => d.skillId !== skillId));
}

/** 发布一个新版本：版本号只增不减，每次发布都记入发布记录（回滚也是一次新发布） */
export function publishSkillVersion(
  skillId: string,
  name: string,
  raw: string,
  note?: string,
  kind: VersionHistoryEntry["kind"] = "publish",
): AppliedSkill {
  const version = nextVersionFor(skillId);
  const applied: AppliedSkill = {
    skillId,
    raw,
    appliedAt: new Date().toISOString(),
    label: name,
    version,
    reportNote: note,
  };
  pushHistory({ skillId, version, raw, label: name, kind, note });
  setApplied(applied);
  discardDraftsForSkill(skillId);
  return applied;
}

export function candidateVersion(skillId: string): string {
  const draft = newestDraftForSkill(skillId);
  if (draft && !isDraftStale(draft)) return draft.version;
  return nextVersionFor(skillId);
}
