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
  Layers,
  ShieldAlert,
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
import { useToast } from "@/context/ToastContext";
import { TraceInspectorDrawer, ExecutionTraceData } from "@/components/chat/TraceInspectorDrawer";
import { WorkflowExecutionModal } from "@/components/workflow/WorkflowExecutionModal";

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
  ragStats?: {
    totalDocs?: number;
    bm25Candidates?: number;
    noiseFiltered?: number;
    validCount?: number;
    mode?: string;
    isRealVector?: boolean;
  };
  traceSteps?: Record<number, any>;
  toolCalls?: ToolCallItem[];
  approvalTicket?: ApprovalTicketItem;
  tokens?: number;
  duration?: string;
  isCached?: boolean;
  trace?: ExecutionTraceData;
  userPrompt?: string;
  modelName?: string;
  sessionId?: string;
  enableRAG?: boolean;
  enableThinking?: boolean;
  enableWebSearch?: boolean;
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
  initialPrompt?: string | { prompt: string; autoSend?: boolean };
  onClearInitialPrompt?: () => void;
  onOpenCreateWorkflow?: () => void;
  onRunWorkflow?: (wf: PipelineItem) => void;
  onNavigateStudio?: () => void;
}

// 渲染正文内的引用角标 (支持 [1], [2], [^1] 式真实可点击锚点)
const renderContentWithCitations = (
  content: string,
  citations?: CitationItem[],
  onCitationClick?: (index: number) => void
) => {
  if (!content) return null;
  const citationRegex = /(\[\^?\d+\])/g;
  const parts = content.split(citationRegex);

  return (
    <span>
      {parts.map((part, index) => {
        const match = part.match(/\[\^?(\d+)\]/);
        if (match) {
          const num = parseInt(match[1], 10);
          const citation = citations && citations[num - 1];
          return (
            <sup
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                if (onCitationClick) onCitationClick(num - 1);
              }}
              className="inline-flex items-center px-1 py-0.2 mx-0.5 rounded text-[10px] font-bold font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer transition select-none shadow-2xs"
              title={citation ? `引用来源 [${num}]: ${citation.docTitle}` : `引用来源 [${num}]`}
            >
              [{num}]
            </sup>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

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
  onRunWorkflow,
  onNavigateStudio,
}: ChatPlaygroundProps) {
  const toast = useToast();
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

  // 全链路执行分析与知识溯源面板 (支持左右分栏 split 与浮层抽屉 drawer 自由切换)
  const [activeTraceDrawer, setActiveTraceDrawer] = useState<{
    messageId: string;
    defaultTab: "lifecycle" | "waterfall" | "knowledge" | "reasoning" | "finops";
    highlightCitationIndex?: number;
  } | null>(null);
  const [traceLayoutMode, setTraceLayoutMode] = useState<"split" | "drawer">("split");
  const [runningWorkflow, setRunningWorkflow] = useState<PipelineItem | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef<boolean>(false);
  const autoSentPromptRef = useRef<string | null>(null);
  const newlyCreatedSessionIdRef = useRef<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);

  // 本地持久化存储富消息缓存（刷新页面或切换会话时，完整保留 traceSteps、toolCalls 与审批工单）
  const LOCAL_CACHE_KEY = "ownagent_rich_session_cache_v2";
  const sessionMessagesCacheRef = useRef<Record<string, Message[]>>((() => {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })());

  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      sessionMessagesCacheRef.current[currentSessionId] = messages;
      try {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(sessionMessagesCacheRef.current));
      } catch {}
    }
  }, [messages, currentSessionId]);

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

  // 2. 切换会话时加载历史消息 (严密防竞态与富消息状态保留)
  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  useEffect(() => {
    if (isGeneratingRef.current) return;

    if (currentSessionId) {
      if (newlyCreatedSessionIdRef.current === currentSessionId) {
        return;
      }
      fetchMessagesApi(currentSessionId).then((history) => {
        // 如果当前正在推流或会话已改变，杜绝异步覆盖
        if (isGeneratingRef.current || currentSessionIdRef.current !== currentSessionId) {
          return;
        }
        const cached = sessionMessagesCacheRef.current[currentSessionId];
        if (cached && cached.length > 0) {
          const merged = (history && history.length > 0 ? history : cached).map((h) => {
            const hit = cached.find((c) => c.id === h.id || c.content === h.content);
            return hit ? { ...h, ...hit } : h;
          });
          setMessages(merged);
        } else if (history && history.length > 0) {
          setMessages(history);
        } else {
          setMessages([]);
        }
      });
    }
  }, [currentSessionId]);

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
                  `> ✅ **【人机协同审批通过】** 审批人已同意执行变更操作。\n> 真实执行结果：变更生效，受影响行数: ${res.affectedRows ?? 1} 行。`,
              }
            : m
        )
      );
      toast.success(`审批已通过，受影响行数: ${res.affectedRows ?? 1} 行`, "审批放行生效");
    } catch (e: any) {
      toast.error(e.message || "审批接口未响应", "审批执行失败");
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
                  `> ❌ **【人机协同审批驳回】** 审批人已驳回该变更指令，已安全阻断。`,
              }
            : m
        )
      );
      toast.warning("已驳回该高危操作，变更未生效并已留痕", "操作阻断成功");
    } catch (e: any) {
      toast.error(e.message || "接口未响应", "驳回处理失败");
    }
  };

  // 开启新会话
  const handleCreateNewSession = async () => {
    if (isGeneratingRef.current) {
      handleStopGenerating();
    }
    isGeneratingRef.current = false;
    setIsGenerating(false);
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
      toast.success("会话已彻底删除", "会话删除");
    } catch (err: any) {
      toast.error(err.message || "删除会话异常", "删除失败");
    }
  };

  // 物理级客户端中断流式输出 (Cancel 上游大模型并触发后端 ABORTED 审计)
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (currentSessionId) {
      fetch(`/api/chat/abort?sessionId=${encodeURIComponent(currentSessionId)}`, { method: "POST" }).catch(() => {});
    }
    isGeneratingRef.current = false;
    setIsGenerating(false);
    setMessages((prev) =>
      prev.map((m, idx) =>
        idx === prev.length - 1 && m.role === "assistant" && m.isThinking
          ? { ...m, isThinking: false, content: (m.content || "") + "\n\n*(已手动停止)*" }
          : m
      )
    );
  };

  // 发送消息并流式推流
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!text || isGeneratingRef.current) return;

    // 1. 同步获取真实后端 Session ID，从源头杜绝本地与服务端 ID 竞态打架
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      const newSessionTitle = text.length > 15 ? text.substring(0, 15) + "..." : text;
      try {
        const created = await createSessionApi(newSessionTitle);
        activeSessionId = created.id;
        setCurrentSessionId(created.id);
        newlyCreatedSessionIdRef.current = created.id;
        setSessions((prev) => [created, ...prev]);
      } catch {
        const fallbackId = `s-${Date.now().toString().slice(-6)}`;
        activeSessionId = fallbackId;
        setCurrentSessionId(fallbackId);
        newlyCreatedSessionIdRef.current = fallbackId;
        setSessions((prev) => [{ id: fallbackId, title: newSessionTitle, time: "刚刚" }, ...prev]);
      }
    } else {
      newlyCreatedSessionIdRef.current = activeSessionId;
    }

    // 2. 计算生效模型
    const effectiveModel =
      currentAgent?.model && currentAgent.model !== "deepseek-chat"
        ? currentAgent.model
        : (systemModel || "qwen-plus");

    // 3. 进入推流生成状态
    isGeneratingRef.current = true;
    setIsGenerating(true);

    const userMsgId = `u-${Date.now()}`;
    const asstMsgId = `a-${Date.now()}`;

    // 立即清空输入并呈现用户气泡与处理态
    setInputMessage("");

    const userMsg: Message = { id: userMsgId, role: "user", content: text };
    const asstMsg: Message = {
      id: asstMsgId,
      role: "assistant",
      content: "",
      isThinking: true,
      duration: "处理中...",
      userPrompt: text,
      modelName: effectiveModel,
      sessionId: activeSessionId,
      enableRAG,
      enableThinking,
      enableWebSearch: false,
      traceSteps: {},
    };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setExpandedReasoning((p) => ({ ...p, [asstMsgId]: false }));

    // 用户发起提问时，右侧处理流程实时固定展开并实时显示 (左右分栏协同)
    setActiveTraceDrawer({
      messageId: asstMsgId,
      defaultTab: "lifecycle",
    });
    setTraceLayoutMode("split");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let accumulatedContent = "";
    const requestStartTs = Date.now();
    let firstTokenTs = 0;

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
          enableWebSearch: false,
          enableRAG,
        },
        {
          onTraceStep: (stepData) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== asstMsgId) return m;
                const flatData = { ...stepData, ...(stepData.data || {}) };
                const prevSteps = m.traceSteps || {};
                const newSteps = { ...prevSteps, [flatData.step]: flatData };
                const traceUpdate = { ...(m.trace || {}) };

                if (flatData.hashKey) {
                  traceUpdate.hashKey = flatData.hashKey;
                }
                if (flatData.cached !== undefined) {
                  traceUpdate.cached = !!flatData.cached;
                }
                if (flatData.cacheHit !== undefined) {
                  traceUpdate.cached = !!flatData.cacheHit;
                }
                if (flatData.ragMs !== undefined) {
                  traceUpdate.ragMs = flatData.ragMs;
                }
                if (flatData.costMs !== undefined) {
                  traceUpdate.ragMs = flatData.costMs;
                }
                if (flatData.ttftMs !== undefined) {
                  traceUpdate.ttftMs = flatData.ttftMs;
                }
                if (flatData.totalMs !== undefined) {
                  traceUpdate.totalMs = flatData.totalMs;
                }
                if (flatData.totalTokens !== undefined) {
                  (traceUpdate as any).tokens = flatData.totalTokens;
                }

                return {
                  ...m,
                  traceSteps: newSteps,
                  trace: traceUpdate,
                };
              })
            );
          },
          onCitations: (newCitations, ragStats) => {
            if (Array.isArray(newCitations) && newCitations.length > 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId
                    ? {
                        ...m,
                        citations: newCitations,
                        ragStats: ragStats || m.ragStats,
                      }
                    : m
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

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== asstMsgId) return m;
                const existingTrace = m.trace || {};
                return {
                  ...m,
                  content: accumulatedContent,
                  isThinking: false,
                  duration: `${(liveElapsedMs / 1000).toFixed(1)}s`,
                  trace: {
                    ...existingTrace,
                    totalMs: liveElapsedMs,
                    ttftMs: liveTtftMs,
                    streamMs: Math.max(0, liveElapsedMs - liveTtftMs),
                  },
                };
              })
            );
          },
          onFinish: (rawMeta) => {
            isGeneratingRef.current = false;
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
            isGeneratingRef.current = false;
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
      if (err?.name === "AbortError" || abortController.signal.aborted) {
        return;
      }
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
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (initialPrompt) {
      const promptText = typeof initialPrompt === "string" ? initialPrompt : initialPrompt.prompt;
      const shouldAutoSend = typeof initialPrompt === "string" ? true : initialPrompt.autoSend !== false;
      if (promptText && promptText.trim()) {
        if (shouldAutoSend) {
          handleSend(promptText);
        } else {
          setInputMessage(promptText);
          setTimeout(() => textareaRef.current?.focus(), 100);
        }
        if (onClearInitialPrompt) onClearInitialPrompt();
      }
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

  const isChatEmpty = messages.length === 0 && !isGenerating;

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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 rounded-xl border border-blue-200/60 shadow-2xs transition cursor-pointer"
              title="新建对话"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新对话</span>
            </button>
          </div>

          {/* 当前模型真实连接状态胶囊与设置快捷入口 */}
          <div className="flex items-center gap-2">
            {/* 智能体角色快速切换下拉框 */}
            {agents && agents.length > 0 && (
              <div className="relative">
                <select
                  value={currentAgent?.id || ""}
                  onChange={(e) => {
                    const found = agents.find((a) => a.id === e.target.value);
                    if (found && onSelectAgent) onSelectAgent(found);
                  }}
                  className="text-xs font-semibold bg-white border border-slate-200/90 rounded-full px-3 py-1 text-slate-700 shadow-2xs hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition"
                  title="选择当前交互智能体角色"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      🤖 {a.name} ({a.model})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div
              className={`flex items-center gap-1.5 px-3 py-1 bg-white/95 border rounded-full text-xs shadow-2xs transition-all ${
                modelProbe?.connected
                  ? "border-emerald-200 text-emerald-800"
                  : "border-amber-200 text-amber-800 bg-amber-50/50"
              }`}
              title={
                modelProbe?.connected
                  ? `大模型服务在线（响应延迟 ${modelProbe.latencyMs || 0}ms）`
                  : `${modelProbe?.message || "大模型未连接"}。可在右上角设置中填入 API Key；当前仍完整支持本地知识库 查知识库、重复问题可走缓存。`
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
                  待配置密钥
                </span>
              )}
            </div>

            {/* 右侧执行流程面板切换按钮 */}
            <button
              onClick={() => {
                if (activeTraceDrawer) {
                  setActiveTraceDrawer(null);
                } else {
                  const targetMsg = messages.slice().reverse().find((m) => m.role === "assistant");
                  setActiveTraceDrawer({
                    messageId: targetMsg ? targetMsg.id : "finops-global",
                    defaultTab: "lifecycle",
                  });
                  setTraceLayoutMode("split");
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs transition cursor-pointer border ${
                activeTraceDrawer
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90"
              }`}
              title="切换显示右侧实时执行流程记录"
            >
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>{activeTraceDrawer ? "收起流程面板" : "查看执行流程"}</span>
            </button>

            {/* 开销与缓存统计按钮 */}
            <button
              onClick={() => {
                const targetMsg = messages.slice().reverse().find((m) => m.role === "assistant");
                setActiveTraceDrawer({
                  messageId: targetMsg ? targetMsg.id : "finops-global",
                  defaultTab: "finops",
                });
                setTraceLayoutMode("split");
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-full text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
              title="查看历史问答缓存与开销节省记录"
            >
              <Coins className="w-3.5 h-3.5 text-emerald-600" />
              <span>开销与缓存统计</span>
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
                        <span>当前大模型已连接（{modelProbe.provider} · {modelProbe.model}）</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          模型在线
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500 font-medium">
                          系统运行正常 · 支持制度检索、系统工具调用与人工把关
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          安全模式
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 居中大对话输入框 */}
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
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed"
                        title="联网搜索功能暂未开启"
                      >
                        <Globe className="w-3.5 h-3.5 text-slate-300" />
                        <span>联网搜索 (未开启)</span>
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
                        <span>知识库检索</span>
                      </button>
                    </div>

                    {isGenerating && messages.length > 0 ? (
                      <button
                        onClick={handleStopGenerating}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-500/25 cursor-pointer"
                        title="停止生成 (断开当前连接)"
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

                {/* ── 常用业务场景 ── */}
                <div className="w-full max-w-3xl space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      <span className="text-xs font-black text-slate-800 tracking-tight">
                        常用业务场景（点击即可快速开始）
                      </span>
                    </div>
                    {workflows && workflows.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400">
                          左侧对话问答，右侧实时显示每步处理过程
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {workflows && workflows.length > 0 ? (
                      workflows.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="group relative p-4 rounded-2xl bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-blue-400 text-left transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-3 cursor-pointer"
                          onClick={() => {
                            handleSend(item.promptTemplate);
                          }}
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

                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInputMessage(item.promptTemplate);
                                  textareaRef.current?.focus();
                                }}
                                className="text-[11px] text-slate-500 hover:text-blue-600 font-medium transition cursor-pointer"
                                title="填入 Prompt 对话"
                              >
                                填入输入框
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSend(item.promptTemplate);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                title="立即运行此业务场景"
                              >
                                <span>立即运行</span>
                                <CornerRightUp className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-3 p-4 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs text-slate-600 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-600" />
                          <span>暂无已发布的业务自动化流水线</span>
                        </div>
                        {onNavigateStudio && (
                          <button
                            onClick={onNavigateStudio}
                            className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline cursor-pointer"
                          >
                            <span>前往「业务配置中心」编排流水线</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                                title="打开相关制度"
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
                                title="查看耗时明细"
                              >
                                <span>✓ 5. 审计归档</span>
                                <span className="font-mono text-[10px]">(详情 ↗)</span>
                              </button>
                            </div>
                          )}

                          {/* 深度思考过程折叠条 */}
                          {msg.reasoning && (
                            <div>
                              {msg.isThinking ? (
                                <div className="flex items-center gap-2 text-xs text-purple-600 font-medium py-1">
                                  <Brain className="w-3.5 h-3.5 animate-pulse" />
                                  <span className="animate-pulse">正在整理思路…</span>
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
                                      <span>思考过程（可展开） ({msg.duration || "完成"})</span>
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
                                        title="点击在右侧查看引用的制度原文"
                                      >
                                        <Database className="w-3 h-3 text-emerald-600" />
                                        <span>已参考 {msg.citations.length} 条制度</span>
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
                                  className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs"
                                >
                                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    <span className="text-slate-600 font-medium">调用系统接口:</span>
                                    <span className="font-mono font-semibold text-slate-900 bg-slate-200/60 px-2 py-0.5 rounded">
                                      {tc.displayName || tc.tool}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                    {tc.status === "FAILED" || tc.status === "error" || (tc as any).isSuccess === false ? (
                                      <span className="font-medium text-rose-600">❌ 执行异常</span>
                                    ) : (
                                      <span className="font-medium text-emerald-600">✓ 执行成功</span>
                                    )}
                                    {tc.duration && <span className="font-mono">({tc.duration})</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 文本回复泡 */}
                          <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200/80 p-4.5 shadow-xs text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {msg.content ? (
                              <>
                                <div>
                                  {renderContentWithCitations(msg.content, msg.citations, () => {
                                    setActiveTraceDrawer({
                                      messageId: msg.id,
                                      defaultTab: "knowledge",
                                    });
                                  })}
                                </div>
                                {msg.citations && msg.citations.length > 0 && (
                                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                    <span className="text-[10px] text-slate-400 font-sans">引用来源:</span>
                                    {msg.citations.map((c, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() =>
                                          setActiveTraceDrawer({
                                           messageId: msg.id,
                                           defaultTab: "knowledge",
                                           highlightCitationIndex: idx,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 cursor-pointer transition"
                                        title={c.docTitle}
                                      >
                                        <span className="text-indigo-600 font-bold">[{idx + 1}]</span>
                                        <span className="truncate max-w-[160px]">{c.docTitle}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-2 text-slate-400 text-xs">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                <span>大模型正在实时流式生成...</span>
                              </span>
                            )}
                          </div>

                          {/* 生产级高危写操作人工协同审批卡片 */}
                          {msg.approvalTicket && (
                            <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3 shadow-xs">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 font-bold text-amber-900">
                                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                                  <span>高危操作触发安全拦截 · 人工复核审批单</span>
                                </div>
                                <span className="font-mono text-[11px] bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
                                  单号: {msg.approvalTicket.ticketId}
                                </span>
                              </div>

                              <div className="p-2.5 bg-amber-100/60 border border-amber-200 rounded-xl text-[11.5px] text-amber-900 font-medium">
                                ⚠️ <strong>重要：</strong>确认后将修改数据库，请仔细核对。
                              </div>

                              <div className="text-xs text-amber-800 leading-relaxed font-medium">
                                {msg.approvalTicket.warning || "检测到涉及非只读数据库写操作指令，已触发生产级安全挂起策略。请授权负责人人工核准或驳回。"}
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
                                    <span>✅ 批准并执行变更</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectTicket(msg.id, msg.approvalTicket!.ticketId)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                                  >
                                    <span>❌ 驳回并终止操作</span>
                                  </button>
                                  <span className="text-[11px] text-slate-500 ml-auto font-sans">
                                    [操作已挂起 · 等待确认]
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
                                  title="点击在右侧查看引用制度与相关度"
                                >
                                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>已引用 {msg.citations.length} 条制度原文</span>
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
                                  title="相同问题已缓存，未再调用模型"
                                >
                                  <Zap className="w-3 h-3 text-emerald-600" />
                                  <span>
                                    相同问题已缓存 · 未再调用模型
                                    {msg.trace?.savedTokens && msg.trace.savedTokens > 0
                                      ? ` (省 ${msg.trace.savedTokens.toLocaleString()} tk)`
                                      : ""}
                                  </span>
                                </button>
                              ) : msg.tokens ? (
                                <span>用量（字）: {msg.tokens}</span>
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
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed"
                      title="联网搜索功能暂未开启"
                    >
                      <Globe className="w-3 h-3 text-slate-300" />
                      <span>联网 (未开启)</span>
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

      {/* Trace Inspector Drawer (支持 split 分栏与 drawer 抽屉双模式切换) */}
      <TraceInspectorDrawer
        isOpen={!!activeTraceDrawer}
        onClose={() => setActiveTraceDrawer(null)}
        layoutMode={traceLayoutMode}
        onToggleLayout={() => setTraceLayoutMode((prev) => (prev === "split" ? "drawer" : "split"))}
        defaultTab={activeTraceDrawer?.defaultTab || "lifecycle"}
        highlightCitationIndex={activeTraceDrawer?.highlightCitationIndex}
        message={
          activeTraceDrawer
            ? (() => {
                if (activeTraceDrawer.messageId === "finops-global") {
                  return {
                    id: "finops-global",
                    role: "assistant",
                    content: "历史问答缓存与开销统计",
                    userPrompt: "开销与缓存统计",
                    modelName: currentAgent?.model || systemModel || "系统模型",
                    sessionId: currentSessionId,
                    enableRAG,
                    enableThinking,
                    enableWebSearch: false,
                    traceSteps: {},
                    trace: {
                      cached: false,
                      totalMs: 0,
                      tokens: 0,
                      savedTokens: 0,
                      savedMs: 0,
                    },
                  } as Message;
                }
                const targetMsg = messages.find((m) => m.id === activeTraceDrawer.messageId);
                if (!targetMsg) {
                  const lastAsst = messages.slice().reverse().find((m) => m.role === "assistant");
                  if (lastAsst) return lastAsst;
                  return {
                    id: activeTraceDrawer.messageId,
                    role: "assistant",
                    content: "",
                    userPrompt: "当前会话监控",
                    modelName: currentAgent?.model || systemModel || "qwen-plus",
                    sessionId: currentSessionId,
                    enableRAG,
                    enableThinking,
                    enableWebSearch,
                    traceSteps: {},
                  } as Message;
                }
                const msgIdx = messages.findIndex((m) => m.id === activeTraceDrawer.messageId);
                const prevUserMsg = msgIdx > 0 ? messages.slice(0, msgIdx).reverse().find((m) => m.role === "user") : null;
                return {
                  ...targetMsg,
                  userPrompt: targetMsg.userPrompt || prevUserMsg?.content || "",
                  modelName: targetMsg.modelName || currentAgent?.model || systemModel || "qwen-plus",
                  sessionId: targetMsg.sessionId || currentSessionId,
                  enableRAG,
                  enableThinking,
                  enableWebSearch,
                };
              })()
            : null
        }
      />

      {/* 业务流水线执行窗口 */}
      <WorkflowExecutionModal
        isOpen={!!runningWorkflow}
        onClose={() => setRunningWorkflow(null)}
        workflow={runningWorkflow}
        onSwitchToChat={(prompt) => {
          setInputMessage(prompt);
          setRunningWorkflow(null);
          textareaRef.current?.focus();
        }}
      />
    </div>
  );
}
