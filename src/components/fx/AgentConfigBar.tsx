import { useEffect, useState } from "react";
import {
  LLM_PRESETS,
  getEnvApiKey,
  hasEnvApiKey,
  isLlmConfigured,
  loadLlmConfig,
  saveLlmConfig,
  type LlmConfig,
  type LlmPresetId,
} from "../../lib/llmConfig";

/** 可选：接入自己的 LLM — 默认用内置 Guest Agent，无需配置 */
export function AgentConfigBar({ onChange, compact }: { onChange?: (cfg: LlmConfig) => void; compact?: boolean }) {
  const [config, setConfig] = useState<LlmConfig>(() => loadLlmConfig());
  const [open, setOpen] = useState(false);
  const llmReady = isLlmConfigured(config);
  const presetMeta = config.preset !== "custom" ? LLM_PRESETS[config.preset] : null;

  useEffect(() => {
    saveLlmConfig(config);
    onChange?.(config);
  }, [config, onChange]);

  function pickPreset(id: LlmPresetId) {
    if (id === "custom") {
      setConfig((c) => ({ ...c, preset: "custom" }));
      return;
    }
    const p = LLM_PRESETS[id];
    setConfig((c) => ({
      ...c,
      preset: id,
      baseUrl: p.baseUrl,
      model: p.model,
    }));
  }

  function toggleEnabled(on: boolean) {
    setConfig((c) => ({
      ...c,
      enabled: on,
      apiKey: on && !c.apiKey.trim() ? getEnvApiKey() : c.apiKey,
    }));
    if (on) setOpen(true);
  }

  return (
    <div className={`agent-config-bar${llmReady ? " ready" : " guest"}${compact ? " compact" : ""}`}>
      <div className="agent-config-top">
        {compact ? null : <span className="agent-guest-badge">内置 Agent · 点开即用</span>}
        <button type="button" className="agent-config-toggle" onClick={() => setOpen((o) => !o)}>
          {llmReady ? `${config.model} · 已接 LLM` : compact ? "接入 LLM" : "高级：接入自己的 LLM（可选）"}
          <em>{open ? "▾" : "▸"}</em>
        </button>
      </div>

      {open && (
        <div className="agent-config-panel">
          <label className="agent-config-enable">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => toggleEnabled(e.target.checked)}
            />
            启用我的 LLM API（不勾选则使用内置 Guest Agent，无需 Key）
          </label>

          {!config.enabled && (
            <p className="agent-config-lead">
              当前模式：<strong>内置 Agent</strong> — 你输入什么就检索 / 探活 / 看当前页，不必点固定演示。接入模型后走完整 Tool Call。
            </p>
          )}

          {config.enabled && (
            <>
              <p className="agent-config-lead">
                已切换为 <strong>LLM Agent Loop</strong> — 你的模型自主选工具。Key 只存在本机浏览器。
                {hasEnvApiKey() && " 检测到 .env.local，可自动填入 Key。"}
                {import.meta.env.DEV && " 开发环境 DeepSeek 走 Vite proxy。"}
              </p>

              <div className="agent-config-presets">
                {(
                  [
                    ...Object.entries(LLM_PRESETS).map(([id, p]) => [id, p] as const),
                    ["custom", { label: "自定义", baseUrl: "", model: "", hint: "" }] as const,
                  ] as const
                ).map(([id, p]) => (
                  <button
                    key={id}
                    type="button"
                    className={config.preset === id ? "on" : ""}
                    onClick={() => pickPreset(id as LlmPresetId)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {presetMeta && (
                <div className="agent-config-guide">
                  <span>{presetMeta.hint}</span>
                  {presetMeta.keyUrl && (
                    <a href={presetMeta.keyUrl} target="_blank" rel="noreferrer">
                      去申请 Key →
                    </a>
                  )}
                  {presetMeta.keySteps && <small>{presetMeta.keySteps}</small>}
                </div>
              )}

              <div className="agent-config-fields">
                <label>
                  Base URL
                  <input
                    value={config.baseUrl}
                    onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value, preset: "custom" }))}
                    spellCheck={false}
                  />
                </label>
                <label>
                  Model
                  <input
                    value={config.model}
                    onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value, preset: "custom" }))}
                    spellCheck={false}
                  />
                </label>
                {config.preset !== "ollama" && (
                  <label>
                    API Key
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
                      placeholder="sk-..."
                      autoComplete="off"
                    />
                  </label>
                )}
              </div>

              {!llmReady && (
                <p className="agent-config-warn">Key 无效或未填写时会 401 — 可关闭上方开关回到 Guest Agent</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function useAgentLlmConfig() {
  const [config, setConfig] = useState<LlmConfig>(() => loadLlmConfig());
  return { config, setConfig, ready: isLlmConfigured(config) };
}
