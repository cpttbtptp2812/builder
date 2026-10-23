/** LLM 连接配置 — localStorage + 可选 .env.local（仅本地开发） */

import { apiUrl, checkBackendHealth, getTeamToken } from "./apiClient";
import { probeVerdict } from "./llmWire";

export type LlmPresetId = "deepseek" | "openai" | "ollama" | "ollama-cloud" | "webllm" | "custom";

export type LlmConfig = {
  preset: LlmPresetId;
  baseUrl: string;
  model: string;
  apiKey: string;
  /** 用户主动启用「自己的 LLM」时才走 API，否则用内置 Guest Agent */
  enabled: boolean;
};

const STORAGE_KEY = "uniagent-llm-config";
const KEY_STORAGE_KEY = "uniagent-llm-key";

/** 本地 .env.local：VITE_UNIAGENT_API_KEY=sk-xxx（勿提交 git，勿用于公开站点 build） */
const ENV_API_KEY = (import.meta.env.VITE_UNIAGENT_API_KEY as string | undefined)?.trim() ?? "";

export const LLM_PRESETS: Record<
  Exclude<LlmPresetId, "custom">,
  { label: string; baseUrl: string; model: string; hint: string; keyUrl?: string; keySteps?: string }
> = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    hint: "支持 Tool Call · 国内常用 · 有免费额度",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keySteps: "注册 → 控制台 → API Keys → 创建 Key（sk- 开头）",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "需可访问 OpenAI · Tool Call 稳定",
    keyUrl: "https://platform.openai.com/api-keys",
    keySteps: "注册 → Billing 充值 → API keys → Create new secret key",
  },
  ollama: {
    label: "Ollama 本地",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    hint: "无需 Key · 终端执行 ollama serve && ollama pull qwen2.5:7b",
    keyUrl: "https://ollama.com/download",
    keySteps: "安装 Ollama → 拉模型 → 无需 API Key",
  },
  "ollama-cloud": {
    label: "Ollama Cloud",
    baseUrl: "https://ollama.com/v1",
    model: "llama3.3",
    hint: "ollama.com 控制台 API Key · 常用模型：llama3.3、qwen2.5、deepseek-r1",
    keyUrl: "https://ollama.com/settings/keys",
    keySteps: "登录 ollama.com → Keys → Create API key",
  },
  webllm: {
    label: "浏览器本地模型",
    baseUrl: "webllm://local",
    model: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    hint: "不配 Key，点下载后才拉取约 1GB 模型。办结说明在浏览器里写，数字仍以计算结果为准。需要 WebGPU。",
  },
};

export function defaultLlmConfig(): LlmConfig {
  const p = LLM_PRESETS.deepseek;
  return {
    preset: "deepseek",
    baseUrl: p.baseUrl,
    model: p.model,
    apiKey: "",
    enabled: false,
  };
}

export function hasEnvApiKey(): boolean {
  return Boolean(ENV_API_KEY);
}

export function getEnvApiKey(): string {
  return ENV_API_KEY;
}

function readStoredConfig(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = readStoredConfig();
    const base = defaultLlmConfig();
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<LlmConfig>;
    let baseUrl = saved.baseUrl ?? base.baseUrl;
    if (baseUrl.includes("ollama.com/api/v1")) {
      baseUrl = baseUrl.replace("ollama.com/api/v1", "ollama.com/v1");
    }
    const browserKey = localStorage.getItem(KEY_STORAGE_KEY)?.trim() ?? "";
    const legacyKey = saved.apiKey?.trim() ?? "";
    if (!browserKey && legacyKey) localStorage.setItem(KEY_STORAGE_KEY, legacyKey);
    return {
      ...base,
      ...saved,
      baseUrl,
      enabled: Boolean(saved.enabled),
      apiKey: saved.enabled ? (browserKey || legacyKey || ENV_API_KEY) : (browserKey || legacyKey),
    };
  } catch {
    return defaultLlmConfig();
  }
}

export function saveLlmConfig(config: LlmConfig) {
  const { apiKey, ...metadata } = config;
  const raw = JSON.stringify(metadata);
  localStorage.setItem(STORAGE_KEY, raw);
  if (apiKey.trim()) localStorage.setItem(KEY_STORAGE_KEY, apiKey.trim());
  else localStorage.removeItem(KEY_STORAGE_KEY);
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("ownagent:config-updated"));
  } catch {
    /* ignore */
  }
}

