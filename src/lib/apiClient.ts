/** API 客户端 — 开发走 Vite /api 代理，生产走 VITE_API_BASE */

export type BackendHealth = {
  ok: boolean;
  status?: string;
  service?: string;
  runtime?: string;
  db?: string;
  databaseConnected?: boolean;
  ragChunks?: number;
  skillRuns?: number;
  skillsCount?: number;
  mcpToolsCount?: number;
  workflowRuns?: number;
  productProcesses?: number;
  llm?: boolean;
  version?: string;
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

const DEFAULT_FETCH_MS = 12_000;
/** 线上服务睡醒常常超过 12 秒。在这段时间里反复问 /health，醒了再继续。 */
const HEALTH_WAKE_MS = 60_000;
const HEALTH_ATTEMPT_MS = 25_000;

type ApiFetchInit = RequestInit & { timeoutMs?: number };

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T | null> {
  try {
    const timeoutMs = init?.timeoutMs ?? DEFAULT_FETCH_MS;
    const { timeoutMs: _timeoutMs, ...rest } = init ?? {};
    const token = getTeamToken();
    const signal =
      rest.signal ??
      (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(timeoutMs)
        : undefined);
    const res = await fetch(apiUrl(path), {
      ...rest,
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

let healthInflight: Promise<BackendHealth | null> | null = null;

async function wakeBackend(): Promise<BackendHealth | null> {
  const deadline = Date.now() + HEALTH_WAKE_MS;
  while (Date.now() < deadline) {
    const remain = deadline - Date.now();
    const health = await apiFetch<BackendHealth>("/health", {
      timeoutMs: Math.min(HEALTH_ATTEMPT_MS, remain),
    });
    if (health?.ok) {
      cachedHealth = health;
      healthCheckedAt = Date.now();
      return health;
    }
    cachedHealth = null;
    const pause = Math.min(1500, deadline - Date.now());
    if (pause <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, pause));
  }
  return null;
}

/** 进页面用：只问一次，失败就返回，不把入口卡住等服务睡醒。 */
export async function probeBackendOnce(timeoutMs = 8_000): Promise<BackendHealth | null> {
  if (cachedHealth?.ok && Date.now() - healthCheckedAt < HEALTH_TTL_MS) return cachedHealth;
  const health = await apiFetch<BackendHealth>("/health", { timeoutMs });
  if (health?.ok) {
    cachedHealth = health;
    healthCheckedAt = Date.now();
    return health;
  }
  return null;
}

export async function checkBackendHealth(force = false): Promise<BackendHealth | null> {
  if (!force && cachedHealth?.ok && Date.now() - healthCheckedAt < HEALTH_TTL_MS) {
    return cachedHealth;
  }
  if (healthInflight) return healthInflight;
  healthInflight = wakeBackend().finally(() => {
    healthInflight = null;
  });
  return healthInflight;
}

export function isBackendOnline(): boolean {
  return Boolean(cachedHealth?.ok);
}

export function clearBackendHealthCache() {
  cachedHealth = null;
  healthCheckedAt = 0;
}
