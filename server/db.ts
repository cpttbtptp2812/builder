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
