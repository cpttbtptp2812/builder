/** 对话框工具栏 — 模型选择 + 快捷跳转完整配置 */

import {
  LLM_PRESETS,
  isLlmConfigured,
  type LlmConfig,
  type LlmPresetId,
} from "../../../lib/llmConfig";
import type { OrchestrationMode } from "./OwnSettingsSheet";

const PRESET_OPTIONS: { id: LlmPresetId | "guest"; label: string }[] = [
  { id: "guest", label: "内置 Agent" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "openai", label: "OpenAI" },
  { id: "ollama", label: "Ollama" },
  { id: "custom", label: "自定义" },
];

export function ComposeModelBar({
  config,
  onChange,
  orchMode,
  onOrchChange,
}: {
  config: LlmConfig;
  onChange: (cfg: LlmConfig) => void;
  orchMode: OrchestrationMode;
  onOrchChange: (m: OrchestrationMode) => void;
}) {
  const llmReady = isLlmConfigured(config);
  const activePreset = config.enabled ? config.preset : "guest";

  function pickPreset(id: LlmPresetId | "guest") {
    if (id === "guest") {
      onChange({ ...config, enabled: false });
      return;
    }
    const p = id === "custom" ? null : LLM_PRESETS[id];
    onChange({
      ...config,
      enabled: true,
      preset: id,
      baseUrl: p?.baseUrl ?? config.baseUrl,
      model: p?.model ?? config.model,
    });
  }

  function updateModel(model: string) {
    onChange({
      ...config,
      enabled: true,
      model,
      preset: config.preset === "custom" ? "custom" : config.preset,
    });
  }

  const status = !config.enabled
    ? { tone: "idle", text: "内置 Agent · 无需 Key", title: "广场优先，技能路由生效" }
    : llmReady
      ? { tone: "ok", text: "已接入", title: `LLM 已启用 · ${config.model}` }
      : { tone: "warn", text: "缺 API Key，暂用内置 Agent", title: "点「配置」填写 API Key 后才会调用该模型" };

  return (
    <div className="oc-tools">
      <label className="oc-pill" title="回答所用模型">
        <span className="oc-pill-k">模型</span>
        <select
          value={activePreset}
          onChange={(e) => pickPreset(e.target.value as LlmPresetId | "guest")}
        >
          {PRESET_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {config.enabled && (
        <label className="oc-pill oc-pill--model" title="Model ID">
          <input
            value={config.model}
            onChange={(e) => updateModel(e.target.value)}
            placeholder="Model ID"
            aria-label="Model ID"
            size={Math.max(8, Math.min(config.model.length || 8, 18))}
          />
        </label>
      )}

      <label className="oc-pill" title="单 Agent：一个助手回答；多 Agent：分工协作">
        <span className="oc-pill-k">编排</span>
        <select
          value={orchMode}
          onChange={(e) => {
            const m = e.target.value as OrchestrationMode;
            onOrchChange(m);
            localStorage.setItem("ownagent-orch-mode", m);
            window.dispatchEvent(new CustomEvent("ownagent:config-updated"));
          }}
        >
          <option value="single">单 Agent</option>
          <option value="multi">多 Agent</option>
        </select>
      </label>

      <button
        type="button"
        className={`oc-status ${status.tone}`}
        title={`${status.title} · 点击配置 API / MCP`}
        onClick={() =>
          window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "connect" } }))
        }
      >
        <i aria-hidden />
        <span>{status.text}</span>
        <b>配置 API / MCP</b>
      </button>
    </div>
  );
}