export function clearStoredLlmKey() {
  try {
    localStorage.removeItem(KEY_STORAGE_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      delete parsed.apiKey;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    localStorage.removeItem(PROBE_KEY);
    window.dispatchEvent(new CustomEvent("ownagent:config-updated"));
  } catch {
    /* ignore */
  }
}

const PROBE_KEY = "uniagent-llm-probe";

export type LlmProbeRecord = {
  ok: boolean;
  model: string;
  baseUrl: string;
  keyStamp: string;
};

function keyStamp(apiKey: string): string {
  let h = 0;
  for (let i = 0; i < apiKey.length; i += 1) h = (h * 31 + apiKey.charCodeAt(i)) >>> 0;
  return `${apiKey.length}:${h}`;
}

export function saveLlmProbe(config: LlmConfig, ok: boolean) {
  const record: LlmProbeRecord = {
    ok,
    model: config.model.trim(),
    baseUrl: config.baseUrl.trim(),
    keyStamp: keyStamp(config.apiKey.trim()),
  };
  try {
    localStorage.setItem(PROBE_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent("ownagent:config-updated"));
  } catch {
    /* ignore */
  }
}

export function loadLlmProbe(): LlmProbeRecord | null {
  try {
    const raw = localStorage.getItem(PROBE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LlmProbeRecord;
  } catch {
    return null;
  }
}

/** 只有最近一次测试成功，且模型、地址、Key 都没改过，才算连上。 */
export function isLlmProbeLive(config: LlmConfig): boolean {
  const probe = loadLlmProbe();
  if (!probe?.ok || !isLlmConfigured(config)) return false;
  return (
    probe.model === config.model.trim() &&
    probe.baseUrl === config.baseUrl.trim() &&
    probe.keyStamp === keyStamp(config.apiKey.trim())
  );
}

/** 传给 product-run / 服务端 LLM 步（不含 enabled 以外的敏感扩展） */
export function toProductLlmConfig(config: LlmConfig): {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  preset: LlmPresetId;
} {
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey,
    preset: config.preset,
  };
}

export function isLlmConfigured(config: LlmConfig): boolean {
  if (!config.enabled) return false;
  if (!config.baseUrl.trim() || !config.model.trim()) return false;
  if (config.preset === "ollama" || config.preset === "webllm") return true;
  if (config.preset === "ollama-cloud") return Boolean(config.apiKey.trim());
  return Boolean(config.apiKey.trim());
}

/** 开发环境可走 Vite proxy 规避 CORS */
export function resolveLlmBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (import.meta.env.DEV && trimmed.includes("api.deepseek.com")) {
    return "/llm-proxy/v1";
  }
  if (import.meta.env.DEV && trimmed.includes("ollama.com")) {
    return "/ollama-cloud-proxy/v1";
  }
  return trimmed;
}

/** 探测 LLM 是否可用（非流式，最多 5 token） */
export async function probeLlmConnection(
  config: LlmConfig,
): Promise<{ ok: boolean; ms: number; detail: string }> {
  let activeConfig = { ...config };
  // 智能适配：如果选了本地 Ollama 但填了云端 API Key，自动切换至 Ollama Cloud
  if (
    activeConfig.preset === "ollama" &&
    activeConfig.apiKey.trim().length > 10 &&
    (activeConfig.baseUrl.includes("localhost") || activeConfig.baseUrl.includes("127.0.0.1"))
  ) {
    activeConfig = {
      ...activeConfig,
      preset: "ollama-cloud",
      baseUrl: "https://ollama.com/v1",
      model: activeConfig.model === "qwen2.5:7b" ? "llama3.3" : activeConfig.model,
    };
  }

  if (!isLlmConfigured(activeConfig)) {
    return { ok: false, ms: 0, detail: "请先启用并填写 Base URL、Model 与 API Key" };
  }
  const t0 = performance.now();
  const baseUrl = resolveLlmBaseUrl(activeConfig.baseUrl);
  const local =
    activeConfig.preset === "ollama" ||
    /localhost|127\.0\.0\.1/.test(baseUrl) ||
    baseUrl.startsWith("/");
  const target = local ? `${baseUrl}/chat/completions` : apiUrl("/llm/probe");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const teamToken = getTeamToken();
  if (local && activeConfig.apiKey.trim()) headers.Authorization = `Bearer ${activeConfig.apiKey.trim()}`;
  if (!local && teamToken) headers.Authorization = `Bearer ${teamToken}`;

  try {
    const res = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(
        local
          ? {
              model: activeConfig.model,
              messages: [{ role: "user", content: "ping" }],
              max_tokens: 5,
              stream: false,
            }
          : { baseUrl: activeConfig.baseUrl, model: activeConfig.model, apiKey: activeConfig.apiKey },
      ),
    });
    const ms = Math.round(performance.now() - t0);
    const raw = await res.text().catch(() => "");
    if (!local) {
      let body: { ok?: boolean; detail?: string } | null = null;
      try {
        body = JSON.parse(raw) as { ok?: boolean; detail?: string };
      } catch {
        body = null;
      }
      const verdict = probeVerdict(res.ok, body, res.status);
      let detail = verdict.detail;
      if (!res.ok && res.status === 500 && (!body || !body.detail)) {
        detail = "HTTP 500 · 后端服务未就绪。请确认是否已执行 npm run dev:server 或 npm run dev:full";
      }
      return { ok: verdict.ok, ms, detail: detail || `已连通 ${activeConfig.model} · ${ms}ms` };
    }
    if (!res.ok) {
      let errDetail = raw.slice(0, 160) || res.statusText;
      try {
        const parsed = JSON.parse(raw) as { error?: string | { message?: string } };
        if (typeof parsed.error === "string") errDetail = parsed.error;
        else if (parsed.error?.message) errDetail = parsed.error.message;
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        ms,
        detail: `HTTP ${res.status} · ${activeConfig.model}: ${errDetail}`,
      };
    }
    return { ok: true, ms, detail: `已连通 ${activeConfig.model} · ${ms}ms` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "网络错误";
    const hint = local
      ? "请求发送失败。若是本地 Ollama 请确认本地服务已启动；若是云端请检查网络或代理是否通畅。"
      : "无法连接模型服务。请检查 API Key 是否有效，或检查网络连接。";
    return { ok: false, ms: Math.round(performance.now() - t0), detail: `${msg} · ${target}。${hint}` };
  }
}
