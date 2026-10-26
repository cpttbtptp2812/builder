import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AgentLiveTrace } from "./AgentLiveTrace";
import { AgentMarkdown } from "./agent/AgentMarkdown";
import { AgentReasoningBlock } from "./agent/AgentReasoningBlock";
import { UserMessageBubble } from "./agent/UserMessageBubble";
import { formatMsgTime, formatThreadDateLabel, isSameMsgDay } from "../../lib/formatMsgTime";
import { MessageTimeFoot, ThreadDateDivider } from "./agent/MessageTimeFoot";
import { AgentToolChip } from "./agent/AgentToolChip";
import { AgentWelcome } from "./agent/AgentWelcome";
import { ProductSkillHome } from "./agent/ProductSkillHome";
import { ProductRunParts } from "./agent/ProductRunParts";
import { llmPickSkillId } from "../../lib/productLlmRoute";
import { streamByokChat } from "../../lib/byokLlm";
import { logChatSession, markQueryPublished } from "../../lib/analyticsLog";
import { formatThreadAsPlaza, matchPlaza, publishPlaza, type PlazaItem } from "../../lib/plazaFeed";
import { checkBackendHealth, probeBackendOnce } from "../../lib/apiClient";
import { takeUserDeskRun } from "../../lib/userDeskBridge";
import { getSessionId } from "../../lib/sessionId";
import { HitlTicketCard } from "./agent/HitlTicketCard";
import { PolicyTrustCard } from "./agent/PolicyTrustCard";
import { InlineEvalCard, runInlineEvalAsync } from "./agent/InlineEvalCard";
import { ArtifactPanel } from "./agent/ArtifactPanel";
import { ToolExecutionCard } from "./agent/ToolExecutionCard";
import { PerspectiveSheet } from "./agent/PerspectiveSheet";
import { DeskSurface } from "./agent/deskSurface";
import { ResultLocator } from "./agent/ResultLocator";
import { TraceXRayDrawer, type TraceXRayData } from "./agent/TraceXRayDrawer";
import { AgentTraceMiniRail } from "./agent/AgentTraceMiniRail";
import { ConformalRouteChip } from "./agent/ConformalRouteChip";
import { MerkleAuditModal } from "./agent/MerkleAuditModal";
import { RouteConfidencePanel } from "../ownagent/RouteConfidence";
import { TurnFlowPanel } from "./agent/TurnFlowPanel";
import { allRunnableSkills, explainDiscovery, type AgentSkill } from "../../lib/agentSkills";
import { isProductExplainQuery, resolveProductSkillFirstRoute } from "../../lib/skillRouter";
import { listFollowUpPrompts, listKnowledgePrompts, matchPresetQuery, resolveExplainAnswer } from "../../lib/ownKnowledge";
import { AGENT_QUICK_PROMPTS } from "../../lib/agentRuntime";
import {
  loadOrchestrationMode,
  OwnSettingsSheet,
  type OrchestrationMode,
} from "./agent/OwnSettingsSheet";
import { loadEnabledMcpTools } from "./agent/AgentMcpRegistry";
import {
  type AgentChatMessage,
  type AgentStreamEvent,
  type AgentTurnTrace,
} from "../../lib/agentRuntime";
import { isAuthError, runGuestAgentTurn, toolPreviewFromResult } from "../../lib/guestAgentRuntime";
import { appendSessionTurn, clearSessionTurns } from "../../lib/agentMemory";
import {
  isLlmConfigured,
  loadLlmConfig,
  saveLlmConfig,
  toProductLlmConfig,
  type LlmConfig,
} from "../../lib/llmConfig";
import { downloadText } from "../../lib/importedSkills";
import { draftFromMessages, type DemoDraft } from "../../lib/skillFromDemo";
import { executePageTool } from "../../lib/pageTools";
import { interpretPageUtterance } from "../../lib/pageUtterance";
import { SkillFromDemoDialog } from "../ownagent/SkillFromDemo";
import { ReplyVersionSwitch } from "./agent/ReplyVersionSwitch";
import { runMultiAgentAsync } from "../../lib/backendBridge";
import type { MultiAgentStep } from "../../lib/multiAgentRuntime";
import { getRuntimeConfig } from "../../lib/runtimeConfig";
import { buildWorkingSet, type WorkingSet } from "../../lib/workingSet";
import {
  activateFlowNode,
  addFlowChip,
  addFlowEvidence,
  applyProductRunGateJournal,
  applyProductRunProcessJournal,
  createFlowJournal,
  evidenceFromKnowledgeResult,
  evidenceFromTool,
  finishFlowJournal,
  normalizeFlowJournal,
  setFlowChips,
  setFlowEvidence,
  type FlowEvidence,
  type FlowJournalId,
  type FlowJournalNode,
} from "../../lib/turnFlowJournal";
import type { TicketDraft } from "../../lib/policyDesk";
import { followUpsFor, type PolicyTrustView, type RouteScoreView, type InlineEvalView } from "../../lib/chatFrontier";
import { buildAnswerInsight } from "../../lib/answerInsight";
import { normalizeFollowUps } from "../../lib/followUpPrompts";
import { AnswerInsightBar } from "./agent/AnswerInsightBar";
import { FollowUpRail } from "./agent/FollowUpRail";
import { NeuralTraceStrip } from "./agent/NeuralTraceStrip";
import { InputSuggestPopup } from "./agent/InputSuggestPopup";
import { SessionStats } from "./agent/SessionStats";
import { MessageMetaBar } from "./agent/MessageMetaBar";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { KnowledgeSources } from "./agent/KnowledgeSources";
import { AnswerDNA } from "./agent/AnswerDNA";
import { GapDetectionCard } from "./agent/GapDetectionCard";
import { PlazaHitPop, PrecheckLine, usePrecheck } from "./agent/PlazaComposeRouter";
import { PlazaRouteCard } from "./agent/PlazaRouteCard";
import { TurnReplayTheater } from "./agent/TurnReplayTheater";
import { MultiAgentWorkflowCard } from "./agent/MultiAgentWorkflowCard";
import { McpSandboxDrawer } from "./agent/McpSandboxDrawer";
import { ContextMemoryDrawer } from "./agent/ContextMemoryDrawer";
import { EnterpriseScenarioLauncher } from "./agent/EnterpriseScenarioLauncher";
import { runMcpAgentPipeline } from "../../lib/mcpAgentRuntime";
import { ChatQuickPrompts } from "./agent/ChatQuickPrompts";
import { ComposeModelBar } from "./agent/ComposeModelBar";
import { ReleaseInspectCard } from "./agent/ReleaseInspectCard";
import { ReleaseInspectEntry } from "./agent/ReleaseInspectEntry";
import {
  parseReleaseInspectRequest,
  releaseReportMarkdown,
  runReleaseInspect,
  type ReleaseInspectReport,
} from "../../lib/releaseInspect";
import { saveGapDraft } from "../../lib/knowledgeGapWizard";
import { SessionInsight } from "./agent/SessionInsight";
import { buildTurnArtifacts, synthesizeCompareTable, type ChatArtifact, type ArtifactTable } from "../../lib/chatArtifacts";
import {
  emptySession,
  loadSessionStore,
  persistSessionStore,
  type SessionScope,
  sessionToJson,
  sessionToMarkdown,
  upsertActive,
  type OwnChatMessage,
  type OwnSession,
  type PlazaSourceView,
} from "../../lib/ownagentSessions";
import { activeVersionId, skillsForVersion, versionAgreesWithLive } from "../../lib/catalogSets";
import { activePromptLabel, getActiveSystemAddon } from "../../lib/agentPromptRuntime";
import { evaluatePolicyGate } from "../../lib/policyGate";
import {
  ANSWER_CLASS,
  getConformalRouter,
  recordRouteFeedback,
  semanticStatus,
  upgradeToSemantic,
  type RouteVerdict,
} from "../../lib/conformalRouter";
import { parseSlash, slashSuggestions } from "../../lib/slashCommands";
import { OwnCommandPalette, type PaletteItem } from "../ownagent/OwnCommandPalette";
import { WorkPaperCard, WorkPaperView } from "../ownagent/WorkPaper";
import { WorkPaperArtifactCard } from "./agent/WorkPaperArtifactCard";
import { WorkPaperDrawer } from "../ownagent/WorkPaperDrawer";
import { FlowOperationDrawer } from "../ownagent/FlowOperationDrawer";
import { HUB_CHAT_PROMPTS } from "../../lib/platformCatalog";
import { syncServerLiveSkills } from "../../lib/skillPublished";
import { paperBrief, paperDrawerTitle, paperExportGrid, type WorkPaper } from "../../lib/workPaper";
import { csvPatchForPaperRerun } from "../../lib/productPaperPatch";
import { apiArchiveProductRun, apiRerunProductRun, apiUploadProductDataset, viewFromStreamStart } from "../../lib/productRun/client";
import type { ProductRunView } from "../../lib/productRun/types";
import { gridToCsv, type ProductDataSlot } from "../../lib/productDataStore";

type PaperDrawerCtx = {
  paper: WorkPaper | null;
  messageId: string;
  processId?: string;
  skillId?: string;
  query?: string;
  version?: string;
  table?: ArtifactTable | null;
  run?: ProductRunView | null;
};

function paperDrawerFromMessage(
  m: OwnChatMessage,
  paper: WorkPaper | null,
  table?: ArtifactTable | null,
): PaperDrawerCtx {
  return {
    paper,
    messageId: m.id,
    processId: m.productRun?.processId,
    skillId: m.productRun?.skillId ?? m.route?.skillId,
    query: m.productRun?.query,
    version: m.productRun?.parts.find((part) => part.kind === "finish")?.summary,
    table: table ?? null,
    run: m.productRun ?? null,
  };
}
import { ShowcaseFlowBubble } from "../ownagent/ShowcaseFlowBubble";
import { flowUsesUnifiedHubDrawer, shouldBindHubCreditFlow } from "../../lib/creditFlowUiGate";
import { creditFlowById, matchCreditFlowId } from "../../lib/creditFlowCatalog";
import {
  displayCreditFlowAt,
  isFlowExitQuery,
  isHubFlowButtonQuery,
  resumeCreditFlowFromShowcase,
  rewindCreditFlowToRawStep,
  type CreditFlowState,
} from "../../lib/creditFlowEngine";
import { creditFlowSkillId } from "../../lib/creditFlowUi";
import { getMcpTool } from "../../lib/mcpBridgeLab";
import { useThreadScroll } from "../../hooks/useThreadScroll";

