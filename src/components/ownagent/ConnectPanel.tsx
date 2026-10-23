import { useCallback, useEffect, useState } from "react";
import { MCP_TOOLS } from "../../lib/mcpBridgeLab";
import { loadEnabledMcpTools } from "../fx/agent/AgentMcpRegistry";
import { loadOrchestrationMode, type OrchestrationMode } from "../fx/agent/OwnSettingsSheet";
import {
  LLM_PRESETS,
  clearStoredLlmKey,
  isLlmConfigured,
  isLlmProbeLive,
  loadLlmConfig,
  probeLlmConnection,
  saveLlmConfig,
  saveLlmProbe,
  type LlmConfig,
  type LlmPresetId,
} from "../../lib/llmConfig";
import { ExternalToolBox } from "./ExternalToolBox";
import { LocalModelBox } from "./LocalModelBox";
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
import { apiFetch, getTeamToken, setTeamToken } from "../../lib/apiClient";
import { listByokModels } from "../../lib/byokLlm";
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
  const [tab, setTab] = useState<"access" | "llm" | "mcp" | "advanced">("llm");
  const [accessToken, setAccessToken] = useState(() => getTeamToken() ?? "");
  const [accessState, setAccessState] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [llm, setLlm] = useState<LlmConfig>(() => loadLlmConfig());
  const [mcpEnabled, setMcpEnabled] = useState<string[]>(() => loadEnabledMcpTools());
  const [orchMode, setOrchMode] = useState<OrchestrationMode>(() => loadOrchestrationMode());
  const [caps, setCaps] = useState<AgentCapabilities>(() => loadAgentCapabilities());
  const [activePrompt, setActivePrompt] = useState<string | null>(() => getActivePromptId());
  const [probe, setProbe] = useState<{ running: boolean; ok?: boolean; detail?: string }>({ running: false });
  const [modelList, setModelList] = useState<{ running: boolean; ids: string[]; detail?: string }>({ running: false, ids: [] });
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
    setModelList({ running: false, ids: [] });
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

  async function runModelList() {
    setModelList({ running: true, ids: [] });
    try {
      const ids = await listByokModels(llm);
      setModelList({
        running: false,
        ids,
        detail: `列出 ${ids.length} 个模型名。名单不校验 Key，测试连接通过才算连上你的模型。`,
      });
      if (ids.length && !ids.includes(llm.model)) setLlm((c) => ({ ...c, model: ids[0]! }));
    } catch (err) {
      setModelList({
        running: false,
        ids: [],
        detail: err instanceof Error ? err.message : "拉取模型失败",
      });
    }
  }

  async function runProbe() {
    setProbe({ running: true });
    const res = await probeLlmConnection(llm);
    saveLlmProbe(llm, res.ok);
    setProbe({ running: false, ok: res.ok, detail: res.detail });
  }

  async function saveAccessToken() {
    setAccessState("checking");
    setTeamToken(accessToken.trim() || null);
    const me = await apiFetch<{ member?: { displayName?: string } }>("/team/me");
    setAccessState(me?.member ? "ok" : "error");
  }

  return (
    <OaPage
      title="接入配置"
      desc="这里连的是你自己的模型。填上你的 Key，测试连接会用这把 Key 发一句真实请求，通过后才算连上。线上也是每位客户自己连。"
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
          { id: "access", label: "办事服务" },
          { id: "llm", label: "大模型" },
          { id: "mcp", label: "MCP 工具" },
          { id: "advanced", label: "高级能力" },
        ]}
      />

      {tab === "access" && (
        <OaStack>
          <p className="oa-toolbar-lead">
            私有部署由管理员为每位办事员发放访问令牌。令牌只保存在当前浏览器，用来保护材料、办理记录和技能发布。
          </p>
          <OaField label="访问令牌">
            <input
              className="oa-input"
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(e) => {
                setAccessToken(e.target.value);
                setAccessState("idle");
              }}
              placeholder="由管理员提供"
            />
          </OaField>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <OaBtn onClick={() => void saveAccessToken()} disabled={!accessToken.trim() || accessState === "checking"}>
              {accessState === "checking" ? "检查中…" : "保存并检查"}
            </OaBtn>
            {accessState === "ok" ? <OaBadge tone="ok">已连接办事服务</OaBadge> : null}
            {accessState === "error" ? <OaBadge tone="danger">令牌无效或服务未连接</OaBadge> : null}
          </div>
        </OaStack>
      )}

      {tab === "llm" && (
        <OaStack>
          <OaField label="启用我的模型">
            <OaCheck
              checked={llm.enabled}
              onChange={(enabled) => setLlm((c) => ({ ...c, enabled }))}
              label="用我填的 Key 连接模型"
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
                  <option value="ollama-cloud">Ollama Cloud</option>
                  <option value="webllm">浏览器本地模型</option>
                  <option value="custom">自定义</option>
                </select>
              </OaField>
              {llm.preset === "webllm" ? <LocalModelBox /> : (
                <>
              <OaField label="Base URL">
                <input
                  className="oa-input"
                  value={llm.baseUrl}
                  onChange={(e) => {
                    setModelList({ running: false, ids: [] });
                    setLlm((c) => ({ ...c, baseUrl: e.target.value, preset: "custom" }));
                  }}
                />
              </OaField>
              <OaField label="Model">
                {modelList.ids.length > 0 ? (
                  <select
                    className="oa-input"
                    value={llm.model}
                    onChange={(e) => setLlm((c) => ({ ...c, model: e.target.value }))}
                  >
                    {modelList.ids.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      className="oa-input"
                      value={llm.model}
                      onChange={(e) => setLlm((c) => ({ ...c, model: e.target.value }))}
                      placeholder={llm.preset === "ollama-cloud" ? "如 llama3.3, qwen2.5, deepseek-r1" : undefined}
                    />
                    {llm.preset === "ollama-cloud" && (
                      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: "0.78rem", opacity: 0.7 }}>推荐模型：</span>
                        {["llama3.3", "qwen2.5", "deepseek-r1", "qwen2.5-coder"].map((m) => (
                          <button
                            key={m}
                            type="button"
                            className="oa-btn oa-btn-ghost"
                            style={{
                              fontSize: "0.78rem",
                              padding: "2px 8px",
                              lineHeight: "1.3",
                              borderRadius: "4px",
                              border: llm.model === m ? "1px solid #6366f1" : "1px solid var(--oa-border, #d1d5db)",
                              background: llm.model === m ? "#e0e7ff" : "transparent",
                              color: llm.model === m ? "#3730a3" : "inherit",
                              cursor: "pointer",
                            }}
                            onClick={() => setLlm((c) => ({ ...c, model: m }))}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </OaField>
              <OaField label="API Key">
                <input
                  className="oa-input"
                  type="password"
                  value={llm.apiKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    if (llm.preset === "ollama" && key.trim().length > 6) {
                      setLlm((c) => ({
                        ...c,
                        apiKey: key,
                        preset: "ollama-cloud",
                        baseUrl: "https://ollama.com/v1",
                        model: c.model === "qwen2.5:7b" ? "llama3.3" : c.model,
                      }));
                    } else {
                      setLlm((c) => ({ ...c, apiKey: key }));
                    }
                  }}
                  placeholder="sk-… 或 ollama.com API Key"
                />
              </OaField>
              <p className="oa-toolbar-lead">
                Key 由你自己填写。测试连接和对话都用这一把 Key 去叫你的模型，平台没有另一把代连的 Key。线上每位客户同样自己填。
              </p>
              <OaBtn
                variant="ghost"
                onClick={() => {
                  clearStoredLlmKey();
                  setLlm((c) => ({ ...c, apiKey: "", enabled: false }));
                  setProbe({ running: false });
                }}
              >
                清除此设备上的 Key
              </OaBtn>
              {llm.preset !== "custom" && LLM_PRESETS[llm.preset as Exclude<LlmPresetId, "custom">] && (
                <p className="oa-toolbar-lead">
                  {LLM_PRESETS[llm.preset as Exclude<LlmPresetId, "custom">].hint}
                </p>
              )}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <OaBtn
                  variant="ghost"
                  onClick={() => void runModelList()}
                  disabled={modelList.running || (llm.preset !== "ollama" && !llm.apiKey.trim())}
                >
                  {modelList.running ? "拉取中…" : "拉取模型"}
                </OaBtn>
                <OaBtn onClick={() => void runProbe()} disabled={probe.running || !llmReady}>
                  {probe.running ? "测试中…" : "测试连接"}
                </OaBtn>
                <OaBadge tone={isLlmProbeLive(llm) ? "ok" : undefined}>
                  {isLlmProbeLive(llm) ? `已连接 ${llm.model}` : "未连接"}
                </OaBadge>
                {modelList.detail ? <OaBadge tone={modelList.ids.length ? undefined : "danger"}>{modelList.detail}</OaBadge> : null}
                {probe.detail && (
                  <OaBadge tone={probe.ok ? "ok" : "danger"}>{probe.detail}</OaBadge>
                )}
              </div>
                </>
              )}
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

          <ExternalToolBox />
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
