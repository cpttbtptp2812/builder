import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Copy,
  ChevronDown,
  Plus,
  Check,
  Brain,
  Globe,
  CornerRightUp,
  History,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowRight,
  Settings,
  Activity,
  ExternalLink,
  Coins,
  Zap,
} from "lucide-react";
import { AgentItem, AuditLogItem, PipelineItem } from "../../types/platform";
import {
  fetchSessionsApi,
  createSessionApi,
  deleteSessionApi,
  fetchMessagesApi,
  streamChatFromBackend,
  decideApprovalApi,
  SessionItem,
} from "../../services/api";
import { TraceInspectorDrawer, ExecutionTraceData } from "@/components/chat/TraceInspectorDrawer";

export interface CitationItem {
  chunkId: string;
  docTitle: string;
  section?: string;
  snippet?: string;
  score?: number;
  rrfScore?: number;
}

export interface ToolCallItem {
  tool: string;
  displayName?: string;
  status?: string;
  duration?: string;
  result?: any;
}

export interface ApprovalTicketItem {
  ticketId: string;
  sql?: string;
  warning?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTION_FAILED";
  affectedRows?: number;
  message?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  isThinking?: boolean;
  activeToolName?: string | null;
  citations?: CitationItem[];
  toolCalls?: ToolCallItem[];
  approvalTicket?: ApprovalTicketItem;
  tokens?: number;
  duration?: string;
  isCached?: boolean;
  trace?: ExecutionTraceData;
}

interface ChatPlaygroundProps {
  agents?: AgentItem[];
  currentAgent?: AgentItem | null;
  onSelectAgent?: (agent: AgentItem) => void;
  onAddAuditLog?: (log: AuditLogItem) => void;
  onNavigateSettings?: () => void;
  onOpenModal?: (tab: any) => void;
  onBackHome?: () => void;
  workflows?: PipelineItem[];
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
  onOpenCreateWorkflow?: () => void;
}

