/** LLM 连接配置 — localStorage + 可选 .env.local（仅本地开发） */

export type LlmPresetId = "deepseek" | "openai" | "ollama" | "custom";

export type LlmConfig = {
  preset: LlmPresetId;
  baseUrl: string;
  model: string;
  apiKey: string;
  /** 用户主动启用「自己的 LLM」时才走 API，否则用内置 Guest Agent */
  enabled: boolean;
};

const STORAGE_KEY = "uniagent-llm-config";

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
    return {
      ...base,
      ...saved,
      enabled: Boolean(saved.enabled),
      apiKey: saved.enabled ? (saved.apiKey?.trim() || ENV_API_KEY) : (saved.apiKey?.trim() ?? ""),
    };
  } catch {
    return defaultLlmConfig();
  }
}

export function saveLlmConfig(config: LlmConfig) {
  const raw = JSON.stringify(config);
  localStorage.setItem(STORAGE_KEY, raw);
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

export function isLlmConfigured(config: LlmConfig): boolean {
  if (!config.enabled) return false;
  if (!config.baseUrl.trim() || !config.model.trim()) return false;
  if (config.preset === "ollama") return true;
  return Boolean(config.apiKey.trim());
}

/** 开发环境可走 Vite proxy 规避 CORS */
export function resolveLlmBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (import.meta.env.DEV && trimmed.includes("api.deepseek.com")) {
    return "/llm-proxy/v1";
  }
  return trimmed;
}

/** 探测 LLM 是否可用（非流式，最多 5 token） */
export async function probeLlmConnection(
  config: LlmConfig,
): Promise<{ ok: boolean; ms: number; detail: string }> {
  if (!isLlmConfigured(config)) {
    return { ok: false, ms: 0, detail: "请先启用并填写 Base URL、Model 与 API Key" };
  }
  const t0 = performance.now();
  const baseUrl = resolveLlmBaseUrl(config.baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
        stream: false,
      }),
    });
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, ms, detail: `HTTP ${res.status}: ${errText.slice(0, 120) || res.statusText}` };
    }
    return { ok: true, ms, detail: `${config.model} · ${ms}ms` };
  } catch (err) {
    return {
      ok: false,
      ms: Math.round(performance.now() - t0),
      detail: err instanceof Error ? err.message : "网络错误",
    };
  }
}
