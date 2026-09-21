import { useEffect, useState } from "react";
import { MCP_TOOLS } from "../../../lib/mcpBridgeLab";
import {
  LLM_PRESETS,
  getEnvApiKey,
  hasEnvApiKey,
  isLlmConfigured,
  loadLlmConfig,
  saveLlmConfig,
  type LlmConfig,
  type LlmPresetId,
} from "../../../lib/llmConfig";
import { KnowledgeEditor } from "./KnowledgeEditor";

export type OrchestrationMode = "single" | "multi";

const MODE_KEY = "ownagent-orch-mode";

export function loadOrchestrationMode(): OrchestrationMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "multi" ? "multi" : "single";
  } catch {
    return "single";
  }
}

/** 知识库 + 编排 + MCP + LLM */
export function OwnSettingsSheet({
  open,
  onClose,
  enabledTools,
  onToolsChange,
  orchMode,
  onOrchModeChange,
  onLlmChange,
  onKnowledgeChange,
  initialTab = "knowledge",
}: {
  open: boolean;
  onClose: () => void;
  enabledTools: string[];
  onToolsChange: (names: string[]) => void;
  orchMode: OrchestrationMode;
  onOrchModeChange: (m: OrchestrationMode) => void;
  onLlmChange: (cfg: LlmConfig) => void;
  onKnowledgeChange?: () => void;
  initialTab?: "knowledge" | "runtime";
}) {
  const [config, setConfig] = useState<LlmConfig>(() => loadLlmConfig());
  const [draftTools, setDraftTools] = useState(enabledTools);
  const [tab, setTab] = useState<"knowledge" | "runtime">(initialTab);
  const llmReady = isLlmConfigured(config);

  useEffect(() => {
    if (open) {
      setConfig(loadLlmConfig());
      setDraftTools(enabledTools);
      setTab(initialTab);
    }
  }, [open, enabledTools, initialTab]);

  useEffect(() => {
    saveLlmConfig(config);
    onLlmChange(config);
  }, [config, onLlmChange]);

  if (!open) return null;

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

  function saveTools() {
    onToolsChange(draftTools.length ? draftTools : MCP_TOOLS.map((t) => t.name));
  }

  function setMode(m: OrchestrationMode) {
    onOrchModeChange(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="ua-settings-back" onClick={onClose} role="presentation">
      <aside className="ua-settings ua-settings-wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>设置</strong>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="ua-settings-tabs">
          <button type="button" className={tab === "knowledge" ? "on" : ""} onClick={() => setTab("knowledge")}>
            知识库
          </button>
          <button type="button" className={tab === "runtime" ? "on" : ""} onClick={() => setTab("runtime")}>
            运行
          </button>
        </div>

        {tab === "knowledge" ? (
          <div className="ua-settings-kb">
            <KnowledgeEditor onChanged={onKnowledgeChange} />
          </div>
        ) : null}

        {tab === "runtime" ? (
        <>
        <section>
          <h3>编排模式</h3>
          <p className="ua-settings-lead">单 Agent，或多角色协作。</p>
          <div className="ua-mode-toggle">
            <button type="button" className={orchMode === "single" ? "on" : ""} onClick={() => setMode("single")}>
              单 Agent
            </button>
            <button type="button" className={orchMode === "multi" ? "on" : ""} onClick={() => setMode("multi")}>
              多代理
            </button>
          </div>
        </section>

        <section>
          <h3>能力工具 · {draftTools.length}</h3>
          <p className="ua-settings-lead">勾选后对话会真实调用这些工具。</p>
          <div className="ua-settings-tools">
            {MCP_TOOLS.map((t) => {
              const on = draftTools.includes(t.name);
              return (
                <label key={t.name} className={on ? "on" : ""}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setDraftTools((prev) =>
                        on ? prev.filter((n) => n !== t.name) : [...prev, t.name],
                      )
                    }
                  />
                  <div>
                    <strong>{t.labelZh}</strong>
                    <code>{t.name}</code>
                    <span>{t.descriptionZh}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="ua-settings-row">
            <button type="button" className="ghost" onClick={() => setDraftTools(MCP_TOOLS.map((t) => t.name))}>
              全选
            </button>
            <button type="button" className="primary" onClick={saveTools}>
              应用工具
            </button>
          </div>
        </section>

        <section>
          <h3>大模型 · {llmReady ? config.model : "内置 Guest"}</h3>
          <p className="ua-settings-lead">
            默认开箱即用。接入 LLM 后走完整 Tool Call；Key 只存本机。
            {hasEnvApiKey() ? " 已检测到 .env.local。" : ""}
          </p>
          <label className="ua-settings-check">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  enabled: e.target.checked,
                  apiKey: e.target.checked && !c.apiKey.trim() ? getEnvApiKey() : c.apiKey,
                }))
              }
            />
            启用我的 LLM API
          </label>
          {config.enabled && (
            <div className="ua-settings-llm">
              <label>
                预设
                <select
                  value={config.preset}
                  onChange={(e) => pickPreset(e.target.value as LlmPresetId)}
                >
                  <option value="deepseek">DeepSeek</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama 本地</option>
                  <option value="custom">自定义</option>
                </select>
              </label>
              <label>
                Base URL
                <input
                  value={config.baseUrl}
                  onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value, preset: "custom" }))}
                />
              </label>
              <label>
                Model
                <input
                  value={config.model}
                  onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
                />
              </label>
              <label>
                API Key
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
                  placeholder="sk-…"
                />
              </label>
            </div>
          )}
        </section>
        </>
        ) : null}
      </aside>
    </div>
  );
}
