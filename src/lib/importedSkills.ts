/** 访客导入的 SKILL.md — 存在 localStorage，不写仓库 */

import {
  attachCompileToManifest,
  hydrateSkill,
  parseSkillMarkdown,
  skillIdFromPath,
  type SkillManifest,
  type SkillPeer,
} from "./skillMarkdown";

function readBuiltinSkillFiles(): Record<string, string> {
  const globFn = (import.meta as ImportMeta & { glob?: (p: string, o: object) => Record<string, string> }).glob;
  if (typeof globFn !== "function") return {};
  return globFn("../skills/*/SKILL.md", {
    eager: true,
    query: "?raw",
    import: "default",
  }) as Record<string, string>;
}

function builtinPeers(): SkillPeer[] {
  return Object.entries(readBuiltinSkillFiles()).map(([filePath, raw]) => {
    const id = skillIdFromPath(filePath);
    const parsed = parseSkillMarkdown(raw);
    return { id, triggers: parsed.triggers };
  });
}

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

function catalogPeers(): SkillPeer[] {
  return builtinPeers();
}

export function recordsToSkills(rows: ImportedRecord[]): SkillManifest[] {
  return rows.map((r) => {
    const core = hydrateSkill(r.raw, { id: r.id, skillPath: `imported://${r.id}` });
    const peers = [
      ...catalogPeers(),
      ...rows
        .filter((x) => x.id !== r.id)
        .map((x) => {
          const p = parseSkillMarkdown(x.raw);
          return { id: x.id, triggers: p.triggers };
        }),
    ];
    return attachCompileToManifest(core, { skillId: r.id, env: "browser", peers });
  });
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
  const core = hydrateSkill(raw, { id, skillPath: `imported://${id}` });
  const skill = attachCompileToManifest(core, { skillId: id, env: "browser", peers: catalogPeers() });
  return { record, skill, parsed };
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

export type SkillExportRecord = {
  id: string;
  raw: string;
  source: "builtin" | "imported" | "published";
};

/** 技能包 JSON — 与 parseImportPayload 格式兼容 */
export function buildSkillsExportBundle(skills: SkillExportRecord[]): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      skills: skills.map((s) => ({ id: s.id, raw: s.raw, importedAt: s.source })),
    },
    null,
    2,
  );
}

/** 从文件列表解析出待导入的 SKILL 条目（支持多 .md + JSON 包） */
export async function readSkillImportFiles(files: FileList | File[]): Promise<{ id?: string; raw: string }[]> {
  const out: { id?: string; raw: string }[] = [];
  for (const file of [...files]) {
    const text = await file.text();
    const parsed = parseImportPayload(text);
    if (!parsed.error && (file.name.endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("["))) {
      out.push(...parsed.files);
      continue;
    }
    if (parsed.error && (text.trim().startsWith("{") || text.trim().startsWith("["))) {
      throw new Error(parsed.error);
    }
    out.push({ id: file.name.replace(/\.(md|markdown|json)$/i, ""), raw: text });
  }
  return out;
}

export type BatchInstallResult = { installed: string[]; drafted: string[]; errors: string[] };

/** 批量装入：新 id → 导入目录；已有内置 id → 回调由调用方存草稿 */
export function batchInstallSkills(
  files: { id?: string; raw: string }[],
  taken: Set<string>,
  opts?: {
    knownBuiltinIds?: Set<string>;
    onBuiltinDraft?: (skillId: string, raw: string, name: string) => void;
  },
): BatchInstallResult {
  const installed: string[] = [];
  const drafted: string[] = [];
  const errors: string[] = [];
  const used = new Set(taken);
  for (const file of files) {
    try {
      const parsed = parseSkillMarkdown(file.raw);
      const hint = file.id?.replace(/\.(md|markdown|json)$/i, "").replace(/\.SKILL$/i, "");
      const looksLikeFilename = Boolean(file.id && /\.(md|markdown|json)$/i.test(file.id));
      const seed = looksLikeFilename ? parsed.name || hint : hint || parsed.name;
      const targetBuiltin = [...(opts?.knownBuiltinIds ?? [])].find((id) => {
        if (file.id === id) return true;
        const stem = file.id?.replace(/\.(md|markdown|json)$/i, "").replace(/\.SKILL$/i, "");
        if (stem === id) return true;
        if (hint === id || parsed.name === id) return true;
        return false;
      });
      if (targetBuiltin && opts?.onBuiltinDraft) {
        opts.onBuiltinDraft(targetBuiltin, file.raw, parsed.name || targetBuiltin);
        drafted.push(targetBuiltin);
        continue;
      }
      const out = installImportedMarkdown(file.raw, used, file.id);
      used.add(out.record.id);
      installed.push(out.record.id);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { installed, drafted, errors };
}