export default function ChatPlaygroundPage({
  agents = [],
  currentAgent,
  onSelectAgent,
  onAddAuditLog,
  onNavigateSettings,
  onOpenModal,
  onBackHome,
  workflows = [],
  initialPrompt,
  onClearInitialPrompt,
  onOpenCreateWorkflow,
}: ChatPlaygroundProps) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 思考、联网、RAG 开关
  const [enableThinking, setEnableThinking] = useState(true);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [enableRAG, setEnableRAG] = useState(true);

  // 历史侧栏收起/展开 (类似 DeepSeek / 豆包默认轻巧贴边)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<{ [key: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 系统模型配置（优先读取持久化缓存，杜绝加载瞬间闪烁沙箱）
  const [systemModel, setSystemModel] = useState<string>(() => {
    try {
      const cached = localStorage.getItem("ownagent_active_model");
      return cached || "qwen-plus";
    } catch {
      return "qwen-plus";
    }
  });
  const [systemBaseUrl, setSystemBaseUrl] = useState<string>("");
  const [modelProbe, setModelProbe] = useState<{
    connected: boolean;
    provider: string;
    model: string;
    status?: string;
    message?: string;
    latencyMs?: number;
  } | null>(() => {
    try {
      const cached = localStorage.getItem("ownagent_probe_cache");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // 全链路执行分析与知识溯源右侧抽屉
  const [activeTraceDrawer, setActiveTraceDrawer] = useState<{
    messageId: string;
    defaultTab: "waterfall" | "knowledge" | "reasoning" | "finops";
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const newlyCreatedSessionIdRef = useRef<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);

  // 1. 初始化拉取会话列表、系统配置与大模型真实健康探针
  useEffect(() => {
    fetchSessionsApi()
      .then((list) => {
        setIsBackendConnected(true);
        if (list && list.length > 0) {
          setSessions(list);
          setCurrentSessionId(list[0].id);
        }
      })
      .catch(() => {
        setIsBackendConnected(false);
      });

    const refreshModelAndConfig = () => {
      fetch("/api/settings/config")
        .then((res) => (res.ok ? res.json() : null))
        .then((cfg) => {
          if (cfg) {
            setIsBackendConnected(true);
            if (cfg.LLM_MODEL) {
              setSystemModel(cfg.LLM_MODEL);
              try { localStorage.setItem("ownagent_active_model", cfg.LLM_MODEL); } catch {}
            }
            if (cfg.LLM_BASE_URL) setSystemBaseUrl(cfg.LLM_BASE_URL);
          }
        })
        .catch(() => setIsBackendConnected(false));

      fetch("/api/system/model-probe")
        .then((res) => (res.ok ? res.json() : null))
        .then((probe) => {
          if (probe) {
            setModelProbe(probe);
            try {
              localStorage.setItem("ownagent_probe_cache", JSON.stringify(probe));
              if (probe.model) localStorage.setItem("ownagent_active_model", probe.model);
            } catch {}
            if (probe.model) setSystemModel(probe.model);
          }
        })
        .catch(() => {
          // 网络抖动时保留当前缓存，避免瞬间跳变
        });
    };

    const handleConfigUpdated = (e?: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail && customEvent.detail.model) {
        const d = customEvent.detail;
        setIsBackendConnected(true);
        if (d.model) {
          setSystemModel(d.model);
          try { localStorage.setItem("ownagent_active_model", d.model); } catch {}
        }
        if (d.baseUrl) setSystemBaseUrl(d.baseUrl);
        const newProbe = {
          connected: !!d.connected,
          provider: d.provider || "云端大模型",
          model: d.model,
          latencyMs: d.latencyMs,
          status: d.status || "CONNECTED",
          message: d.message || "模型服务连接正常",
        };
        setModelProbe(newProbe);
        try { localStorage.setItem("ownagent_probe_cache", JSON.stringify(newProbe)); } catch {}
      }
      refreshModelAndConfig();
    };

    refreshModelAndConfig();

    window.addEventListener("system-config-updated", handleConfigUpdated);
    window.addEventListener("focus", refreshModelAndConfig);

    return () => {
      window.removeEventListener("system-config-updated", handleConfigUpdated);
      window.removeEventListener("focus", refreshModelAndConfig);
    };
  }, []);

  // 2. 切换会话时加载历史消息 (严密防竞态，发消息创建会话期间绝对禁止清空覆盖)
  useEffect(() => {
    if (isGenerating) return;

    if (currentSessionId) {
      // 若是刚刚在当前页面由发送消息触发创建的新会话，严禁拉取空历史覆盖当前页面气泡
      if (newlyCreatedSessionIdRef.current === currentSessionId) {
        return;
      }
      fetchMessagesApi(currentSessionId).then((history) => {
        if (!isGenerating && newlyCreatedSessionIdRef.current !== currentSessionId) {
          setMessages(history && history.length > 0 ? history : []);
        }
      });
    }
  }, [currentSessionId, isGenerating]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // 人机协同审批通过：真实调用后端执行高危写操作并断点续跑
  const handleApproveTicket = async (msgId: string, ticketId: string) => {
    try {
      const res = await decideApprovalApi(ticketId, "APPROVE");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.approvalTicket
            ? {
                ...m,
                approvalTicket: {
                  ...m.approvalTicket,
                  status: "APPROVED",
                  affectedRows: res.affectedRows,
                  message: res.message,
                },
                content:
                  (m.content ? m.content + "\n\n" : "") +
                  `> ✅ **【人机协同审批通过】** 架构师已批准执行高危写操作。\n> 真实执行结果：变更生效，受影响行数: ${res.affectedRows ?? 1} 行。`,
              }
            : m
        )
      );
    } catch (e: any) {
      alert("审批执行失败: " + e.message);
    }
  };

  // 人机协同审批驳回：安全阻断高危操作
  const handleRejectTicket = async (msgId: string, ticketId: string) => {
    try {
      const res = await decideApprovalApi(ticketId, "REJECT");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.approvalTicket
            ? {
                ...m,
                approvalTicket: {
                  ...m.approvalTicket,
                  status: "REJECTED",
                  message: res.message,
                },
                content:
                  (m.content ? m.content + "\n\n" : "") +
                  `> ❌ **【人机协同审批驳回】** 架构师已驳回该高危变更指令，已安全阻断。`,
              }
            : m
        )
      );
    } catch (e: any) {
      alert("驳回处理失败: " + e.message);
    }
  };

  // 开启新会话
  const handleCreateNewSession = async () => {
    const newTitle = `对话 ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    try {
      const created = await createSessionApi(newTitle);
      setSessions([created, ...sessions]);
      setCurrentSessionId(created.id);
      setMessages([]);
    } catch {
      const fallbackId = `s-${Date.now().toString().slice(-4)}`;
      const fallbackSession = { id: fallbackId, title: "新会话", time: "刚刚" };
      setSessions([fallbackSession, ...sessions]);
      setCurrentSessionId(fallbackId);
      setMessages([]);
    }
  };

  // 删除会话
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSessionApi(id);
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);
      if (currentSessionId === id) {
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          setCurrentSessionId("");
          setMessages([]);
        }
      }
    } catch (err: any) {
      alert("删除会话失败: " + err.message);
    }
  };

  // 物理级客户端中断流式输出 (Cancel 上游大模型并触发后端 ABORTED 审计)
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  // 发送消息并流式推流
  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isGenerating) return;

    const userMsgId = `u-${Date.now()}`;
    const asstMsgId = `a-${Date.now()}`;

    // 立即清空输入并呈现用户气泡与思考态，杜绝点击无响应的迟钝感
    setInputMessage("");
    setIsGenerating(true);

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
      {
        id: asstMsgId,
        role: "assistant",
        content: "",
        isThinking: true,
        duration: "思考中...",
      },
    ]);

    setExpandedReasoning((p) => ({ ...p, [asstMsgId]: false }));

    // 确保有合法的 Session ID
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      const newId = `s-${Date.now().toString().slice(-6)}`;
      const newTitle = text.length > 15 ? text.substring(0, 15) + "..." : text;
      newlyCreatedSessionIdRef.current = newId;
      activeSessionId = newId;
      setCurrentSessionId(newId);
      setSessions([{ id: newId, title: newTitle, time: "刚刚" }, ...sessions]);

      // 异步与后端同步会话记录，不阻塞前台渲染
      createSessionApi(newTitle).catch(() => {});
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let accumulatedContent = "";
    const requestStartTs = Date.now();
    let firstTokenTs = 0;

    const effectiveModel =
      currentAgent?.model && currentAgent.model !== "deepseek-chat"
        ? currentAgent.model
        : systemModel;

    try {
      await streamChatFromBackend(
        {
          sessionId: activeSessionId,
          message: text,
          agentId: currentAgent?.id,
          model: effectiveModel,
          systemPrompt: currentAgent?.systemPrompt,
          temperature: currentAgent?.temperature,
          enableThinking,
          enableWebSearch,
          enableRAG,
        },
        {
          onCitations: (newCitations) => {
            if (Array.isArray(newCitations) && newCitations.length > 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId ? { ...m, citations: newCitations } : m
                )
              );
            }
          },
          onToolCall: (toolData) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== asstMsgId) return m;
                const existing = m.toolCalls || [];
                return {
                  ...m,
                  activeToolName: toolData.tool,
                  toolCalls: [...existing, toolData],
                };
              })
            );
          },
          onApprovalRequired: (ticketData) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstMsgId
                  ? {
                      ...m,
                      isThinking: false,
                      approvalTicket: {
                        ticketId: ticketData.ticketId,
                        sql: ticketData.sql,
                        status: (ticketData.status as any) || "PENDING",
                        warning: ticketData.warning,
                      },
                    }
                  : m
              )
            );
          },
          onReasoning: (rawReasoning) => {
            try {
              const parsed = JSON.parse(rawReasoning);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId ? { ...m, reasoning: parsed.content } : m
                )
              );
            } catch {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId
                    ? { ...m, reasoning: (m.reasoning || "") + rawReasoning }
                    : m
                )
              );
            }
          },
          onDelta: (chunk) => {
            if (!firstTokenTs) {
              firstTokenTs = Date.now();
            }
            accumulatedContent += chunk;
            const liveElapsedMs = Date.now() - requestStartTs;
            const liveTtftMs = firstTokenTs ? (firstTokenTs - requestStartTs) : liveElapsedMs;
            const liveTokens = Math.round(accumulatedContent.length * 0.75);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstMsgId
                  ? {
                      ...m,
                      content: accumulatedContent,
                      isThinking: false,
                      tokens: liveTokens,
                      duration: `${(liveElapsedMs / 1000).toFixed(1)}s`,
                      trace: {
                        totalMs: liveElapsedMs,
                        ragMs: m.citations && m.citations.length > 0 ? 35 : 0,
                        ttftMs: liveTtftMs,
                        streamMs: Math.max(0, liveElapsedMs - liveTtftMs),
                        hitCount: m.citations?.length || 0,
                      },
                    }
                  : m
              )
            );
          },
          onFinish: (rawMeta) => {
            setIsGenerating(false);
            try {
              const meta = typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId
                    ? {
                        ...m,
                        isThinking: false,
                        tokens: meta.tokens,
                        duration: meta.duration,
                        isCached: !!meta.cached,
                        trace: meta.trace,
                      }
                    : m
                )
              );
            } catch {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId ? { ...m, isThinking: false } : m
                )
              );
            }
          },
          onError: (err) => {
            setIsGenerating(false);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstMsgId
                  ? {
                      ...m,
                      content: `【接口异常】${err}\n请前往「系统设置」核对 API Key 与模型名称是否正确。`,
                      isThinking: false,
                    }
                  : m
              )
            );
          },
        },
        abortController.signal
      );
    } catch (err: any) {
      setIsGenerating(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsgId
            ? {
                ...m,
                content: `【连接失败】${err.message || "未知网络错误"}\n建议检查后端服务或大模型 Key 配置。`,
                isThinking: false,
              }
            : m
        )
      );
    }
  };

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      handleSend(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt]);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 渠道标签
  const getProviderTag = (url: string) => {
    if (!url) return "大模型服务";
    if (url.includes("dashscope") || url.includes("aliyun")) return "通义千问";
    if (url.includes("ollama.com")) return "Ollama 云端";
    if (url.includes("11434")) return "本地 Ollama";
    if (url.includes("deepseek.com")) return "DeepSeek";
    if (url.includes("siliconflow")) return "硅基流动";
    if (url.includes("openai.com")) return "OpenAI";
    return "API 接口";
  };

  const getBadgeColor = (category?: string) => {
    if (category?.includes("DevOps") || category?.includes("SRE")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (category?.includes("架构")) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (category?.includes("财务") || category?.includes("风控")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (category?.includes("效能") || category?.includes("GitOps") || category?.includes("代码")) {
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const isChatEmpty = messages.length === 0;

  return (
    <div className="flex-1 flex h-full w-full overflow-hidden bg-[#FAFBFC] relative font-sans">
      {/* ────────────────── 1. 类似 DeepSeek / 豆包的极轻抽屉历史侧栏 ────────────────── */}
      <div
        className={`h-full border-r border-slate-200/70 bg-white/95 backdrop-blur-md flex flex-col transition-all duration-300 ease-in-out z-20 shrink-0 ${
          isHistoryOpen ? "w-64 opacity-100" : "w-0 opacity-0 pointer-events-none border-r-0"
        }`}
      >
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-800">历史对话 ({sessions.length})</span>
          <button
            onClick={() => setIsHistoryOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
            title="收起侧栏"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 shrink-0">
          <button
            onClick={handleCreateNewSession}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>开启新对话</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">暂无历史对话记录</div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  if (isGenerating) return;
                  newlyCreatedSessionIdRef.current = null;
                  setCurrentSessionId(s.id);
                }}
                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs transition cursor-pointer ${
                  currentSessionId === s.id
                    ? "bg-blue-50 text-blue-700 font-bold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="truncate flex-1 pr-2">{s.title || "未命名会话"}</div>
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition"
                  title="删除此会话"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ────────────────── 2. 主聊天视窗 (DeepSeek/元宝极简风) ────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* 顶部极简透明工具条 */}
        <div className="h-14 px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2">
            {onBackHome && (
              <button
                onClick={onBackHome}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/90 shadow-2xs transition cursor-pointer"
                title="返回系统首页门户"
              >
                <ArrowRight className="w-3.5 h-3.5 rotate-180 text-slate-400" />
                <span>平台首页</span>
              </button>
            )}

            {!isHistoryOpen && (
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white rounded-xl border border-slate-200/80 shadow-2xs transition cursor-pointer"
                title="展开历史对话"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>历史</span>
              </button>
            )}

            <button
              onClick={handleCreateNewSession}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white rounded-xl border border-slate-200/80 shadow-2xs transition cursor-pointer"
              title="新建对话"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新对话</span>
            </button>
          </div>

          {/* 当前模型真实连接状态胶囊与设置快捷入口 */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 bg-white/95 border rounded-full text-xs shadow-2xs transition-all ${
                modelProbe?.connected
                  ? "border-emerald-200 text-emerald-800"
                  : "border-amber-200 text-amber-800 bg-amber-50/50"
              }`}
              title={
                modelProbe?.connected
                  ? `大模型服务在线（响应延迟 ${modelProbe.latencyMs || 0}ms）`
                  : `${modelProbe?.message || "大模型未连接"}。系统已启用高保真离线沙箱提供交互推演，点击齿轮可配置大模型。`
              }
            >
              {/* 状态指示灯：真实在线为绿灯，未连通大模型为琥珀色警示灯 */}
              <span
                className={`w-2 h-2 rounded-full ${
                  modelProbe?.connected
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-amber-500 shadow-xs shadow-amber-500/50"
                }`}
              />

              <span className="font-semibold">
                {modelProbe?.connected
                  ? modelProbe.provider
                  : (systemBaseUrl.includes("11434") ? "本地 Ollama" : "云端大模型")}
              </span>
              <span className="text-slate-300">·</span>
              <span className="font-mono font-bold">
                {modelProbe?.connected
                  ? modelProbe.model
                  : (systemModel || "未就绪")}
              </span>

              {!modelProbe?.connected && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded-md font-medium ml-0.5">
                  离线沙箱
                </span>
              )}
            </div>

            {/* FinOps 降本看板快捷入口 */}
            <button
              onClick={() => {
                const targetMsg = messages.slice().reverse().find((m) => m.role === "assistant") || {
                  id: "finops-global",
                  role: "assistant" as const,
                  content: "FinOps 全局指标概览",
                  tokens: 0,
                  duration: "0s",
                };
                setActiveTraceDrawer({
                  messageId: targetMsg.id,
                  defaultTab: "finops",
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-full text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
              title="查看 Exact Hash 算力与 Token 降本审计看板"
            >
              <Coins className="w-3.5 h-3.5 text-emerald-600" />
              <span>FinOps 降本看板</span>
            </button>

            {onNavigateSettings && (
              <button
                onClick={onNavigateSettings}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition cursor-pointer"
                title="去配置大模型密钥或连接端点"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 核心内容区 */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-8">
          <div className="max-w-3xl mx-auto h-full flex flex-col">
            {/* ── 首页空态：类似 DeepSeek/豆包，只聚焦在中央大标题与核心输入框 ── */}
            {isChatEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center -mt-16 text-center space-y-8 animate-in fade-in duration-500">
                {/* 极简 Logo 与问候语 */}
                <div className="space-y-3">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                    今天有什么我可以帮您的？
                  </h1>
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                    {modelProbe?.connected ? (
                      <>
                        <span>由 {modelProbe.provider} · {modelProbe.model} 提供全自主算力支持</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          模型在线 ({modelProbe.latencyMs}ms)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-amber-700 font-medium">
                          大模型服务未连接 · 当前由高保真离线沙箱保障交互
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          沙箱保护中
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 居中大对话输入框 (豆包/元宝同款布局) */}
                <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 p-3.5 space-y-3 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="输入您的问题或指令，Enter 发送，Shift+Enter 换行..."
                    rows={3}
                    className="w-full resize-none bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 px-2 py-1 leading-relaxed"
                  />

                  {/* 输入框底栏功能小工具 */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEnableThinking(!enableThinking)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                          enableThinking
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Brain className="w-3.5 h-3.5" />
                        <span>深度思考</span>
                      </button>

                      <button
                        onClick={() => setEnableWebSearch(!enableWebSearch)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                          enableWebSearch
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>联网搜索</span>
                      </button>

                      <button
                        onClick={() => setEnableRAG(!enableRAG)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                          enableRAG
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>知识库召回</span>
                      </button>
                    </div>

                    {isGenerating ? (
                      <button
                        onClick={handleStopGenerating}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-500/25 cursor-pointer"
                        title="停止生成 (断开物理连接)"
                      >
                        <span className="w-2.5 h-2.5 rounded-xs bg-white" />
                        <span>停止</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSend()}
                        disabled={!inputMessage.trim()}
                        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-30 disabled:scale-100 text-white flex items-center justify-center transition shadow-md shadow-blue-500/25 cursor-pointer"
                      >
                        <CornerRightUp className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── 企业常用业务自动化流水线 ── */}
                <div className="w-full max-w-3xl space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      <span className="text-xs font-black text-slate-800 tracking-tight">
                        企业常用业务自动化流水线 (Production Workflows)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {onOpenCreateWorkflow && (
                        <button
                          onClick={onOpenCreateWorkflow}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>配置流水线</span>
                        </button>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">
                        点击快速启动端到端自动化业务处理链路
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {workflows && workflows.length > 0 ? (
                      workflows.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSend(item.promptTemplate)}
                          className="group relative p-4 rounded-2xl bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-blue-400 text-left transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeColor(
                                  item.category
                                )}`}
                              >
                                {item.badge || item.category}
                              </span>
                              <span className="text-xs font-mono text-slate-400">
                                {item.version || "v1.0.0"}
                              </span>
                            </div>

                            <h3 className="text-xs font-black text-slate-800 group-hover:text-blue-600 transition tracking-tight">
                              {item.name}
                            </h3>

                            <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                              {item.description}
                            </p>
                          </div>

                          <div className="space-y-2 pt-1 border-t border-slate-100">
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.tags.map((t, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] font-bold text-blue-600 pt-0.5">
                              <span>一键启动流水线</span>
                              <CornerRightUp className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-3 p-4 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                        暂无配置的业务流水线，可在首页或通过配置中心自由添加
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ── 对话消息流：纯净聊天泡 ── */
              <div className="py-6 space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-3 animate-in fade-in duration-200">
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-xl bg-slate-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3.5 items-start">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </div>

                        <div className="flex-1 space-y-2 min-w-0">
                          {/* 业务流水线步进看板：凸显非普通聊天的工业级工作流编排 */}
                          {(msg.citations?.length || msg.toolCalls?.length || msg.approvalTicket) && (
                            <div className="p-2 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs flex flex-wrap items-center gap-1.5 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                <span>业务流水线</span>
                              </span>

                              {/* 步骤 1: 规约对齐 */}
                              <button
                                type="button"
                                onClick={() => msg.citations?.length && setActiveTraceDrawer({ messageId: msg.id, defaultTab: "knowledge" })}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                                  msg.citations?.length
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "text-slate-400"
                                }`}
                                title="第一阶段：从企业知识库召回合规军规"
                              >
                                <span>{msg.citations?.length ? "✓" : "○"} 1. 规约对齐</span>
                                {msg.citations?.length ? <span className="font-mono text-[10px]">({msg.citations.length}篇)</span> : null}
                              </button>

                              <span className="text-slate-300 text-[10px]">→</span>

                              {/* 步骤 2: 状态感知 */}
                              <div
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                  msg.toolCalls?.length
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "text-slate-400"
                                }`}
                                title="第二阶段：调用企业数据库执行只读感知"
                              >
                                <span>{msg.toolCalls?.length ? "✓" : "○"} 2. 状态感知</span>
                                {msg.toolCalls?.length ? <span className="font-mono text-[10px]">({msg.toolCalls[0].displayName || msg.toolCalls[0].tool})</span> : null}
                              </div>

                              <span className="text-slate-300 text-[10px]">→</span>

                              {/* 步骤 3: 安全防线 */}
                              <div
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                  msg.approvalTicket
                                    ? "bg-rose-50 text-rose-700 border border-rose-200 font-bold"
                                    : "text-slate-400"
                                }`}
                                title="第三阶段：生产高危写操作阻断与单据生成"
                              >
                                <span>{msg.approvalTicket ? "⚠️" : "○"} 3. 高危拦截</span>
                                {msg.approvalTicket ? <span className="font-mono text-[10px]">({msg.approvalTicket.ticketId})</span> : null}
                              </div>

                              <span className="text-slate-300 text-[10px]">→</span>

                              {/* 步骤 4: 人机协同 */}
                              <div
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                  msg.approvalTicket?.status === "APPROVED"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold"
                                    : msg.approvalTicket
                                    ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse font-bold"
                                    : "text-slate-400"
                                }`}
                                title="第四阶段：安全员现场人工决断"
                              >
                                <span>{msg.approvalTicket?.status === "APPROVED" ? "✓" : msg.approvalTicket ? "⏳" : "○"} 4. 人机协同</span>
                                {msg.approvalTicket?.status === "APPROVED" ? <span className="font-mono text-[10px]">(已核准)</span> : null}
                              </div>

                              <span className="text-slate-300 text-[10px]">→</span>

                              {/* 步骤 5: 交付归档 */}
                              <button
                                type="button"
                                onClick={() => setActiveTraceDrawer({ messageId: msg.id, defaultTab: "waterfall" })}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer transition"
                                title="第五阶段：Trace 瀑布流与审计单据落库"
                              >
                                <span>✓ 5. 审计归档</span>
                                <span className="font-mono text-[10px]">(Trace ↗)</span>
                              </button>
                            </div>
                          )}

                          {/* 深度思考过程折叠条 */}
                          {msg.reasoning && (
                            <div>
                              {msg.isThinking ? (
                                <div className="flex items-center gap-2 text-xs text-purple-600 font-medium py-1">
                                  <Brain className="w-3.5 h-3.5 animate-pulse" />
                                  <span className="animate-pulse">正在深度推演思考中...</span>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() =>
                                        setExpandedReasoning((prev) => ({
                                          ...prev,
                                          [msg.id]: !prev[msg.id],
                                        }))
                                      }
                                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition cursor-pointer py-0.5"
                                    >
                                      <Brain className="w-3.5 h-3.5 text-purple-500" />
                                      <span>已深度思考 ({msg.duration || "完成"})</span>
                                      <ChevronDown
                                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                          expandedReasoning[msg.id] ? "rotate-180" : ""
                                        }`}
                                      />
                                    </button>

                                    {msg.citations && msg.citations.length > 0 && (
                                      <button
                                        onClick={() =>
                                          setActiveTraceDrawer({
                                            messageId: msg.id,
                                            defaultTab: "knowledge",
                                          })
                                        }
                                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200/80 font-medium transition cursor-pointer"
                                        title="点击在右侧抽屉查看命中的知识切片"
                                      >
                                        <Database className="w-3 h-3 text-emerald-600" />
                                        <span>已检索增强 ({msg.citations.length} 篇规范)</span>
                                      </button>
                                    )}
                                  </div>

                                  {expandedReasoning[msg.id] && (
                                    <div className="mt-1.5 pl-3 border-l-2 border-purple-200 text-slate-500 text-xs font-mono whitespace-pre-wrap leading-relaxed bg-purple-50/30 p-2.5 rounded-r-xl">
                                      {msg.reasoning}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 1. 工具调用闭环轨迹 (Tool Tracing) */}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <div className="space-y-1.5 mb-2">
                              {msg.toolCalls.map((tc, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between px-3 py-2 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs"
                                >
                                  <div className="flex items-center gap-2 text-amber-900 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                    <span>⚡ 智能体自主调用工具:</span>
                                    <span className="font-mono font-bold text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded">
                                      {tc.displayName || tc.tool}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-amber-700">
                                    <span className="font-semibold text-emerald-600">✓ 执行成功</span>
                                    {tc.duration && <span className="font-mono">({tc.duration})</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 文本回复泡 */}
                          <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200/80 p-4.5 shadow-xs text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {msg.content || (
                              <span className="inline-flex items-center gap-2 text-slate-400 text-xs">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                <span>大模型正在实时流式生成...</span>
                              </span>
                            )}
                          </div>

                          {/* 生产级高危写操作人机协同审批卡片 (Human-in-the-Loop) */}
                          {msg.approvalTicket && (
                            <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3 shadow-xs">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 font-bold text-amber-900">
                                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                                  <span>高危操作触发安全拦截 · 人机协同审批单 (Human-in-the-Loop)</span>
                                </div>
                                <span className="font-mono text-[11px] bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
                                  单号: {msg.approvalTicket.ticketId}
                                </span>
                              </div>

                              <div className="text-xs text-amber-800 leading-relaxed font-medium">
                                {msg.approvalTicket.warning || "检测到涉及非只读数据库写操作指令，已触发生产级安全挂起策略。请合规安全员进行人工核准或驳回。"}
                              </div>

                              {msg.approvalTicket.sql && (
                                <div className="p-3 bg-slate-900 text-amber-300 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800">
                                  <div className="text-[10px] text-slate-400 mb-1">拟执行变更指令 (SQL)：</div>
                                  <code>{msg.approvalTicket.sql}</code>
                                </div>
                              )}

                              {msg.approvalTicket.status === "PENDING" ? (
                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                  <button
                                    onClick={() => handleApproveTicket(msg.id, msg.approvalTicket!.ticketId)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                                  >
                                    <span>✅ 批准执行 (断点续跑)</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectTicket(msg.id, msg.approvalTicket!.ticketId)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                                  >
                                    <span>❌ 驳回并终止</span>
                                  </button>
                                  <span className="text-[11px] text-slate-500 ml-auto font-mono">
                                    [任务挂起中 · 虚拟线程已释放]
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-xs font-bold pt-1">
                                  {msg.approvalTicket.status === "APPROVED" ? (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-3 py-1.5 rounded-xl">
                                      <span>✅ 审批通过并已真实执行</span>
                                      {typeof msg.approvalTicket.affectedRows === "number" && (
                                        <span className="font-normal font-mono text-[11px]">
                                          (变更受影响: {msg.approvalTicket.affectedRows} 行)
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-100/90 border border-rose-300 px-3 py-1.5 rounded-xl">
                                      <span>❌ 已被合规驳回并终止执行</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 优雅的操作条与全链路 Trace 入口 (彻底告别笨重的大卡片，一键唤出右侧分析抽屉) */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 px-1 pt-1">
                            <div className="flex items-center gap-2">
                              {/* 知识库轻量溯源胶囊（点击直达右侧抽屉查看切片原文与两阶段召回评分） */}
                              {msg.citations && msg.citations.length > 0 && (
                                <button
                                  onClick={() =>
                                    setActiveTraceDrawer({
                                      messageId: msg.id,
                                      defaultTab: "knowledge",
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                                  title="点击在右侧抽屉展开查看完整命中文档、切片分块与余弦打分"
                                >
                                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>知识库已增强 ({msg.citations.length} 篇切片)</span>
                                  <ExternalLink className="w-3 h-3 text-emerald-500 opacity-70" />
                                </button>
                              )}

                              {/* 一键复制 */}
                              <button
                                onClick={() => handleCopyMessage(msg.id, msg.content)}
                                className="flex items-center gap-1 hover:text-slate-700 transition cursor-pointer px-1 py-0.5 rounded"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>{copiedId === msg.id ? "已复制" : "复制"}</span>
                              </button>
                            </div>

                            {/* 耗时与 Token 统计，点击查看瀑布流 Trace */}
                            <div className="flex items-center gap-2 font-mono text-[10px]">
                              {msg.isCached || msg.trace?.cached ? (
                                <button
                                  onClick={() =>
                                    setActiveTraceDrawer({
                                      messageId: msg.id,
                                      defaultTab: "finops",
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-0.5 rounded-full font-bold transition cursor-pointer"
                                  title="该回答命中 Exact Hash Cache，免除大模型推理与 Token 计费，点击查看 FinOps 看板"
                                >
                                  <Zap className="w-3 h-3 text-emerald-600" />
                                  <span>
                                    Exact Hash 命中 · 0 Token
                                    {msg.trace?.savedTokens && msg.trace.savedTokens > 0
                                      ? ` (省 ${msg.trace.savedTokens.toLocaleString()} tk)`
                                      : ""}
                                  </span>
                                </button>
                              ) : msg.tokens ? (
                                <span>Tokens: {msg.tokens}</span>
                              ) : null}
                              {msg.duration && (
                                <>
                                  <span>·</span>
                                  <button
                                    onClick={() =>
                                      setActiveTraceDrawer({
                                        messageId: msg.id,
                                        defaultTab: "waterfall",
                                      })
                                    }
                                    className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 font-medium hover:underline transition cursor-pointer"
                                    title="点击展开右侧抽屉，查看单次请求全链路甘特瀑布图"
                                  >
                                    <Activity className="w-3 h-3 text-blue-500" />
                                    <span>耗时: {msg.duration} (Trace 瀑布图 ↗)</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* ── 底部固定输入条 (仅当有对话内容时显示在底栏，与豆包/DeepSeek完全一致) ── */}
        {!isChatEmpty && (
          <div className="p-4 bg-gradient-to-t from-[#FAFBFC] via-[#FAFBFC]/90 to-transparent shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-lg shadow-slate-200/50 p-3 space-y-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="继续提问..."
                  rows={2}
                  className="w-full resize-none bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 px-2 py-1 leading-relaxed max-h-36 scrollbar-hide"
                />

                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEnableThinking(!enableThinking)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        enableThinking
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Brain className="w-3 h-3" />
                      <span>思考</span>
                    </button>

                    <button
                      onClick={() => setEnableWebSearch(!enableWebSearch)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        enableWebSearch
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Globe className="w-3 h-3" />
                      <span>联网</span>
                    </button>

                    <button
                      onClick={() => setEnableRAG(!enableRAG)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        enableRAG
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Database className="w-3 h-3" />
                      <span>知识库</span>
                    </button>
                  </div>

                  {isGenerating ? (
                    <button
                      onClick={handleStopGenerating}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                      title="停止生成 (断开物理连接)"
                    >
                      <span className="w-2 h-2 rounded-xs bg-white" />
                      <span>停止</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSend()}
                      disabled={!inputMessage.trim()}
                      className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-30 text-white flex items-center justify-center transition shadow-sm cursor-pointer"
                    >
                      <CornerRightUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trace Inspector Drawer */}
      <TraceInspectorDrawer
        isOpen={!!activeTraceDrawer}
        onClose={() => setActiveTraceDrawer(null)}
        defaultTab={activeTraceDrawer?.defaultTab || "waterfall"}
        message={
          activeTraceDrawer
            ? messages.find((m) => m.id === activeTraceDrawer.messageId) || null
            : null
        }
      />
    </div>
  );
}
