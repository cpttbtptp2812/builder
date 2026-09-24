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

  return (
    <div className="compose-model-bar">
      <div className="compose-model-bar-row">
        <label className="compose-model-field">
          <span>模型</span>
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
          <label className="compose-model-field compose-model-field--grow">
            <span>Model ID</span>
            <input
              value={config.model}
              onChange={(e) => updateModel(e.target.value)}
              placeholder="deepseek-chat"
            />
          </label>
        )}

        <label className="compose-model-field">
          <span>编排</span>
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
          className="compose-model-config-btn"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "connect" } }))
          }
        >
          配置 API / MCP
        </button>
      </div>

      <div className="compose-model-status">
        {config.enabled ? (
          llmReady ? (
            <span className="ok">LLM 已启用 · {config.model}</span>
          ) : (
            <span className="warn">请填写 API Key → 点「配置 API / MCP」</span>
          )
        ) : (
          <span>内置 Agent · 广场优先 · 无需 Key</span>
        )}
      </div>
    </div>
  );
}
