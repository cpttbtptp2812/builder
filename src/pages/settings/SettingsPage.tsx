import React, { useState, useEffect } from "react";
import {
  Key,
  Globe,
  Cpu,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Save,
  Activity,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  fetchFailoverStatusApi,
  toggleFailoverTimeoutApi,
  resetFailoverApi,
  FailoverStatusResponse,
} from "@/services/api";
import { useToast } from "@/context/ToastContext";

interface QuickPreset {
  id: string;
  name: string;
  badge: string;
  baseUrl: string;
  defaultModel: string;
  placeholder: string;
  recommendedModels: string[];
  docLink?: string;
  docText?: string;
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "tongyi",
    name: "通义千问 (百炼/DashScope)",
    badge: "阿里云官方",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (百炼/DashScope API Key)",
    recommendedModels: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen2.5-72b-instruct", "deepseek-v3", "deepseek-r1"],
    docLink: "https://bailian.console.aliyun.com/",
    docText: "进入阿里云百炼控制台",
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud",
    badge: "云端算力",
    baseUrl: "https://ollama.com/v1",
    defaultModel: "gemma4:31b-cloud",
    placeholder: "粘贴 https://ollama.com/dashboard 复制的 API Key",
    recommendedModels: ["gemma4:31b-cloud", "deepseek-v4.1-flash", "kimi-k3", "glm-5.3-flash"],
    docLink: "https://ollama.com/settings/keys",
    docText: "前往 ollama.com 获取 Key",
  },
  {
    id: "deepseek",
    name: "DeepSeek 官方",
    badge: "官方直连",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (DeepSeek Key)",
    recommendedModels: ["deepseek-chat", "deepseek-reasoner"],
    docLink: "https://platform.deepseek.com/api_keys",
    docText: "前往 DeepSeek 开放平台",
  },
  {
    id: "siliconflow",
    name: "硅基流动 (SiliconFlow)",
    badge: "极速算力",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx (硅基流动 Key)",
    recommendedModels: ["deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1", "Qwen/Qwen2.5-72B-Instruct"],
    docLink: "https://cloud.siliconflow.cn/account/ak",
    docText: "前往硅基流动控制台",
  },
  {
    id: "openai",
    name: "OpenAI 官方",
    badge: "国际标准",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    placeholder: "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx",
    recommendedModels: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
    docLink: "https://platform.openai.com/api-keys",
    docText: "前往 OpenAI 开发者后台",
  },
  {
    id: "ollama-local",
    name: "本地 Ollama",
    badge: "11434 端口",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "deepseek-r1:8b",
    placeholder: "本地 Ollama 无需 Key (可留空或填 ollama)",
    recommendedModels: ["deepseek-r1:8b", "llama3.1:8b", "qwen2.5:7b"],
    docText: "本地运行 ollama 守护进程",
  },
];

