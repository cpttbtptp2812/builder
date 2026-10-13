import { isIP } from "node:net";
import type { Context, Next } from "hono";
import { teamSessionFromHeader } from "./teamGovernanceApi.ts";
import type { AuthenticatedSession } from "./teamGovernance.ts";
import { isAdminSession } from "./adminAuth.ts";

const PUBLIC_PATHS = new Set([
  "/api/health",
  "/api/ready",
  "/api/team/bootstrap",
  "/api/admin/login",
]);

/** 客户办事：模型测试、个人 Key 代理、办理流程、已发布技能只读。管理与发版不在此列。 */
export function customerApiOpen(path: string, method: string): boolean {
  if (method === "POST" && (path === "/api/llm/probe" || path === "/api/llm/byok/chat")) return true;
  if (path === "/api/product-run" || path.startsWith("/api/product-run/")) return true;
  if (method === "GET" && (path === "/api/skills/live" || path.startsWith("/api/skills/live/"))) return true;
  return false;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function requestIdentity(c: Context): AuthenticatedSession | undefined {
  return teamSessionFromHeader(c.req.header("authorization"));
}

export async function productionApiGuard(c: Context, next: Next) {
  if (
    process.env.NODE_ENV !== "production" ||
    PUBLIC_PATHS.has(c.req.path) ||
    customerApiOpen(c.req.path, c.req.method)
  ) {
    await next();
    return;
  }
  if (!requestIdentity(c) && !isAdminSession(c.req.header("x-admin-token"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
}

export function rateLimit(opts: { name: string; max: number; windowMs: number }) {
  return async (c: Context, next: Next) => {
    const actor =
      requestIdentity(c)?.member.id ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous";
    const key = `${opts.name}:${actor}`;
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + opts.windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > opts.max) {
      c.header("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return c.json({ error: "请求过于频繁，请稍后再试" }, 429);
    }
    await next();
  };
}

export async function requestSizeLimit(c: Context, next: Next) {
  const max = Number(process.env.MAX_REQUEST_BYTES ?? 10 * 1024 * 1024);
  const length = Number(c.req.header("content-length") ?? 0);
  if (length > max) return c.json({ error: "请求内容过大" }, 413);
  await next();
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

export function assertSafeExternalUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("只允许 https 地址");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    (isIP(host) === 4 && isPrivateIpv4(host)) ||
    (isIP(host) === 6 && /^(?:fc|fd|fe8|fe9|fea|feb)/i.test(host.replace(/:/g, "")))
  ) {
    throw new Error("不能访问本机、内网或链路本地地址");
  }
  return url;
}

export async function fetchExternal(
  raw: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number; maxBytes?: number; redirects?: number } = {},
): Promise<Response> {
  let url = assertSafeExternalUrl(raw);
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxRedirects = opts.redirects ?? 2;
  for (let i = 0; i <= maxRedirects; i += 1) {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (res.status < 300 || res.status >= 400) {
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > (opts.maxBytes ?? 1024 * 1024)) throw new Error("远程内容过大");
      return res;
    }
    const location = res.headers.get("location");
    if (!location) return res;
    url = assertSafeExternalUrl(new URL(location, url).toString());
  }
  throw new Error("重定向次数过多");
}

export async function readResponseTextLimited(res: Response, maxBytes = 1024 * 1024): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("远程内容过大");
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

