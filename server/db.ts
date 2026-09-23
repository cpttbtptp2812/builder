import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "..", "data");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "builder.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  /* ── 知识库文档（客户可通过管理后台增删改） ── */
  CREATE TABLE IF NOT EXISTS knowledge_docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    prompts TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  /* ── 应用配置（KV 存储，供管理后台读写） ── */
  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  /* ── 聊天会话记录（用于分析） ── */
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    query TEXT NOT NULL,
    answer_length INTEGER NOT NULL DEFAULT 0,
    groundedness INTEGER NOT NULL DEFAULT 0,
    hit_count INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(created_at DESC);

  /* ── 共享问答（朋友圈式知识 Feed） ── */
  CREATE TABLE IF NOT EXISTS published_qa (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '匿名用户',
    avatar_color TEXT NOT NULL DEFAULT '#6366f1',
    source_doc TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    likes INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_published_qa_created ON published_qa(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_published_qa_pinned ON published_qa(pinned DESC, created_at DESC);

  /* ── 制度条款（客户可配置） ── */
  CREATE TABLE IF NOT EXISTS policy_clauses (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'current',
    text TEXT NOT NULL,
    slot TEXT,
    value TEXT,
    condition_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  /* ── 能力规则（read / mutate / abstain） ── */
  CREATE TABLE IF NOT EXISTS capability_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cap TEXT NOT NULL,
    pattern TEXT NOT NULL,
    reason TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 50,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_capability_rules_priority ON capability_rules(priority ASC);
`);

const CHAT_SESSION_MIGRATIONS = [
  "ALTER TABLE chat_sessions ADD COLUMN answer_preview TEXT",
  "ALTER TABLE chat_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'llm'",
  "ALTER TABLE chat_sessions ADD COLUMN plaza_hit INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE chat_sessions ADD COLUMN published INTEGER NOT NULL DEFAULT 0",
] as const;

for (const sql of CHAT_SESSION_MIGRATIONS) {
  try { db.exec(sql); } catch { /* column exists */ }
}

/* ── 管理员密码默认配置 ── */
try {
  db.prepare(`INSERT OR IGNORE INTO app_config(key,value,updated_at) VALUES(?,?,?)`)
    .run("admin_password", process.env.ADMIN_PASSWORD ?? "admin123", new Date().toISOString());
} catch { /* ignore */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS rag_chunks (
    chunk_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    section TEXT NOT NULL,
    aspect_key TEXT,
    text TEXT NOT NULL,
    char_count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memories (
    session_id TEXT NOT NULL,
    mem_key TEXT NOT NULL,
    value TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'fact',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, mem_key)
  );

  CREATE TABLE IF NOT EXISTS session_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    run_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS skill_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    skill_id TEXT NOT NULL,
    query TEXT NOT NULL,
    trace_json TEXT NOT NULL,
    ok INTEGER NOT NULL,
    total_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_session_turns_session ON session_turns(session_id);

  CREATE TABLE IF NOT EXISTS clip_snippets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    page_url TEXT,
    page_title TEXT,
    text_fragment TEXT,
    scroll_y REAL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_clip_snippets_created ON clip_snippets(created_at DESC);
`);

try {
  db.exec(`ALTER TABLE clip_snippets ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
} catch {
  /* column exists */
}

export function nowIso() {
  return new Date().toISOString();
}

export type RagChunkRow = {
  chunk_id: string;
  project_id: string;
  project_name: string;
  section: string;
  aspect_key: string | null;
  text: string;
  char_count: number;
};

export function dbGet<T>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function dbAll<T>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function dbRun(sql: string, params: unknown[] = []) {
  return db.prepare(sql).run(...params);
}
