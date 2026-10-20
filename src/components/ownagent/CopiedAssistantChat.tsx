import "./openuiDevtoolsOff";
import { useMemo, useState } from "react";
import {
  AuiConfig,
  AuiProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  Tools,
  WebSpeechDictationAdapter,
  WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { AISDKThreads, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { createOpenUIToolkit, OpenUIInstructions } from "@openuidev/assistant-ui";
import { shouldContinueAfterOpenUIPrompt } from "@openuidev/assistant-ui/ai-sdk";
import { CopiedThread, CopiedThreadList } from "./CopiedThread";
import { apiUrl, getApiBase } from "../../lib/apiClient";
import {
  LLM_PRESETS,
  isLlmConfigured,
  loadLlmConfig,
  probeLlmConnection,
  saveLlmConfig,
  saveLlmProbe,
  type LlmConfig,
  type LlmPresetId,
} from "../../lib/llmConfig";
import "../prompt-kit/prompt-kit.css";
import "./copied-chat.css";

const PRESET_IDS = Object.keys(LLM_PRESETS) as Array<Exclude<LlmPresetId, "custom">>;

const openuiToolkit = createOpenUIToolkit({
  theme: { mode: "light", cssSelector: ".copied-chat" },
  ErrorFallback: OpenUiError,
});

function OpenUiError() {
  return (
    <p className="copied-status warn" role="alert">
      这张界面没画出来。
    </p>
  );
}

function canForward(config: LlmConfig): boolean {
  return isLlmConfigured(config) && config.baseUrl.trim().startsWith("https://") && Boolean(config.apiKey.trim());
}

export function CopiedAssistantChat() {
  const [config, setConfig] = useState<LlmConfig>(() => loadLlmConfig());
  const [editing, setEditing] = useState(() => !canForward(loadLlmConfig()));
  const [probe, setProbe] = useState<{ running: boolean; detail?: string; ok?: boolean }>({ running: false });
  const hostedWithoutApi = !import.meta.env.DEV && !getApiBase();
  const ready = canForward(config) && !editing;

  const adapters = useMemo(
    () => ({
      attachments: new CompositeAttachmentAdapter([new SimpleImageAttachmentAdapter(), new SimpleTextAttachmentAdapter()]),
      dictation: new WebSpeechDictationAdapter({ language: "zh-CN" }),
      speech: new WebSpeechSynthesisAdapter(),
    }),
    [],
  );
  const threads = useMemo(
    () =>
      AuiConfig({
        threads: AISDKThreads({
          transport: () =>
            new AssistantChatTransport({
              api: apiUrl("/llm/assistant/chat"),
              body: () => {
                const current = loadLlmConfig();
                return {
                  baseUrl: current.baseUrl,
                  model: current.model,
                  apiKey: current.apiKey,
                };
              },
            }),
          adapters,
          sendAutomaticallyWhen: shouldContinueAfterOpenUIPrompt,
        }),
        tools: Tools({ toolkit: openuiToolkit }),
      }),
    [adapters],
  );

  function pickPreset(id: LlmPresetId) {
    if (id === "custom") {
      setConfig((current) => ({ ...current, preset: "custom" }));
      return;
    }
    const preset = LLM_PRESETS[id];
    setConfig((current) => ({ ...current, preset: id, baseUrl: preset.baseUrl, model: preset.model }));
  }

  function save() {
    const next = { ...config, enabled: true };
    saveLlmConfig(next);
    setConfig(next);
    if (canForward(next)) setEditing(false);
  }

  async function testConnection() {
    const next = { ...config, enabled: true };
    setProbe({ running: true });
    const result = await probeLlmConnection(next);
    saveLlmProbe(next, result.ok);
    setProbe({ running: false, ok: result.ok, detail: result.detail });
  }

  return (
    <div className="copied-chat">
      <div>
        <h1>对话</h1>
        <p className="copied-note">填你自己的密钥就能聊。密钥留在这台浏览器里，服务只转发这一次。刷新后，这边的对话记录会清空。</p>
        {hostedWithoutApi ? (
          <p className="copied-status warn">这个网址上没有转发服务。GitHub Pages 只放页面，对话要本机服务开着，或另有一台开着的服务。</p>
        ) : null}
      </div>

      <AuiProvider config={threads}>
        <OpenUIInstructions
          additionalRules={[
            "可见文字用中文。",
            "清单、对比、步骤、表格和图表调用 present_openui 画出来。",
            "要用户选择或填写时调用 prompt_openui。",
            "数字和结论必须来自用户刚说的内容，不要编造业务数字。",
          ]}
        />
        <div className="copied-app">
          <aside className="copied-side">
            {ready ? (
              <div className="copied-bar">
                <p className="copied-status">正在用 {config.model}</p>
                <button type="button" className="copied-ghost" onClick={() => setEditing(true)}>
                  更换密钥
                </button>
              </div>
            ) : (
              <form
                className="copied-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  save();
                }}
              >
                <label>
                  模型来源
                  <select value={config.preset} onChange={(event) => pickPreset(event.target.value as LlmPresetId)}>
                    {PRESET_IDS.map((id) => (
                      <option key={id} value={id}>
                        {LLM_PRESETS[id].label}
                      </option>
                    ))}
                    <option value="custom">自定义地址</option>
                  </select>
                </label>
                <label>
                  地址
                  <input value={config.baseUrl} onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))} />
                </label>
                <label>
                  模型名
                  <input value={config.model} onChange={(event) => setConfig((current) => ({ ...current, model: event.target.value }))} />
                </label>
                <label>
                  密钥
                  <input
                    type="password"
                    autoComplete="off"
                    value={config.apiKey}
                    onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))}
                  />
                </label>
                {config.preset === "ollama" || config.preset === "webllm" ? (
                  <p className="copied-status warn">这版转发只接受公网上的 https 地址。本机 Ollama 和浏览器里的模型走不了这条。</p>
                ) : null}
                {probe.detail ? <p className={`copied-status${probe.ok ? "" : " warn"}`}>{probe.detail}</p> : null}
                <div className="copied-actions">
                  <button type="submit">保存并开始</button>
                  <button type="button" className="copied-ghost" disabled={probe.running} onClick={() => void testConnection()}>
                    {probe.running ? "正在测试" : "测试连接"}
                  </button>
                </div>
              </form>
            )}
            <CopiedThreadList />
          </aside>
          <CopiedThread canSend={ready} />
        </div>
      </AuiProvider>
    </div>
  );
}
