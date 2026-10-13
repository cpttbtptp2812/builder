import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dir = path.join(os.tmpdir(), `ownagent-backup-${randomUUID()}`);
fs.mkdirSync(dir, { recursive: true });
process.env.DATABASE_PATH = path.join(dir, "source.db");
process.env.BACKUP_DIR = path.join(dir, "backups");
const target = path.join(dir, "restorable.db");

const { dbRun } = await import("../server/db.ts");
dbRun("INSERT INTO app_config(key,value,updated_at) VALUES(?,?,?)", ["backup_probe", "recover-me", new Date().toISOString()]);

process.argv[2] = target;
await import("../server/backup.ts");

const restored = new DatabaseSync(target, { readOnly: true });
const value = restored.prepare("SELECT value FROM app_config WHERE key='backup_probe'").get() as { value?: string } | undefined;
const migrations = restored.prepare("SELECT COUNT(*) AS c FROM schema_migrations").get() as { c: number };
const integrity = restored.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
restored.close();

if (value?.value !== "recover-me") throw new Error("backup lost application data");
if (migrations.c < 3) throw new Error("backup lost schema migration history");
if (integrity.integrity_check !== "ok") throw new Error("restored database failed integrity check");
console.log("PASS  online backup contains data + migration history and restores cleanly");

