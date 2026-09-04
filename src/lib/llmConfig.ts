/** LLM 连接配置 — sessionStorage + 可选 .env.local（仅本地开发） */

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

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
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
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
