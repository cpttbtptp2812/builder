/** 访客导入的 SKILL.md — 存在 localStorage，不写仓库 */

import { hydrateSkill, parseSkillMarkdown, skillIdFromPath, type SkillManifest } from "./skillMarkdown";

const KEY = "ownagent:imported-skills";

export type ImportedRecord = { id: string; raw: string; importedAt: string };

function slugify(name: string) {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "imported-skill";
}

export function readImportedRecords(): ImportedRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { skills?: ImportedRecord[] } | ImportedRecord[];
    const list = Array.isArray(parsed) ? parsed : parsed.skills ?? [];
    return list.filter((r) => r && typeof r.raw === "string" && typeof r.id === "string");
  } catch {
    return [];
  }
}

function writeImportedRecords(rows: ImportedRecord[]) {
  localStorage.setItem(KEY, JSON.stringify({ skills: rows }));
}

export function recordsToSkills(rows: ImportedRecord[]): SkillManifest[] {
  return rows.map((r) =>
    hydrateSkill(r.raw, { id: r.id, skillPath: `imported://${r.id}` }),
  );
}

export function loadImportedSkills(): SkillManifest[] {
  return recordsToSkills(readImportedRecords());
}

export function uniqueImportedId(name: string, taken: Set<string>) {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function installImportedMarkdown(raw: string, taken: Set<string>, preferredId?: string) {
  const parsed = parseSkillMarkdown(raw);
  const fromFile = preferredId?.replace(/\.(md|markdown|json)$/i, "").replace(/\.SKILL$/i, "");
  const looksLikeFilename = Boolean(preferredId && /\.(md|markdown|json)$/i.test(preferredId));
  const seed = looksLikeFilename ? parsed.name || fromFile : fromFile || parsed.name;
  const id = uniqueImportedId(seed || skillIdFromPath(preferredId ?? "") || "imported-skill", taken);
  const record: ImportedRecord = { id, raw, importedAt: new Date().toISOString() };
  const rows = readImportedRecords().filter((r) => r.id !== id).concat(record);
  writeImportedRecords(rows);
  return { record, skill: hydrateSkill(raw, { id, skillPath: `imported://${id}` }), parsed };
}

export function removeImportedSkill(id: string) {
  writeImportedRecords(readImportedRecords().filter((r) => r.id !== id));
}

export function parseImportPayload(text: string): { files: { id?: string; raw: string }[]; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { files: [], error: "空文件" };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed) as { skills?: ImportedRecord[] } | ImportedRecord[];
      const list = Array.isArray(data) ? data : data.skills ?? [];
      const files = list
        .filter((r) => r && typeof r.raw === "string")
        .map((r) => ({ id: r.id, raw: r.raw }));
      if (files.length === 0) return { files: [], error: "JSON 里没有 skills[].raw" };
      return { files };
    } catch {
      return { files: [], error: "JSON 无法解析" };
    }
  }
  return { files: [{ raw: trimmed }] };
}

export function downloadText(filename: string, text: string, mime = "text/markdown;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
