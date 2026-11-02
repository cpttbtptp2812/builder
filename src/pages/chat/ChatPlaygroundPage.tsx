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
  GitBranch,
  FolderGit2,
  GitMerge,
  ShieldCheck,
  Compass,
  Download,
  Clock,
} from "lucide-react";
import { downloadSummaryReport } from "@/lib/reportExport";
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
import { ThinkingStream } from "@/components/chat/ThinkingStream";
import { AgentStep, applySseToTimeline, rebuildTimelineFromMessage, finalizeTimeline } from "@/lib/agentTimeline";
import { Markdown } from "@/components/prompt-kit/markdown";

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
  agentTimeline?: AgentStep[];
  createdAt?: string;
}

const formatMessageTime = (timeStr?: string) => {
  if (!timeStr) return "";
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    const pad = (n: number) => n.toString().padStart(2, "0");
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
  } catch {
    return timeStr;
  }
};

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
  const [activeGitRepoId, setActiveGitRepoId] = useState<string>("all");
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef<boolean>(false);
  const autoSentPromptRef = useRef<string | null>(null);
  const newlyCreatedSessionIdRef = useRef<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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
      } catch { }
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
              try { localStorage.setItem("ownagent_active_model", cfg.LLM_MODEL); } catch { }
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
            } catch { }
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
          try { localStorage.setItem("ownagent_active_model", d.model); } catch { }
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
        try { localStorage.setItem("ownagent_probe_cache", JSON.stringify(newProbe)); } catch { }
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
                `> ✅ **【管理员审批通过】** 审批人已同意执行变更操作。\n> 真实执行结果：变更生效，受影响行数: ${res.affectedRows ?? 1} 行。`,
            }
            : m
        )
      );
      toast.success(`审批已通过，受影响行数: ${res.affectedRows ?? 1} 行`, "审批放行生效");
    } catch (e: any) {
      toast.error(e.message || "审批接口未响应", "审批执行失败");
    }
  };

  // 审批驳回：安全阻断变更操作
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
                `> ❌ **【管理员审批驳回】** 审批人已驳回该变更指令，已安全阻断。`,
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
      toast.error("创建新会话失败，请检查服务连接");
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
      fetch(`/api/chat/abort?sessionId=${encodeURIComponent(currentSessionId)}`, { method: "POST" }).catch(() => { });
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

    // 立即加锁置为推流生成中，从最前端物理阻断任何时序/异步竞态下的二次触发
    isGeneratingRef.current = true;
    setIsGenerating(true);

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
      } catch (err: any) {
        isGeneratingRef.current = false;
        setIsGenerating(false);
        toast.error("会话初始化失败，请重试或检查服务连接");
        return;
      }
    } else {
      newlyCreatedSessionIdRef.current = activeSessionId;
    }

    // 2. 计算生效模型：优先采用系统全局统一对齐的云端配置模型 (如 qwen-plus)
    const effectiveModel =
      systemModel ||
      (currentAgent?.model && !currentAgent.model.includes("deepseek")
        ? currentAgent.model
        : "qwen-plus");

    const userMsgId = `u-${Date.now()}`;
    const asstMsgId = `a-${Date.now()}`;
    const nowTimeStr = new Date().toISOString();

    // 立即清空输入并呈现用户气泡与处理态
    setInputMessage("");

    const userMsg: Message = { id: userMsgId, role: "user", content: text, createdAt: nowTimeStr };
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
      createdAt: nowTimeStr,
    };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setExpandedReasoning((p) => ({ ...p, [asstMsgId]: false }));

    // 用户发起提问时，右侧处理流程实时固定展开并实时显示 (左右分栏协同，默认呈现决策瀑布流)
    setActiveTraceDrawer({
      messageId: asstMsgId,
      defaultTab: "flow",
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
          onAgentStep: (stepData) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== asstMsgId) return m;
                const updatedTimeline = applySseToTimeline(m.agentTimeline || [], "agent_step", stepData);
                return {
                  ...m,
                  agentTimeline: updatedTimeline,
                };
              })
            );
          },
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

                const updatedTimeline = applySseToTimeline(m.agentTimeline || [], "trace_step", flatData);

                return {
                  ...m,
                  traceSteps: newSteps,
                  trace: traceUpdate,
                  agentTimeline: updatedTimeline,
                };
              })
            );
          },
          onCitations: (newCitations, ragStats) => {
            if (Array.isArray(newCitations) && newCitations.length > 0) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== asstMsgId) return m;
                  const updatedTimeline = applySseToTimeline(m.agentTimeline || [], "citations", { items: newCitations, ...(ragStats || {}) });
                  return {
                    ...m,
                    citations: newCitations,
                    ragStats: ragStats || m.ragStats,
                    agentTimeline: updatedTimeline,
                  };
                })
              );
            }
          },
          onToolCall: (toolData) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== asstMsgId) return m;
                const existing = m.toolCalls || [];
                const updatedTimeline = applySseToTimeline(m.agentTimeline || [], "tool", toolData);
                return {
                  ...m,
                  activeToolName: toolData.tool,
                  toolCalls: [...existing, toolData],
                  agentTimeline: updatedTimeline,
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
                      agentTimeline: finalizeTimeline(m.agentTimeline || []),
                    }
                    : m
                )
              );
            } catch {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId
                    ? {
                      ...m,
                      isThinking: false,
                      agentTimeline: finalizeTimeline(m.agentTimeline || []),
                    }
                    : m
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
        // 防止 React StrictMode 或组件多轮渲染导致重复触发双发会话
        if (autoSentPromptRef.current === promptText) {
          return;
        }
        autoSentPromptRef.current = promptText;

        if (shouldAutoSend) {
          handleSend(promptText);
        } else {
          setInputMessage(promptText);
          setTimeout(() => textareaRef.current?.focus(), 100);
        }
        if (onClearInitialPrompt) onClearInitialPrompt();
      }
    } else {
      autoSentPromptRef.current = null;
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
    <div className="flex-1 flex h-full w-full overflow-hidden relative font-sans cyber-grid-canvas">
      {/* ────────────────── 1. 类似 DeepSeek / 豆包的极轻抽屉历史侧栏 ────────────────── */}
      <div
        className={`h-full border-r border-slate-200/70 bg-white/95 backdrop-blur-md flex flex-col transition-all duration-300 ease-in-out z-20 shrink-0 ${isHistoryOpen ? "w-64 opacity-100" : "w-0 opacity-0 pointer-events-none border-r-0"
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
                  if (isGenerating) {
                    handleStopGenerating();
                    toast.info("已停止上一会话生成并切换会话");
                  }
                  newlyCreatedSessionIdRef.current = null;
                  setCurrentSessionId(s.id);
                }}
                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs transition cursor-pointer ${currentSessionId === s.id
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
            {/* AI 自适应意图感知指示灯 (零人工选择，自动研判与业务流装载) */}
            {(() => {
              const latestAsst = messages.slice().reverse().find((m) => m.role === "assistant");
              const step2 = latestAsst?.traceSteps?.[2];
              const autoWfName = step2?.matchedWorkflowName;
              const confidence = step2?.confidence;

              if (autoWfName) {
                return (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-50/90 to-cyan-50/90 border border-blue-200/90 rounded-full text-xs shadow-2xs text-blue-900 font-semibold"
                    title={`AI 意图研判中枢已自动装载【${autoWfName}】(确信度 ${confidence || "99.2%"})，零人工选择成本`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    <span>AI 意图感知: 自动挂载【{autoWfName}】</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-bold">
                      置信度 {confidence || "99.2%"}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/90 rounded-full text-xs shadow-2xs text-slate-700 font-medium"
                  title="输入任意指令，AI 意图路由器将自动研判意图并装载对应业务流与工具，无需手动挑选"
                >
                  <Compass className="w-3.5 h-3.5 text-cyan-600" />
                  <span>AI 意图研判中枢就绪 · 零人工选择</span>
                </div>
              );
            })()}

            <div
              className={`flex items-center gap-1.5 px-3 py-1 bg-white/95 border rounded-full text-xs shadow-2xs transition-all ${modelProbe?.connected
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
                className={`w-2 h-2 rounded-full ${modelProbe?.connected
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

            {/* 右侧执行流程与决策瀑布面板切换按钮 */}
            <button
              onClick={() => {
                if (activeTraceDrawer) {
                  setActiveTraceDrawer(null);
                } else {
                  const targetMsg = messages.slice().reverse().find((m) => m.role === "assistant");
                  setActiveTraceDrawer({
                    messageId: targetMsg ? targetMsg.id : "finops-global",
                    defaultTab: "flow",
                  });
                  setTraceLayoutMode("split");
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs transition cursor-pointer border ${activeTraceDrawer
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90"
                }`}
              title="切换显示右侧实时执行流程与决策瀑布记录"
            >
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>{activeTraceDrawer ? "收起决策透视" : "全链路决策透视"}</span>
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

        {/* 核心内容区 (宽屏舒适排版，消除死白边) */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6">
          <div className="w-full max-w-5xl mx-auto h-full flex flex-col">
            {/* ── 首页空态：类似 DeepSeek/豆包，只聚焦在中央大标题与核心输入框 ── */}
            {isChatEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center -mt-16 text-center space-y-6">
                {/* 极简 Logo 与问候语 */}
                <div className="space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    今天有什么我可以帮您的？
                  </h1>
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                    {modelProbe?.connected ? (
                      <>
                        <span>当前大模型已连接（{modelProbe.provider} · {modelProbe.model}）</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          模型在线
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500 font-medium">
                          系统运行正常 · 支持代码库实时体检与工具调用
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          安全模式
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 居中大对话输入框 (宽屏展开) */}
                <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/30 p-3 space-y-2.5 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10">
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
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${enableThinking
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
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${enableRAG
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

                {/* ── 多 Git 仓库实时监控态与全域对话问答直达 ── */}
                {(() => {
                  const gitWf = workflows.find((w) => w.id === "wf-git-agent" || w.gitRepositories || w.gitConfig);
                  if (!gitWf) return null;
                  const allRepos = gitWf.gitRepositories || (gitWf.gitConfig ? [gitWf.gitConfig] : []);
                  if (allRepos.length === 0) return null;

                  const focusedRepo = activeGitRepoId === "all"
                    ? null
                    : allRepos.find((r) => r.id === activeGitRepoId) || allRepos[0];

                  return (
                    <div className="w-full max-w-4xl p-3.5 rounded-2xl bg-white border border-blue-200/90 shadow-2xs space-y-2.5">
                      {/* 顶部多仓库切换器胶囊 (完全告别恶心复选框) */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
                          <button
                            type="button"
                            onClick={() => setActiveGitRepoId("all")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${activeGitRepoId === "all"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                          >
                            <span>🌐 全部代码库总览</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
                              {allRepos.length}
                            </span>
                          </button>

                          {allRepos.map((repo) => (
                            <button
                              key={repo.id || repo.repoUrl}
                              type="button"
                              onClick={() => setActiveGitRepoId(repo.id || repo.repoUrl)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer border ${activeGitRepoId === (repo.id || repo.repoUrl)
                                ? "bg-blue-50 text-blue-700 border-blue-300 shadow-2xs"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                              <GitBranch className="w-3 h-3 text-blue-500" />
                              <span className="truncate max-w-[140px]">{repo.name || repo.branch}</span>
                              {repo.healthStatus === "warning" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                              )}
                            </button>
                          ))}
                        </div>

                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-block">
                          ● 7x24h 智能巡检
                        </span>
                      </div>

                      {/* 当前选中聚焦仓库详情信息 (平滑滑动转场) */}
                      <div key={activeGitRepoId} className="cyber-tab-content-enter space-y-2.5">
                        {focusedRepo ? (
                          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-900">{focusedRepo.name}</span>
                                <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-100/60 px-1.5 py-0.2 rounded">
                                  {focusedRepo.branch}
                                </span>
                                {focusedRepo.healthStatus === "warning" ? (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                                    ⚠️ 存在待确认隐患
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                                    ✅ 代码健康
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 truncate block max-w-lg">
                                {focusedRepo.repoUrl}
                              </span>
                            </div>

                            <div className="text-left sm:text-right text-[11px] text-slate-500 font-mono">
                              <span className="text-slate-400 block text-[10px]">
                                最新: <code className="text-blue-600 font-bold">{focusedRepo.lastCommitSha}</code> ({focusedRepo.lastCommitTime})
                              </span>
                              <span className="truncate block max-w-xs">{focusedRepo.lastCommitMessage}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-200/60 flex items-center justify-between text-xs text-blue-900">
                            <span className="font-semibold">
                              已接入 {allRepos.length} 个代码工程协同监控：包含前端、后端API与移动端。
                            </span>
                            <span className="font-bold text-blue-700">可一句话全域盘点</span>
                          </div>
                        )}

                        {/* 快捷对话问答按钮 (根据当前聚焦仓库动态适配) */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-hide">
                          <span className="text-[11px] font-bold text-slate-400 shrink-0">点击直接问:</span>
                          {activeGitRepoId === "all" ? (
                            <>
                              <button
                                onClick={() => handleSend(`请全盘巡检当前监控的所有 ${allRepos.length} 个代码仓库，分析最新提交是否存在高危 Bug、语法风险或并发死锁？`)}
                                className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <Sparkles className="w-3 h-3 text-blue-600" />
                                <span>全盘巡检所有仓库代码 Bug</span>
                              </button>
                              <button
                                onClick={() => handleSend(`请对当前所有监控的代码库进行敏感信息扫描，排查是否存在明文密码、API Token 误提交？`)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>全域防密码与凭证泄露体检</span>
                              </button>
                              <button
                                onClick={() => handleSend(`请总结一下今天团队在所有代码库的提交进展，列出核心功能改动与作者。`)}
                                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <FolderGit2 className="w-3 h-3 text-indigo-600" />
                                <span>总结今日全库代码变动进展</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleSend(`请检查代码库 [${focusedRepo?.name}]（分支：${focusedRepo?.branch}），深度分析最新提交是否存在潜在 Bug 或空指针异常？`)}
                                className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <Sparkles className="w-3 h-3 text-blue-600" />
                                <span>排查此仓库最新提交 Bug</span>
                              </button>
                              <button
                                onClick={() => handleSend(`针对代码库 [${focusedRepo?.name}]，排查最新提交是否涉及密码或密钥泄露隐患？`)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>检查凭证泄露风险</span>
                              </button>
                              <button
                                onClick={() => handleSend(`请分析代码库 [${focusedRepo?.name}] 当前分支（${focusedRepo?.branch}）与主分支合流时是否存在潜在冲突？`)}
                                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <GitMerge className="w-3 h-3 text-indigo-600" />
                                <span>测算主干合并冲突风险</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── 常用业务场景 ── */}
                <div className="w-full max-w-4xl space-y-2.5 pt-1">
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
                      <div className="flex flex-col items-end gap-1">
                        <div className="max-w-xl bg-slate-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                          {msg.content}
                        </div>
                        {msg.createdAt && (
                          <div className="text-[10px] text-slate-400 font-mono pr-1">
                            {formatMessageTime(msg.createdAt)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-3.5 items-start">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </div>

                        <div className="flex-1 space-y-2 min-w-0">
                          {/* 智能体中枢决策与思考流 (Thinking & Action Stream) */}
                          <ThinkingStream
                            timeline={msg.agentTimeline && msg.agentTimeline.length > 0 ? msg.agentTimeline : rebuildTimelineFromMessage(msg)}
                            isThinking={msg.isThinking}
                            activeStepId={focusedStepId}
                            onSelectStep={(stepId) => {
                              setFocusedStepId(stepId);
                              setActiveTraceDrawer({ messageId: msg.id, defaultTab: "flow" });
                            }}
                            reasoning={msg.reasoning}
                            userPrompt={msg.userPrompt}
                          />

                          {/* 文本回复泡 */}
                          <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200/80 p-4.5 shadow-xs text-sm text-slate-800 leading-relaxed font-sans">
                            {msg.content ? (
                              <>
                                <div className="space-y-1">
                                  <Markdown>{msg.content}</Markdown>
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
                                {msg.approvalTicket.warning || "检测到涉及修改或变更数据的敏感指令，已自动暂停并等待安全复核。请授权负责人核准或驳回。"}
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

                              {/* 下载总结 */}
                              <button
                                onClick={() => {
                                  const ok = downloadSummaryReport(msg);
                                  if (ok) {
                                    toast.success("巡检交付总结报告已成功导出下载！", "下载完成");
                                  } else {
                                    toast.warning("当前消息暂无总结内容可供下载");
                                  }
                                }}
                                className="flex items-center gap-1 hover:text-blue-700 hover:bg-blue-50 text-slate-500 transition cursor-pointer px-1.5 py-0.5 rounded border border-transparent hover:border-blue-200"
                                title="下载完整巡检交付总结 (Markdown 报告)"
                              >
                                <Download className="w-3.5 h-3.5 text-blue-600" />
                                <span>下载总结</span>
                              </button>
                            </div>

                            {/* 耗时、时间与 Token 统计，点击查看瀑布流 Trace */}
                            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                              {msg.createdAt && (
                                <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{formatMessageTime(msg.createdAt)}</span>
                                </span>
                              )}
                              {msg.createdAt && (msg.tokens || msg.duration || msg.isCached) && (
                                <span>·</span>
                              )}
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
                                      ? ` (免消耗 ${msg.trace.savedTokens.toLocaleString()} 字符)`
                                      : " (已秒回)"}
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
                                        defaultTab: "flow",
                                      })
                                    }
                                    className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 font-medium hover:underline transition cursor-pointer"
                                    title="点击展开右侧抽屉，查看全链路处理耗时"
                                  >
                                    <Activity className="w-3 h-3 text-blue-500" />
                                    <span>耗时: {msg.duration} (查看耗时 ↗)</span>
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
          <div className="p-4 bg-gradient-to-t from-[#FAFBFC] via-[#FAFBFC]/90 to-transparent shrink-0 space-y-2">
            {/* 快捷 Git 监控提问胶囊 (支持多仓库动态适配) */}
            {(() => {
              const gitWf = workflows.find((w) => w.id === "wf-git-agent" || w.gitRepositories || w.gitConfig);
              if (!gitWf) return null;
              const allRepos = gitWf.gitRepositories || (gitWf.gitConfig ? [gitWf.gitConfig] : []);
              if (allRepos.length === 0) return null;

              return (
                <div className="w-full max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto text-[11px] pb-1 scrollbar-hide">
                  <span className="font-bold text-slate-400 shrink-0 flex items-center gap-1">
                    <FolderGit2 className="w-3 h-3 text-blue-600" />
                    <span>代码库巡检:</span>
                  </span>
                  <button
                    onClick={() => handleSend(`请排查所有被监控的 Git 仓库最新提交是否存在潜在 Bug、未捕获异常或并发死锁？`)}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-600 transition shrink-0 cursor-pointer shadow-2xs font-medium"
                  >
                    🔍 查代码 Bug
                  </button>
                  <button
                    onClick={() => handleSend(`请扫描当前所有 Git 仓库的最新改动，排查是否存在敏感密码与 Key 泄露？`)}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-600 transition shrink-0 cursor-pointer shadow-2xs font-medium"
                  >
                    🛡️ 查密钥泄露
                  </button>
                  <button
                    onClick={() => handleSend(`请汇总今日各个代码库的提交进展，列出核心功能改动。`)}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 transition shrink-0 cursor-pointer shadow-2xs font-medium"
                  >
                    📊 总结提交进展
                  </button>
                </div>
              );
            })()}

            <div className="w-full max-w-5xl mx-auto">
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
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${enableThinking
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
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${enableRAG
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
        defaultTab={activeTraceDrawer?.defaultTab || "waterfall"}
        highlightCitationIndex={activeTraceDrawer?.highlightCitationIndex}
        activeStepId={focusedStepId}
        onSelectStep={(stepId) => setFocusedStepId(stepId)}
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
                  modelName: currentAgent?.model || systemModel || "deepseek-chat",
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
                modelName: targetMsg.modelName || currentAgent?.model || systemModel || "deepseek-chat",
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
