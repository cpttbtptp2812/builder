import { useCallback, useEffect, useState } from "react";
import { MCP_TOOLS } from "../../lib/mcpBridgeLab";
import { loadEnabledMcpTools } from "../fx/agent/AgentMcpRegistry";
import { loadOrchestrationMode, type OrchestrationMode } from "../fx/agent/OwnSettingsSheet";
import {
  LLM_PRESETS,
  getEnvApiKey,
  hasEnvApiKey,
  isLlmConfigured,
  loadLlmConfig,
  probeLlmConnection,
  saveLlmConfig,
  type LlmConfig,
  type LlmPresetId,
} from "../../lib/llmConfig";
import {
  dispatchAgentConfigUpdated,
  loadAgentCapabilities,
  saveAgentCapabilities,
  type AgentCapabilities,
} from "../../lib/agentCapabilities";
import {
  getActivePromptId,
  setActivePromptId,
} from "../../lib/agentPromptRuntime";
import { listPromptTemplates, PROMPT_CATEGORY_LABEL } from "../../lib/promptTemplates";
import { McpToolsPanel } from "./McpToolsPanel";
import {
  OaBadge,
  OaBtn,
  OaCheck,
  OaField,
  OaPage,
  OaStack,
  OaTabs,
} from "./OaUi";

const MCP_KEY = "uniagent-mcp-enabled";

function saveMcpEnabled(names: string[]) {
  localStorage.setItem(MCP_KEY, JSON.stringify(names));
  dispatchAgentConfigUpdated();
}

