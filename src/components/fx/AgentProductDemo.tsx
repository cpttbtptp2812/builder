import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentLiveTrace } from "./AgentLiveTrace";
import { AgentMarkdown } from "./agent/AgentMarkdown";
import { AgentThink } from "./agent/AgentThink";
import { UserMessageBubble } from "./agent/UserMessageBubble";
import { formatMsgTime } from "../../lib/formatMsgTime";
import { AgentReasoningBlock } from "./agent/AgentReasoningBlock";
import { AgentToolChip } from "./agent/AgentToolChip";
import { AgentWelcome } from "./agent/AgentWelcome";
import { logChatSession, markQueryPublished } from "../../lib/analyticsLog";
import { formatThreadAsPlaza, matchPlaza, publishPlaza, type PlazaItem } from "../../lib/plazaFeed";
import { getSessionId } from "../../lib/sessionId";
import { HitlTicketCard } from "./agent/HitlTicketCard";
import { PolicyTrustCard } from "./agent/PolicyTrustCard";
import { InlineEvalCard, runInlineEvalAsync } from "./agent/InlineEvalCard";
import { ArtifactPanel } from "./agent/ArtifactPanel";
import { ResultLocator } from "./agent/ResultLocator";
import { TurnFlowPanel } from "./agent/TurnFlowPanel";
import { explainDiscovery } from "../../lib/agentSkills";
import { listFollowUpPrompts, listKnowledgePrompts, matchPresetQuery } from "../../lib/ownKnowledge";
import { AGENT_QUICK_PROMPTS } from "../../lib/agentRuntime";
import {
  loadOrchestrationMode,
  OwnSettingsSheet,
  type OrchestrationMode,
} from "./agent/OwnSettingsSheet";
import { loadEnabledMcpTools } from "./agent/AgentMcpRegistry";
import {
  runAgentTurn,
  type AgentChatMessage,
  type AgentStreamEvent,
  type AgentTurnTrace,
} from "../../lib/agentRuntime";
import { isAuthError, runGuestAgentTurn, toolPreviewFromResult } from "../../lib/guestAgentRuntime";
import { appendSessionTurn, clearSessionTurns } from "../../lib/agentMemory";
import { isLlmConfigured, loadLlmConfig, saveLlmConfig, type LlmConfig } from "../../lib/llmConfig";
import { downloadText } from "../../lib/importedSkills";
import { runMultiAgentAsync } from "../../lib/backendBridge";
import type { MultiAgentStep } from "../../lib/multiAgentRuntime";
import { getRuntimeConfig } from "../../lib/runtimeConfig";
import { buildWorkingSet, type WorkingSet } from "../../lib/workingSet";
import {
  activateFlowNode,
  addFlowChip,
  addFlowEvidence,
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
import { PlazaComposeRouter } from "./agent/PlazaComposeRouter";
import { PlazaRouteCard } from "./agent/PlazaRouteCard";
import { TurnReplayTheater } from "./agent/TurnReplayTheater";
import { MultiAgentTraceCard } from "./agent/MultiAgentTraceCard";
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
import { buildTurnArtifacts, synthesizeCompareTable, type ChatArtifact } from "../../lib/chatArtifacts";
import {
  emptySession,
  loadSessionStore,
  persistSessionStore,
  sessionToJson,
  sessionToMarkdown,
  upsertActive,
  type OwnChatMessage,
  type OwnSession,
  type PlazaSourceView,
} from "../../lib/ownagentSessions";
import { activePromptLabel, getActiveSystemAddon } from "../../lib/agentPromptRuntime";
import { evaluatePolicyGate } from "../../lib/policyGate";
import { parseSlash, slashSuggestions } from "../../lib/slashCommands";
import { OwnCommandPalette, type PaletteItem } from "../ownagent/OwnCommandPalette";
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
}: {
  autoStart?: boolean;
  hubMode?: boolean;
  onFlowActive?: (nodeId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendLockRef = useRef(false);
  const [footerHeight, setFooterHeight] = useState(120);
  const latestAnswerIdRef = useRef<string | null>(null);

  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => loadLlmConfig());
  const [enabledTools, setEnabledTools] = useState<string[]>(() => loadEnabledMcpTools());
  const [orchMode, setOrchMode] = useState<OrchestrationMode>(() => loadOrchestrationMode());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"knowledge" | "runtime">("runtime");
  const [kbRev, setKbRev] = useState(0);
  const boot = useRef(loadSessionStore());
  const [store, setStore] = useState(boot.current);
  const active = store.sessions.find((s) => s.id === store.activeId) ?? store.sessions[0]!;
  const [messages, setMessages] = useState<OwnChatMessage[]>(() => active.messages);
  const [history, setHistory] = useState<AgentChatMessage[]>(() => active.history);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [input, setInput] = useState("");
  const [composeFocused, setComposeFocused] = useState(false);
  const [running, setRunning] = useState(false);
  const [traces, setTraces] = useState<AgentTurnTrace[]>([]);
  const [iteration, setIteration] = useState(0);
  const [streamReasoning, setStreamReasoning] = useState("");
  const [streamText, setStreamText] = useState("");
  const [liveTools, setLiveTools] = useState<ToolChipState[]>([]);
  const [flowJournal, setFlowJournal] = useState<FlowJournalNode[]>([]);
  const [flowTurnStartedAt, setFlowTurnStartedAt] = useState<number | null>(null);
  const [turnRuntime, setTurnRuntime] = useState<"server" | "local" | undefined>();
  const [turnRagRuntime, setTurnRagRuntime] = useState<"server" | "local" | undefined>();
  const [highlightTerm, setHighlightTerm] = useState<string | null>(null);
  const [liveMulti, setLiveMulti] = useState<MultiAgentStep[]>([]);
  const [inspector, setInspector] = useState(false);
  const [flowOpen, setFlowOpen] = useState(() => !hubMode);
  const [traceElapsed, setTraceElapsed] = useState(0);
  const [rightTab, setRightTab] = useState<"graph" | "trace" | "insight">("graph");
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pinned, setPinned] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [resultFlash, setResultFlash] = useState(false);

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
      setOrchMode(loadOrchestrationMode());
    };
    window.addEventListener("ownagent:config-updated", syncConfig);
    return () => window.removeEventListener("ownagent:config-updated", syncConfig);
  }, []);
  const slashMenu = slashSuggestions(input);

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
    void getRuntimeConfig();
  }, []);

  useEffect(() => {
    if (!running || flowTurnStartedAt == null) {
      setTraceElapsed((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const tick = window.setInterval(() => setTraceElapsed(Date.now() - flowTurnStartedAt), 120);
    return () => clearInterval(tick);
  }, [running, flowTurnStartedAt]);

  const lastAsst = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );
  const lastAsstId = lastAsst?.id;

  const [replayMsg, setReplayMsg] = useState<OwnChatMessage | null>(null);

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

    if (emptyMessage) {
      for (const p of listKnowledgePrompts(6)) push(p.label, p.text, p.hint);
      for (const p of AGENT_QUICK_PROMPTS) push(p.label, p.text, "内置能力");
      return out.slice(0, 8);
    }

    const fromLast = normalizeFollowUps(lastAsst?.followUps);
    if (fromLast.length) {
      for (const p of fromLast.slice(0, 4)) push(p.text, p.text, p.hint);
      return out;
    }
    for (const t of listFollowUpPrompts(messages.map((m) => m.content), 5)) push(t, t);
    return out.slice(0, 5);
  }, [running, emptyMessage, lastAsst, messages, kbRev]);

  const threadSearchNorm = threadSearch.trim().toLowerCase();
  const threadMatchCount = useMemo(() => {
    if (!threadSearchNorm) return 0;
    return messages.filter((m) => m.content.toLowerCase().includes(threadSearchNorm)).length;
  }, [messages, threadSearchNorm]);

  useEffect(() => {
    setStore((prev) => {
      const cur = prev.sessions.find((s) => s.id === prev.activeId);
      if (cur && cur.messages === messages && cur.history === history) {
        return prev;
      }
      const next = upsertActive(prev, { messages, history });
      persistSessionStore(next);
      return next;
    });
  }, [messages, history]);

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
    if (ev.type === "text-delta") setStreamText((s) => s + ev.text);
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
  }, [onFlowActive]);

  const send = useCallback(
    async (text: string) => {
      const parsed = parseSlash(text);
      const q = parsed.query.trim();
      if (!q || running || sendLockRef.current) return;

      sendLockRef.current = true;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const inspectPreview = parseReleaseInspectRequest(q);
      const userMsg: OwnChatMessage = {
        id: uid(),
        role: "user",
        content: inspectPreview ? `巡检 ${inspectPreview.url}` : text.trim(),
        createdAt: Date.now(),
      };
      const assistantId = uid();
      const toolsAcc: ToolChipState[] = [];
      const t0 = performance.now();
      const journalRef = { current: createFlowJournal(q) };
      const syncJournal = () => setFlowJournal([...journalRef.current]);
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
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setRunning(true);
      if (!hubMode) {
        setFlowOpen(true);
        setRightTab("trace");
      }
      setTurnRuntime(undefined);
      setTurnRagRuntime(undefined);
      setResultFlash(false);
      setTraces([]);
      setIteration(0);
      setStreamReasoning("");
      setStreamText("");
      setLiveTools([]);
      window.setTimeout(() => onFlowActive?.("router"), 240);

      let fullReasoning = "";
      let fullText = "";
      let hitl: TicketDraft | undefined;
      let multiSteps: MultiAgentStep[] = [];
      let workingSet: WorkingSet | undefined;
      let policyTrust: PolicyTrustView | undefined;
      let route: RouteScoreView | undefined;
      let inlineEval: InlineEvalView | undefined;
      let artifacts: ChatArtifact[] = [];
      let mode: OwnChatMessage["mode"] = useLlm ? "llm" : "guest";
      let plazaHit = false;
      let plazaSourceLocal: PlazaSourceView | undefined;
      let turnRuntimeLocal: "server" | "local" | undefined;
      let turnRagRuntimeLocal: "server" | "local" | undefined;
      let releaseInspectReport: ReleaseInspectReport | undefined;
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
        syncJournal();
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
        const followUps = releaseInspectReport
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
          : buildAnswerInsight({
              flowJournal: journalRef.current,
              ms,
              mode,
              route,
              toolCount: toolsAcc.length,
              runtime: turnRuntimeLocal,
              ragRuntime: turnRagRuntimeLocal,
            });
        latestAnswerIdRef.current = assistantId;
        setMessages((prev) => {
          if (prev.some((m) => m.id === assistantId)) return prev;
          return [
            ...prev,
            {
              id: assistantId,
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
              inlineEval,
              followUps,
              answerInsight,
              artifacts: deduped.length ? deduped : undefined,
              plazaSource: plazaSourceLocal,
              releaseInspect: releaseInspectReport,
            },
          ];
        });
        appendSessionTurn("user", q || text.trim());
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
        const cfg = await getRuntimeConfig();
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

        if (!parsed.force && !parsed.evalKind) {
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
        if (sheet && !parsed.force && !parsed.evalKind) {
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

        if (parsed.evalKind) {
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

        if (orchMode === "multi" && !parsed.force) {
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

        if (useLlm) {
          try {
            mode = "llm";
            route = { skillId: "llm-loop", skillName: llmConfig.model, score: 4, hits: ["tool-call"], path: "llm" };
            jChip("route", `大模型：${llmConfig.model}`);
            jActivate("fetch");
            const result = await runAgentTurn(
              q,
              historyRef.current,
              llmConfig,
              {
                snapshotRoot: rootRef.current,
                signal: ac.signal,
                enabledTools,
                memoryBlock: ws.memoryBlock,
                promptAddon,
              },
              onEv,
            );
            setTraces(result.traces);
            historyRef.current = result.messages;
            setHistory(result.messages);
            finish(result.assistantText || fullText, fullReasoning || undefined);
            return;
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            if (isAuthError(err)) {
              finish("LLM Key 无效。请在「接入配置」检查 API Key，或关闭 LLM 继续使用内置 Agent。");
              return;
            }
            throw err;
          }
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
            promptAddon,
          },
          onEv,
        );
        turnRuntimeLocal = guest.runtime;
        setTurnRuntime(guest.runtime);
        if (guest.runtime) jChip("route", `自研 Agent · ${guest.runtime === "server" ? "SQLite API" : "浏览器 Loop"}`);
        setTraces(guest.traces);
        hitl = guest.hitl;
        policyTrust = guest.policyTrust;
        route = guest.route;
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

  const pendingAskRef = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (pendingAskRef.current) return;
    const pending = sessionStorage.getItem("oa-pending-ask");
    if (!pending) return;
    pendingAskRef.current = true;
    sessionStorage.removeItem("oa-pending-ask");
    void sendRef.current(pending);
  }, []);

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  function updateHitl(msgId: string, ticket: TicketDraft, note: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, hitl: ticket, content: `${m.content}\n\n---\n${note}` }
          : m,
      ),
    );
  }

  function applySession(next: OwnSession, all: OwnSession[]) {
    abortRef.current?.abort();
    setRunning(false);
    setMessages(next.messages);
    setHistory(next.history);
    historyRef.current = next.history;
    setTraces([]);
    setStore({ activeId: next.id, sessions: all });
    persistSessionStore({ activeId: next.id, sessions: all });
    setSessionsOpen(false);
  }

  function newChat() {
    const created = emptySession();
    const sessions = [created, ...store.sessions].slice(0, 24);
    applySession(created, sessions);
    clearSessionTurns();
    setPinned("");
  }

  function switchSession(id: string) {
    const next = store.sessions.find((s) => s.id === id);
    if (!next || next.id === store.activeId) return;
    const flushed = upsertActive(store, { messages, history });
    applySession(next, flushed.sessions);
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
      if (e.key === "Escape" && running) stop();
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
  }, [running, store, messages, history]);

  const paletteItems: PaletteItem[] = useMemo(() => {
    return [
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
      { id: "connect-panel", group: "视图", label: "接入配置", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "connect" } })) },
      { id: "theory", group: "视图", label: "理论 / Flow 编排", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { tab: "theory" } })) },
      { id: "skills", group: "开发者", label: "技能扩展", run: () => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "skills" } })) },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspector, store.sessions, messages, history, orchMode]);

  const toolCount = traces.reduce((n, t) => n + t.tools.length, 0);
  const modeHint = useLlm ? llmConfig.model : "本地运行";

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
    <div className={`ua-shell ua-shell-flow${hubMode ? " hub" : ""}${inspector ? " with-side" : ""}${!flowOpen ? " flow-collapsed" : ""}${running ? " running-pulse" : ""}`} ref={rootRef}>
      <header className="ua-topbar-pro">
        {/* 左：菜单 + 品牌 */}
        <button type="button" className="ua-icon-btn-pro" onClick={() => setSessionsOpen(true)} title="历史会话" aria-label="历史会话">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect y="2" width="16" height="1.6" rx="0.8" fill="currentColor"/><rect y="7.2" width="12" height="1.6" rx="0.8" fill="currentColor"/><rect y="12.4" width="9" height="1.6" rx="0.8" fill="currentColor"/></svg>
        </button>
        <div className="ua-brand-pro">
          <div className="ua-brand-icon-pro" aria-hidden>OA</div>
          <div className="ua-brand-text">
            <strong>OwnAgent</strong>
            <span className="ua-brand-sub">{active.title || "新对话"}</span>
          </div>
        </div>

        {!hubMode && (
          <div className={`ua-status-pill-pro${running ? " running" : ""}`}>
            <span className="ua-status-dot-pro" aria-hidden />
            <span>{running ? "AI 处理中" : "就绪"}</span>
          </div>
        )}

        {!hubMode && <SessionStats messages={messages} />}

        {/* 实时检索脉冲 — 客户模式隐藏 */}
        {!hubMode && running && (() => {
          const liveHits = displayJournal
            .flatMap((n) => n.evidence ?? [])
            .filter((e) => e.kind === "hit").length;
          return liveHits > 0 ? (
            <div className="ua-live-pulse">
              <span className="ua-live-pulse-dot" />
              <span>已检索 {liveHits} 个知识片段</span>
            </div>
          ) : null;
        })()}

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
            <span>{hubMode ? "来源" : "轨迹"}</span>
          </button>
          {!hubMode && (
            <button
              type="button"
              className={`ua-topbar-btn-pro${inspector ? " active" : ""}`}
              onClick={() => setInspector((o) => !o)}
              title="运行记录"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="4" width="12" height="1.4" rx="0.7" fill="currentColor"/><rect x="1" y="7" width="8" height="1.4" rx="0.7" fill="currentColor"/><rect x="1" y="10" width="10" height="1.4" rx="0.7" fill="currentColor"/></svg>
              <span>记录</span>
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
          {!hubMode && (
            <button
              type="button"
              className="ua-topbar-btn-pro"
              onClick={() => { setSettingsTab("knowledge"); setSettingsOpen(true); }}
              title="知识库"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2h4v10H2zM8 2h4v10H8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              <span>知识库</span>
            </button>
          )}
          {hubMode && (
            <button
              type="button"
              className={`ua-topbar-btn-pro${threadSearchOpen ? " active" : ""}`}
              onClick={() => setThreadSearchOpen((o) => !o)}
              title="搜索对话"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6.2" cy="6.2" r="4.2" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              <span>搜索</span>
            </button>
          )}
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
        <div className={`ua-chat${emptyMessage ? " empty" : ""}`}>
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
                .map((m, idx) => (
                <div
                  key={m.id}
                  data-msg-id={m.id}
                  className={`ua-row group/message ${m.role}${focusId === m.id ? " focus-result" : ""}${
                    m.id === latestAnswerIdRef.current && resultFlash ? " result-flash" : ""
                  }${highlightTerm && m.id === latestAnswerIdRef.current ? " citation-pulse" : ""}${
                    threadSearchNorm && m.content.toLowerCase().includes(threadSearchNorm) ? " search-hit" : ""
                  }${threadSearchNorm && !m.content.toLowerCase().includes(threadSearchNorm) ? " search-dim" : ""}`}
                >
                  {m.role === "assistant" ? (
                    <div className="ua-avatar ua-avatar-agent" aria-hidden>
                      OA
                    </div>
                  ) : null}
                  <div className="ua-bubble-wrap">
                    {formatMsgTime(m.createdAt) && (
                      <div className={`ua-msg-time ${m.role}`}>{formatMsgTime(m.createdAt)}</div>
                    )}
                    {m.role === "user" ? (
                      <UserMessageBubble text={m.content} />
                    ) : (
                      <>
                        {m.plazaSource && (
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
                        {m.releaseInspect ? (
                          <details className="release-inspect-md-extra">
                            <summary>Markdown 详情</summary>
                            <div className="ua-bubble assistant ua-prose">
                              <AgentMarkdown text={m.content} promoteTables={!m.artifacts?.length} />
                            </div>
                          </details>
                        ) : (
                          <div className="ua-bubble assistant ua-prose">
                            <AgentMarkdown text={m.content} promoteTables={!m.artifacts?.length} />
                          </div>
                        )}
                      </>
                    )}
                    {(!hubMode || inspector) && m.role === "assistant" && m.flowJournal && m.flowJournal.length > 0 && (
                      <AnswerDNA flowJournal={m.flowJournal} />
                    )}
                    {hubMode && m.role === "assistant" ? (
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
                      />
                    ) : m.role === "assistant" && m.answerInsight ? (
                      <AnswerInsightBar insight={m.answerInsight} compact={false} />
                    ) : null}
                    {m.role === "assistant" &&
                      m.answerInsight &&
                      !m.releaseInspect &&
                      m.route?.skillId !== "release-inspector" &&
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
                    {!hubMode && m.role === "assistant" && !running && idx === messages.length - 1 && (() => {
                      const userMsg = messages.slice(0, idx).reverse().find(x => x.role === "user");
                      if (!userMsg) return null;
                      return (
                        <PublishToFeedButton
                          question={userMsg.content}
                          answer={m.content}
                          thread={messages.slice(0, idx + 1).map(x => ({ role: x.role, content: x.content }))}
                        />
                      );
                    })()}
                    {(!hubMode || inspector) && m.role === "assistant" && m.artifacts && m.artifacts.length > 0 && (
                      <ArtifactPanel artifacts={m.artifacts} />
                    )}
                    {m.role === "assistant" && m.policyTrust && (
                      <PolicyTrustCard trust={m.policyTrust} />
                    )}
                    {m.role === "assistant" && m.hitl && (
                      <HitlTicketCard
                        ticket={m.hitl}
                        onUpdate={(ticket, note) => updateHitl(m.id, ticket, note)}
                      />
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
                    {inspector && m.role === "assistant" && m.reasoning && (
                      <AgentReasoningBlock text={m.reasoning} thinking={false} defaultOpen={false} />
                    )}
                    {!hubMode && m.role === "assistant" && idx === messages.length - 1 && (() => {
                      const prompts = normalizeFollowUps(m.followUps);
                      if (!prompts.length && m.content) {
                        const priorUser = messages.slice(0, idx).filter((x) => x.role === "user").map((x) => x.content);
                        const uq = messages[idx - 1]?.role === "user" ? messages[idx - 1]!.content : "";
                        return (
                          <FollowUpRail
                            prompts={followUpsFor({
                              exclude: priorUser,
                              query: uq,
                              flowJournal: m.flowJournal,
                              limit: 3,
                            })}
                            disabled={running}
                            onPick={(t) => void send(t)}
                          />
                        );
                      }
                      return (
                        <FollowUpRail
                          prompts={prompts}
                          disabled={running}
                          onPick={(t) => void send(t)}
                        />
                      );
                    })()}
                    <div className="ua-msg-actions">
                      <button type="button" className="ua-msg-act" title="复制" onClick={() => void copyMsg(m)}>
                        {copiedId === m.id ? "✓" : "⎘"}
                      </button>
                      {m.role === "assistant" && idx === messages.length - 1 && (
                        <button type="button" className="ua-msg-act" title="重试" disabled={running} onClick={retryLast}>
                          ↻
                        </button>
                      )}
                    </div>
                  </div>
                  {m.role === "user" ? (
                    <div className="ua-avatar ua-avatar-user" aria-hidden>
                      我
                    </div>
                  ) : null}
                </div>
              ))}

              {running && (
                <div className="ua-row assistant live-turn group/message" data-msg-id="__live__">
                  <div className="ua-avatar ua-avatar-agent live" aria-hidden>
                    OA
                  </div>
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
                    {streamText ? (
                      <div className="ua-bubble assistant streaming ink">
                        <AgentMarkdown text={streamText} />
                        <span className="ua-caret" />
                      </div>
                    ) : (
                      <AgentThink />
                    )}
                  </div>
                </div>
              )}
              <div ref={sentinelRef} className="ua-thread-sentinel" aria-hidden />
              </div>
            </div>
          )}

          {emptyMessage && (
            <div className="ua-empty" style={{ paddingBottom: Math.max(footerHeight + 16, 120) }}>
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
            </div>
          )}

          <div ref={footerRef} className="ua-footer">
            <ResultLocator
              visible={away && !running && !emptyMessage}
              label="最新一条"
              onLocate={() => {
                const id = latestAnswerIdRef.current;
                if (id) scrollToMessage(id, true);
                else scrollToBottom(true);
              }}
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
            {hubMode && running && displayJournal.length > 0 && (
              <NeuralTraceStrip journal={displayJournal} running elapsedMs={traceElapsed} />
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
            <div className={`ua-compose-dock${hubMode ? " hub" : ""}`}>
              {!running && (
                <ReleaseInspectEntry
                  compact={hubMode}
                  disabled={running}
                  onInspect={(url) => {
                    const clean = url.replace(/^\/inspect\s+/gi, "").trim();
                    if (clean) void send(`/inspect ${clean}`);
                  }}
                />
              )}
              {hubMode && !running && quickPromptItems.length > 0 && (
                <ChatQuickPrompts
                  label={emptyMessage ? "试试这样问" : "继续问"}
                  items={quickPromptItems}
                  disabled={running}
                  onPick={(t) => void send(t)}
                />
              )}
              {hubMode && input.trim().length >= 2 && (
                <PlazaComposeRouter
                  input={input}
                  running={running}
                  onUsePlaza={(item) => void deliverPlazaAnswer(input, item)}
                />
              )}

            <div className="ua-compose-wrap">
              <InputSuggestPopup
                input={input}
                running={running}
                focused={composeFocused}
                exclude={messages.map((m) => m.content)}
                onPick={(t) => setInput(t)}
              />

              <form
                className={`ua-compose-pro${voiceListening ? " voice-active" : ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                {hubMode && (
                  <ComposeModelBar
                    config={llmConfig}
                    onChange={handleLlmChange}
                    orchMode={orchMode}
                    onOrchChange={setOrchMode}
                  />
                )}
                {!hubMode && (
                  <div className="ua-compose-caps">
                    <button
                      type="button"
                      className="ua-compose-cap ua-compose-cap--plaza"
                      onClick={() => window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "feed" } }))}
                    >
                      知识广场
                    </button>
                    <span className="ua-compose-cap">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/><path d="M3 5l1.5 1.5L7 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      Hybrid RAG
                    </span>
                    <span className="ua-compose-cap">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 9L5 1l4 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 6.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      Neural Trace
                    </span>
                    <span className="ua-compose-cap">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1" y="3" width="3.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="5.5" y="3" width="3.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 5h1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      多智能体
                    </span>
                    <span className="ua-compose-cap-dot" aria-hidden />
                    <span className="ua-compose-mode-hint">{modeHint}</span>
                  </div>
                )}

                {/* 文本区 */}
                <textarea
                  value={input}
                  rows={1}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  onFocus={() => setComposeFocused(true)}
                  onBlur={() => window.setTimeout(() => setComposeFocused(false), 180)}
                  placeholder={voiceListening ? "🎤 正在聆听…" : "输入问题，Enter 发送"}
                  disabled={running}
                />

                <div className="ua-compose-bar-pro">
                  {!hubMode && (
                    <span className="ua-compose-hint-pro">
                      ⏎ Enter 发送 &nbsp;·&nbsp; Shift+Enter 换行
                    </span>
                  )}
                  {hubMode && <span className="ua-compose-hint-pro" />}
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
          <div className="ua-right-panel">
            {/* Tab 切换 */}
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
              <button type="button" className="ua-right-close" onClick={() => setFlowOpen(false)} aria-label="关闭">×</button>
            </div>

            {rightTab === "graph" ? (
              <KnowledgeSources
                messages={messages}
                running={running}
                onClose={() => setFlowOpen(false)}
              />
            ) : rightTab === "insight" ? (
              <SessionInsight messages={messages} />
            ) : (
              <TurnFlowPanel
                journal={displayJournal}
                running={running}
                turnStartedAt={flowTurnStartedAt}
                runtime={turnRuntime ?? messages.filter((m) => m.role === "assistant").at(-1)?.runtime}
                ragRuntime={turnRagRuntime ?? messages.filter((m) => m.role === "assistant").at(-1)?.ragRuntime}
                onEvidenceClick={handleEvidenceClick}
              />
            )}
          </div>
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
              {store.sessions.map((s) => (
                <li key={s.id}>
                  <button type="button" className={s.id === store.activeId ? "on" : ""} onClick={() => switchSession(s.id)}>
                    <strong>{s.title}</strong>
                    <em>{s.updatedAt.slice(0, 16).replace("T", " ")}</em>
                  </button>
                </li>
              ))}
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
    </div>
  );
}
