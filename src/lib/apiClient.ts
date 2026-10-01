/** API 客户端 — 开发走 Vite /api 代理，生产走 VITE_API_BASE */

export type BackendHealth = {
  ok: boolean;
  runtime: string;
  db: string;
  ragChunks: number;
  skillRuns: number;
  workflowRuns: number;
  llm: boolean;
};

let cachedHealth: BackendHealth | null = null;
let healthCheckedAt = 0;
const HEALTH_TTL_MS = 15_000;
const TEAM_TOKEN_KEY = "ownagent:team-token";

export function setTeamToken(token: string | null) {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TEAM_TOKEN_KEY, token);
  else localStorage.removeItem(TEAM_TOKEN_KEY);
}

export function getTeamToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TEAM_TOKEN_KEY);
}

export function getApiBase(): string {
  const env = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (env) return env.replace(/\/$/, "");
  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base) return `${base}${p.startsWith("/api") ? p : `/api${p}`}`;
  return p.startsWith("/api") ? p : `/api${p}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const token = getTeamToken();
    const res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function checkBackendHealth(force = false): Promise<BackendHealth | null> {
  if (!force && cachedHealth && Date.now() - healthCheckedAt < HEALTH_TTL_MS) {
    return cachedHealth;
  }
  const health = await apiFetch<BackendHealth>("/health");
  if (health?.ok) {
    cachedHealth = health;
    healthCheckedAt = Date.now();
  } else {
    cachedHealth = null;
  }
  return health;
}

export function isBackendOnline(): boolean {
  return Boolean(cachedHealth?.ok);
}

export function clearBackendHealthCache() {
  cachedHealth = null;
  healthCheckedAt = 0;
}
