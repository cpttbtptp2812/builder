import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "..", "data");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "builder.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );

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

function runMigration(version: number, name: string, apply: () => void) {
  if (db.prepare("SELECT version FROM schema_migrations WHERE version=?").get(version)) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    apply();
    db.prepare("INSERT INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)")
      .run(version, name, new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

runMigration(1, "chat analytics columns", () => {
  for (const sql of CHAT_SESSION_MIGRATIONS) {
    try { db.exec(sql); } catch { /* column exists */ }
  }
});

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

  CREATE TABLE IF NOT EXISTS product_datasets (
    session_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    columns_json TEXT NOT NULL,
    rows_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, slot)
  );

  CREATE TABLE IF NOT EXISTS product_processes (
    process_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    query TEXT NOT NULL,
    status TEXT NOT NULL,
    trace_json TEXT,
    result_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_product_processes_session ON product_processes(session_id);

  CREATE TABLE IF NOT EXISTS product_session_owners (
    session_id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_product_session_owners_owner ON product_session_owners(owner_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS skill_versions (
    skill_id TEXT NOT NULL,
    version TEXT NOT NULL,
    raw TEXT NOT NULL,
    gate TEXT,
    actor_id TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (skill_id, version)
  );

  CREATE TABLE IF NOT EXISTS live_skills (
    skill_id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    raw TEXT NOT NULL,
    actor_id TEXT,
    published_at TEXT NOT NULL
  );
`);

runMigration(2, "clip tags", () => {
  try { db.exec(`ALTER TABLE clip_snippets ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`); } catch { /* column exists */ }
});
runMigration(4, "material cells, collab, external tools", () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dataset_cells (
      session_id TEXT NOT NULL,
      slot TEXT NOT NULL,
      sheet TEXT NOT NULL,
      cell TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      column_name TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (session_id, slot, sheet, cell)
    );
    CREATE TABLE IF NOT EXISTS y_updates (
      room TEXT NOT NULL,
      seq INTEGER NOT NULL,
      update_b64 TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (room, seq)
    );
    CREATE TABLE IF NOT EXISTS external_tools (
      name TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      capability TEXT NOT NULL,
      timeout_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
});

runMigration(3, "product archive and run token", () => {
  for (const sql of [
    "ALTER TABLE product_processes ADD COLUMN archived_at TEXT",
    "ALTER TABLE product_processes ADD COLUMN archived_by TEXT",
    "ALTER TABLE product_processes ADD COLUMN run_token TEXT",
  ] as const) {
    try { db.exec(sql); } catch { /* column exists */ }
  }
});

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

export function dbGet<T>(sql: string, params: any[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function dbAll<T>(sql: string, params: any[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function dbRun(sql: string, params: any[] = []) {
  return db.prepare(sql).run(...params);
}