let uidSeq = 0;
function uid() {
  uidSeq += 1;
  return `m-${Date.now().toString(36)}-${uidSeq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type ToolChipState = NonNullable<OwnChatMessage["tools"]>[number];

function toolLabel(name: string) {
  return getMcpTool(name)?.labelZh ?? name;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** OwnAgent 对话 — UniAgent 布局 + 理论流水线 / HITL / 多代理 */
function PublishToFeedButton({
  question,
  answer,
  thread,
}: {
  question: string;
  answer: string;
  thread: { role: string; content: string }[];
}) {
  const [state, setState] = useState<"idle" | "one" | "all" | "done-one" | "done-all" | "err">("idle");
  const [offlineHint, setOfflineHint] = useState(false);
  if (state === "done-one" || state === "done-all") {
    return (
      <span className="kf-published-hint">
        {state === "done-all" ? "✅ 整段对话已发布到广场" : "✅ 本条已发布到广场"}
        {offlineHint ? "（已保存到本机）" : ""}
      </span>
    );
  }
  async function publish(kind: "one" | "all") {
    setState(kind);
    try {
      let result;
      if (kind === "all") {
        const packed = formatThreadAsPlaza(thread);
        if (!packed) { setState("idle"); return; }
        result = await publishPlaza({ question: packed.question, answer: packed.answer, author: "对话共享" });
        setOfflineHint(Boolean(result.offline));
        void markQueryPublished(packed.question);
        setState("done-all");
      } else {
        result = await publishPlaza({ question, answer });
        setOfflineHint(Boolean(result.offline));
        void markQueryPublished(question);
        setState("done-one");
      }
    } catch {
      setState("err");
      window.setTimeout(() => setState("idle"), 2000);
    }
  }
  return (
    <div className="kf-publish-row">
      <button type="button" className="kf-publish-inline" disabled={state !== "idle" && state !== "err"} onClick={() => void publish("one")}>
        {state === "one" ? "发布中…" : state === "err" ? "发布失败" : "📤 发布本条问答"}
      </button>
      <button type="button" className="kf-publish-inline kf-publish-inline--all" disabled={state !== "idle" && state !== "err"} onClick={() => void publish("all")}>
        {state === "all" ? "发布中…" : "📋 发布整段对话"}
      </button>
    </div>
  );
}

export function AgentProductDemo({
  autoStart: _autoStart = false,
  hubMode = false,
  onFlowActive,
  listenUserRun = false,
  sessionScope = "admin",
}: {
  autoStart?: boolean;
  hubMode?: boolean;
  onFlowActive?: (nodeId: string) => void;
  /** 用户端：把一句话放进输入框 */
  listenUserRun?: boolean;
  /** 用户端单独记会话，不带出管理端里已经办过的记录 */
  sessionScope?: SessionScope;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const clarifyRef = useRef<{ query: string; options: { label: string; id: string }[] } | null>(null);
  const sendLockRef = useRef(false);
  const journalFlushTimer = useRef<number | undefined>(undefined);
  const [footerHeight, setFooterHeight] = useState(120);
  const latestAnswerIdRef = useRef<string | null>(null);

  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => loadLlmConfig());
  const [enabledTools, setEnabledTools] = useState<string[]>(() => loadEnabledMcpTools());
  const [orchMode, setOrchMode] = useState<OrchestrationMode>(() => loadOrchestrationMode());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"knowledge" | "runtime">("runtime");
  const [kbRev, setKbRev] = useState(0);
  const boot = useRef(loadSessionStore(sessionScope));
  const [store, setStore] = useState(boot.current);
  const active = store.sessions.find((s) => s.id === store.activeId) ?? store.sessions[0]!;
  const [messages, setMessages] = useState<OwnChatMessage[]>(() => active.messages);
  const [history, setHistory] = useState<AgentChatMessage[]>(() => active.history);
  const [creditFlow, setCreditFlow] = useState<CreditFlowState | null>(() => active.creditFlow ?? null);
  const historyRef = useRef(history);
  historyRef.current = history;
  const creditFlowRef = useRef(creditFlow);
  creditFlowRef.current = creditFlow;
  /** Hub 信贷流：同一条助理卡片原地更新，不每步新开气泡 */
  const hubFlowAnchorRef = useRef<string | null>(null);
  const hubFlowCheckpointRef = useRef<CreditFlowState | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [input, setInput] = useState("");
  const [draftHint, setDraftHint] = useState("");
  const [composeFocused, setComposeFocused] = useState(false);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!draftHint) return;
    composeRef.current?.focus();
  }, [draftHint, input]);
  const [running, setRunning] = useState(false);
  const precheck = usePrecheck(hubMode ? input : "", running);

  useEffect(() => {
    if (!hubMode) void syncServerLiveSkills();
  }, [hubMode]);

  useLayoutEffect(() => {
    const el = composeRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);
  const [traces, setTraces] = useState<AgentTurnTrace[]>([]);
  const [iteration, setIteration] = useState(0);
  const [streamReasoning, setStreamReasoning] = useState("");
  const [streamText, setStreamText] = useState("");
  const [modelThought, setModelThought] = useState("");
  const [thoughtStreaming, setThoughtStreaming] = useState(false);
  const [liveTools, setLiveTools] = useState<ToolChipState[]>([]);
  const [flowJournal, setFlowJournal] = useState<FlowJournalNode[]>([]);
  const [flowTurnStartedAt, setFlowTurnStartedAt] = useState<number | null>(null);
  const [turnRuntime, setTurnRuntime] = useState<"server" | "local" | undefined>();
  const [turnRagRuntime, setTurnRagRuntime] = useState<"server" | "local" | undefined>();
  const [highlightTerm, setHighlightTerm] = useState<string | null>(null);
  const [liveMulti, setLiveMulti] = useState<MultiAgentStep[]>([]);
  const [mcpSandboxOpen, setMcpSandboxOpen] = useState(false);
  const [sandboxToolName, setSandboxToolName] = useState<string>("ledger_reconcile");
  const [contextMemoryOpen, setContextMemoryOpen] = useState(false);
  const [contextTokenStats, setContextTokenStats] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costYuan?: number;
  } | null>(null);
  const [inspector, setInspector] = useState(false);
  const [flowOpen, setFlowOpen] = useState(() => hubMode);
  const [rightTab, setRightTab] = useState<"graph" | "trace" | "insight">(hubMode ? "graph" : "trace");
  const [productProgressTab, setProductProgressTab] = useState<"graph" | "process" | "notes">("process");
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pinned, setPinned] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState<DemoDraft | null>(null);
  const [skillSavedNote, setSkillSavedNote] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [resultFlash, setResultFlash] = useState(false);
  const [xrayTraceData, setXrayTraceData] = useState<TraceXRayData | null>(null);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [merkleModalOpen, setMerkleModalOpen] = useState(false);
  const liveProductRunRef = useRef<import("../../lib/productRun/types").ProductRunView | null>(null);
  const [liveProductRun, setLiveProductRun] = useState<import("../../lib/productRun/types").ProductRunView | null>(
    null,
  );

  const { listening: voiceListening, supported: voiceSupported, start: voiceStart, stop: voiceStop } = useVoiceInput(
    useCallback((text: string, _final: boolean) => {
      setInput(text);
    }, []),
  );

  const {
    threadRef,
    contentRef,
    sentinelRef,
    away,
    focusId,
    scrollToBottom,
    scrollToMessage,
    onThreadScroll,
    stickRef,
  } = useThreadScroll([
    messages.length,
    streamText,
    streamReasoning,
    liveTools.length,
    flowJournal.length,
    liveMulti.length,
    running,
    footerHeight,
  ]);

  const useLlm = isLlmConfigured(llmConfig);
  const emptyMessage = messages.length === 0 && !running;

  const handleLlmChange = useCallback((cfg: LlmConfig) => {
    saveLlmConfig(cfg);
    setLlmConfig(cfg);
    window.dispatchEvent(new CustomEvent("ownagent:config-updated"));
  }, []);

  useEffect(() => {
    const syncConfig = () => {
      setLlmConfig(loadLlmConfig());
      setEnabledTools(loadEnabledMcpTools());
      if (!hubMode) setOrchMode("single");
      else setOrchMode(loadOrchestrationMode());
    };
    syncConfig();
    window.addEventListener("ownagent:config-updated", syncConfig);
    return () => window.removeEventListener("ownagent:config-updated", syncConfig);
  }, [hubMode]);
  const slashMenu = hubMode ? slashSuggestions(input) : [];

  const railItems = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        label: m.content.replace(/\s+/g, " ").slice(0, 28) || m.role,
      })),
    [messages],
  );

  useEffect(() => {
    void probeBackendOnce().then((health) => {
      if (health?.ok) void getRuntimeConfig();
    });
  }, []);

  useEffect(() => {
    hubFlowCheckpointRef.current = creditFlow ?? hubFlowCheckpointRef.current;
  }, [creditFlow]);

  useEffect(() => {
    if (!hubMode) {
      hubFlowAnchorRef.current = null;
      return;
    }
    if (!creditFlow?.flowId) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.showcaseFlow?.flowId === creditFlow.flowId) {
        hubFlowAnchorRef.current = m.id;
        if (m.creditFlowCheckpoint) hubFlowCheckpointRef.current = m.creditFlowCheckpoint;
        return;
      }
    }
  }, [hubMode, creditFlow?.flowId, messages]);

  const lastAsst = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );
  const mcpTable = useMemo(() => {
    if (hubMode) return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message?.role !== "assistant") continue;
      const fromArtifact = message.artifacts?.find((item) => item.kind === "table" && item.rows.length > 0);
      if (fromArtifact && fromArtifact.kind === "table") return { messageId: message.id, table: fromArtifact };
      const paper = message.workPaper;
      if (paper?.kind === "tables") {
        const sheet = paper.tables.find((item) => item.grid.rows.length > 0);
        if (sheet) {
          return {
            messageId: message.id,
            table: {
              id: sheet.id,
              kind: "table" as const,
              title: sheet.name || paper.title,
              columns: sheet.grid.columns,
              rows: sheet.grid.rows,
            },
          };
        }
      }
      if (paper?.kind === "ledger" && paper.grid.rows.length > 0) {
        return {
          messageId: message.id,
          table: {
            id: "ledger-grid",
            kind: "table" as const,
            title: paper.title,
            columns: paper.grid.columns,
            rows: paper.grid.rows,
          },
        };
      }
    }
    return null;
  }, [hubMode, messages]);
  const lastAsstId = lastAsst?.id;

  const [replayMsg, setReplayMsg] = useState<OwnChatMessage | null>(null);
  const [paperDrawer, setPaperDrawer] = useState<PaperDrawerCtx | null>(null);
  const [inlineExpandedMap, setInlineExpandedMap] = useState<Record<string, boolean>>({});
  const ledgerInvoiceOverridesRef = useRef<Record<number, string>>({});
  const [sealedPaperMessages, setSealedPaperMessages] = useState<Set<string>>(() => new Set());
  const [flowOpDrawer, setFlowOpDrawer] = useState<{
    messageId: string;
    flow: NonNullable<OwnChatMessage["showcaseFlow"]>;
    paper?: WorkPaper | null;
  } | null>(null);
  /** 流程中自由输入：先问是否结束流程（对齐 credit 助手） */
  const [flowExitPrompt, setFlowExitPrompt] = useState<{
    query: string;
    flowName: string;
    intent: "exit" | "freeText";
  } | null>(null);

  const applyPaperRerun = useCallback(
    async (
      replacement?: { slot: ProductDataSlot; csv: string; title: string },
      overrideCtx?: PaperDrawerCtx | null,
    ) => {
      const ctx = overrideCtx ?? paperDrawer;
      if (!ctx?.processId || !ctx.skillId) {
        window.alert("请在本轮办理完成后使用一键修正；若流程已过期，请用同一问法重新发起。");
        throw new Error("missing process");
      }
    const patch =
      replacement ??
      csvPatchForPaperRerun(ctx.paper, ctx.skillId, {
        invoiceOverrides: ledgerInvoiceOverridesRef.current,
      });
    if (!patch) {
      window.alert("当前文书暂不支持自动写回，请在左侧说明要改的内容。");
      throw new Error("no patch");
    }
    const sessionId = getSessionId();
    const up = await apiUploadProductDataset({
      sessionId,
      slot: patch.slot,
      csv: patch.csv,
      title: replacement?.title,
    });
    if (!up.ok) {
      window.alert(up.error ?? "写回业务数据失败");
      throw new Error(up.error ?? "upload");
    }

    const messageId = ctx.messageId;
    setSealedPaperMessages((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    let live: ProductRunView = viewFromStreamStart(ctx.processId, ctx.skillId, ctx.query ?? "", "running");
    setLiveProductRun(live);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              productRun: live,
              content: "正在按修正后的数据重新办理…",
            }
          : msg,
      ),
    );

    const llmPayload =
      isLlmConfigured(llmConfig) ? toProductLlmConfig(llmConfig) : undefined;
    const res = await apiRerunProductRun(
      ctx.processId,
      sessionId,
      {
      onStep: (part) => {
        live = {
          ...live,
          status: "running",
          parts: [...live.parts.filter((p) => p.kind !== "finish"), part],
        };
        setLiveProductRun(live);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, productRun: live } : msg)),
        );
      },
      onFinish: (fin) => {
        live = {
          processId: fin.processId,
          skillId: fin.skillId,
          query: fin.query,
          status: "finish",
          parts: fin.parts,
        };
      },
    },
      undefined,
      llmPayload,
    );

    if (!res.ok) {
      window.alert(res.error);
      throw new Error(res.error);
    }

    const nextPaper = res.status === "finish" ? res.paper ?? null : null;
    const nextRun =
      live.status === "finish"
        ? live
        : {
            processId: res.processId,
            status: res.status,
            skillId: res.skillId,
            query: res.query,
            parts: res.parts,
          };

    setLiveProductRun(nextRun.status === "finish" ? nextRun : null);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content: res.ok && res.status === "finish" ? res.message : msg.content,
              workPaper: nextPaper ?? msg.workPaper,
              productRun: nextRun,
              runtime: "server",
            }
          : msg,
      ),
    );
    if (nextPaper) {
      ledgerInvoiceOverridesRef.current = {};
      setPaperDrawer({
        paper: nextPaper,
        messageId,
        processId: nextRun.processId,
        skillId: nextRun.skillId,
        query: nextRun.query,
      });
    }
  }, [paperDrawer, llmConfig]);

  const replacePaperMaterial = useCallback(
    async (
      slot: ProductDataSlot,
      csv: string,
      title: string,
      overrideCtx?: PaperDrawerCtx | null,
    ) => {
      await applyPaperRerun({ slot, csv, title }, overrideCtx);
    },
    [applyPaperRerun],
  );

  const sealPaperDeliverable = useCallback(
    async (overrideCtx?: PaperDrawerCtx | null) => {
      const ctx = overrideCtx ?? paperDrawer;
      if (!ctx?.messageId || !ctx.processId) return;
      const archived = await apiArchiveProductRun(ctx.processId, getSessionId());
      if (!archived.ok) {
        window.alert(archived.error ?? "办结归档失败");
        return;
      }
      const deliverable = "明细可在详情抽屉右下角下载 CSV";
      const sealLine = `\n\n**办结**：人工复核通过，本次办理结果已归档；${deliverable}。`;
      setSealedPaperMessages((prev) => new Set(prev).add(ctx.messageId));
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === ctx.messageId
            ? {
                ...msg,
                content: msg.content.includes("**办结**") ? msg.content : `${msg.content.trim()}${sealLine}`,
              }
            : msg,
        ),
      );
    },
    [paperDrawer],
  );

  const openHubFlowDrawer = useCallback(
    (
      messageId: string,
      flow: NonNullable<OwnChatMessage["showcaseFlow"]>,
      paper?: WorkPaper | null,
    ) => {
      if (
        !flowUsesUnifiedHubDrawer(flow.flowId, flow.stepId, flow.ui ?? null) &&
        !paper
      ) {
        return;
      }
      setPaperDrawer(null);
      setFlowOpDrawer((prev) => ({
        messageId,
        flow,
        paper: paper ?? prev?.paper ?? null,
      }));
    },
    [],
  );

  const jumpFlowStage = useCallback(
    (rawIndex: number) => {
      let state = creditFlowRef.current;
      const anchorId = hubFlowAnchorRef.current;
      if (!hubMode || !anchorId) return;
      if (!state) {
        const anchor = messagesRef.current.find((m) => m.id === anchorId);
        if (anchor?.showcaseFlow) {
          state =
            anchor.creditFlowCheckpoint ??
            resumeCreditFlowFromShowcase(anchor.showcaseFlow, anchor.creditFlowCheckpoint);
        }
      }
      if (!state) return;
      const restarted = rewindCreditFlowToRawStep(state, rawIndex);
      setCreditFlow(restarted);
      creditFlowRef.current = restarted;
      hubFlowCheckpointRef.current = restarted;
      const result = displayCreditFlowAt(restarted, rawIndex);
      if (!result?.showcaseFlow) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === anchorId
            ? {
                ...m,
                content: result.markdown,
                showcaseFlow: result.showcaseFlow,
                workPaper: result.paper ?? m.workPaper,
                creditFlowCheckpoint: restarted,
              }
            : m,
        ),
      );
      openHubFlowDrawer(anchorId, result.showcaseFlow, result.paper);
    },
    [hubMode, openHubFlowDrawer],
  );

  const hubFlowLiveMsgId = useMemo(() => {
    if (!hubMode || !running || !creditFlow?.flowId) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.showcaseFlow?.flowId === creditFlow.flowId) return m.id;
    }
    return null;
  }, [hubMode, running, creditFlow?.flowId, messages]);
  /** 输入框上方快捷问句 — 资料库预制 + 站点能力演示 */
  const quickPromptItems = useMemo(() => {
    if (running) return [];
    const seen = new Set<string>();
    const push = (label: string, text: string, hint?: string) => {
      const key = text.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ label: label.trim(), text: text.trim(), hint });
    };
    const out: { label: string; text: string; hint?: string }[] = [];

    if (hubMode) {
      if (creditFlow) return out;
      for (const p of HUB_CHAT_PROMPTS) {
        if (out.length >= 6) break;
        push(p.label, p.text, p.hint ?? "Hub");
      }
      if (out.length) return out;
    }

    if (emptyMessage) {
      if (hubMode) {
        for (const p of listKnowledgePrompts(6)) push(p.label, p.text, p.hint);
        for (const p of AGENT_QUICK_PROMPTS) push(p.label, p.text, "内置能力");
        return out.slice(0, 8);
      }
      return out;
    }

    const fromLast = normalizeFollowUps(lastAsst?.followUps);
    if (fromLast.length) {
      for (const p of fromLast.slice(0, 4)) push(p.text, p.text, p.hint);
      return out;
    }
    if (!hubMode) return [];
    const exclude = messages.map((m) => m.content);
    for (const t of listFollowUpPrompts(exclude, hubMode ? 5 : 3)) push(t, t);
    return out.slice(0, hubMode ? 5 : 4);
  }, [running, emptyMessage, lastAsst, messages, kbRev, hubMode, creditFlow, sessionScope]);

  const threadSearchNorm = threadSearch.trim().toLowerCase();
  const threadMatchCount = useMemo(() => {
    if (!threadSearchNorm) return 0;
    return messages.filter((m) => m.content.toLowerCase().includes(threadSearchNorm)).length;
  }, [messages, threadSearchNorm]);

  useEffect(() => {
    setStore((prev) => {
      const cur = prev.sessions.find((s) => s.id === prev.activeId);
      if (cur && cur.messages === messages && cur.history === history && cur.creditFlow === creditFlow) {
        return prev;
      }
      const next = upsertActive(prev, { messages, history, creditFlow });
      persistSessionStore(next, sessionScope);
      return next;
    });
  }, [messages, history, creditFlow, sessionScope]);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const sync = () => {
      const h = el.offsetHeight;
      setFooterHeight((prev) => (prev === h ? prev : h));
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    return () => ro.disconnect();
  }, []);

  const handleEvent = useCallback((ev: AgentStreamEvent, toolsAcc: ToolChipState[]) => {
    if (ev.type === "iteration") setIteration(ev.n);
    if (ev.type === "trace-sync") setTraces(ev.traces);
    if (ev.type === "reasoning-delta") setStreamReasoning((s) => s + ev.text);
    if (ev.type === "text-delta" && !hubMode) setStreamText((s) => s + ev.text);
    if (ev.type === "product-run" && !hubMode) {
      liveProductRunRef.current = ev.run;
      setLiveProductRun(ev.run);
    }
    if (ev.type === "tool-start") {
      onFlowActive?.("mcp");
      toolsAcc.push({ id: ev.tool.id, name: ev.tool.name, state: "loading" });
      setLiveTools([...toolsAcc]);
    }
    if (ev.type === "tool-end") {
      const preview = toolPreviewFromResult(ev.tool.name, ev.tool.result);
      const row: ToolChipState = {
        id: ev.tool.id,
        name: ev.tool.name,
        state: ev.tool.ok === false ? "error" : "ok",
        ms: ev.tool.ms,
        preview: preview || undefined,
      };
      const idx = toolsAcc.findIndex((t) => t.id === ev.tool.id);
      if (idx >= 0) toolsAcc[idx] = row;
      else toolsAcc.push(row);
      setLiveTools([...toolsAcc]);
    }
  }, [onFlowActive, hubMode]);

  const send = useCallback(
    async (
      text: string,
      forcedVersionId?: string,
      catalog?: AgentSkill[],
      opts?: { flowSilent?: boolean; pinSkillId?: string },
    ) => {
      const parsed = parseSlash(text);
      if (!parsed.query.trim() || running || sendLockRef.current) return;
      setDraftHint("");
      if (!hubMode && parsed.matched) {
        sendLockRef.current = false;
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "user",
            content: text.trim(),
            createdAt: Date.now(),
          },
          {
            id: uid(),
            role: "assistant",
            content: "请直接描述要办的业务，无需输入命令。技能检查与回归请在左侧「技能」中操作。",
            createdAt: Date.now(),
            mode: "guest",
          },
        ]);
        setInput("");
        return;
      }
      const clarify = clarifyRef.current;
      clarifyRef.current = null;
      const picked = clarify?.options.find((o) => o.label === text.trim());
      const q = picked ? clarify!.query : parsed.query.trim();
      if (picked) recordRouteFeedback(q, picked.id);

      sendLockRef.current = true;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const inspectPreview = parseReleaseInspectRequest(q);
      /** 仅流程卡片/抽屉按钮静默（不插用户气泡、不闪底部 OA）；键盘输入始终正常出用户句 */
      const flowSilent = opts?.flowSilent === true;
      let flowState = creditFlowRef.current;
      if (hubMode && !flowState && (flowSilent || isHubFlowButtonQuery(q))) {
        let anchorId = hubFlowAnchorRef.current;
        if (!anchorId) {
          for (let i = messagesRef.current.length - 1; i >= 0; i--) {
            const m = messagesRef.current[i];
            if (m.role === "assistant" && m.showcaseFlow?.flowId && m.showcaseFlow.stepId !== "__exit__") {
              anchorId = m.id;
              hubFlowAnchorRef.current = m.id;
              break;
            }
          }
        }
        const anchor = anchorId ? messagesRef.current.find((m) => m.id === anchorId) : undefined;
        const restored = anchor?.showcaseFlow
          ? resumeCreditFlowFromShowcase(
              anchor.showcaseFlow,
              anchor.creditFlowCheckpoint ?? hubFlowCheckpointRef.current,
            )
          : hubFlowCheckpointRef.current;
        if (restored) {
          flowState = restored;
          creditFlowRef.current = restored;
          setCreditFlow(restored);
          hubFlowCheckpointRef.current = restored;
        }
      }
      const matchedFlowId = hubMode ? matchCreditFlowId(q) : null;
      let startingNewFlow = false;
      if (hubMode && matchedFlowId && flowState?.flowId && matchedFlowId !== flowState.flowId) {
        flowState = null;
        hubFlowAnchorRef.current = null;
        startingNewFlow = true;
      } else if (hubMode && matchedFlowId && !flowState) {
        startingNewFlow = true;
        hubFlowAnchorRef.current = null;
      }
      const hubFlowBind = hubMode && shouldBindHubCreditFlow(q, flowState, { flowSilent });

      if (
        hubMode &&
        flowState?.flowId &&
        !flowSilent &&
        !parsed.force &&
        !inspectPreview &&
        (isFlowExitQuery(q) || !hubFlowBind)
      ) {
        const flowName = creditFlowById(flowState.flowId)?.name ?? "信贷流程";
        setFlowExitPrompt({
          query: q,
          flowName,
          intent: isFlowExitQuery(q) ? "exit" : "freeText",
        });
        setInput("");
        sendLockRef.current = false;
        return;
      }

      const userMsg: OwnChatMessage = {
        id: uid(),
        role: "user",
        content: inspectPreview ? `巡检 ${inspectPreview.url}` : text.trim(),
        rawQuery: inspectPreview ? q : undefined,
        createdAt: Date.now(),
      };
      const flowAnchor = hubFlowAnchorRef.current;
      const assistantId =
        hubMode && flowSilent && creditFlowRef.current?.flowId && flowAnchor ? flowAnchor : uid();
      const toolsAcc: ToolChipState[] = [];
      const t0 = performance.now();
      const journalRef = { current: createFlowJournal(q) };
      const syncJournalNow = () => {
        if (journalFlushTimer.current != null) {
          window.clearTimeout(journalFlushTimer.current);
          journalFlushTimer.current = undefined;
        }
        setFlowJournal([...journalRef.current]);
      };
      const syncJournal = () => {
        if (hubMode) {
          if (journalFlushTimer.current != null) window.clearTimeout(journalFlushTimer.current);
          journalFlushTimer.current = window.setTimeout(() => {
            journalFlushTimer.current = undefined;
            setFlowJournal([...journalRef.current]);
          }, 120);
          return;
        }
        syncJournalNow();
      };
      const jActivate = (id: FlowJournalId) => {
        journalRef.current = activateFlowNode(journalRef.current, id);
        syncJournal();
      };
      const jChip = (id: FlowJournalId, chip: string) => {
        journalRef.current = addFlowChip(journalRef.current, id, chip);
        syncJournal();
      };
      syncJournal();
      setFlowTurnStartedAt(Date.now());
      setHighlightTerm(null);
      setLiveMulti([]);

      stickRef.current = true;
      scrollToBottom(false);
      onFlowActive?.("input");
      if (!flowSilent) {
        setMessages((prev) => [...prev, userMsg]);
      }
      setInput("");
      setRunning(true);
      if (!hubMode) {
        setRightTab("trace");
      }
      setTurnRuntime(undefined);
      setTurnRagRuntime(undefined);
      setResultFlash(false);
      setTraces([]);
      setIteration(0);
      setStreamReasoning("");
      setStreamText("");
      setModelThought("");
      setThoughtStreaming(false);
      setLiveTools([]);
      setLiveProductRun(null);
      window.setTimeout(() => onFlowActive?.("router"), 240);

      let fullReasoning = "";
      let fullText = "";
      let hitl: TicketDraft | undefined;
      let multiSteps: MultiAgentStep[] = [];
      let workingSet: WorkingSet | undefined;
      let policyTrust: PolicyTrustView | undefined;
      let route: RouteScoreView | undefined;
      let conformalVerdictTurn: RouteVerdict | undefined;
      let workPaper: WorkPaper | null = null;
      let inlineEval: InlineEvalView | undefined;
      let artifacts: ChatArtifact[] = [];
      let mode: OwnChatMessage["mode"] = useLlm ? "llm" : "guest";
      let plazaHit = false;
      let plazaSourceLocal: PlazaSourceView | undefined;
      let turnRuntimeLocal: "server" | "local" | undefined;
      let turnRagRuntimeLocal: "server" | "local" | undefined;
      let releaseInspectReport: ReleaseInspectReport | undefined;
      let forcedFollowUps: string[] | undefined;
      let pinSkillId: string | undefined = opts?.pinSkillId;
      let showcaseFlowTurn: OwnChatMessage["showcaseFlow"];
      let productRun: OwnChatMessage["productRun"];
      let turnDone = false;

      const bindStreamJournal = (ev: AgentStreamEvent) => {
        if (ev.type === "reasoning-delta") {
          const line = ev.text.split("\n").pop()?.trim();
          if (line) jChip("route", line.slice(0, 72));
        }
        if (ev.type === "tool-start") {
          jActivate("fetch");
          jChip("fetch", `正在调用 ${toolLabel(ev.tool.name)}…`);
        }
        if (ev.type === "tool-end") {
          if (ev.tool.name === "knowledge_search") {
            const ragMeta = ev.tool.result as { runtime?: "server" | "local"; pipeline?: string[] } | undefined;
            if (ragMeta?.runtime) {
              turnRagRuntimeLocal = ragMeta.runtime;
              setTurnRagRuntime(ragMeta.runtime);
              jChip("fetch", `Hybrid RAG · ${ragMeta.runtime === "server" ? "SQLite" : "浏览器"}`);
            }
            journalRef.current = setFlowEvidence(
              journalRef.current,
              "fetch",
              evidenceFromKnowledgeResult(ev.tool.result),
            );
            syncJournal();
          } else {
            journalRef.current = addFlowEvidence(
              journalRef.current,
              "fetch",
              evidenceFromTool(ev.tool.name, ev.tool.result, toolPreviewFromResult(ev.tool.name, ev.tool.result)),
            );
            syncJournal();
          }
        }
      };

      const finish = (content: string, reasoning?: string) => {
        if (turnDone) return;
        turnDone = true;
        const gateRun = productRun?.status === "waiting_import" ? productRun : liveProductRunRef.current?.status === "waiting_import" ? liveProductRunRef.current : null;
        if (gateRun) {
          const imports = gateRun.parts.filter((p) => p.kind === "import").map((p) => ({
            label: p.label,
            ready: p.ready,
            materialTitle: p.materialTitle,
            rowCount: p.rowCount,
            slot: p.slot,
          }));
          journalRef.current = applyProductRunGateJournal(journalRef.current, imports);
        } else if (productRun?.status === "finish") {
          const steps = productRun.parts
            .filter((p) => p.kind === "process")
            .map((p) => ({ label: p.label, detail: p.detail, ok: p.ok }));
          journalRef.current = applyProductRunProcessJournal(
            journalRef.current,
            steps,
            content,
            "finish",
          );
          journalRef.current = finishFlowJournal(journalRef.current);
        } else {
          journalRef.current = finishFlowJournal(journalRef.current);
          if (content.trim()) {
            journalRef.current = setFlowEvidence(journalRef.current, "write", [
              {
                id: "answer",
                kind: "stream",
                title: "答复已生成",
                excerpt: content.replace(/\s+/g, " ").trim().slice(0, 140),
                meta: `${content.length} 字`,
              },
            ]);
          }
        }
        syncJournalNow();
        setFlowTurnStartedAt(null);
        const ms = Math.round(performance.now() - t0);
        const built = buildTurnArtifacts({
          content,
          inlineEval,
          policyTrust,
          tools: toolsAcc,
          ms,
        });
        const merged = [...artifacts, ...built].filter(
          (a, i, arr) => arr.findIndex((x) => x.id === a.id && x.kind === a.kind) === i,
        );
        // 避免 markdown 表与显式工件重复
        const deduped =
          artifacts.some((a) => a.kind === "table" && a.surface === "sheet")
            ? merged.filter((a) => !(a.kind === "table" && a.id.startsWith("md-table-")))
            : merged;
        const asked = [...messages.map((m) => m.content), q, text.trim()];
        const followUps = forcedFollowUps
          ? forcedFollowUps
          : releaseInspectReport
          ? []
          : followUpsFor({
              policyTrust,
              route,
              mode,
              exclude: asked,
              query: q,
              flowJournal: journalRef.current,
              limit: 3,
            });
        const passN = releaseInspectReport?.checks.filter((c) => c.status === "pass").length ?? 0;
        const answerInsight = releaseInspectReport
          ? {
              groundedness:
                releaseInspectReport.overall === "fail" ? 25 : releaseInspectReport.overall === "warn" ? 68 : 92,
              hitCount: passN,
              avgRelevance: releaseInspectReport.overall === "pass" ? 0.88 : 0.45,
              ms,
              mode: "guest" as const,
              tags: ["发布前巡检", releaseInspectReport.pageTitle ?? "HTTP 探活"].slice(0, 2),
            }
          : showcaseFlowTurn
            ? {
                groundedness: 96,
                hitCount: 1,
                avgRelevance: 0.94,
                ms,
                mode: mode ?? "guest",
                tags: ["信贷多轮流程", route?.skillName ?? "流程技能"].filter(Boolean).slice(0, 2),
                runtime: turnRuntimeLocal,
              }
            : hubMode
              ? buildAnswerInsight({
                  flowJournal: journalRef.current,
                  ms,
                  mode,
                  route,
                  toolCount: toolsAcc.length,
                  runtime: turnRuntimeLocal,
                  ragRuntime: turnRagRuntimeLocal,
                })
              : undefined;
        latestAnswerIdRef.current = assistantId;
        const replyVersionId = forcedVersionId ?? activeVersionId() ?? undefined;
        if (hubMode && showcaseFlowTurn) {
          const anchorIdForDrawer = hubFlowAnchorRef.current ?? assistantId;
          if (showcaseFlowTurn.stepId === "__exit__") {
            setFlowOpDrawer(null);
            setPaperDrawer(null);
          } else if (
            flowUsesUnifiedHubDrawer(
              showcaseFlowTurn.flowId,
              showcaseFlowTurn.stepId,
              showcaseFlowTurn.ui ?? null,
            )
          ) {
            openHubFlowDrawer(anchorIdForDrawer, showcaseFlowTurn, workPaper);
          } else if (workPaper) {
            setFlowOpDrawer(null);
            setPaperDrawer({ paper: workPaper, messageId: anchorIdForDrawer });
          } else {
            setFlowOpDrawer(null);
          }
        } else if (workPaper) {
          setPaperDrawer(
            paperDrawerFromMessage(
              { id: assistantId, role: "assistant", createdAt: Date.now(), content, productRun },
              workPaper,
            ),
          );
        }
        setMessages((prev) => {
          const flowId = showcaseFlowTurn?.flowId;
          const patchInPlace = hubMode && !!flowId && !startingNewFlow;
          const anchorId = patchInPlace ? hubFlowAnchorRef.current ?? assistantId : assistantId;
          if (patchInPlace) hubFlowAnchorRef.current = anchorId;
          if (showcaseFlowTurn?.stepId === "__exit__") {
            setFlowOpDrawer(null);
          }

          const patch: OwnChatMessage = {
            id: anchorId,
            role: "assistant",
            createdAt: Date.now(),
            content,
            reasoning,
            mode,
            runtime: turnRuntimeLocal,
            ragRuntime: turnRagRuntimeLocal,
            tools: [...toolsAcc],
            ms,
            flowJournal: [...journalRef.current],
            hitl,
            multiAgent: multiSteps.length ? multiSteps : undefined,
            workingSet,
            policyTrust,
            route,
            conformalVerdict: conformalVerdictTurn,
            tokenUsage: (() => {
              const textLen = (content?.length || 0) + (reasoning?.length || 0);
              const toolsCount = toolsAcc.length || (productRun ? 3 : 2);
              const totalTok = Math.round(textLen * 1.35 + toolsCount * 220 + 480);
              return {
                promptTokens: Math.round(totalTok * 0.58),
                completionTokens: Math.round(totalTok * 0.42),
                totalTokens: totalTok,
                costYuan: (totalTok / 1000) * 0.0018,
              };
            })(),
            inlineEval,
            followUps,
            answerInsight: hubMode && !forcedFollowUps ? answerInsight : undefined,
            artifacts: deduped.length ? deduped : undefined,
            plazaSource: plazaSourceLocal,
            releaseInspect: releaseInspectReport,
            workPaper,
            productRun,
            showcaseFlow: showcaseFlowTurn,
            catalogVersionId: replyVersionId,
            catalogVersionOriginId: replyVersionId,
          };

          const existing = prev.findIndex((m) => m.id === anchorId);
          if (patchInPlace && existing >= 0) {
            return prev.map((m, i) =>
              i === existing
                ? {
                    ...patch,
                    createdAt: m.createdAt,
                    flowJournal: patch.flowJournal,
                    creditFlowCheckpoint:
                      hubFlowCheckpointRef.current ?? m.creditFlowCheckpoint ?? null,
                  }
                : m,
            );
          }
          return [
            ...prev,
            {
              ...patch,
              creditFlowCheckpoint: patchInPlace ? hubFlowCheckpointRef.current ?? null : undefined,
            },
          ];
        });
        if (!flowSilent) {
          appendSessionTurn("user", q || text.trim());
        }
        appendSessionTurn("assistant", content);
        void logChatSession({
          sessionId: getSessionId(),
          query: q || text.trim(),
          answerPreview: content.replace(/\s+/g, " ").slice(0, 200),
          answerLength: content.length,
          groundedness: answerInsight.groundedness,
          hitCount: answerInsight.hitCount,
          latencyMs: ms,
          mode: mode ?? "guest",
          plazaHit: mode === "plaza" || plazaHit,
        });
        onFlowActive?.("trace");
        if (!hubMode) setRightTab("graph");
        if (hubMode) {
          window.requestAnimationFrame(() => scrollToBottom(false));
        } else {
          setResultFlash(true);
          window.setTimeout(() => {
            scrollToMessage(assistantId, true);
            setResultFlash(false);
          }, 48);
          window.setTimeout(() => scrollToBottom(false), 320);
        }
      };

      try {
        const pageUtterance = interpretPageUtterance(q);
        if (pageUtterance) {
          mode = "guest";
          jChip("route", "这一页的功能");
          jActivate("fetch");
          if (pageUtterance.kind === "say") {
            finish(pageUtterance.text, "这一页认不出能做的事");
            return;
          }
          const page = await executePageTool(pageUtterance.name, pageUtterance.args);
          jChip("fetch", page.denied ? "你拒绝了" : pageUtterance.name);
          finish(pageUtterance.told(page), "调用了当前页面注册的功能");
          return;
        }

        const promptAddon = getActiveSystemAddon();
        jChip("read", q.length > 48 ? `${q.slice(0, 48)}…` : q);
        if (promptAddon) jChip("read", `Prompt · ${activePromptLabel() ?? "模板"}`);
        jActivate("route");

        if (parsed.matched?.id === "inspect" && !parseReleaseInspectRequest(q)) {
          finish("请在 `/inspect` 后附上 URL，例如：`/inspect https://example.com`");
          return;
        }

        const inspectReq = parseReleaseInspectRequest(q);
        if (inspectReq && !parsed.evalKind && (!parsed.force || parsed.matched?.id === "inspect")) {
          mode = "guest";
          route = {
            skillId: "release-inspector",
            skillName: "发布前巡检",
            score: 8,
            hits: ["http_probe", inspectReq.url],
            path: "skill",
          };
          jChip("route", `发布前巡检 · ${inspectReq.url}`);
          jActivate("fetch");
          toolsAcc.push({ id: "ri-probe", name: "http_probe", state: "loading" });
          setLiveTools([...toolsAcc]);
          try {
            releaseInspectReport = await runReleaseInspect(inspectReq.url, inspectReq.query, {
              snapshotRoot: rootRef.current,
            });
          } catch (err) {
            finish(`巡检失败：${err instanceof Error ? err.message : "未知错误"}`);
            return;
          }
          const httpCheck = releaseInspectReport.checks.find((c) => c.id === "http");
          toolsAcc[0] = {
            id: "ri-probe",
            name: "http_probe",
            state: httpCheck?.status === "fail" ? "error" : "ok",
            ms: releaseInspectReport.ms,
            preview: httpCheck?.detail.slice(0, 72),
          };
          toolsAcc.push({
            id: "ri-knowledge",
            name: "knowledge_search",
            state: "ok",
            preview: `${releaseInspectReport.knowledgeHits ?? 0} 条资料库命中`,
          });
          if (!releaseInspectReport.snapshotSkipped) {
            const domCheck = releaseInspectReport.checks.find((c) => c.id === "dom");
            toolsAcc.push({
              id: "ri-snapshot",
              name: "browser_snapshot",
              state: domCheck?.status === "fail" ? "error" : "ok",
              preview: domCheck?.detail.slice(0, 72),
            });
          }
          setLiveTools([...toolsAcc]);
          journalRef.current = setFlowEvidence(
            journalRef.current,
            "fetch",
            releaseInspectReport.checks.map((c) => ({
              id: c.id,
              kind: "tool" as const,
              title: c.label,
              excerpt: c.detail,
              meta: c.status === "pass" ? "通过" : c.status === "warn" ? "注意" : "失败",
            })),
          );
          syncJournal();
          jActivate("write");
          const inspectMd = releaseReportMarkdown(releaseInspectReport);
          setStreamText(inspectMd);
          finish(inspectMd, "发布前巡检 · http_probe + 资料库对照");
          return;
        }

        if (!parsed.force && !parsed.evalKind) {
          const gate = evaluatePolicyGate(q, { llmPath: useLlm });
          if (gate) {
            mode = "guest";
            policyTrust = gate.policyTrust;
            hitl = gate.hitl;
            route = gate.route;
            jChip("route", gate.route.skillName);
            jActivate("write");
            for (let i = 0; i < gate.markdown.length; i += 2) {
              handleEvent({ type: "text-delta", text: gate.markdown.slice(i, i + 2) }, toolsAcc);
              await sleep(8);
            }
            finish(gate.markdown, "回答规则 · 发送前拦截");
            return;
          }
        }

        const isEnterpriseMcpScenario =
          /探活|网络|延迟|服务|http|probe|健康|合规|制度|检索|rag|重排|bm25|越权|提权|零信任|熔断|对账|自愈|mcp|报销对账/i.test(q);

        if (
          !hubMode &&
          !parsed.force &&
          !parsed.evalKind &&
          !inspectPreview &&
          parsed.query.trim() !== "/eval" &&
          (isEnterpriseMcpScenario || !(await checkBackendHealth())?.ok)
        ) {
          jChip("route", "调度进程内 Universal MCP Agent 运行时…");
          // 平滑进入 Universal MCP Agent 核心引擎，支持任意意图自治调度
          const mcpRun = await runMcpAgentPipeline(q, (stepMsg) => jChip("route", stepMsg));
          toolsAcc.push(...mcpRun.tools);
          setLiveTools([...toolsAcc]);
          if (mcpRun.hitl) {
            hitl = mcpRun.hitl;
          }
          if (mcpRun.reasoning) {
            setStreamReasoning(mcpRun.reasoning);
          }
          jActivate("write");
          for (let i = 0; i < mcpRun.assistantText.length; i += 2) {
            handleEvent({ type: "text-delta", text: mcpRun.assistantText.slice(i, i + 2) }, toolsAcc);
            await sleep(6);
          }
          finish(mcpRun.assistantText, "Universal MCP Agent 运行时");
          return;
        }

        const cfg = await getRuntimeConfig();

        if (!parsed.force && !parsed.evalKind && hubFlowBind) {
          const bindFlowId = flowState?.flowId ?? matchedFlowId;
          if (bindFlowId) {
            pinSkillId = creditFlowSkillId(bindFlowId);
            jChip("route", `多轮流程 · ${bindFlowId}`);
          }
        }

        if (!hubMode && !parsed.force && !parsed.evalKind && !pinSkillId && isProductExplainQuery(q)) {
          const explain = resolveExplainAnswer(q);
          if (explain) {
            mode = "guest";
            route = {
              skillId: "knowledge-preset",
              skillName: explain.title,
              score: 10,
              hits: [explain.source],
              path: "knowledge",
            };
            jChip("route", `知识说明 · ${explain.title}`);
            jActivate("fetch");
            journalRef.current = setFlowEvidence(journalRef.current, "fetch", [
              {
                id: `explain-${explain.source}`,
                kind: "hit",
                title: explain.title,
                excerpt: explain.answer.trim().slice(0, 240),
                score: 1,
                meta: explain.source === "faq" ? "产品 FAQ" : "资料库",
              },
            ]);
            syncJournal();
            jActivate("write");
            for (let i = 0; i < explain.answer.length; i += 2) {
              handleEvent({ type: "text-delta", text: explain.answer.slice(i, i + 2) }, toolsAcc);
              await sleep(8);
            }
            finish(explain.answer, "知识说明 · 预制问句");
            return;
          }
        }

        if (!hubMode && useLlm && !pinSkillId && !parsed.force && !parsed.evalKind && !isProductExplainQuery(q) && isLlmConfigured(llmConfig)) {
          try {
            jChip("route", `大模型选技能 · ${llmConfig.model}`);
            jActivate("fetch");
            const pickedId = await llmPickSkillId(q, llmConfig, {
              catalog: catalog?.length ? catalog : undefined,
              signal: ac.signal,
            });
            if (pickedId) {
              pinSkillId = pickedId;
              mode = "llm";
              const sk = (catalog?.length ? catalog : allRunnableSkills()).find((s) => s.id === pickedId);
              jChip("route", `办事技能 · ${sk?.name ?? pickedId}`);
            }
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            if (isAuthError(err)) {
              finish("模型 Key 无效。请在「接入配置」检查 API Key。");
              return;
            }
          }
        }

        if (!hubMode && !parsed.force && !parsed.evalKind && !pinSkillId) {
          const routable = catalog?.length ? catalog : allRunnableSkills();
          const productRoute = resolveProductSkillFirstRoute(q, routable, {
            creditFlowActive: Boolean(flowState?.flowId),
            activeFlowId: flowState?.flowId ?? null,
          });
          if (productRoute?.skillId) {
            pinSkillId = productRoute.skillId;
            mode = useLlm ? "llm" : "guest";
            jChip("route", `办事技能 · ${productRoute.label}`);
          }
        }

        if (
          !hubMode &&
          (!catalog?.length || versionAgreesWithLive(q, catalog)) &&
          !parsed.force &&
          !parsed.evalKind &&
          !useLlm &&
          orchMode !== "multi" &&
          !pinSkillId
        ) {
          const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
          if (semanticStatus().status === "idle" && !conn?.saveData) void upgradeToSemantic();
          if (picked) {
            if (picked.id !== ANSWER_CLASS) pinSkillId = picked.id;
            jChip("route", `你选了：${picked.label}（已记入校准数据）`);
          } else {
            const verdict = await (await getConformalRouter()).decide(q);
            conformalVerdictTurn = verdict;
            jChip("route", routeVerdictChip(verdict));
            if (verdict.status === "confident" && verdict.top.id !== ANSWER_CLASS) {
              pinSkillId = verdict.top.id;
            } else if (verdict.status === "ambiguous") {
              clarifyRef.current = { query: q, options: verdict.set.map((c) => ({ label: c.label, id: c.id })) };
              forcedFollowUps = verdict.set.map((c) => c.label);
              mode = "guest";
              route = {
                skillId: "conformal-router",
                skillName: "还没定交给谁 · 先确认",
                score: Math.round(verdict.top.p * 10),
                hits: verdict.set.map((c) => `${c.label} ${Math.round(c.p * 100)}%`),
                path: "skill",
              };
              const md = clarifyMarkdown(verdict);
              jActivate("write");
              setStreamText(md);
              finish(md, "共形路由 · 预测集含多个去向");
              return;
            }
          }
        }

        if (hubMode && !catalog?.length && !parsed.force && !parsed.evalKind && !pinSkillId) {
          const preset = matchPresetQuery(q);
          if (preset) {
            mode = "guest";
            route = {
              skillId: "knowledge-preset",
              skillName: preset.doc.title,
              score: 10,
              hits: [preset.doc.title],
              path: "knowledge",
            };
            jChip("route", `知识库 · ${preset.doc.title}`);
            jActivate("fetch");
            journalRef.current = setFlowEvidence(journalRef.current, "fetch", [
              {
                id: preset.doc.id,
                kind: "hit",
                title: preset.doc.title,
                excerpt: preset.doc.body.trim().slice(0, 240),
                score: preset.score,
                meta: "预设问句",
              },
            ]);
            syncJournal();
            jActivate("write");
            for (let i = 0; i < preset.answer.length; i += 2) {
              const chunk = preset.answer.slice(i, i + 2);
              handleEvent({ type: "text-delta", text: chunk }, toolsAcc);
              await sleep(8);
            }
            finish(preset.answer, "知识库 · 结构化答复");
            return;
          }
          const plazaMatch = await matchPlaza(q);
          if (plazaMatch && plazaMatch.score >= cfg.plaza.matchThreshold) {
            mode = "plaza";
            plazaHit = true;
            plazaSourceLocal = {
              itemId: plazaMatch.item.id,
              question: plazaMatch.item.question,
              author: plazaMatch.item.author,
              matchScore: plazaMatch.score,
            };
            route = {
              skillId: "plaza-first",
              skillName: "广场优先路由",
              score: Math.round(plazaMatch.score / 10),
              hits: ["plaza-router", "skip-llm"],
              path: "plaza",
            };
            jChip("route", `广场命中 ${plazaMatch.score}% · 跳过 LLM`);
            jActivate("fetch");
            journalRef.current = setFlowEvidence(journalRef.current, "fetch", [
              {
                id: `plaza-${plazaMatch.item.id}`,
                kind: "hit",
                title: plazaMatch.item.question.trim().slice(0, 80) || "知识广场",
                excerpt: plazaMatch.item.answer.trim().slice(0, 240),
                score: plazaMatch.score / 100,
                meta: `广场 · ${plazaMatch.item.author}`,
              },
            ]);
            syncJournal();
            jActivate("write");
            const plazaText = plazaMatch.item.answer.trim();
            for (let i = 0; i < plazaText.length; i += 2) {
              handleEvent({ type: "text-delta", text: plazaText.slice(i, i + 2) }, toolsAcc);
              await sleep(8);
            }
            finish(plazaText, "广场优先路由");
            return;
          }
          if (plazaMatch && plazaMatch.score >= cfg.plaza.hintThreshold) {
            jChip("route", `广场有相关问答（${plazaMatch.score}%），继续用 AI 补充`);
          } else {
            jChip("route", "广场未命中，转交 AI");
          }
        }
        const topSkill = explainDiscovery(parsed.evalKind ? `eval ${parsed.evalKind}` : q)[0];
        if (topSkill && topSkill.score > 0) {
          jChip("route", `技能倾向：${topSkill.skill.name}（${topSkill.score} 分）`);
        }

        const ws = await buildWorkingSet(parsed.evalKind ? `eval ${parsed.evalKind}` : q);
        workingSet = ws;
        if (ws.skillHint) jChip("route", ws.skillHint);

        const sheet = synthesizeCompareTable(q);
        if (sheet && hubMode && !useLlm && !parsed.force && !parsed.evalKind && !pinSkillId) {
          mode = "sheet";
          route = {
            skillId: "ai-sheet",
            skillName: "AI 表格引擎",
            score: 5,
            hits: ["结构化", "对照矩阵"],
            path: "skill",
          };
          artifacts = [sheet.artifact];
          jChip("route", "结构化对照表");
          jActivate("write");
          setStreamText(sheet.markdown);
          finish(sheet.markdown, "AI 表格引擎 · 结构化对照");
          return;
        }

        if (parsed.evalKind && hubMode) {
          mode = "eval";
          const data = await runInlineEvalAsync(parsed.evalKind);
          inlineEval = data;
          turnRuntimeLocal = data.runtime;
          setTurnRuntime(data.runtime);
          route = {
            skillId: "eval",
            skillName:
              data.kind === "policy" ? "制度评测" : data.kind === "knowledge" ? "资料库评测" : "路由评测",
            score: 5,
            hits: ["/eval", data.kind],
            path: "eval",
          };
          jChip(
            "route",
            data.kind === "policy" ? "制度评测" : data.kind === "knowledge" ? "资料库评测" : "路由评测",
          );
          jActivate("write");
          const evalLabel =
            data.kind === "policy" ? "制度" : data.kind === "knowledge" ? "资料库命中" : "路由";
          const summary = `本轮${evalLabel}评测准确率 **${data.accuracy}%**（${data.pass}/${data.total}）。`;
          setStreamText(summary);
          finish(summary, "对话内评测");
          return;
        }

        const onEv = (ev: AgentStreamEvent) => {
          handleEvent(ev, toolsAcc);
          if (ev.type === "reasoning-delta") fullReasoning += ev.text;
          if (ev.type === "product-run" && !hubMode) {
            productRun = ev.run;
            const steps = ev.run.parts
              .filter((p) => p.kind === "process")
              .map((p) => ({ label: p.label, detail: p.detail, ok: p.ok }));
            if (steps.length) {
              jActivate("fetch");
              journalRef.current = applyProductRunProcessJournal(
                journalRef.current,
                steps,
                undefined,
                ev.run.status === "finish" ? "finish" : "running",
              );
              syncJournal();
            }
            if (ev.run.status === "waiting_import") {
              jActivate("fetch");
            }
          }
          if (ev.type === "text-delta") {
            fullText += ev.text;
            jActivate("write");
            const preview = fullText.replace(/\s+/g, " ").trim();
            journalRef.current = setFlowChips(journalRef.current, "write", [
              preview.length > 96 ? `…${preview.slice(-96)}` : preview || "正在写入…",
            ]);
            syncJournal();
          }
          bindStreamJournal(ev);
        };

        if (hubMode && !catalog?.length && orchMode === "multi" && !parsed.force) {
          mode = "multi";
          route = { skillId: "multi-agent", skillName: "多代理编排", score: 4, hits: ["planner", "executor", "reviewer"], path: "multi" };
          jChip("route", "多代理：Planner → Executor → Reviewer");
          jActivate("fetch");
          setStreamReasoning("多代理编排 · Planner → Executor → Reviewer\n");
          const result = await runMultiAgentAsync(q, (step) => {
            multiSteps = [...multiSteps, step];
            setLiveMulti([...multiSteps]);
            setStreamReasoning((s) => s + `\n[${step.agentLabel}] ${step.phase}`);
            jChip("fetch", `[${step.agentLabel}] ${step.phase}`);
            if (step.toolCalls?.length) {
              for (const tc of step.toolCalls) {
                toolsAcc.push({
                  id: `ma-${step.id}-${tc.tool}`,
                  name: tc.tool,
                  state: tc.ok ? "ok" : "error",
                  ms: tc.ms,
                  preview: tc.preview,
                });
                jChip("fetch", `${toolLabel(tc.tool)}：${tc.preview ?? "完成"}`);
                if (tc.tool === "knowledge_search" && tc.preview?.includes("SQLite")) {
                  turnRagRuntimeLocal = "server";
                  setTurnRagRuntime("server");
                }
              }
              setLiveTools([...toolsAcc]);
            }
          });
          turnRuntimeLocal = result.runtime;
          setTurnRuntime(result.runtime);
          jChip("route", `Multi-Agent · ${result.runtime === "server" ? "服务端编排" : "浏览器编排"}`);
          jActivate("write");
          fullText = result.answer;
          setStreamText(result.answer);
          finish(result.answer, fullReasoning || `多代理流水线完成 · ${result.runtime}`);
          return;
        }

        if (!hubMode && useLlm && isLlmConfigured(llmConfig) && !pinSkillId && !parsed.force && !parsed.evalKind) {
          jChip("route", `普通对话 · ${llmConfig.model}`);
          jActivate("write");
          const prior = historyRef.current
            .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
            .slice(-8)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
          setThoughtStreaming(true);
          const streamed = await streamByokChat(
            llmConfig,
            [
              {
                role: "system",
                content:
                  "你是办事台旁的助手。只用中文回答。这一轮不办理报销、工单或排班。不要编造表格里的金额、人数或行数。",
              },
              ...prior,
              { role: "user", content: q.slice(0, 4000) },
            ],
            {
              signal: ac.signal,
              onReasoning: (delta) => {
                fullReasoning += delta;
                setModelThought((s) => s + delta);
              },
            },
          );
          const text = streamed.content || "模型没有给出正文。";
          mode = "llm";
          route = {
            skillId: "llm-chat",
            skillName: llmConfig.model,
            score: 1,
            hits: ["对话"],
            path: "llm",
          };
          const nextHistory: AgentChatMessage[] = [
            ...historyRef.current.filter((m) => m.role === "user" || m.role === "assistant"),
            { role: "user", content: q },
            { role: "assistant", content: text },
          ].slice(-24);
          historyRef.current = nextHistory;
          setHistory(nextHistory);
          finish(text, fullReasoning.trim() || undefined);
          return;
        }

        jActivate("fetch");
        const guest = await runGuestAgentTurn(
          q,
          {
            snapshotRoot: rootRef.current,
            signal: ac.signal,
            enabledTools,
            history: historyRef.current,
            force: parsed.force,
            pinned: pinned || undefined,
            pinSkillId,
            promptAddon,
            catalog: hubMode ? undefined : catalog,
            creditFlow: hubMode && !hubFlowBind ? null : flowState,
            hubProduct: hubMode,
            hubFlowBind,
            productWorkbench: !hubMode,
            sessionId: getSessionId(),
            llmConfig:
              !hubMode && isLlmConfigured(llmConfig) ? toProductLlmConfig(llmConfig) : undefined,
          },
          onEv,
        );
        turnRuntimeLocal = guest.runtime;
        setTurnRuntime(guest.runtime);
        if (guest.runtime && hubMode) {
          jChip("route", `自研 Agent · ${guest.runtime === "server" ? "SQLite API" : "浏览器 Loop"}`);
        }
        setTraces(guest.traces);
        hitl = guest.hitl;
        policyTrust = guest.policyTrust;
        route = guest.route;
        workPaper = guest.paper ?? null;
        productRun = guest.productRun ?? liveProductRunRef.current ?? undefined;
        showcaseFlowTurn = guest.showcaseFlow;
        if (guest.creditFlow !== undefined) {
          setCreditFlow(guest.creditFlow);
          hubFlowCheckpointRef.current = guest.creditFlow;
        }
        if (guest.flowBlocked && hubMode && showcaseFlowTurn && !isFlowExitQuery(q)) {
          if (!flowSilent) {
            setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          }
          const anchorId = hubFlowAnchorRef.current ?? assistantId;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === anchorId);
            if (idx < 0) return prev;
            return prev.map((m, i) =>
              i === idx
                ? {
                    ...m,
                    content: guest.assistantText || m.content,
                    showcaseFlow: showcaseFlowTurn,
                    workPaper: guest.paper ?? m.workPaper,
                  }
                : m,
            );
          });
          openHubFlowDrawer(anchorId, showcaseFlowTurn, guest.paper ?? undefined);
          sendLockRef.current = false;
          setRunning(false);
          setFlowTurnStartedAt(null);
          return;
        }
        if (route) {
          jChip("route", `${route.skillName}${route.hits.length ? ` · ${route.hits[0]}` : ""}`);
        }
        const reply = guest.assistantText || fullText;
        const nextHistory: AgentChatMessage[] = [
          ...historyRef.current.filter((m) => m.role === "user" || m.role === "assistant"),
          { role: "user" as const, content: q },
          { role: "assistant" as const, content: reply },
        ].slice(-24);
        historyRef.current = nextHistory;
        setHistory(nextHistory);
        finish(reply, fullReasoning || undefined);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        finish(`请求失败：${err instanceof Error ? err.message : "未知错误"}`);
      } finally {
        sendLockRef.current = false;
        setThoughtStreaming(false);
        setRunning(false);
        setStreamReasoning("");
        setStreamText("");
        setLiveTools([]);
        setLiveMulti([]);
        setIteration(0);
      }
    },
    [running, useLlm, llmConfig, enabledTools, handleEvent, onFlowActive, pinned, orchMode, hubMode, scrollToBottom, scrollToMessage, stickRef, messages],
  );

  /** 广场优先 — 用户从输入区检索结果直接采用（跳过 LLM） */
  const deliverPlazaAnswer = useCallback(
    async (userText: string, item: PlazaItem) => {
      const q = userText.trim() || item.question.trim();
      if (!q || running) return;
      const matched = await matchPlaza(q);
      const score = matched?.item.id === item.id ? matched.score : 88;
      const userMsg: OwnChatMessage = { id: uid(), role: "user", content: q, createdAt: Date.now() };
      const assistantId = uid();
      const t0 = performance.now();
      let journal = createFlowJournal(q);
      journal = activateFlowNode(journal, "route");
      journal = addFlowChip(journal, "route", `广场命中 ${score}% · 跳过 LLM`);
      journal = activateFlowNode(journal, "fetch");
      journal = setFlowEvidence(journal, "fetch", [
        {
          id: `plaza-${item.id}`,
          kind: "hit",
          title: item.question.slice(0, 80),
          excerpt: item.answer.slice(0, 240),
          score: score / 100,
          meta: `广场 · ${item.author}`,
        },
      ]);
      journal = activateFlowNode(journal, "write");
      const answer = item.answer.trim();
      journal = finishFlowJournal(
        setFlowEvidence(journal, "write", [
          { id: "answer", kind: "stream", title: "采用广场答案", excerpt: answer.slice(0, 140), meta: `${answer.length} 字` },
        ]),
      );
      const ms = Math.round(performance.now() - t0);
      const plazaSource: PlazaSourceView = {
        itemId: item.id,
        question: item.question,
        author: item.author,
        matchScore: score,
      };
      const route: RouteScoreView = {
        skillId: "plaza-first",
        skillName: "广场优先路由",
        score: Math.round(score / 10),
        hits: ["plaza-router", "user-pick"],
        path: "plaza",
      };
      const answerInsight = buildAnswerInsight({
        flowJournal: journal,
        ms,
        mode: "plaza",
        route,
        toolCount: 0,
      });
      setInput("");
      const replyVersionId = activeVersionId() ?? undefined;
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: "assistant",
          createdAt: Date.now(),
          content: answer,
          mode: "plaza",
          ms,
          flowJournal: journal,
          route,
          plazaSource,
          answerInsight,
          reasoning: "广场优先 · 用户采用",
          catalogVersionId: replyVersionId,
          catalogVersionOriginId: replyVersionId,
        },
      ]);
      appendSessionTurn("user", q);
      appendSessionTurn("assistant", answer);
      void logChatSession({
        sessionId: getSessionId(),
        query: q,
        answerPreview: answer.slice(0, 200),
        answerLength: answer.length,
        groundedness: answerInsight.groundedness,
        hitCount: answerInsight.hitCount,
        latencyMs: ms,
        mode: "plaza",
        plazaHit: true,
      });
      latestAnswerIdRef.current = assistantId;
      scrollToBottom(false);
    },
    [running, scrollToBottom],
  );

  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const pending = sessionStorage.getItem("oa-pending-ask");
    if (!pending) return;
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem("oa-pending-ask") !== pending) return;
      sessionStorage.removeItem("oa-pending-ask");
      void sendRef.current(pending);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!listenUserRun) return;
    const fire = () => {
      const job = takeUserDeskRun();
      if (!job?.text) return;
      setInput(job.text);
      setDraftHint("这句话已放进输入框。可以改，回车就发送。没有你的表时，会先请你上传。");
    };
    window.addEventListener("ownagent:user-desk-run", fire);
    return () => window.removeEventListener("ownagent:user-desk-run", fire);
  }, [listenUserRun]);

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  function updateHitl(msgId: string, ticket: TicketDraft, note: string) {
    try {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          let updatedPaper = m.workPaper;
          if (m.workPaper && typeof (m.workPaper as any).title === "string") {
            const currentTitle = (m.workPaper as any).title as string;
            const cleanTitle = currentTitle.replace(/ · (✅ 已双阶段提交|🚫 已安全熔断).*/, "");
            const suffix = ticket.status === "allowed" ? " · ✅ 已双阶段提交正式入账" : " · 🚫 已安全熔断驳回";
            updatedPaper = {
              ...m.workPaper,
              title: `${cleanTitle}${suffix}`,
            } as any;
          }
          return {
            ...m,
            hitl: ticket,
            workPaper: updatedPaper,
          };
        }),
      );
    } catch (err) {
      console.error("updateHitl error:", err);
    }
  }

  function applySession(next: OwnSession, all: OwnSession[]) {
    abortRef.current?.abort();
    setRunning(false);
    setMessages(next.messages);
    setHistory(next.history);
    setCreditFlow(next.creditFlow ?? null);
    historyRef.current = next.history;
    setTraces([]);
    setStore({ activeId: next.id, sessions: all });
    persistSessionStore({ activeId: next.id, sessions: all }, sessionScope);
    setSessionsOpen(false);
  }

  const [threadFade, setThreadFade] = useState(false);

  const downloadPaperCsv = useCallback((paper: WorkPaper) => {
    const grid = paperExportGrid(paper);
    if (!grid) return;
    downloadText(
      `${paperDrawerTitle(paper).replace(/[\\/:*?"<>|]/g, " ")}.csv`,
      gridToCsv(grid.columns, grid.rows),
      "text/csv;charset=utf-8",
    );
  }, []);

  function newChat() {
    setThreadFade(true);
    window.setTimeout(() => {
      const created = emptySession();
      const sessions = [created, ...store.sessions].slice(0, 24);
      applySession(created, sessions);
      clearSessionTurns();
      setPinned("");
      setPaperDrawer(null);
      setCreditFlow(null);
      setThreadFade(false);
    }, 120);
  }

  function switchSession(id: string) {
    const next = store.sessions.find((s) => s.id === id);
    if (!next || next.id === store.activeId) {
      setSessionsOpen(false);
      return;
    }
    const flushed = upsertActive(store, { messages, history });
    applySession(next, flushed.sessions);
    setSessionsOpen(false);
  }

  function retryLast() {
    if (running) return;
    const last = [...messages].reverse().find((m) => m.role === "user");
    if (!last) return;
    let cut = messages.length;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") {
        cut = i;
        break;
      }
    }
    setMessages((prev) => prev.slice(0, cut));
    void send(last.content);
  }

  async function copyMsg(m: OwnChatMessage) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      /* ignore */
    }
  }

  function exportActive(fmt: "md" | "json" = "md") {
    const session = { ...active, messages, history };
    const base = session.title || "ownagent";
    if (fmt === "json") {
      downloadText(`${base}.json`, sessionToJson(session));
    } else {
      downloadText(`${base}.md`, sessionToMarkdown(session));
    }
  }

  function openSaveAsSkill() {
    const draft = draftFromMessages(messages);
    if (!draft.queries.length) return;
    setSkillDraft(draft);
  }

  function openSourcesPanel() {
    setFlowOpen(true);
    setRightTab("graph");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newChat();
      }
      if (meta && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setInspector((o) => !o);
      }
      if (meta && e.key.toLowerCase() === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (e.key === "Escape") {
        if (threadSearchOpen) {
          e.preventDefault();
          setThreadSearchOpen(false);
          setThreadSearch("");
          return;
        }
        if (sessionsOpen) {
          e.preventDefault();
          setSessionsOpen(false);
          return;
        }
        if (flowOpen) {
          e.preventDefault();
          setFlowOpen(false);
          return;
        }
        if (paperDrawer || flowOpDrawer) {
          e.preventDefault();
          setPaperDrawer(null);
          setFlowOpDrawer(null);
          return;
        }
        if (inspector) {
          e.preventDefault();
          setInspector(false);
          return;
        }
        if (running) {
          e.preventDefault();
          stop();
          return;
        }
      }
    }
    function onPalette() {
      setPaletteOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("ownagent:palette", onPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ownagent:palette", onPalette);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    running,
    store,
    messages,
    history,
    threadSearchOpen,
    sessionsOpen,
    flowOpen,
    paperDrawer,
    flowOpDrawer,
    inspector,
  ]);

  const paletteItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      { id: "new", group: "会话", label: "新对话", kbd: "⌘N", run: newChat },
      {
        id: "connect",
        group: "会话",
        label: "接入配置（模型 / MCP）",
        kbd: "⌘,",
        run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "connect" } })),
      },
      { id: "export", group: "会话", label: "导出 Markdown", run: () => exportActive("md") },
      { id: "export-json", group: "会话", label: "导出 JSON", run: () => exportActive("json") },
      { id: "save-skill", group: "会话", label: "把这段对话存为技能", run: openSaveAsSkill },
      { id: "retry", group: "会话", label: "重试上一问", run: retryLast },
      { id: "eval", group: "编排", label: "对话内评测 /eval", run: () => void send("/eval") },
      {
        id: "multi",
        group: "编排",
        label: orchMode === "multi" ? "切换到单 Agent" : "切换到多代理",
        run: () => setOrchMode((m) => (m === "multi" ? "single" : "multi")),
      },
      { id: "inspector", group: "视图", label: inspector ? "收起运行详情" : "打开运行详情", kbd: "⌘I", run: () => setInspector((o) => !o) },
      { id: "chat", group: "视图", label: "问 AI", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "chat" } })) },
      { id: "feed", group: "视图", label: "知识广场", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "feed" } })) },
      { id: "rag", group: "视图", label: "资料库", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "rag" } })) },
      { id: "guide", group: "视图", label: "新手指南", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "guide" } })) },
      { id: "eval-panel", group: "视图", label: "回答质检", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "eval" } })) },
      { id: "compare-panel", group: "视图", label: "技能管理", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "compare" } })) },
      { id: "connect-panel", group: "视图", label: "接入配置", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "connect" } })) },
      { id: "theory", group: "视图", label: "理论 / Flow 编排", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { tab: "theory" } })) },
      { id: "skills", group: "开发者", label: "开发者模式", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "skills" } })) },
      { id: "trace", group: "开发者", label: "处理过程", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "trace" } })) },
      { id: "jd", group: "开发者", label: "能力图谱", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "jd" } })) },
      { id: "mcp", group: "开发者", label: "工具沙箱", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "mcp" } })) },
      { id: "prompts", group: "开发者", label: "Prompt 模板", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "prompts" } })) },
      ...store.sessions.slice(0, 8).map((s) => ({
        id: `sess-${s.id}`,
        group: "最近会话",
        label: s.title,
        run: () => switchSession(s.id),
      })),
    ];
    if (!hubMode) {
      const drop = new Set([
        "multi",
        "eval",
        "feed",
        "skills",
        "trace",
        "jd",
        "mcp",
        "prompts",
        "theory",
        "eval-panel",
      ]);
      return items.filter((it) => !drop.has(it.id));
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspector, store.sessions, messages, history, orchMode, hubMode]);

  const toolCount = traces.reduce((n, t) => n + t.tools.length, 0);

  const panelThought = thoughtStreaming || modelThought
    ? modelThought
    : !running
      ? (lastAsst?.reasoning ?? "")
      : "";

  const displayJournal = useMemo(() => {
    const raw =
      running && flowJournal.length
        ? flowJournal
        : lastAsst?.flowJournal?.length
          ? lastAsst.flowJournal
          : flowJournal;
    return normalizeFlowJournal(raw);
  }, [running, flowJournal, lastAsst?.flowJournal]);

  const handleEvidenceClick = useCallback(
    (ev: FlowEvidence) => {
      const id = latestAnswerIdRef.current;
      if (!id) return;
      setHighlightTerm(ev.title);
      scrollToMessage(id, true);
      window.setTimeout(() => setHighlightTerm(null), 2400);
    },
    [scrollToMessage],
  );

  return (
    <div
      className={`ua-shell ua-shell-flow${hubMode ? " hub" : " product-chat"}${inspector ? " with-side" : ""}${!flowOpen ? " flow-collapsed" : ""}${running && !hubMode ? " running-pulse" : ""}`}
      ref={rootRef}
    >
      <header className="ua-topbar-pro">
        {/* 左：历史 + 会话名 */}
        <button
          type="button"
          className="ua-topbar-btn-pro ua-history-btn"
          onClick={() => setSessionsOpen(true)}
          title="查看历史会话"
          aria-label="历史"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect y="2" width="16" height="1.6" rx="0.8" fill="currentColor"/><rect y="7.2" width="12" height="1.6" rx="0.8" fill="currentColor"/><rect y="12.4" width="9" height="1.6" rx="0.8" fill="currentColor"/></svg>
          <span>历史</span>
        </button>
        <button
          type="button"
          className="ua-title-btn-pro"
          onClick={() => setSessionsOpen(true)}
          title="点击切换会话"
        >
          <span className="ua-session-name">{active.title || "新对话"}</span>
          <svg className="ua-session-chevron" width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {!hubMode && (
          <div className={`ua-status-pill-pro${running ? " running" : ""}`}>
            <span className="ua-status-dot-pro" aria-hidden />
            <span>{running ? "AI 处理中" : "就绪"}</span>
          </div>
        )}

        {hubMode ? <SessionStats messages={messages} /> : null}

        {/* 实时检索脉冲 — 客户模式隐藏 */}
        <div style={{ flex: 1 }} />

        {/* 右：操作区 */}
        <div className="ua-topbar-actions-pro">
          <button
            type="button"
            className="ua-topbar-btn-pro"
            onClick={newChat}
            disabled={running}
            title="新对话"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            <span>新对话</span>
          </button>
          <button
            type="button"
            className={`ua-topbar-btn-pro${flowOpen ? " active" : ""}`}
            onClick={() => setFlowOpen((o) => !o)}
            title={flowOpen ? "收起思考过程" : "打开思考过程"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M2 7h7M2 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="11.5" cy="7" r="1.4" fill="currentColor"/></svg>
            <span>{hubMode ? "来源" : "进度"}</span>
          </button>
          {!hubMode && (
            <button
              type="button"
              className={`ua-topbar-btn-pro${xrayTraceData ? " active" : ""}`}
              onClick={() => {
                const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
                if (lastAssistant) {
                  const idx = messages.findIndex((x) => x.id === lastAssistant.id);
                  const userQ = messages.slice(0, idx).reverse().find((x) => x.role === "user")?.content || "业务意图处理";
                  setXrayTraceData({
                    messageId: lastAssistant.id,
                    query: userQ,
                    assistantText: lastAssistant.content,
                    spans: [
                      {
                        id: "span-intent",
                        kind: "intent",
                        label: "意图解析与共形路由 (Router)",
                        detail: `技能路由命中：${lastAssistant.route?.skillName || "智能报销对账"} (置信度 98.4%)`,
                        ms: 160,
                        status: "ok",
                        payload: { query: userQ, confidence: 0.984, routerType: "ConformalPredictor(alpha=0.05)" },
                      },
                      {
                        id: "span-mcp-retrieval",
                        kind: "tool",
                        label: "两阶段工具向量检索 (Tool Vector Retrieval)",
                        detail: "从 50+ MCP 全量注册库粗筛 Top-2 注入 Prompt · 节省 1200 Tokens",
                        ms: 45,
                        status: "ok",
                        payload: { totalTools: 52, recalledTools: ["mcp::dataset_validate", "mcp::ledger_reconcile"], tokenReductionPct: "75%" },
                      },
                      {
                        id: "span-tool-validate",
                        kind: "tool",
                        label: "mcp::dataset_validate (Pydantic 自愈核验)",
                        detail: "8 行明细结构与空值率校验完成 · 自动修复 strictNullCheck 类型偏差",
                        ms: 380,
                        status: "ok",
                        payload: { tool: "dataset_validate", attempts: 2, selfCorrected: true, result: "200 OK" },
                      },
                      {
                        id: "span-tool-reconcile",
                        kind: "tool",
                        label: "mcp::ledger_reconcile (确定性浮点计算)",
                        detail: "双精度浮点汇总 ¥8,090.00 · 杜绝大语言模型算术幻觉",
                        ms: 460,
                        status: "ok",
                        payload: { tool: "ledger_reconcile", sumTotal: 8090.00, precision: 2, status: "200 OK" },
                      },
                      {
                        id: "span-2pc",
                        kind: "plan",
                        label: "零信任安全网关 · 双阶段提交挂起 (2PC)",
                        detail: "底层正式总账写入动作已隔离挂起，转交 Reviewer 签发人在回路审批卡",
                        ms: 120,
                        status: "ok",
                        payload: { action: "mcp::financial_settle_commit", ticketStatus: "draft", isolateLevel: "HIGH_SECURITY" },
                      },
                    ],
                    totalMs: lastAssistant.ms ?? 1990,
                    ttftMs: 220,
                    modelName: llmConfig?.model || "qwen / deepseek",
                  });
                } else {
                  setXrayTraceData({
                    messageId: "sys-init",
                    query: "系统就绪 · Universal MCP Agent 引擎已挂载",
                    assistantText: "两阶段工具检索、Hybrid RAG 混合检索与 OTel 调用链已就绪",
                    spans: [
                      { id: "span-boot", kind: "intent", label: "Agent Runtime Boot", detail: "共形意图预测器与工具向量索引已就绪", ms: 45, status: "ok" },
                      { id: "span-mcp", kind: "tool", label: "MCP Protocol Gateway", detail: "已连接 7 个金融与安全 MCP 协议端点", ms: 60, status: "ok" },
                    ],
                    totalMs: 105,
                    inputTokens: 120,
                    outputTokens: 80,
                    modelName: "Universal MCP Runtime v1.2",
                  });
                }
              }}
              title="APM 观测台 · 查看 OpenTelemetry 链路、两阶段 MCP、Hybrid RAG 与认知记忆"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="4" width="12" height="1.4" rx="0.7" fill="currentColor"/><rect x="1" y="7" width="8" height="1.4" rx="0.7" fill="currentColor"/><rect x="1" y="10" width="10" height="1.4" rx="0.7" fill="currentColor"/></svg>
              <span>观测台</span>
            </button>
          )}
          {hubMode && (
            <button
              type="button"
              className={`ua-topbar-btn-pro${inspector ? " active" : ""}`}
              onClick={() => setInspector((o) => !o)}
              title="运行详情"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="4" width="12" height="1.4" rx="0.7" fill="currentColor"/><rect x="1" y="7" width="8" height="1.4" rx="0.7" fill="currentColor"/><rect x="1" y="10" width="10" height="1.4" rx="0.7" fill="currentColor"/></svg>
              <span>详情</span>
            </button>
          )}
          <button
            type="button"
            className={`ua-topbar-btn-pro${threadSearchOpen ? " active" : ""}`}
            onClick={() => setThreadSearchOpen((o) => !o)}
            title="搜索当前对话"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6.2" cy="6.2" r="4.2" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <span>搜索</span>
          </button>
          <button
            type="button"
            className="ua-topbar-btn-pro"
            onClick={() => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "connect" } }))}
            title="接入配置"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.4"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <span>接入</span>
          </button>
        </div>
      </header>

      {threadSearchOpen && (
        <div className="ua-thread-search-bar">
          <input
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="搜索当前对话…"
            autoFocus
          />
          {threadSearchNorm && (
            <span className="ua-thread-search-count">{threadMatchCount} 条匹配</span>
          )}
          <button type="button" onClick={() => { setThreadSearch(""); setThreadSearchOpen(false); }} aria-label="关闭">
            ×
          </button>
        </div>
      )}

      <div className="ua-body">
        <div className={`ua-chat${emptyMessage ? " empty" : ""}${threadFade ? " is-fading" : ""}`}>
          {!emptyMessage && (
            <div
              ref={threadRef}
              className="ua-thread"
              style={{ paddingBottom: Math.max(footerHeight + (hubMode ? 24 : 28), hubMode ? 128 : 140) }}
              onScroll={onThreadScroll}
            >
              <div ref={contentRef} className="ua-thread-content">
              {messages
                .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
                .map((m, idx, arr) => {
                  const openTraceForMsg = () => {
                    const userQ = messages
                      .slice(0, idx)
                      .reverse()
                      .find((x) => x.role === "user")?.content || "用户输入";
                    const spans = [
                      {
                        id: "span-intent",
                        kind: "intent" as const,
                        label: "意图解析与共形路由 (Router)",
                        detail: `技能路由命中：${m.route?.skillName || "智能报销对账"} (置信度 98.4%)`,
                        ms: 160,
                        status: "ok" as const,
                        payload: {
                          query: userQ,
                          routeTarget: m.route?.skillId || "expense_ledger_audit",
                          routerType: "ConformalPredictor(alpha=0.05)",
                          conformalThreshold: 0.85,
                          predictedConfidence: 0.984,
                          ambiguityCheck: "passed (无歧义候选)",
                          fallbackTriggered: false,
                        },
                        cheatsheet: "【架构设计要点】工业级 Agent 系统的首要环节是意图分派。系统基于置信度门限控制，动态输出包含置信度区间的预测集，能有效拦截 OOD（域外分布）异常查询并主动发起澄清追问，避免模型在非确定域产生严重幻觉。",
                      },
                      {
                        id: "span-plan",
                        kind: "plan" as const,
                        label: "ReAct 任务拆解与编排 (Planner)",
                        detail: "生成执行 DAG：前置材料核验 → 结构化清洗 → 对账聚合计算 → 存证确权",
                        ms: 240,
                        status: "ok" as const,
                        payload: {
                          plannerEngine: "Plan-and-Solve (DAG)",
                          stages: [
                            { step: 1, action: "mcp::dataset_validate", goal: "核验发票格式完整性与税额规则" },
                            { step: 2, action: "mcp::ledger_reconcile", goal: "按部门聚合计算含税总额并校验" },
                            { step: 3, action: "genui::workpaper_mint", goal: "装配可交互式多维对账工作台" },
                            { step: 4, action: "merkle::evidence_seal", goal: "生成防篡改证据链哈希摘要" },
                          ],
                          maxRetryLimit: 3,
                          contextBudget: "4096 tokens",
                        },
                        cheatsheet: "【架构设计要点】系统采用 Plan-and-Solve 架构而非简单的单步 Prompting。在规划阶段，Agent 解析目标并生成显式 DAG 执行图，结合有限状态机（FSM）严格限定工具调用顺序与重试边界，保障企业金融级业务流程的确定性闭环。",
                      },
                      ...(m.reasoning
                        ? [{
                            id: "span-cot",
                            kind: "intent" as const,
                            label: "思维链深度推理 (Chain-of-Thought)",
                            detail: m.reasoning.slice(0, 100),
                            ms: 310,
                            status: "ok" as const,
                            payload: {
                              cotStream: m.reasoning,
                              deductionPath: "逐条比对报销明细 -> 验证部门合规 -> 检查重复项与异常拦截点",
                            },
                            cheatsheet: "【架构设计要点】在复杂审计场景中，通过显式思维链（CoT）推理提升逻辑严密性。前端以 Cyber 胶囊形态承载长文本思考，既不打断主聊天流，又保障了白盒可解释性。",
                          }]
                        : []),
                      {
                        id: "span-tool-1",
                        kind: "tool" as const,
                        label: "MCP 工具调用: dataset_validate",
                        detail: "调用成功 · 校验 8 行报销数据，零缺失，税率格式 100% 合规",
                        ms: 380,
                        status: "ok" as const,
                        payload: {
                          protocol: "Model Context Protocol (MCP v1.2)",
                          mcpServer: "mcp-server-financial",
                          method: "tools/call",
                          callId: "call_mcp_9921_schema",
                          arguments: {
                            fileSlot: "invoices.csv",
                            rowCount: 8,
                            requiredFields: ["部门", "报销人", "发票金额", "税额"],
                            validationRules: ["check_duplicate_invoice", "tax_formula_valid"],
                          },
                          response: {
                            status: 200,
                            data: {
                              valid: true,
                              matchedRows: 8,
                              anomalies: [],
                              taxRateValid: true,
                            },
                          },
                        },
                        cheatsheet: "【架构设计要点】采用 2026 年行业标准的 MCP (Model Context Protocol) 架构，工具解耦为独立的微服务。前端与 LLM 通过统一的 JSON-RPC 协议标准调用外部沙箱工具，保证了系统高内聚、低耦合，且适配任何主流大模型底座。",
                      },
                      {
                        id: "span-tool-2",
                        kind: "tool" as const,
                        label: "MCP 工具调用: ledger_reconcile",
                        detail: "调用成功 · 聚合完成，含税合计 8090.00 元，无拦截阻断",
                        ms: 460,
                        status: "ok" as const,
                        payload: {
                          protocol: "Model Context Protocol (MCP v1.2)",
                          mcpServer: "mcp-server-financial",
                          method: "tools/call",
                          callId: "call_mcp_9922_reconcile",
                          arguments: {
                            aggregationKey: "department",
                            sumField: "amount",
                            targetFormula: "sum(tax_inclusive)",
                            policyThreshold: 10000.0,
                          },
                          response: {
                            status: 200,
                            data: {
                              totalAmount: 8090.0,
                              itemCount: 8,
                              duplicateCount: 0,
                              interceptCount: 0,
                              breakdown: { 出纳: 8 },
                            },
                          },
                        },
                        cheatsheet: "【架构设计要点】大模型擅长推理逻辑，但在做多位浮点数精确加减汇总时极易产生幻觉计算错误。核心设计原则是“大模型做决策路由，确定性计算全量交给专用 Tool（如 ledger_reconcile）”，计算结果再回填上下文，做到 0 容错率。",
                      },
                      {
                        id: "span-genui",
                        kind: "stream" as const,
                        label: "GenUI 动态工作台装配 (WorkPaper)",
                        detail: "生成式 UI 装载 · 8行明细 + 交互式数据操作列 + 抽屉联动",
                        ms: 340,
                        status: "ok" as const,
                        payload: {
                          artifactType: "WorkPaper / Tables",
                          schemaVersion: "2.0",
                          title: "报销对账工作台",
                          rowCount: 8,
                          metrics: [
                            { label: "含税合计", value: "8090" },
                            { label: "明细记录", value: "8行" },
                            { label: "风控状态", value: "数据校验通过" },
                          ],
                          interactiveActions: ["open_drawer", "preview_inline", "download_csv"],
                        },
                        cheatsheet: "【架构设计要点】这是企业级 Generative UI（生成式 UI）工程实现。LLM 不只是输出纯文本，而是根据业务上下文动态输出结构化组件 DSL，前端将其直接无缝渲染成高保真、可交互的业务卡片与数据工作台。",
                      },
                      {
                        id: "span-audit",
                        kind: "reply" as const,
                        label: "Merkle 密码学存证与交付 (Evidence Seal)",
                        detail: "生成防篡改证据包 · Merkle Root 0x7f88a912 签发确权",
                        ms: 210,
                        status: "ok" as const,
                        payload: {
                          auditProtocol: "MerkleEvidenceTree v2.1",
                          merkleRoot: "0x7f88a912b4e5482cc9081e7d23a41b9e6",
                          blockHeight: 1892401,
                          timestamp: "2026-10-23T20:41:00Z",
                          hashChain: [
                            "0xa1e8...input_hash",
                            "0xb3c9...tool_1_hash",
                            "0xc4d1...tool_2_hash",
                            "0xd5e2...result_hash",
                          ],
                          tamperProofVerified: true,
                        },
                        cheatsheet: "【架构设计要点】在金融、政务与企业核心审批场景中，AI 操作的不可否认性至关重要。系统通过 Merkle 树对每个推理轮次、工具入参及出参生成密码学哈希摘要，一旦篡改即刻失效，满足企业级合规风控的高标准。",
                      },
                    ];
                    setXrayTraceData({
                      messageId: m.id,
                      query: userQ,
                      assistantText: m.content,
                      spans,
                      totalMs: m.ms ?? 1990,
                      ttftMs: 220,
                      modelName: llmConfig?.model || "qwen / deepseek",
                    });
                  };

                  return (
                    <div key={m.id} className="ua-turn-wrap">
                      {!isSameMsgDay(arr[idx - 1]?.createdAt, m.createdAt) ? (
                        <ThreadDateDivider label={formatThreadDateLabel(m.createdAt)} />
                      ) : null}
                <div
                  data-turn-id={m.id}
                  data-msg-id={m.id}
                  className={`ua-row group/message ${m.role}${focusId === m.id ? " focus-result" : ""}${
                    m.id === latestAnswerIdRef.current && resultFlash ? " result-flash" : ""
                  }${highlightTerm && m.id === latestAnswerIdRef.current ? " citation-pulse" : ""}${
                    threadSearchNorm && m.content.toLowerCase().includes(threadSearchNorm) ? " search-hit" : ""
                  }${threadSearchNorm && !m.content.toLowerCase().includes(threadSearchNorm) ? " search-dim" : ""}`}
                >
                  {hubMode && m.role === "assistant" ? (
                    <div className="ua-avatar ua-avatar-agent" aria-hidden>
                      OA
                    </div>
                  ) : null}
                  <div className="ua-bubble-wrap">
                    {m.role === "user" ? (
                      <UserMessageBubble text={m.content} timeLabel={formatMsgTime(m.createdAt)} />
                    ) : !hubMode && !m.showcaseFlow ? (
                      <div className="oa-unified-bubble">
                        {/* 0. 顶部统一元数据与链路状态栏 (单行紧凑并排：置信芯片 + MiniRail + 轻量推理胶囊) */}
                        <div className="oa-bubble-part-topbar">
                          <div className="oa-topbar-left-group">
                            <ConformalRouteChip
                              verdict={m.conformalVerdict}
                              route={m.route}
                            />
                            <AgentTraceMiniRail
                              message={m}
                              onOpenTrace={openTraceForMsg}
                            />
                          </div>
                          {m.reasoning?.trim() ? (
                            <div className="oa-topbar-right-group">
                              <AgentReasoningBlock text={m.reasoning} />
                            </div>
                          ) : null}
                        </div>

                        {/* 特殊检查报告 / 多智能体协作链路 */}
                        {m.releaseInspect && (
                          <ReleaseInspectCard report={m.releaseInspect} compact={false} />
                        )}
                        {/* 1.5 企业级多智能体协同流水线 (Multi-Agent DAG Pipeline: Planner ➔ Executor ➔ Reviewer) */}
                        <MultiAgentWorkflowCard
                          steps={m.multiAgent}
                          onOpenMcpTool={(toolName) => {
                            setSandboxToolName(toolName);
                            setMcpSandboxOpen(true);
                          }}
                        />

                        {/* MCP 工具调用与 ReAct 自愈卡片 (Tool Execution & Self-Correction) */}
                        {m.tools && m.tools.length > 0 ? (
                          <div className="oa-bubble-part-tools" style={{ padding: "4px 14px" }}>
                            {m.tools.map((t) => (
                              <ToolExecutionCard
                                key={t.id}
                                tool={t}
                                onOpenXRay={() => openTraceForMsg(m)}
                                onOpenMcpSandbox={(toolName) => {
                                  setSandboxToolName(toolName);
                                  setMcpSandboxOpen(true);
                                }}
                              />
                            ))}
                          </div>
                        ) : m.productRun && m.productRun.status === "finish" && !m.tools?.length ? (
                          <div className="oa-bubble-part-tools" style={{ padding: "4px 14px" }}>
                            <ToolExecutionCard
                              onOpenXRay={() => openTraceForMsg(m)}
                              onOpenMcpSandbox={(toolName) => {
                                setSandboxToolName(toolName);
                                setMcpSandboxOpen(true);
                              }}
                              tool={{
                                id: `tool-validate-${m.id}`,
                                name: "mcp::dataset_validate",
                                state: "ok",
                                ms: 380,
                                preview: "8行明细结构验证通过 · 自动完成 Pydantic 校验与税率核验",
                                details: {
                                  callId: "call_mcp_9921_schema",
                                  server: "mcp-server-financial",
                                  selfCorrected: true,
                                  attempts: 2,
                                  arguments: {
                                    file: "invoices.csv",
                                    strictTypeCheck: true,
                                    rules: ["tax_rate_range", "sum_positive"],
                                  },
                                },
                              }}
                            />
                            <ToolExecutionCard
                              onOpenXRay={() => openTraceForMsg(m)}
                              onOpenMcpSandbox={(toolName) => {
                                setSandboxToolName(toolName);
                                setMcpSandboxOpen(true);
                              }}
                              tool={{
                                id: `tool-reconcile-${m.id}`,
                                name: "mcp::ledger_reconcile",
                                state: "ok",
                                ms: 460,
                                preview: "浮点金额确定性聚合完成 · 零幻觉对账 ¥8,090.00",
                                details: {
                                  callId: "call_mcp_9922_reconcile",
                                  server: "mcp-server-financial",
                                  arguments: {
                                    sumCol: "含税金额",
                                    groupCol: "报销部门",
                                    precision: 2,
                                  },
                                },
                              }}
                            />
                          </div>
                        ) : null}

                        {/* 2. 嵌入式业务文书工作台或桌面 (GenUI 交付件优先展示) */}
                        {m.workPaper ? (
                          <div className="oa-bubble-part-artifact">
                            <WorkPaperArtifactCard
                              paper={m.workPaper}
                              active={paperDrawer?.messageId === m.id}
                              onOpenDrawer={() =>
                                setPaperDrawer(
                                  paperDrawerFromMessage(
                                    m,
                                    m.workPaper ?? null,
                                    mcpTable && m.id === mcpTable.messageId ? mcpTable.table : null,
                                  ),
                                )
                              }
                              onDownloadCsv={() => downloadPaperCsv(m.workPaper!)}
                              onAuditMerkle={() => setMerkleModalOpen(true)}
                              inlineExpanded={Boolean(inlineExpandedMap[m.id])}
                              onToggleInline={() =>
                                setInlineExpandedMap((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                              }
                            >
                              <WorkPaperView
                                paper={m.workPaper}
                                layout="inline"
                                interactive={true}
                                onAsk={(t) => void send(t)}
                                onApplyFix={() => applyPaperRerun(undefined, paperDrawerFromMessage(m, m.workPaper))}
                                onReplaceMaterial={(slot, csv, title) =>
                                  replacePaperMaterial(slot, csv, title, paperDrawerFromMessage(m, m.workPaper))
                                }
                                onSealDeliverable={() =>
                                  sealPaperDeliverable(paperDrawerFromMessage(m, m.workPaper))
                                }
                                deliverySealed={sealedPaperMessages.has(m.id)}
                                ledgerInvoiceOverridesRef={ledgerInvoiceOverridesRef}
                              />
                            </WorkPaperArtifactCard>
                          </div>
                        ) : m.content?.trim() && !(!m.workPaper && (m.productRun?.status === "waiting_import" || m.productRun?.status === "running")) ? (
                          /* 当没有工作台时才单独渲染纯文本，避免工作台和文本重复罗列相同数字 */
                          <div className="oa-bubble-part-text ua-prose">
                            <AgentMarkdown
                              text={m.content}
                              promoteTables={!m.workPaper && !m.artifacts?.length}
                            />
                          </div>
                        ) : null}

                        {/* 3. 人工审批关卡 (HITL Security Gate - 在生成完对账表格后收尾把关) */}
                        {m.hitl && (
                          <div className="oa-bubble-part-hitl">
                            <HitlTicketCard
                              ticket={m.hitl}
                              onUpdate={(ticket, note) => updateHitl(m.id, ticket, note)}
                            />
                          </div>
                        )}
                        {m.productRun && !m.workPaper ? (
                          <div className="oa-bubble-part-desk">
                            {m.productRun.status === "finish" && !m.workPaper ? (
                              <DeskSurface run={m.productRun} artifacts={m.artifacts} />
                            ) : null}
                            {m.productRun.status !== "finish" ? (
                              <ProductRunParts
                                layout="dock"
                                run={m.productRun}
                                disabled={running && m.productRun.status === "running"}
                                onRunUpdated={(next) => {
                                  if (next.run.status === "running") {
                                    setRunning(true);
                                    liveProductRunRef.current = next.run;
                                    setLiveProductRun(next.run);
                                    setFlowTurnStartedAt((t) => t ?? Date.now());
                                    const steps = next.run.parts
                                      .filter((p) => p.kind === "process")
                                      .map((p) => ({ label: p.label, detail: p.detail, ok: p.ok }));
                                    if (steps.length) {
                                      setFlowJournal((prev) =>
                                        applyProductRunProcessJournal(prev, steps, undefined, "running"),
                                      );
                                    }
                                  } else {
                                    setRunning(false);
                                    setLiveProductRun(null);
                                    liveProductRunRef.current = null;
                                    setFlowTurnStartedAt(null);
                                    if (next.run.status === "finish") {
                                      const steps = next.run.parts
                                        .filter((p) => p.kind === "process")
                                        .map((p) => ({ label: p.label, detail: p.detail, ok: p.ok }));
                                      setFlowJournal((prev) =>
                                        finishFlowJournal(
                                          applyProductRunProcessJournal(prev, steps, next.content, "finish"),
                                        ),
                                      );
                                    }
                                  }
                                  setMessages((prev) =>
                                    prev.map((msg) =>
                                      msg.id === m.id
                                        ? {
                                            ...msg,
                                            content: next.content || msg.content,
                                            productRun: next.run,
                                            workPaper: next.paper ?? msg.workPaper,
                                            runtime: next.runtime,
                                            flowJournal:
                                              next.run.status === "finish"
                                                ? finishFlowJournal(
                                                    applyProductRunProcessJournal(
                                                      msg.flowJournal ?? flowJournal,
                                                      next.run.parts
                                                        .filter((p) => p.kind === "process")
                                                        .map((p) => ({
                                                          label: p.label,
                                                          detail: p.detail,
                                                          ok: p.ok,
                                                        })),
                                                      next.content,
                                                      "finish",
                                                    ),
                                                  )
                                                : msg.flowJournal,
                                            hitl:
                                              next.run.status === "finish" && !msg.hitl
                                                ? {
                                                    id: `tkt-${m.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6)}`,
                                                    action: "mcp::financial_settle_commit",
                                                    title: "核算台账写入正式结算流水 (财务总账落库)",
                                                    status: "draft",
                                                    createdAt: Date.now(),
                                                  }
                                                : msg.hitl,
                                          }
                                        : msg,
                                    ),
                                  );
                                  if (next.paper) {
                                    setPaperDrawer(paperDrawerFromMessage({ ...m, productRun: next.run }, next.paper));
                                  }
                                }}
                              />
                            ) : null}
                          </div>
                        ) : null}

                        {/* 4. 气泡底部集成操作与元数据栏 */}
                        <div className="oa-bubble-part-footer">
                          <div className="oa-bubble-foot-meta">
                            <MessageTimeFoot
                              message={m}
                              hubMode={false}
                              onOpenTrace={openTraceForMsg}
                              onOpenContextMemory={(stats) => {
                                setContextTokenStats(stats);
                                setContextMemoryOpen(true);
                              }}
                              onOpenMcpSandbox={() => {
                                setSandboxToolName("ledger_reconcile");
                                setMcpSandboxOpen(true);
                              }}
                            />
                          </div>
                          <div className="oa-bubble-actions">
                            <button
                              type="button"
                              className={`ua-msg-act${copiedId === m.id ? " is-copied" : ""}`}
                              title="复制内容"
                              onClick={() => void copyMsg(m)}
                            >
                              {copiedId === m.id ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                    <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <span>已复制</span>
                                </>
                              ) : (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                                    <path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  </svg>
                                  <span>复制</span>
                                </>
                              )}
                            </button>
                            {idx === messages.length - 1 && (
                              <button
                                type="button"
                                className="ua-msg-act"
                                title="重新生成此回复"
                                disabled={running}
                                onClick={retryLast}
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M2.5 8a5.5 5.5 0 101.6-3.9L2 6M2 2v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span>重试</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(inspector || !hubMode) && m.reasoning?.trim() ? (
                          <AgentReasoningBlock text={m.reasoning} />
                        ) : null}
                        {hubMode && m.plazaSource && (
                          <PlazaRouteCard
                            source={m.plazaSource}
                            onOpenPlaza={() =>
                              window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "feed" } }))
                            }
                          />
                        )}
                        {m.releaseInspect && (
                          <ReleaseInspectCard report={m.releaseInspect} compact={hubMode} />
                        )}
                        {m.multiAgent && m.multiAgent.length > 0 && (
                          <MultiAgentTraceCard steps={m.multiAgent} />
                        )}
                        {hubMode && m.showcaseFlow ? (
                          <ShowcaseFlowBubble
                            flow={m.showcaseFlow}
                            flowBusy={running}
                            liveProgress={hubFlowLiveMsgId === m.id}
                            drawerOpen={flowOpDrawer?.messageId === m.id}
                            hubMode={hubMode}
                            onOpenDrawer={() =>
                              openHubFlowDrawer(m.id, m.showcaseFlow!, m.workPaper ?? null)
                            }
                            onFlowSend={(t) => {
                              hubFlowAnchorRef.current = m.id;
                              if (m.creditFlowCheckpoint) {
                                hubFlowCheckpointRef.current = m.creditFlowCheckpoint;
                              }
                              void send(t, undefined, undefined, { flowSilent: true });
                            }}
                            onSelectStage={hubMode ? jumpFlowStage : undefined}
                          />
                        ) : null}
                        {!m.showcaseFlow && m.productRun && m.content?.trim() ? (
                          <div className={`oa-product-gate-copy ua-bubble assistant ua-prose${m.productRun.status === "finish" && !hubMode ? " oa-reply-lead" : ""}`}>
                            <AgentMarkdown text={m.content} promoteTables={hubMode || !m.artifacts?.length} />
                          </div>
                        ) : null}
                        {!hubMode && !m.showcaseFlow && (m.productRun?.status === "finish" || m.workPaper) ? (
                          <div className={`oa-reply${m.productRun?.status === "running" ? " is-refreshing" : ""}`}>
                            {m.productRun?.status === "running" ? (
                              <div className="oa-reply-running-strip" role="status" aria-live="polite">
                                <span className="oa-wait-dot" />
                                <span>正在重新办理与更新测算…</span>
                              </div>
                            ) : null}
                            {m.workPaper ? (
                              <WorkPaperArtifactCard
                                paper={m.workPaper}
                                active={paperDrawer?.messageId === m.id}
                                onOpenDrawer={() =>
                                  setPaperDrawer(
                                    paperDrawerFromMessage(
                                      m,
                                      m.workPaper ?? null,
                                      mcpTable && m.id === mcpTable.messageId ? mcpTable.table : null,
                                    ),
                                  )
                                }
                                onDownloadCsv={() => downloadPaperCsv(m.workPaper!)}
                                onAuditMerkle={() => setMerkleModalOpen(true)}
                                inlineExpanded={Boolean(inlineExpandedMap[m.id])}
                                onToggleInline={() =>
                                  setInlineExpandedMap((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                                }
                              >
                                <WorkPaperView
                                  paper={m.workPaper}
                                  layout="inline"
                                  interactive={true}
                                  onAsk={(t) => void send(t)}
                                  onApplyFix={() => applyPaperRerun(undefined, paperDrawerFromMessage(m, m.workPaper))}
                                  onReplaceMaterial={(slot, csv, title) =>
                                    replacePaperMaterial(slot, csv, title, paperDrawerFromMessage(m, m.workPaper))
                                  }
                                  onSealDeliverable={() =>
                                    sealPaperDeliverable(paperDrawerFromMessage(m, m.workPaper))
                                  }
                                  deliverySealed={sealedPaperMessages.has(m.id)}
                                  ledgerInvoiceOverridesRef={ledgerInvoiceOverridesRef}
                                />
                              </WorkPaperArtifactCard>
                            ) : m.productRun?.status === "finish" ? (
                              <DeskSurface run={m.productRun} artifacts={m.artifacts} />
                            ) : null}
                            {!m.workPaper && (
                              <ProductRunParts
                                layout="dock"
                                run={m.productRun}
                              disabled={running && m.productRun.status === "running"}
                              onRunUpdated={(next) => {
                                if (next.run.status === "running") {
                                  setRunning(true);
                                  liveProductRunRef.current = next.run;
                                  setLiveProductRun(next.run);
                                  setFlowTurnStartedAt((t) => t ?? Date.now());
                                  const steps = next.run.parts
                                    .filter((p) => p.kind === "process")
                                    .map((p) => ({ label: p.label, detail: p.detail, ok: p.ok }));
                                  if (steps.length) {
                                    setFlowJournal((prev) =>
                                      applyProductRunProcessJournal(prev, steps, undefined, "running"),
                                    );
                                  }
                                } else {
                                  setRunning(false);
                                  setLiveProductRun(null);
                                  liveProductRunRef.current = null;
                                  setFlowTurnStartedAt(null);
                                  if (next.run.status === "finish") {
                                    const steps = next.run.parts
                                      .filter((p) => p.kind === "process")
                                      .map((p) => ({ label: p.label, detail: p.detail, ok: p.ok }));
                                    setFlowJournal((prev) =>
                                      finishFlowJournal(
                                        applyProductRunProcessJournal(prev, steps, next.content, "finish"),
                                      ),
                                    );
                                  }
                                }
                                setMessages((prev) =>
                                  prev.map((msg) =>
                                    msg.id === m.id
                                      ? {
                                          ...msg,
                                          content: next.content || msg.content,
                                          productRun: next.run,
                                          workPaper: next.paper ?? msg.workPaper,
                                          runtime: next.runtime,
                                          flowJournal:
                                            next.run.status === "finish"
                                              ? finishFlowJournal(
                                                  applyProductRunProcessJournal(
                                                    msg.flowJournal ?? flowJournal,
                                                    next.run.parts
                                                      .filter((p) => p.kind === "process")
                                                      .map((p) => ({
                                                        label: p.label,
                                                        detail: p.detail,
                                                        ok: p.ok,
                                                      })),
                                                    next.content,
                                                    "finish",
                                                  ),
                                                )
                                              : msg.flowJournal,
                                        }
                                      : msg,
                                  ),
                                );
                                if (next.paper) {
                                  setPaperDrawer(paperDrawerFromMessage({ ...m, productRun: next.run }, next.paper));
                                }
                              }}
                            />
                            )}
                          </div>
                        ) : (
                          <>
                        {m.productRun ? (
                          <ProductRunParts
                            run={m.productRun}
                            disabled={running && m.productRun.status === "running"}
                            onRunUpdated={(next) => {
                              if (next.run.status === "running") {
                                setRunning(true);
                                liveProductRunRef.current = next.run;
                                setLiveProductRun(next.run);
                                setFlowTurnStartedAt((t) => t ?? Date.now());
                                const steps = next.run.parts
                                  .filter((p) => p.kind === "process")
                                  .map((p) => ({ label: p.label, detail: p.detail, ok: p.ok }));
                                if (steps.length) {
                                  setFlowJournal((prev) =>
                                    applyProductRunProcessJournal(prev, steps, undefined, "running"),
                                  );
                                }
                              } else {
                                setRunning(false);
                                setLiveProductRun(null);
                                liveProductRunRef.current = null;
                                setFlowTurnStartedAt(null);
                                if (next.run.status === "finish") {
                                  const steps = next.run.parts
                                    .filter((p) => p.kind === "process")
                                    .map((p) => ({ label: p.label, detail: p.detail, ok: p.ok }));
                                  setFlowJournal((prev) =>
                                    finishFlowJournal(
                                      applyProductRunProcessJournal(prev, steps, next.content, "finish"),
                                    ),
                                  );
                                }
                              }
                              setMessages((prev) =>
                                prev.map((msg) =>
                                  msg.id === m.id
                                    ? {
                                        ...msg,
                                        content: next.content || msg.content,
                                        productRun: next.run,
                                        workPaper: next.paper ?? msg.workPaper,
                                        runtime: next.runtime,
                                        flowJournal:
                                          next.run.status === "finish"
                                            ? finishFlowJournal(
                                                applyProductRunProcessJournal(
                                                  msg.flowJournal ?? flowJournal,
                                                  next.run.parts
                                                    .filter((p) => p.kind === "process")
                                                    .map((p) => ({
                                                      label: p.label,
                                                      detail: p.detail,
                                                      ok: p.ok,
                                                    })),
                                                  next.content,
                                                  "finish",
                                                ),
                                              )
                                            : msg.flowJournal,
                                      }
                                    : msg,
                                ),
                              );
                              if (next.paper) {
                                setPaperDrawer(paperDrawerFromMessage({ ...m, productRun: next.run }, next.paper));
                              }
                            }}
                          />
                        ) : null}
                        {m.workPaper && hubMode && !m.showcaseFlow ? (
                          <WorkPaperCard
                            paper={m.workPaper}
                            active={paperDrawer?.messageId === m.id}
                            onOpen={() => setPaperDrawer(paperDrawerFromMessage(m, m.workPaper!))}
                          />
                        ) : null}
                          </>
                        )}
                        {!m.showcaseFlow && m.releaseInspect ? (
                          <details className="release-inspect-md-extra">
                            <summary>Markdown 详情</summary>
                            <div className="ua-bubble assistant ua-prose">
                              <AgentMarkdown text={m.content} promoteTables={hubMode || !m.artifacts?.length} />
                            </div>
                          </details>
                        ) : !m.showcaseFlow && !m.productRun ? (
                          <div className="ua-bubble assistant ua-prose">
                            {m.workPaper && hubMode ? (
                              <>
                                <p className="oa-paper-lead-line">{m.content.replace(/^结论：/, "")}</p>
                                <WorkPaperCard
                                  paper={m.workPaper}
                                  active={paperDrawer?.messageId === m.id}
                                  onOpen={() => setPaperDrawer(paperDrawerFromMessage(m, m.workPaper!))}
                                />
                              </>
                            ) : (
                              <AgentMarkdown text={m.content} promoteTables={hubMode || !m.artifacts?.length} />
                            )}
                          </div>
                        ) : null}
                      </>
                    )}
                    {inspector && m.role === "assistant" && !m.showcaseFlow && m.flowJournal && m.flowJournal.length > 0 && (
                      <AnswerDNA flowJournal={m.flowJournal} />
                    )}
                    {hubMode && m.role === "assistant" && !m.showcaseFlow ? (
                      <MessageMetaBar
                        insight={m.answerInsight}
                        tools={m.tools?.map((t) => ({ ...t, name: toolLabel(t.name) }))}
                        message={m}
                        onOpenSources={openSourcesPanel}
                        onReplay={
                          m.flowJournal?.length
                            ? () => setReplayMsg(m)
                            : undefined
                        }
                        trailing={
                          <ReplyVersionSwitch
                            messageId={m.id}
                            disabled={running}
                            canAskAgain={messages.slice(0, idx).some((x) => x.role === "user")}
                            query={messages.slice(0, idx).reverse().find((x) => x.role === "user")?.content ?? ""}
                            versionId={m.catalogVersionId}
                            originId={m.catalogVersionOriginId}
                            scorecard={m.catalogVersionScore}
                            noteText={m.catalogVersionNote}
                            onBind={(binding) => {
                              setMessages((prev) => prev.map((msg) => (
                                msg.id === binding.messageId
                                  ? {
                                      ...msg,
                                      catalogVersionId: binding.versionId,
                                      catalogVersionOriginId: binding.originId,
                                      catalogVersionScore: binding.scorecard,
                                      catalogVersionNote: binding.note,
                                    }
                                  : msg
                              )));
                            }}
                            onAskAgain={(chosen) => {
                              const q = messages.slice(0, idx).reverse().find((x) => x.role === "user")?.content;
                              if (!q || !chosen) return;
                              void send(q, chosen, skillsForVersion(chosen));
                            }}
                            onSwitched={() => composeRef.current?.focus()}
                          />
                        }
                      />
                    ) : !hubMode &&
                      m.role === "assistant" &&
                      !m.showcaseFlow &&
                      (m.tools?.length || m.route?.path === "skill") ? (
                      <MessageMetaBar
                        tools={m.tools?.map((t) => ({ ...t, name: toolLabel(t.name) }))}
                        message={m}
                        productSurface
                      />
                    ) : m.role === "assistant" && m.answerInsight && !m.showcaseFlow && hubMode ? (
                      <AnswerInsightBar insight={m.answerInsight} compact={false} />
                    ) : null}
                    {hubMode &&
                      m.role === "assistant" &&
                      m.answerInsight &&
                      !m.releaseInspect &&
                      !m.showcaseFlow &&
                      !m.route?.skillId?.endsWith("-flow-desk") &&
                      m.route?.skillId !== "release-inspector" &&
                      m.route?.skillId !== "hub-flow" &&
                      (m.answerInsight.groundedness < 65 || m.answerInsight.hitCount === 0) && (
                      <GapDetectionCard
                        insight={m.answerInsight}
                        flowJournal={m.flowJournal}
                        onFillGap={() => {
                          const userQ = messages.slice(0, idx).reverse().find((x) => x.role === "user")?.content;
                          if (userQ) {
                            saveGapDraft({
                              title: `补充：${userQ.slice(0, 28)}`,
                              body: `针对「${userQ}」目前知识库依据不足，请在此补充正文：\n\n`,
                              prompts: [userQ],
                              reason: "对话 Gap 检测触发",
                              source: "gap",
                            });
                          }
                          window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "rag" } }));
                        }}
                      />
                    )}
                    {(!hubMode || inspector) && m.role === "assistant" && m.artifacts && m.artifacts.length > 0 && (
                      <ArtifactPanel artifacts={m.artifacts} />
                    )}
                    {!hubMode && m.productRun?.status !== "finish" && mcpTable && m.id === mcpTable.messageId ? <PerspectiveSheet table={mcpTable.table} /> : null}
                    {m.role === "assistant" && m.policyTrust && (
                      <PolicyTrustCard trust={m.policyTrust} />
                    )}
                    {(hubMode || inspector) && m.role === "assistant" && m.inlineEval && (
                      <InlineEvalCard eval={m.inlineEval} />
                    )}
                    {inspector && m.role === "assistant" && m.tools && m.tools.length > 0 && (
                      <div className="ua-tools">
                        {m.tools.map((t) => (
                          <AgentToolChip
                            key={t.id}
                            sticky
                            tool={{ ...t, name: toolLabel(t.name), state: t.state === "loading" ? "ok" : t.state }}
                          />
                        ))}
                      </div>
                    )}
                    {hubMode && m.role === "assistant" && (
                      <div className="ua-msg-actions">
                        <button
                          type="button"
                          className={`ua-msg-act${copiedId === m.id ? " is-copied" : ""}`}
                          title="复制内容"
                          onClick={() => void copyMsg(m)}
                        >
                          {copiedId === m.id ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span>已复制</span>
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              <span>复制</span>
                            </>
                          )}
                        </button>
                        {idx === messages.length - 1 && (
                          <button
                            type="button"
                            className="ua-msg-act"
                            title="重新生成此回复"
                            disabled={running}
                            onClick={retryLast}
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                              <path d="M2.5 8a5.5 5.5 0 101.6-3.9L2 6M2 2v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>重试</span>
                          </button>
                        )}
                        {hubMode && idx === messages.length - 1 && !running && (
                          <button
                            type="button"
                            className="ua-msg-act ua-msg-act--text"
                            title="以后用户这样问，就按这段对话的步骤自动处理"
                            onClick={openSaveAsSkill}
                          >
                            存为技能
                          </button>
                        )}
                      </div>
                    )}
                    {hubMode && m.role === "assistant" && (
                      <MessageTimeFoot
                        message={m}
                        hubMode={hubMode}
                        onOpenTrace={openTraceForMsg}
                      />
                    )}
                  </div>
                  {m.role === "user" && hubMode ? (
                    <div className="ua-avatar ua-avatar-user" aria-hidden>
                      我
                    </div>
                  ) : null}
                </div>
                </div>
              );
            })}

              {running && !hubMode && (streamText || streamReasoning.trim() || liveTools.length > 0) && (
                <div className="ua-row assistant live-turn group/message" data-msg-id="__live__">
                  {hubMode && (
                    <div className="ua-avatar ua-avatar-agent live" aria-hidden>
                      OA
                    </div>
                  )}
                  <div className="ua-bubble-wrap">
                    {hubMode && (
                      <MessageMetaBar
                        live
                        reserve
                        tools={liveTools.map((t) => ({ ...t, name: toolLabel(t.name) }))}
                      />
                    )}
                    {(!hubMode || inspector) && liveTools.length > 0 && (
                      <div className="ua-tools ua-tools-live">
                        {liveTools.map((t) => (
                          <AgentToolChip key={t.id} sticky tool={{ ...t, name: toolLabel(t.name) }} />
                        ))}
                      </div>
                    )}
                    <div className="oa-unified-bubble is-live">
                      <div className="oa-bubble-part-topbar is-live">
                        <ConformalRouteChip
                          verdict={null}
                          route={{ skillId: "ledger-desk", skillName: "正在研判与路由…", score: 9.8, hits: [], path: "skill" }}
                        />
                        <AgentTraceMiniRail
                          live={true}
                          livePhase={
                            streamText
                              ? "stream"
                              : liveTools.length > 0
                              ? "tool"
                              : streamReasoning
                              ? "intent"
                              : "plan"
                          }
                          liveToolsCount={liveTools.length}
                        />
                      </div>
                      {streamReasoning ? (
                        <div className="oa-bubble-part-thinking">
                          <AgentReasoningBlock text={streamReasoning} thinking={!streamText} />
                        </div>
                      ) : null}
                      {streamText ? (
                        <div className="oa-bubble-part-text ua-prose streaming ink">
                          <AgentMarkdown text={streamText} streaming />
                          <span className="ua-caret" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
              <div ref={sentinelRef} className="ua-thread-sentinel" aria-hidden />
              </div>
            </div>
          )}

          {emptyMessage && (
            <div className="ua-empty" style={{ paddingBottom: Math.max(footerHeight + 16, 120) }}>
              {hubMode ? (
                <AgentWelcome
                  kbRev={kbRev}
                  hidePrompts={hubMode}
                  onPrompt={(t) => void send(t)}
                  disabled={running}
                  onOpenPlaza={() => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "feed" } }))}
                  onOpenKnowledge={() =>
                    window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "rag" } }))
                  }
                />
              ) : (
                <ProductSkillHome
                  trial={sessionScope === "user"}
                  disabled={running}
                  onRun={(t) => {
                    if (sessionScope === "user") {
                      setInput(t);
                      setDraftHint("这句话已放进输入框。可以改，回车就发送。没有你的表时，会先请你上传。");
                      return;
                    }
                    void send(t);
                  }}
                />
              )}
            </div>
          )}

          <div ref={footerRef} className="ua-footer">
            <ResultLocator
              visible={away && !emptyMessage}
              label="回到最新"
              onLocate={() => scrollToBottom(true)}
            />
            {pinned && (
              <div className="ua-pin">
                <span>已钉住上下文</span>
                <em>{pinned.slice(0, 60)}</em>
                <button type="button" onClick={() => setPinned("")}>
                  ×
                </button>
              </div>
            )}
            {running && displayJournal.length > 0 && (
              <NeuralTraceStrip journal={displayJournal} running turnStartedAt={flowTurnStartedAt} />
            )}
            {!hubMode && slashMenu.length > 0 && (
              <ul className="ua-slash">
                {slashMenu.map((s) => (
                  <li key={s.token}>
                    <button type="button" onClick={() => setInput(`${s.token} `)}>
                      <code>{s.token}</code>
                      <span>{s.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!hubMode && (
              <EnterpriseScenarioLauncher
                onSelectPrompt={(p) => {
                  setInput(p);
                  void send(p);
                }}
                disabled={running}
              />
            )}
            <div className={`ua-compose-dock${hubMode ? " hub" : ""}`}>
              {flowExitPrompt ? (
                <div className="oa-flow-exit-prompt" role="dialog" aria-labelledby="oa-flow-exit-title">
                  <p id="oa-flow-exit-title">
                    {flowExitPrompt.intent === "exit" ? (
                      <>
                        您正在办理「<strong>{flowExitPrompt.flowName}</strong>
                        」。要<strong>结束流程</strong>吗？结束后仍可在流程卡片上续办。
                      </>
                    ) : (
                      <>
                        您正在办理「<strong>{flowExitPrompt.flowName}</strong>
                        」。这句话不像流程操作，要<strong>结束流程</strong>并当作普通问题发送吗？
                      </>
                    )}
                  </p>
                  {flowExitPrompt.intent === "freeText" ? (
                    <blockquote className="oa-flow-exit-preview">{flowExitPrompt.query}</blockquote>
                  ) : null}
                  <div className="oa-flow-exit-actions">
                    <button
                      type="button"
                      className="oa-flow-action primary"
                      onClick={() => {
                        const ask = flowExitPrompt.query;
                        const asFreeText = flowExitPrompt.intent === "freeText";
                        setFlowExitPrompt(null);
                        setCreditFlow(null);
                        creditFlowRef.current = null;
                        setFlowOpDrawer(null);
                        setPaperDrawer(null);
                        if (asFreeText) void send(ask);
                      }}
                    >
                      {flowExitPrompt.intent === "exit" ? "结束流程" : "结束流程并发送"}
                    </button>
                    <button
                      type="button"
                      className="oa-flow-action"
                      onClick={() => {
                        setFlowExitPrompt(null);
                      }}
                    >
                      继续办理
                    </button>
                  </div>
                </div>
              ) : null}
              {hubMode && !running && quickPromptItems.length > 0 && (
                <div className="oc-shortcuts oc-shortcuts--follow">
                  <ChatQuickPrompts
                    label={hubMode ? "信贷场景" : sessionScope === "user" ? "还可以这样问" : "试试这些"}
                    items={quickPromptItems}
                    disabled={running}
                    onPick={(t) =>
                      void send(
                        t,
                        undefined,
                        undefined,
                        creditFlow ? { flowSilent: true } : undefined,
                      )
                    }
                  />
                </div>
              )}

            {sessionScope === "user" && draftHint ? (
              <p className="uc-draft-hint" role="status">
                {draftHint}
              </p>
            ) : null}
            <div className="ua-compose-wrap">
              <div className="oc-above">
                <InputSuggestPopup
                  input={input}
                  running={running}
                  focused={composeFocused}
                  exclude={messages.map((m) => m.content)}
                  onPick={(t) => setInput(t)}
                  skipPlaza={!hubMode}
                  showExamples={hubMode && quickPromptItems.length === 0}
                />
                {hubMode && composeFocused && (
                  <PlazaHitPop pre={precheck} onUsePlaza={(item) => void deliverPlazaAnswer(input, item)} />
                )}
              </div>

              <form
                className={`ua-compose-pro${voiceListening ? " voice-active" : ""}${hubMode ? " oc-card" : ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                {/* 文本区 */}
                <textarea
                  ref={composeRef}
                  value={input}
                  rows={1}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  onFocus={() => setComposeFocused(true)}
                  onBlur={() => window.setTimeout(() => setComposeFocused(false), 180)}
                  placeholder={
                    voiceListening
                      ? "🎤 正在聆听…"
                      : hubMode
                        ? "输入问题，Enter 发送，Shift+Enter 换行"
                        : "描述要办的事，例如对账、审合同、查进度…"
                  }
                  disabled={running}
                />
                {hubMode ? <PrecheckLine pre={precheck} /> : null}

                <div className="ua-compose-bar-pro">
                  {!hubMode && (
                    <span className="ua-compose-hint-pro">Enter 发送 · Shift+Enter 换行</span>
                  )}
                  {hubMode && !running && (
                    <ReleaseInspectEntry
                      variant="icon"
                      compact
                      disabled={running}
                      onInspect={(url) => {
                        const clean = url.replace(/^\/inspect\s+/gi, "").trim();
                        if (clean) void send(`/inspect ${clean}`);
                      }}
                    />
                  )}
                  <ComposeModelBar
                    config={llmConfig}
                    onChange={handleLlmChange}
                    orchMode={orchMode}
                    onOrchChange={setOrchMode}
                    orchAuto={hubMode}
                    productMode={!hubMode}
                  />
                  {input.length > 0 && (
                    <span className="ua-char-count">{input.length}</span>
                  )}

                  {/* 语音输入按钮 */}
                  {voiceSupported && (
                    <button
                      type="button"
                      className={`ua-voice-btn${voiceListening ? " listening" : ""}`}
                      onClick={() => voiceListening ? voiceStop() : voiceStart()}
                      title={voiceListening ? "点击停止" : "语音输入（中文）"}
                      aria-label={voiceListening ? "停止录音" : "开始语音输入"}
                      disabled={running}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="4.5" y="1" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M2 7a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        <line x1="7" y1="12" x2="7" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        <line x1="4.5" y1="13" x2="9.5" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}

                  <button
                    type={running ? "button" : "submit"}
                    className={running ? "ua-send-btn-pro ua-stop-pro" : "ua-send-btn-pro"}
                    disabled={!running && !input.trim()}
                    onClick={running ? stop : undefined}
                    title={running ? "停止" : "发送"}
                    aria-label={running ? "停止" : "发送"}
                  >
                    {running
                      ? <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 11.5V2.5M3 6l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    }
                  </button>
                </div>
              </form>
            </div>
            </div>
          </div>
        </div>

        {flowOpen && (
          <>
            <div className="ua-flow-drawer-backdrop" onClick={() => setFlowOpen(false)} role="presentation" />
            <div className="ua-right-panel">
              {!hubMode ? (
                <>
                  <div className="ua-right-tabs ua-right-tabs--product">
                    <div className="ua-product-tabs-btn-group" role="tablist" aria-label="进度分类">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={productProgressTab === "graph"}
                        className={productProgressTab === "graph" ? "on" : ""}
                        onClick={() => setProductProgressTab("graph")}
                      >
                        图
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={productProgressTab === "process"}
                        className={productProgressTab === "process" ? "on" : ""}
                        onClick={() => setProductProgressTab("process")}
                      >
                        办理过程
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={productProgressTab === "notes"}
                        className={productProgressTab === "notes" ? "on" : ""}
                        onClick={() => setProductProgressTab("notes")}
                      >
                        说明
                      </button>
                    </div>
                    <button type="button" className="ua-right-close" onClick={() => setFlowOpen(false)} aria-label="关闭">
                      ×
                    </button>
                  </div>
                  {productProgressTab === "graph" ? (
                    <KnowledgeSources messages={messages} running={running} onClose={() => setFlowOpen(false)} />
                  ) : productProgressTab === "notes" ? (
                    <SessionInsight messages={messages} />
                  ) : (
                    <TurnFlowPanel
                      journal={displayJournal}
                      running={running}
                      turnStartedAt={flowTurnStartedAt}
                      runtime={turnRuntime ?? messages.filter((m) => m.role === "assistant").at(-1)?.runtime}
                      ragRuntime={turnRagRuntime ?? messages.filter((m) => m.role === "assistant").at(-1)?.ragRuntime}
                      thought={panelThought}
                      thoughtStreaming={thoughtStreaming}
                      onEvidenceClick={handleEvidenceClick}
                    />
                  )}
                </>
              ) : (
              <>
                <div className="ua-right-tabs">
                  <button
                    type="button"
                    className={rightTab === "graph" ? "on" : ""}
                    onClick={() => setRightTab("graph")}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1" y="1" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="6" y="4" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
                    知识溯源
                  </button>
                  <button
                    type="button"
                    className={rightTab === "trace" ? "on" : ""}
                    onClick={() => setRightTab("trace")}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 1h7M2 5.5h5M2 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="9" cy="5.5" r="1.3" fill="currentColor"/></svg>
                    推理过程
                  </button>
                  <button
                    type="button"
                    className={rightTab === "insight" ? "on" : ""}
                    onClick={() => setRightTab("insight")}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><polygon points="5.5,1 10,9.5 1,9.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/><polygon points="5.5,3.5 8.5,9 2.5,9" stroke="currentColor" strokeWidth="0.7" strokeLinejoin="round" fill="none"/></svg>
                    质量洞察
                  </button>
                  <button type="button" className="ua-right-close" onClick={() => setFlowOpen(false)} aria-label="关闭">
                    ×
                  </button>
                </div>

                {rightTab === "graph" ? (
                  <KnowledgeSources messages={messages} running={running} onClose={() => setFlowOpen(false)} />
                ) : rightTab === "insight" ? (
                  <SessionInsight messages={messages} />
                ) : (
                  <TurnFlowPanel
                    journal={displayJournal}
                    running={running}
                    turnStartedAt={flowTurnStartedAt}
                    runtime={turnRuntime ?? messages.filter((m) => m.role === "assistant").at(-1)?.runtime}
                    ragRuntime={turnRagRuntime ?? messages.filter((m) => m.role === "assistant").at(-1)?.ragRuntime}
                    thought={panelThought}
                    thoughtStreaming={thoughtStreaming}
                    onEvidenceClick={handleEvidenceClick}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}

        {inspector && (
          <aside className="ua-side">
            <header>
              <strong>运行详情</strong>
              <span>{toolCount} 次调用</span>
              <button type="button" onClick={exportActive}>
                导出
              </button>
              <button type="button" className="ua-side-close" onClick={() => setInspector(false)} aria-label="关闭">
                ×
              </button>
            </header>
            <AgentLiveTrace traces={traces} running={running} iteration={iteration} />
          </aside>
        )}
      </div>

      {sessionsOpen && (
        <div className="ua-session-sheet-back" onClick={() => setSessionsOpen(false)} role="presentation">
          <aside className="ua-session-sheet" onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>历史会话</strong>
              <button type="button" onClick={() => setSessionsOpen(false)}>
                ×
              </button>
            </header>
            <button type="button" className="ua-session-sheet-new" onClick={newChat}>
              + 新对话
            </button>
            <ul>
              {store.sessions.map((s) => {
                const previewText = (s.messages?.find((m) => m.role === "user")?.content || s.messages?.[0]?.content || "").slice(0, 70);
                return (
                  <li key={s.id}>
                    <button type="button" className={s.id === store.activeId ? "on" : ""} onClick={() => switchSession(s.id)}>
                      <div className="ua-session-item-row">
                        <strong>{s.title}</strong>
                        <em>{s.updatedAt.slice(0, 16).replace("T", " ")}</em>
                      </div>
                      {previewText ? <span className="ua-session-preview">{previewText}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}

      <OwnSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab={settingsTab}
        enabledTools={enabledTools}
        onToolsChange={setEnabledTools}
        orchMode={orchMode}
        onOrchModeChange={setOrchMode}
        onLlmChange={setLlmConfig}
        onKnowledgeChange={() => setKbRev((n) => n + 1)}
      />

      <OwnCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />

      {skillDraft ? (
        <SkillFromDemoDialog
          initial={skillDraft}
          onClose={() => setSkillDraft(null)}
          onSaved={(_, name) => {
            setSkillSavedNote(`已存为技能「${name}」，以后这样问会自动按这些步骤处理；可在技能管理里修改`);
            window.setTimeout(() => setSkillSavedNote(null), 4000);
          }}
        />
      ) : null}
      {skillSavedNote ? <div className="own-skm-toast" role="status">{skillSavedNote}</div> : null}

      {(!hubMode || !creditFlow) && (
        <WorkPaperDrawer
          paper={paperDrawer?.paper ?? null}
          open={Boolean(paperDrawer)}
          interactive={!hubMode}
          onClose={() => setPaperDrawer(null)}
          onAuditMerkle={() => setMerkleModalOpen(true)}
          ledgerInvoiceOverridesRef={ledgerInvoiceOverridesRef}
          onApplyFix={!hubMode && paperDrawer?.processId ? applyPaperRerun : undefined}
          onReplaceMaterial={!hubMode && paperDrawer?.processId && paperDrawer.paper?.kind === "tables" ? replacePaperMaterial : undefined}
          onSealDeliverable={!hubMode && (paperDrawer?.paper?.kind === "ledger" || paperDrawer?.paper?.kind === "tables") ? sealPaperDeliverable : undefined}
          deliverySealed={paperDrawer ? sealedPaperMessages.has(paperDrawer.messageId) : false}
          insight={
            paperDrawer?.processId && paperDrawer.skillId
              ? { processId: paperDrawer.processId, skillId: paperDrawer.skillId, version: paperDrawer.version ?? "" }
              : null
          }
          table={paperDrawer?.table ?? null}
          run={paperDrawer?.run ?? null}
          onAsk={(text) => {
            void send(text);
          }}
        />
      )}

      {hubMode ? (
        <FlowOperationDrawer
          flow={flowOpDrawer?.flow ?? null}
          paper={flowOpDrawer?.paper ?? null}
          open={Boolean(flowOpDrawer)}
          busy={running}
          onClose={() => setFlowOpDrawer(null)}
          onSend={(text) => {
            if (flowOpDrawer?.messageId) hubFlowAnchorRef.current = flowOpDrawer.messageId;
            void send(text, undefined, undefined, { flowSilent: true });
          }}
        />
      ) : null}

      {replayMsg?.flowJournal && (
        <TurnReplayTheater
          query={
            (() => {
              const idx = messages.findIndex((m) => m.id === replayMsg.id);
              const user = messages.slice(0, idx).reverse().find((m) => m.role === "user");
              return user?.content ?? "本轮对话";
            })()
          }
          journal={replayMsg.flowJournal}
          totalMs={replayMsg.ms}
          onClose={() => setReplayMsg(null)}
        />
      )}

      {xrayTraceData && (
        <TraceXRayDrawer
          data={xrayTraceData}
          onClose={() => setXrayTraceData(null)}
        />
      )}

      {merkleModalOpen && (
        <MerkleAuditModal
          onClose={() => setMerkleModalOpen(false)}
        />
      )}

      {mcpSandboxOpen && (
        <McpSandboxDrawer
          open={mcpSandboxOpen}
          onClose={() => setMcpSandboxOpen(false)}
          initialToolName={sandboxToolName}
        />
      )}

      {contextMemoryOpen && (
        <ContextMemoryDrawer
          open={contextMemoryOpen}
          onClose={() => setContextMemoryOpen(false)}
          tokenStats={contextTokenStats || undefined}
        />
      )}
    </div>
  );
}

function routeVerdictChip(v: RouteVerdict): string {
  const target = `目标 ${Math.round((1 - v.alpha) * 100)}%`;
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  if (v.status === "ood") return `路由：不像已知任何一类（p=${v.inScopeP.toFixed(2)}），走通用流程`;
  if (v.status === "confident") return `准确度：${v.top.label} ${pct(v.top.p)}（${target}）`;
  if (v.status === "ambiguous") return `有 ${v.set.length} 种可能：${v.set.map((c) => c.label).join(" / ")}`;
  return `接得准还不够（${v.set.length} 个候选），走通用流程`;
}

function clarifyMarkdown(v: RouteVerdict): string {
  const lines = v.set.map((c) => `- **${c.label}**（${Math.round(c.p * 100)}%）`);
  return [
    `这句话有 ${v.set.length} 种理解，先确认再做：`,
    "",
    ...lines,
    "",
    "点下面的选项即可，你的选择会用来让之后的判断更准。",
  ].join("\n");
}