export default function SettingsPage() {
  const toast = useToast();
  const [baseUrl, setBaseUrl] = useState("https://dashscope.aliyuncs.com/compatible-mode/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("qwen-plus");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-v3");

  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok?: boolean;
    msg?: string;
    status?: number;
    latencyMs?: number;
    detail?: string;
  } | null>(null);

  // 动态模型列表状态
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [serviceStatus, setServiceStatus] = useState("正在检测后端连接... 🟡");

  // Failover 网关与演练状态
  const [failoverInfo, setFailoverInfo] = useState<FailoverStatusResponse | null>(null);
  const [isTogglingTimeout, setIsTogglingTimeout] = useState(false);

  const loadFailoverStatus = () => {
    fetchFailoverStatusApi()
      .then(setFailoverInfo)
      .catch(() => {});
  };

  const handleToggleFailoverTimeout = async () => {
    setIsTogglingTimeout(true);
    try {
      const res = await toggleFailoverTimeoutApi();
      setFailoverInfo(res);
      toast.success(res.isTimeoutSimulated ? "已开启上游超时熔断注入" : "已恢复正常网络状态", "容灾切换");
    } catch (e: any) {
      toast.error(e.message || "切换失败", "容灾设置异常");
    } finally {
      setIsTogglingTimeout(false);
    }
  };

  const handleResetFailover = async () => {
    try {
      const res = await resetFailoverApi();
      setFailoverInfo(res);
      toast.success("已重置容灾状态至主通道模式", "重置成功");
    } catch (e: any) {
      toast.error(e.message || "重置失败", "重置异常");
    }
  };

  // 初始化加载当前系统配置
  useEffect(() => {
    loadFailoverStatus();
    fetch("/api/settings/config")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: any) => {
        if (data.LLM_BASE_URL) setBaseUrl(data.LLM_BASE_URL);
        if (data.LLM_API_KEY && data.LLM_API_KEY !== "ollama") setApiKey(data.LLM_API_KEY);
        if (data.LLM_MODEL) setModelName(data.LLM_MODEL);
        if (data.EMBEDDING_MODEL) setEmbeddingModel(data.EMBEDDING_MODEL);
      })
      .catch(() => {});

    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.status === "UP" || data.ok === true || data.status === "ok")) {
          setServiceStatus(`后端服务已连接 🟢 (Spring Boot 3 · Java 21)`);
        } else {
          setServiceStatus("后端服务离线 🔴");
        }
      })
      .catch(() => setServiceStatus("后端服务离线 🔴"));
  }, []);

  // 快捷套用预设模板
  const applyPreset = (preset: QuickPreset) => {
    setBaseUrl(preset.baseUrl);
    setModelName(preset.defaultModel);
    setFetchedModels([]);
    setFetchMsg(null);
    if (preset.id === "tongyi") {
      setEmbeddingModel("text-embedding-v3");
    } else if (preset.id === "openai") {
      setEmbeddingModel("text-embedding-3-small");
    } else {
      setEmbeddingModel("nomic-embed-text");
    }
    setTestResult(null);
  };

  // 动态向服务商拉取最新模型列表
  const handleFetchModels = async () => {
    if (!baseUrl || baseUrl.trim() === "") {
      setFetchMsg({ ok: false, text: "请先填写 Base URL" });
      return;
    }

    setIsFetchingModels(true);
    setFetchMsg(null);

    try {
      const res = await fetch("/api/settings/fetch-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`后端接口返回 HTTP ${res.status}，未响应合法 JSON，请稍候重试`);
      }

      if (res.ok && data.ok && Array.isArray(data.models) && data.models.length > 0) {
        setFetchedModels(data.models);
        setFetchMsg({ ok: true, text: `已从官网拉取到 ${data.models.length} 个最新可用模型！` });
        // 如果当前模型不在拉取的列表里，自动选中第一个
        if (!data.models.includes(modelName)) {
          setModelName(data.models[0]);
        }
      } else {
        setFetchMsg({
          ok: false,
          text: data.msg || `未能拉取到模型列表 (HTTP ${res.status})，请核对 Base URL 与 API Key`,
        });
      }
    } catch (e: any) {
      setFetchMsg({ ok: false, text: `拉取失败: ${e.message}` });
    } finally {
      setIsFetchingModels(false);
    }
  };

  // 一键测试并保存
  const handleSaveAndTest = async () => {
    if (!baseUrl || baseUrl.trim() === "") {
      setTestResult({ ok: false, msg: "请填写 API 接口地址 (Base URL)" });
      return;
    }
    if (!modelName || modelName.trim() === "") {
      setTestResult({ ok: false, msg: "请选择或填写模型名称 (Model)" });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    const cleanApiKey = apiKey.trim();
    const cleanModel = modelName.trim();

    try {
      // 1. 先进行真实连通性测试 (支持透传服务商所有真实报错)
      const testRes = await fetch("/api/settings/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: cleanBaseUrl,
          apiKey: cleanApiKey,
          model: cleanModel,
        }),
      });

      let resData: any = {};
      if (testRes.ok) {
        resData = await testRes.json();
      } else {
        resData = {
          ok: false,
          status: testRes.status,
          msg: `后端接口返回 HTTP ${testRes.status}，请核对服务状态`,
        };
      }

      setTestResult(resData);

      // 2. 无论是否连通，只要用户点击保存，都持久化写入数据库
      const saveRes = await fetch("/api/settings/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          LLM_BASE_URL: cleanBaseUrl,
          LLM_API_KEY: cleanApiKey,
          LLM_MODEL: cleanModel,
          EMBEDDING_MODEL: embeddingModel.trim(),
        }),
      });

      if (saveRes.ok) {
        setIsSaved(true);
        const probeDetail = {
          connected: resData.ok === true,
          provider: cleanBaseUrl.includes("11434")
            ? "本地 Ollama"
            : cleanBaseUrl.includes("dashscope") || cleanBaseUrl.includes("aliyun")
            ? "通义千问"
            : "云端大模型",
          model: cleanModel,
          baseUrl: cleanBaseUrl,
          latencyMs: resData.latencyMs || 0,
          status: resData.ok ? "CONNECTED" : "FAILED",
          message: resData.msg || (resData.ok ? "模型服务连接正常" : "连接失败"),
        };
        window.dispatchEvent(new CustomEvent("system-config-updated", { detail: probeDetail }));
        setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        msg: `本地网络请求异常: ${e.message || "无法连通本地后端"}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 查找当前预设信息（若匹配）
  const matchedPreset = QUICK_PRESETS.find(
    (p) => baseUrl.toLowerCase().includes(p.id) || baseUrl === p.baseUrl
  );

  // 合并模型候选池：官网动态拉取的 + 厂商推荐预设
  const availableOptions = Array.from(
    new Set([...(fetchedModels.length > 0 ? fetchedModels : []), ...(matchedPreset?.recommendedModels || [])])
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-10 relative scrollbar-hide flex items-start justify-center">
      <div className="w-full max-w-3xl space-y-6">
        {/* 顶部标题区 */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">大模型服务接入配置</h1>
              <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                标准 OpenAI 兼容协议
              </span>
            </div>
            <p className="text-xs text-slate-500">
              支持任意服务商：粘贴 Key 后可一键从官方拉取最新模型下拉列表，省去手输繁琐，杜绝拼写错误。
            </p>
          </div>
          <div className="text-right text-xs font-mono text-slate-400 hidden sm:block">
            {serviceStatus}
          </div>
        </div>

        {/* 快捷模板预选栏 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>快速套用主流厂商地址模板 (点击即可自动填入地址):</span>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {QUICK_PRESETS.map((preset) => {
              const isCurrent = baseUrl === preset.baseUrl;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    isCurrent
                      ? "bg-blue-50/90 border-blue-400 text-blue-900 shadow-xs"
                      : "bg-white border-slate-200/80 hover:border-slate-300 text-slate-700 hover:bg-slate-50/80"
                  }`}
                >
                  <div className="text-xs font-bold truncate">{preset.name.split(" ")[0]}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{preset.badge}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 核心配置表单卡片 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* 1. Base URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>API 接口地址 (Base URL)</span>
                <span className="text-rose-500">*</span>
              </label>
              {matchedPreset?.docLink && (
                <a
                  href={matchedPreset.docLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <span>{matchedPreset.docText || "打开控制台"}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1 或 https://api.openai.com/v1"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              必须支持 OpenAI 兼容格式，通常以 <code className="text-slate-600 font-semibold">/v1</code> 结尾。
              阿里百炼请填: <code className="text-blue-600 font-mono">https://dashscope.aliyuncs.com/compatible-mode/v1</code>
            </p>
          </div>

          {/* 2. API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-600" />
                <span>API 密钥 (API Key)</span>
                <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showKey ? "隐藏密钥" : "显示明文"}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={matchedPreset ? matchedPreset.placeholder : "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              密钥仅安全保存在您的本地后端数据库中，浏览器不直连第三方服务，杜绝泄露与盗刷。
            </p>
          </div>

          {/* 3. 模型选择 (支持下拉选择 + 一键拉取官网最新模型 + 自由手输) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>模型名称 (Model)</span>
                <span className="text-rose-500">*</span>
              </label>
              {/* 一键从官网拉取最新模型按钮 */}
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels}
                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="向该 Base URL 发送 /models 请求，实时拉取服务商支持的所有最新模型"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? "animate-spin" : ""}`} />
                <span>{isFetchingModels ? "正在拉取官网模型..." : "从服务商拉取最新模型"}</span>
              </button>
            </div>

            {/* 下拉选择器与输入框组合 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* 下拉列表选择 */}
              <div className="relative">
                <select
                  value={availableOptions.includes(modelName) ? modelName : ""}
                  onChange={(e) => {
                    if (e.target.value) setModelName(e.target.value);
                  }}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition appearance-none cursor-pointer pr-9 font-semibold text-slate-800"
                >
                  <option value="" disabled>
                    {availableOptions.length > 0 ? "👇 点击下拉选择可用模型" : "暂无模型，可点击右上角拉取"}
                  </option>
                  {availableOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} {fetchedModels.includes(opt) ? "(官网实时)" : "(推荐)"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 手动微调输入框 */}
              <div className="relative">
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="或直接手输自定义模型"
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition"
                />
              </div>
            </div>

            {/* 拉取反馈提示 */}
            {fetchMsg && (
              <div
                className={`text-[11px] font-bold mt-1 px-2.5 py-1 rounded-lg border ${
                  fetchMsg.ok
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {fetchMsg.text}
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              您可以直接在左侧下拉菜单中选择，也可以点击右上角<strong>「从服务商拉取最新模型」</strong>自动拉取全量官方模型。
            </p>
          </div>

          {/* 4. 知识库向量模型 (Embedding) */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>知识库向量化模型 (Embedding Model) - 可选</span>
            </label>
            <input
              type="text"
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              placeholder="text-embedding-v3 或 text-embedding-3-small 或 nomic-embed-text"
              className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:bg-white focus:border-blue-500"
            />
            <p className="text-[10.5px] text-slate-400">
              用于知识库文档上传时的语义切片向量生成。通义千问官方推荐 <code className="font-mono text-slate-600">text-embedding-v3</code>。
            </p>
          </div>

          {/* 操作按钮区 */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveAndTest}
              disabled={isTesting}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>正在向服务商发送实时验证请求...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isSaved ? "配置已保存生效 ✓" : "保存并测试连接"}</span>
                </>
              )}
            </button>
          </div>

          {/* 测试结果诊断卡片 (原样展示服务商真实返回) */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-xs transition animate-in fade-in duration-200 ${
                testResult.ok
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                  : "bg-rose-50 border-rose-300 text-rose-950"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <div className="font-black text-sm flex items-center gap-2">
                  <span>{testResult.ok ? "✅ 连通测试通过！" : "❌ 连接未通过"}</span>
                  {testResult.latencyMs && (
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-200/60 text-emerald-800 rounded font-normal">
                      响应耗时: {testResult.latencyMs}ms
                    </span>
                  )}
                  {testResult.status && !testResult.ok && (
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-rose-200/60 text-rose-800 rounded font-normal">
                      HTTP {testResult.status}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono leading-relaxed bg-white/70 p-2.5 rounded-lg border border-black/5 break-all">
                  {testResult.msg}
                </div>
                {testResult.ok && (
                  <div className="text-[11px] font-semibold text-emerald-700 pt-0.5">
                    👉 配置已成功持久化，请前往左侧导航「对话中枢」尽情对话！
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ 多模型高可用容灾与断路器网关 (Failover Control) ═══════════ */}
          <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black tracking-wide">
                  多模型高可用容灾与断路器网关 (Failover Gateway)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">断路器状态:</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                    failoverInfo?.circuitState === "CLOSED"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : failoverInfo?.circuitState === "OPEN"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      failoverInfo?.circuitState === "CLOSED"
                        ? "bg-emerald-400"
                        : failoverInfo?.circuitState === "OPEN"
                        ? "bg-rose-400"
                        : "bg-amber-400"
                    }`}
                  />
                  {failoverInfo?.circuitState || "CLOSED"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/70 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold">主通道 (Primary)</span>
                <div className="font-semibold text-slate-200">
                  {failoverInfo?.primaryChannel || "阿里云通义千问 (Qwen-Plus)"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  超时阈值: {failoverInfo?.timeoutThresholdMs || 3000}ms · 自动熔断
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/70 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold">备用通道 (Fallback)</span>
                <div className="font-semibold text-emerald-300">
                  {failoverInfo?.fallbackChannel || "本地私有化引擎 (Ollama / 备用模型)"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  故障接管延迟: &lt; 20ms · 业务零中断
                </div>
              </div>
            </div>

            {/* 演练控制与说明 */}
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>生产故障注入演练：模拟主通道 3s 超时</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  开启后向任意会话提问，主通道将模拟 3 秒超时并触发断路器，毫秒级降级至备用通道并在 Trace 中预警。
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleFailoverTimeout}
                  disabled={isTogglingTimeout}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                    failoverInfo?.simulateTimeout
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                  }`}
                >
                  {failoverInfo?.simulateTimeout ? "🔥 演练中 (点击关闭)" : "开启 3s 超时演练"}
                </button>

                {failoverInfo?.circuitState === "OPEN" && (
                  <button
                    type="button"
                    onClick={handleResetFailover}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold transition cursor-pointer"
                  >
                    重置为 CLOSED
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
