import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const source = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "builder.db");
const backupDir = process.env.BACKUP_DIR ?? path.join(path.dirname(source), "backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(backupDir, `builder-${stamp}.db`);

fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
const db = new DatabaseSync(source);
db.exec(`PRAGMA wal_checkpoint(FULL); VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();

const verify = new DatabaseSync(target, { readOnly: true });
const integrity = verify.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
verify.close();
if (integrity.integrity_check !== "ok") {
  fs.rmSync(target, { force: true });
  throw new Error(`backup integrity check failed: ${integrity.integrity_check ?? "unknown"}`);
}

const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS ?? 14));
const cutoff = Date.now() - retentionDays * 86_400_000;
let removed = 0;
for (const name of fs.readdirSync(backupDir)) {
  const file = path.join(backupDir, name);
  if (/^builder-.*\.db$/.test(name) && file !== target && fs.statSync(file).mtimeMs < cutoff) {
    fs.rmSync(file, { force: true });
    removed += 1;
  }
}

console.log(JSON.stringify({ ok: true, source, target, bytes: fs.statSync(target).size, retentionDays, removed }));