/** 接入配置 — 大模型 + MCP + 高级能力（客户可用，非 Demo） */
export function ConnectPanel() {
  const [tab, setTab] = useState<"llm" | "mcp" | "advanced">("llm");
  const [llm, setLlm] = useState<LlmConfig>(() => loadLlmConfig());
  const [mcpEnabled, setMcpEnabled] = useState<string[]>(() => loadEnabledMcpTools());
  const [orchMode, setOrchMode] = useState<OrchestrationMode>(() => loadOrchestrationMode());
  const [caps, setCaps] = useState<AgentCapabilities>(() => loadAgentCapabilities());
  const [activePrompt, setActivePrompt] = useState<string | null>(() => getActivePromptId());
  const [probe, setProbe] = useState<{ running: boolean; ok?: boolean; detail?: string }>({ running: false });
  const [saved, setSaved] = useState(false);

  const llmReady = isLlmConfigured(llm);
  const templates = listPromptTemplates();

  useEffect(() => {
    saveLlmConfig(llm);
    dispatchAgentConfigUpdated();
  }, [llm]);

  const flashSaved = useCallback(() => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }, []);

  function pickPreset(id: LlmPresetId) {
    if (id === "custom") {
      setLlm((c) => ({ ...c, preset: "custom" }));
      return;
    }
    const p = LLM_PRESETS[id];
    setLlm((c) => ({ ...c, preset: id, baseUrl: p.baseUrl, model: p.model }));
  }

  function toggleMcp(name: string) {
    setMcpEnabled((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      saveMcpEnabled(next.length ? next : MCP_TOOLS.map((t) => t.name));
      return next.length ? next : MCP_TOOLS.map((t) => t.name);
    });
    flashSaved();
  }

  function setOrch(m: OrchestrationMode) {
    setOrchMode(m);
    localStorage.setItem("ownagent-orch-mode", m);
    dispatchAgentConfigUpdated();
    flashSaved();
  }

  function updateCaps(next: AgentCapabilities) {
    setCaps(next);
    saveAgentCapabilities(next);
    flashSaved();
  }

  function selectPrompt(id: string | null) {
    setActivePrompt(id);
    setActivePromptId(id);
    flashSaved();
  }

  async function runProbe() {
    setProbe({ running: true });
    const res = await probeLlmConnection(llm);
    setProbe({ running: false, ok: res.ok, detail: res.detail });
  }

  return (
    <OaPage
      title="接入配置"
      desc="配置大模型与 MCP 工具后，对话会真实调用 API 与工具链。保存后立即生效。"
    >
      {saved && (
        <p className="oa-connect-saved">
          <OaBadge tone="ok">已保存 · 对话已同步</OaBadge>
        </p>
      )}

      <OaTabs
        label="接入"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "llm", label: "大模型" },
          { id: "mcp", label: "MCP 工具" },
          { id: "advanced", label: "高级能力" },
        ]}
      />

      {tab === "llm" && (
        <OaStack>
          <OaField label="启用 LLM API">
            <OaCheck
              checked={llm.enabled}
              onChange={(enabled) =>
                setLlm((c) => ({
                  ...c,
                  enabled,
                  apiKey: enabled && !c.apiKey.trim() ? getEnvApiKey() : c.apiKey,
                }))
              }
              label="启用我的大模型（关闭则使用内置 Guest Agent + 广场优先）"
            />
          </OaField>

          {llm.enabled && (
            <>
              <OaField label="预设">
                <select
                  className="oa-input"
                  value={llm.preset}
                  onChange={(e) => pickPreset(e.target.value as LlmPresetId)}
                >
                  <option value="deepseek">DeepSeek</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama 本地</option>
                  <option value="custom">自定义</option>
                </select>
              </OaField>
              <OaField label="Base URL">
                <input
                  className="oa-input"
                  value={llm.baseUrl}
                  onChange={(e) => setLlm((c) => ({ ...c, baseUrl: e.target.value, preset: "custom" }))}
                />
              </OaField>
              <OaField label="Model">
                <input
                  className="oa-input"
                  value={llm.model}
                  onChange={(e) => setLlm((c) => ({ ...c, model: e.target.value }))}
                />
              </OaField>
              <OaField label="API Key">
                <input
                  className="oa-input"
                  type="password"
                  value={llm.apiKey}
                  onChange={(e) => setLlm((c) => ({ ...c, apiKey: e.target.value }))}
                  placeholder="sk-…"
                />
              </OaField>
              {llm.preset !== "custom" && LLM_PRESETS[llm.preset as Exclude<LlmPresetId, "custom">] && (
                <p className="oa-toolbar-lead">
                  {LLM_PRESETS[llm.preset as Exclude<LlmPresetId, "custom">].hint}
                  {hasEnvApiKey() ? " · 已检测到 .env.local Key" : ""}
                </p>
              )}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <OaBtn onClick={() => void runProbe()} disabled={probe.running || !llmReady}>
                  {probe.running ? "测试中…" : "测试连接"}
                </OaBtn>
                <OaBadge tone={llmReady ? "ok" : undefined}>{llmReady ? llm.model : "未就绪"}</OaBadge>
                {probe.detail && (
                  <OaBadge tone={probe.ok ? "ok" : "danger"}>{probe.detail}</OaBadge>
                )}
              </div>
            </>
          )}
        </OaStack>
      )}

      {tab === "mcp" && (
        <OaStack>
          <p className="oa-toolbar-lead">
            勾选的工具会在对话中真实可调（Guest / LLM 路径均生效）。当前启用 {mcpEnabled.length}/{MCP_TOOLS.length} 个。
          </p>
          <div className="oa-connect-mcp-grid">
            {MCP_TOOLS.map((t) => (
              <label key={t.name} className="oa-connect-mcp-row">
                <OaCheck
                  checked={mcpEnabled.includes(t.name)}
                  onChange={() => toggleMcp(t.name)}
                  label={t.labelZh}
                />
                <code>{t.name}</code>
                <span>{t.descriptionZh}</span>
              </label>
            ))}
          </div>
          <OaBtn variant="ghost" onClick={() => {
            const all = MCP_TOOLS.map((t) => t.name);
            setMcpEnabled(all);
            saveMcpEnabled(all);
            flashSaved();
          }}>
            全选工具
          </OaBtn>

          <details className="oa-details" open>
            <summary>工具调用测试（沙箱）</summary>
            <div className="oa-details-body oa-connect-mcp-sandbox">
              <McpToolsPanel embedded />
            </div>
          </details>
        </OaStack>
      )}

      {tab === "advanced" && (
        <OaStack>
          <section className="oa-connect-cap-block">
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>多 Agent 编排</h3>
            <p className="oa-toolbar-lead">开启后，对话走 Planner → Executor → Reviewer 流水线（无需 LLM 也可用浏览器编排）。</p>
            <div className="oa-connect-toggle-row">
              <OaBtn variant={orchMode === "single" ? "primary" : "ghost"} onClick={() => setOrch("single")}>
                单 Agent
              </OaBtn>
              <OaBtn variant={orchMode === "multi" ? "primary" : "ghost"} onClick={() => setOrch("multi")}>
                多 Agent
              </OaBtn>
            </div>
          </section>

          <section className="oa-connect-cap-block">
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>RAG Query Rewrite</h3>
            <p className="oa-toolbar-lead">检索前自动改写 query、多路融合，提升资料库命中率。</p>
            <OaCheck
              checked={caps.ragRewrite}
              onChange={(ragRewrite) => updateCaps({ ...caps, ragRewrite })}
              label="启用 Query Rewrite（knowledge_search 全链路生效）"
            />
          </section>

          <section className="oa-connect-cap-block">
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>Prompt 场景模板</h3>
            <p className="oa-toolbar-lead">选中后注入 system 指令，影响 LLM / Guest 行为。</p>
            <div className="oa-connect-prompt-list">
              <button
                type="button"
                className={`oa-connect-prompt-item${!activePrompt ? " on" : ""}`}
                onClick={() => selectPrompt(null)}
              >
                默认（无附加指令）
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`oa-connect-prompt-item${activePrompt === t.id ? " on" : ""}`}
                  onClick={() => selectPrompt(t.id)}
                >
                  <strong>{t.name}</strong>
                  <span>{PROMPT_CATEGORY_LABEL[t.category]}</span>
                  <em>{t.description}</em>
                </button>
              ))}
            </div>
          </section>

          <section className="oa-connect-cap-block">
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>回答规则 · HITL</h3>
            <p className="oa-toolbar-lead">
              制度拦截与人工审批在「回答规则」页配置，对话发送前自动生效。
            </p>
            <OaBtn
              variant="ghost"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "guard" } }))
              }
            >
              打开回答规则 →
            </OaBtn>
          </section>
        </OaStack>
      )}
    </OaPage>
  );
}
