/** Agent 记忆 — Session 短期 + IndexedDB 长期（Context Engineering） */

import { idbGet, idbSet } from "./idbCache";

const MEM_INDEX_KEY = "agent-memory:index";
const MEM_PREFIX = "agent-memory:entry:";

export type MemoryEntry = {
  key: string;
  value: string;
  category: "preference" | "fact" | "session";
  updatedAt: string;
};

export type MemorySnapshot = {
  sessionTurns: { role: "user" | "assistant"; text: string; ts: string }[];
  longTerm: MemoryEntry[];
};

const SESSION_KEY = "uniagent:session-turns";
const MAX_SESSION_TURNS = 12;

function readSessionTurns(): MemorySnapshot["sessionTurns"] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MemorySnapshot["sessionTurns"];
  } catch {
    return [];
  }
}

function writeSessionTurns(turns: MemorySnapshot["sessionTurns"]) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(turns.slice(-MAX_SESSION_TURNS)));
}

export async function listLongTermMemories(): Promise<MemoryEntry[]> {
  const keys = (await idbGet<string[]>(MEM_INDEX_KEY)) ?? [];
  const entries: MemoryEntry[] = [];
  for (const key of keys) {
    const e = await idbGet<MemoryEntry>(MEM_PREFIX + key);
    if (e) entries.push(e);
  }
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function upsertMemory(
  key: string,
  value: string,
  category: MemoryEntry["category"] = "fact",
): Promise<MemoryEntry> {
  const entry: MemoryEntry = {
    key: key.trim(),
    value: value.trim(),
    category,
    updatedAt: new Date().toISOString(),
  };
  const keys = (await idbGet<string[]>(MEM_INDEX_KEY)) ?? [];
  if (!keys.includes(entry.key)) keys.push(entry.key);
  await idbSet(MEM_INDEX_KEY, keys);
  await idbSet(MEM_PREFIX + entry.key, entry);
  return entry;
}

export async function deleteMemory(key: string): Promise<void> {
  const keys = ((await idbGet<string[]>(MEM_INDEX_KEY)) ?? []).filter((k) => k !== key);
  await idbSet(MEM_INDEX_KEY, keys);
  await idbSet(MEM_PREFIX + key, null as unknown as MemoryEntry);
}

export function appendSessionTurn(role: "user" | "assistant", text: string) {
  const turns = readSessionTurns();
  turns.push({ role, text: text.slice(0, 500), ts: new Date().toISOString() });
  writeSessionTurns(turns);
}

export function clearSessionTurns() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function getMemorySnapshot(): Promise<MemorySnapshot> {
  return {
    sessionTurns: readSessionTurns(),
    longTerm: await listLongTermMemories(),
  };
}

/** 注入 Agent system prompt 的记忆块 */
export async function buildMemoryContextBlock(): Promise<string> {
  const { sessionTurns, longTerm } = await getMemorySnapshot();
  const parts: string[] = [];

  if (longTerm.length) {
    parts.push(
      "【长期记忆 · IndexedDB】\n" +
        longTerm.map((m) => `- ${m.key}: ${m.value}`).join("\n"),
    );
  }
  if (sessionTurns.length) {
    parts.push(
      "【会话短期记忆 · sessionStorage】\n" +
        sessionTurns
          .slice(-6)
          .map((t) => `${t.role}: ${t.text.slice(0, 120)}`)
          .join("\n"),
    );
  }
  return parts.length ? parts.join("\n\n") : "（暂无持久化记忆）";
}

/** 首次访问种子数据 */
export async function seedDefaultMemoriesIfEmpty() {
  const existing = await listLongTermMemories();
  if (existing.length) return existing;
  await upsertMemory("tech_focus", "Agent · MCP · Skills 运行时 · DOM 回放 SDK", "preference");
  await upsertMemory("demo_site", "个人站 builder 含 UniAgent / SkillForge / Platform Lab", "fact");
  return listLongTermMemories();
}
