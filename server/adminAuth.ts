import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { dbGet, dbRun, nowIso } from "./db.ts";

const ADMIN_HASH_KEY = "admin_password_hash";
const sessions = new Map<string, number>();
const SESSION_MS = 8 * 60 * 60 * 1000;

function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${digest}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [, salt, digest] = stored.split(":");
  if (!salt || !digest || !stored.startsWith("scrypt:")) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function initializeAdminCredential(): void {
  const configured = process.env.ADMIN_PASSWORD?.trim();
  const existing = dbGet<{ value: string }>("SELECT value FROM app_config WHERE key=?", [ADMIN_HASH_KEY])?.value;
  if (!existing && configured) {
    dbRun("INSERT INTO app_config(key,value,updated_at) VALUES(?,?,?)", [
      ADMIN_HASH_KEY,
      hashPassword(configured),
      nowIso(),
    ]);
  }
  if (process.env.NODE_ENV === "production" && !existing && !configured) {
    throw new Error("生产环境必须设置 ADMIN_PASSWORD 完成首次初始化");
  }
}

export function createAdminSession(password: string): string | null {
  const stored = dbGet<{ value: string }>("SELECT value FROM app_config WHERE key=?", [ADMIN_HASH_KEY])?.value;
  if (!stored || !verifyPassword(password, stored)) return null;
  const token = randomBytes(32).toString("base64url");
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}

export function isAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function revokeAdminSession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

