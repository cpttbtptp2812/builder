const fs = require('fs');

const content = `import React, { useState, useEffect } from "react";
import {
  Key,
  Database,
  Cpu,
  Sparkles,
  Network,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  Save,
  Activity,
  Layers,
} from "lucide-react";

export type NetworkTopology = "LOCAL" | "DOCKER_COMPOSE" | "DOCKER_HOST" | "REMOTE_IP";

interface NetworkTopologyOption {
  id: NetworkTopology;
  label: string;
  badge: string;
  desc: string;
  getUrl: (ip?: string) => string;
}

const NETWORK_TOPOLOGIES: NetworkTopologyOption[] = [
  {
    id: "LOCAL",
    label: "本机电脑运行 (localhost:11434)",
    badge: "物理机",
    desc: "在 Windows / Mac 本地运行，连接 127.0.0.1:11434",
    getUrl: () => "http://localhost:11434/v1",
  },
  {
    id: "DOCKER_COMPOSE",
    label: "Docker 容器集群互联 (ollama:11434)",
    badge: "容器集群",
    desc: "与 Ollama 容器在同一 Docker 网桥内，通过服务名解析",
    getUrl: () => "http://ollama:11434/v1",
  },
  {
    id: "DOCKER_HOST",
    label: "Docker 访问宿主机 (host.docker.internal)",
    badge: "宿主机访问",
    desc: "项目在容器内运行，访问宿主机上安装的 Ollama",
    getUrl: () => "http://host.docker.internal:11434/v1",
  },
  {
    id: "REMOTE_IP",
    label: "远程 GPU 独立服务器 / 局域网 IP",
    badge: "远程 IP",
    desc: "连接指定 IP 的独立 Linux/GPU 服务器节点",
    getUrl: (ip) => \`http://\${ip || "192.168.1.100"}:11434/v1\`,
  },
];

interface ProviderPreset {
  id: string;
  name: string;
  badge: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  keyPlaceholder: string;
  keyGuideUrl?: string;
  keyGuideText: string;
  description: string;
  isLocal?: boolean;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek (官方直连) · 推荐",
    badge: "国内官方 · 填 Key 即用",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyPlaceholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideUrl: "https://platform.deepseek.com/api_keys",
    keyGuideText: "在 DeepSeek 开放平台创建 API Key",
    description: "国内顶级大模型，性价比极高，支持 V3 极速推理与 R1 深度思考",
  },
  {
    id: "siliconflow",
    name: "SiliconFlow (硅基流动)",
    badge: "国产云算力 · 注册即用",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    models: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen2.5-72B-Instruct",
      "Qwen/Qwen2.5-Coder-32B-Instruct",
    ],
    keyPlaceholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideUrl: "https://cloud.siliconflow.cn/account/ak",
    keyGuideText: "在硅基流动控制台获取 API Key (送免费额度)",
    description: "国内高可用云算力中转，免本地显卡直接体验 DeepSeek 全规格模型",
  },
  {
    id: "openai",
    name: "OpenAI (官方 / 代理)",
    badge: "国际标准 · GPT-4o / o3",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1"],
    keyPlaceholder: "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideUrl: "https://platform.openai.com/api-keys",
    keyGuideText: "在 OpenAI 开发者控制台获取",
    description: "OpenAI 官方 API 或企业中转网关端点，支持全系列前沿多模态大模型",
  },
  {
    id: "ollama",
    name: "Ollama (本地私有 / Docker)",
    badge: "本地离线 · 免 API Key",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "deepseek-r1:8b",
    models: [
      "deepseek-r1:8b",
      "deepseek-r1:70b",
      "qwen2.5:72b",
      "qwen2.5:14b",
      "qwen2.5:7b",
      "llama3.3",
      "mistral",
    ],
    keyPlaceholder: "本地部署免密，填 ollama 即可",
    keyGuideText: "需要本机安装 Ollama 软件并执行 ollama serve",
    description: "完全本地离线运行开源模型，数据绝不出内网，适合具备本地 GPU 的环境",
    isLocal: true,
  },
  {
    id: "dashscope",
    name: "DashScope (阿里云百炼)",
    badge: "通义千问系列",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    keyPlaceholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideUrl: "https://bailian.console.aliyun.com/",
    keyGuideText: "在阿里云百炼大模型控制台获取",
    description: "阿里通义千问 OpenAI 兼容端点，企业级高可用与中文理解强",
  },
  {
    id: "moonshot",
    name: "Moonshot (月之暗面 Kimi)",
    badge: "超长文本推理",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    keyPlaceholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideUrl: "https://platform.moonshot.cn/console/api-keys",
    keyGuideText: "在月之暗面平台获取",
    description: "Kimi 官方开放平台，擅长长篇业务资料研读、总结与长上下文问答",
  },
  {
    id: "custom",
    name: "自定义端点 (第三方中转 / 私有网关)",
    badge: "任何 OpenAI 兼容接口",
    baseUrl: "https://api.your-relay.com/v1",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "deepseek-chat", "claude-3-5-sonnet-20241022"],
    keyPlaceholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideText: "支持第三方聚合平台、OneAPI 或企业自建反向代理",
    description: "支持任意标准的 OpenAI 兼容 Base URL 与自定义 API Key",
  },
];

export default function SettingsPage() {
  const [selectedProviderId, setSelectedProviderId] = useState<string>("deepseek");
  const [networkMode, setNetworkMode] = useState<NetworkTopology>("LOCAL");
  const [remoteServerIp, setRemoteServerIp] = useState<string>("192.168.1.100");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [modelName, setModelName] = useState("deepseek-chat");
  const [embeddingModel, setEmbeddingModel] = useState("nomic-embed-text");
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState("");
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; msg?: string; latencyMs?: number } | null>(null);
  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [dbStatus, setDbStatus] = useState("正在检测系统连接...");

  useEffect(() => {
    fetch("/api/settings/config")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: any) => {
        if (data.LLM_API_KEY) setApiKey(data.LLM_API_KEY);
        if (data.LLM_NETWORK_MODE) setNetworkMode(data.LLM_NETWORK_MODE as NetworkTopology);
        if (data.LLM_REMOTE_IP) setRemoteServerIp(data.LLM_REMOTE_IP);
        if (data.EMBEDDING_MODEL) setEmbeddingModel(data.EMBEDDING_MODEL);
        if (data.EMBEDDING_BASE_URL) setEmbeddingBaseUrl(data.EMBEDDING_BASE_URL);
        if (data.EMBEDDING_API_KEY) setEmbeddingApiKey(data.EMBEDDING_API_KEY);
        if (data.LLM_BASE_URL) {
          setBaseUrl(data.LLM_BASE_URL);
          const matched = PROVIDER_PRESETS.find(
            (p) =>
              data.LLM_BASE_URL.toLowerCase().includes(p.id) ||
              p.baseUrl.toLowerCase() === data.LLM_BASE_URL.toLowerCase()
          );
          if (matched) {
            setSelectedProviderId(matched.id);
          } else {
            setSelectedProviderId("custom");
          }
        }
        if (data.LLM_MODEL) setModelName(data.LLM_MODEL);
      })
      .catch(() => {});

    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setDbStatus(\`已连接 🟢 (服务: \${data.service} · 运行时: \${data.runtime} · 存储: \${data.db})\`);
        } else {
          setDbStatus("未连接 🔴 (后端服务离线)");
        }
      })
      .catch(() => {
        setDbStatus("未连接 🔴 (后端服务离线)");
      });
  }, []);

  const handleSelectProvider = (preset: ProviderPreset) => {
    setSelectedProviderId(preset.id);
    setModelName(preset.defaultModel);
    if (preset.isLocal) {
      const topo = NETWORK_TOPOLOGIES.find((t) => t.id === networkMode) || NETWORK_TOPOLOGIES[0];
      setBaseUrl(topo.getUrl(remoteServerIp));
      if (!apiKey || apiKey.trim() === "") setApiKey("ollama");
    } else {
      setBaseUrl(preset.baseUrl);
      if (apiKey === "ollama") setApiKey("");
    }
    setTestResult(null);
  };

  const handleSelectNetworkMode = (mode: NetworkTopology) => {
    setNetworkMode(mode);
    const topo = NETWORK_TOPOLOGIES.find((t) => t.id === mode);
    if (topo) {
      setBaseUrl(topo.getUrl(remoteServerIp));
    }
  };

  const handleRemoteIpChange = (newIp: string) => {
    setRemoteServerIp(newIp);
    if (networkMode === "REMOTE_IP") {
      setBaseUrl(\`http://\${newIp || "192.168.1.100"}:11434/v1\`);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch("/api/settings/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          LLM_API_KEY: apiKey,
          LLM_BASE_URL: baseUrl,
          LLM_MODEL: modelName,
          LLM_NETWORK_MODE: networkMode,
          LLM_REMOTE_IP: remoteServerIp,
          EMBEDDING_MODEL: embeddingModel,
          EMBEDDING_BASE_URL: embeddingBaseUrl,
          EMBEDDING_API_KEY: embeddingApiKey,
        }),
      });
      if (res.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      }
    } catch (err) {
      console.error("Save config error", err);
    }
  };

  const handleTestLlm = async () => {
    setIsTestingLlm(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          model: modelName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      } else {
        setTestResult({ ok: false, msg: \`测试接口 HTTP \${res.status} 异常\` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: \`请求失败: \${e.message || "网络异常"}\` });
    } finally {
      setIsTestingLlm(false);
    }
  };

  const activePreset = PROVIDER_PRESETS.find((p) => p.id === selectedProviderId);

  return (
    <div className="flex-1 overflow-y-auto p-8 relative scrollbar-hide">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页头说明 */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              Model Hub & Providers
            </span>
            <span className="text-xs text-slate-400">· 多模型供应商与凭证中枢</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">模型与环境配置</h1>
          <p className="text-xs text-slate-500 mt-1">
            选择您使用的大模型服务商，输入 API Key 即可一键生效，支持 DeepSeek、硅基流动、OpenAI 及本地 Ollama。
          </p>
        </div>

        {/* 极速 3 步使用指引卡片 (清晰明了，任何人一目了然) */}
        <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 p-4 rounded-2xl border border-blue-200/80 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900">3 步配置即可开始对话</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">
                ① 在下方点击您拥有的服务商（如 DeepSeek 官方直连） ➔ ② 填入 API Key ➔ ③ 点击【保存配置】即可在对话中使用！
              </p>
            </div>
          </div>
          <div className="text-[11px] text-blue-700 bg-white px-3 py-1.5 rounded-xl border border-blue-200 font-bold shrink-0 shadow-2xs">
            ⚡ 填 Key 即用
          </div>
        </div>

        {/* 1. 供应商选择网格 */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>选择大模型提供商 (点击一键填充端点与模型)</span>
            </div>
            <span className="text-[11px] text-slate-400">遵循 OpenAI 标准兼容协议</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {PROVIDER_PRESETS.map((preset) => {
              const isSelected = selectedProviderId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectProvider(preset)}
                  className={\`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between \${
                    isSelected
                      ? "bg-blue-50/90 border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20"
                      : "bg-slate-50/70 border-slate-200/70 hover:bg-white hover:border-slate-300"
                  }\`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900">{preset.name}</h3>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-semibold text-blue-600 mt-1">
                      {preset.badge}
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. 凭证与端点配置卡片 */}
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900">
              <Key className="w-4 h-4 text-blue-600" />
              <span>当前配置: {activePreset?.name || "自定义端点"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestLlm}
                disabled={isTestingLlm}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5"
              >
                <Activity className={\`w-3.5 h-3.5 \${isTestingLlm ? "animate-spin text-blue-600" : "text-slate-500"}\`} />
                <span>{isTestingLlm ? "正在连接测试..." : "一键测试大模型连接"}</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaved ? "已保存 ✓" : "保存配置并生效"}</span>
              </button>
            </div>
          </div>

          {/* 实时连接测试结果反馈 */}
          {testResult && (
            <div
              className={\`p-3 rounded-xl border flex items-start gap-2.5 text-xs \${
                testResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }\`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">{testResult.ok ? "测试通过" : "连接失败"}</div>
                <div className="text-[11px] mt-0.5">{testResult.msg}</div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Ollama 部署环境轻量选择 (仅当选择 Ollama 时展示) */}
            {activePreset?.isLocal && (
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Network className="w-4 h-4 text-blue-600" />
                    <span>Ollama 服务部署环境 (选择后自动计算端点)</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    若在本机运行请先确保终端已启动 <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-700">ollama serve</code>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {NETWORK_TOPOLOGIES.map((topo) => {
                    const isCurrent = networkMode === topo.id;
                    return (
                      <div
                        key={topo.id}
                        onClick={() => handleSelectNetworkMode(topo.id)}
                        className={\`p-3 rounded-xl border transition-all cursor-pointer \${
                          isCurrent
                            ? "bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/30"
                            : "bg-white/60 border-slate-200/70 hover:bg-white hover:border-slate-300"
                        }\`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-slate-900">{topo.label}</span>
                          <span className={\`text-[10px] px-1.5 py-0.2 rounded font-semibold \${
                            isCurrent ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                          }\`}>
                            {topo.badge}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-400">{topo.desc}</p>
                      </div>
                    );
                  })}
                </div>
                {networkMode === "REMOTE_IP" && (
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">服务器 IP 地址:</span>
                    <input
                      type="text"
                      placeholder="例如: 192.168.1.100 或 10.0.0.5"
                      value={remoteServerIp}
                      onChange={(e) => handleRemoteIpChange(e.target.value)}
                      className="flex-1 text-xs font-mono bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                )}
              </div>
            )}

            {/* API Key 输入框 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-800 font-bold">
                  API Key (大模型密钥凭证)
                </label>
                {activePreset?.keyGuideUrl && (
                  <a
                    href={activePreset.keyGuideUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                  >
                    <span>{activePreset.keyGuideText}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                type="password"
                placeholder={activePreset?.keyPlaceholder || "在此填入您的 API Key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 outline-none focus:bg-white focus:border-blue-500 font-medium"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {activePreset?.isLocal
                  ? "💡 本地私有 Ollama 免密运行，填入 'ollama' 即可；若选择云端服务商请填入对应的真实 API Key"
                  : "填入后点击右上方【保存配置并生效】，智能体对话将立即直连该大模型"}
              </span>
            </div>

            {/* Base URL 和 Model Name 网格 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">
                  Base URL (接口端点地址)
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 outline-none focus:bg-white focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">
                  Model Name (大模型名称)
                </label>
                <div className="flex gap-2">
                  {activePreset && activePreset.models.length > 0 && (
                    <select
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="text-xs font-mono bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2.5 outline-none focus:bg-white focus:border-blue-500 font-medium"
                    >
                      {activePreset.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="模型名"
                    className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 outline-none focus:bg-white focus:border-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* 3. 知识库向量模型解耦配置 */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div>
                <label className="text-xs text-slate-700 font-semibold flex items-center justify-between mb-1">
                  <span>Embedding Model (知识库向量嵌入模型)</span>
                  <span className="text-[10px] text-blue-600 font-normal">支持真实语义空间 (Dense Neural Embedding)</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    className="text-xs font-mono bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2.5 outline-none focus:bg-white focus:border-blue-500 font-medium"
                  >
                    <option value="nomic-embed-text">nomic-embed-text (Ollama 768维 · 本地语义)</option>
                    <option value="bge-m3">bge-m3 (BAAI 1024维 · 多语言语义)</option>
                    <option value="text-embedding-3-small">text-embedding-3-small (OpenAI 1536维)</option>
                    <option value="text-embedding-3-large">text-embedding-3-large (OpenAI 3072维)</option>
                    <option value="local-fnv-token-hash">local-fnv-token-hash (离线 256维词元哈希)</option>
                  </select>
                  <input
                    type="text"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder="输入向量模型名称"
                    className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 outline-none focus:bg-white focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-700 font-semibold block mb-1">
                    Embedding Base URL (向量专用端点)
                  </label>
                  <input
                    type="text"
                    value={embeddingBaseUrl}
                    onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
                    placeholder="留空自动回退至本地 Ollama (11434)"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2 outline-none focus:bg-white focus:border-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-700 font-semibold block mb-1">
                    Embedding API Key (向量专用密钥)
                  </label>
                  <input
                    type="password"
                    value={embeddingApiKey}
                    onChange={(e) => setEmbeddingApiKey(e.target.value)}
                    placeholder="Ollama 填 ollama / 云端填专用 key"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2 outline-none focus:bg-white focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 text-[11px] text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>💡 核心机制：聊天与向量端点解耦保护</span>
                </div>
                <div>
                  DeepSeek 官方未开放 <code className="font-mono bg-amber-100/80 px-1 rounded">/v1/embeddings</code> 接口。当聊天选择 DeepSeek 时，系统会自动将向量请求路由至本地 Ollama 或上方配置的向量专用端点（如硅基流动 SiliconFlow 免费 BGE-M3），彻底杜绝 404 导致向量退化。同时对已入库的神经向量执行只读防污染保护，避免被离线哈希覆盖。
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 基础设施连接状态 */}
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-[2rem] border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-slate-700">
            <Database className="w-4 h-4 text-emerald-600" />
            <span className="font-bold">平台服务健康度:</span>
            <span className="font-mono">{dbStatus}</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-sm transition"
          >
            {isSaved ? "已保存生效 ✓" : "保存所有配置"}
          </button>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('e:/owner/builder/src/pages/settings/SettingsPage.tsx', content, 'utf8');
console.log('Successfully wrote user-friendly SettingsPage.tsx');
