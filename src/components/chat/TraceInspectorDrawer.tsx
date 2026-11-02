import React, { useState, useEffect, useRef } from "react";
import { AgentStep, rebuildTimelineFromMessage } from "@/lib/agentTimeline";
import { InspectorStepCards } from "./InspectorStepCards";
import {
  X,
  Compass,
  Coins,
  Trash2,
  RefreshCw,
  Layers,
  GripVertical,
  Download,
} from "lucide-react";
import { downloadSummaryReport } from "@/lib/reportExport";
import {
  fetchFinOpsCacheMetricsApi,
  clearFinOpsCacheApi,
  FinOpsCacheMetrics,
} from "@/services/api";

export interface TraceDrawerMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  userPrompt?: string;
  modelName?: string;
  sessionId?: string;
  enableRAG?: boolean;
  enableThinking?: boolean;
  enableWebSearch?: boolean;
  toolCalls?: any[];
  approvalTicket?: any;
  reasoning?: string;
  citations?: any[];
  traceSteps?: Record<number, any>;
  tokens?: number;
  duration?: string;
  isThinking?: boolean;
  isCached?: boolean;
  trace?: {
    totalMs?: number;
    ragMs?: number;
    ttftMs?: number;
    cached?: boolean;
    savedTokens?: number;
    savedMs?: number;
    hashKey?: string;
  };
  agentTimeline?: AgentStep[];
}

interface TraceInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  message: TraceDrawerMessage | null;
  defaultTab?: "flow" | "finops" | any;
  layoutMode?: "split" | "drawer";
  onToggleLayout?: () => void;
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
}

const STORAGE_WIDTH_KEY = "ownagent_drawer_width";
const DEFAULT_DRAWER_WIDTH = 520;

export const TraceInspectorDrawer: React.FC<TraceInspectorDrawerProps> = ({
  isOpen,
  onClose,
  message,
  defaultTab = "flow",
  layoutMode = "drawer",
  onToggleLayout,
  activeStepId,
  onSelectStep,
}) => {
  // 严格只保留 2 个 Tab：流程图 与 成本效能
  const [activeTab, setActiveTab] = useState<"flow" | "finops">(
    defaultTab === "finops" ? "finops" : "flow"
  );

  // 抽屉宽度状态（支持拖拽调整并持久化到本地与数据库）
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_WIDTH_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 400 && parsed <= 1200) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_DRAWER_WIDTH;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = useRef<{ startX: number; startWidth: number }>({
    startX: 0,
    startWidth: DEFAULT_DRAWER_WIDTH,
  });

  // 初始化从后端数据库拉取用户已保存的抽屉宽度
  useEffect(() => {
    fetch("/api/settings/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (cfg && cfg.DRAWER_WIDTH) {
          const w = parseInt(cfg.DRAWER_WIDTH, 10);
          if (!isNaN(w) && w >= 400 && w <= 1200) {
            setDrawerWidth(w);
            try {
              localStorage.setItem(STORAGE_WIDTH_KEY, w.toString());
            } catch {}
          }
        }
      })
      .catch((err) => console.warn("Fetch drawer width from DB failed", err));
  }, []);

  // 左右拖拽处理器
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startWidth: drawerWidth,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // 抽屉固定在屏幕右侧，鼠标向左拖动为增加宽度，向右为减小宽度
      const delta = dragRef.current.startX - moveEvent.clientX;
      const minW = 400;
      const maxW = Math.min(1000, window.innerWidth - 300);
      const newWidth = Math.max(minW, Math.min(dragRef.current.startWidth + delta, maxW));
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setIsDragging(false);

      const delta = dragRef.current.startX - upEvent.clientX;
      const minW = 400;
      const maxW = Math.min(1000, window.innerWidth - 300);
      const finalWidth = Math.max(minW, Math.min(dragRef.current.startWidth + delta, maxW));
      setDrawerWidth(finalWidth);

      // 1. 即时本地持久化 (0延迟还原)
      try {
        localStorage.setItem(STORAGE_WIDTH_KEY, finalWidth.toString());
      } catch {}

      // 2. 持久化存储到后端数据库 system_config 表中
      fetch("/api/settings/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ DRAWER_WIDTH: finalWidth.toString() }),
      }).catch((err) => console.warn("Persist drawer width to DB failed", err));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // FinOps 统计状态
  const [finOpsStats, setFinOpsStats] = useState<FinOpsCacheMetrics | null>(null);
  const [isLoadingFinOps, setIsLoadingFinOps] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab === "finops" ? "finops" : "flow");
    }
  }, [defaultTab, isOpen]);

  const loadFinOpsStats = async () => {
    setIsLoadingFinOps(true);
    try {
      const data = await fetchFinOpsCacheMetricsApi();
      if (data) setFinOpsStats(data);
    } finally {
      setIsLoadingFinOps(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "finops") {
      loadFinOpsStats();
    }
  }, [isOpen, activeTab]);

  const handleClearCache = async () => {
    if (!window.confirm("确定要清空历史问答缓存吗？")) return;
    setIsClearing(true);
    try {
      const ok = await clearFinOpsCacheApi();
      if (ok) await loadFinOpsStats();
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen || !message) return null;

  const isCacheHit = !!(
    message.isCached ||
    message.trace?.cached ||
    message.traceSteps?.[2]?.cacheHit ||
    message.traceSteps?.[2]?.cached
  );

  const parseTotalMs = (durationStr?: string): number => {
    if (!durationStr) return 0;
    const match = durationStr.match(/([\d.]+)s/);
    if (match) return Math.round(parseFloat(match[1]) * 1000);
    return 0;
  };

  const totalMs = message.trace?.totalMs ?? parseTotalMs(message.duration) ?? 0;
  const isSplit = layoutMode === "split";

  const timeline: AgentStep[] =
    message.agentTimeline && message.agentTimeline.length > 0
      ? message.agentTimeline
      : rebuildTimelineFromMessage(message);

  return (
    <div
      style={{
        width: `${drawerWidth}px`,
        transition: isDragging ? "none" : "width 0.15s ease-out",
      }}
      className={
        isSplit
          ? "relative h-full bg-white border-l border-slate-200 shadow-xs flex flex-col shrink-0 z-10 select-auto"
          : "fixed inset-y-0 right-0 z-50 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 ease-out select-auto"
      }
    >
      {/* ── 左侧边缘可拖拽把手 (鼠标按住左右拖拽即可缩放抽屉大小) ── */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute -left-2 top-0 bottom-0 w-4 cursor-col-resize group flex items-center justify-center z-50 select-none ${
          isDragging ? "bg-blue-500/15" : "hover:bg-blue-400/10"
        }`}
        title="按住左右拖拽调整面板宽度 (自动保存至数据库)"
      >
        <div
          className={`w-1 h-8 rounded-full transition-all duration-150 ${
            isDragging
              ? "bg-blue-600 scale-y-150 w-1.5 shadow-sm"
              : "bg-slate-300 group-hover:bg-blue-500 group-hover:scale-y-125"
          }`}
        />
      </div>

      {/* ── 顶栏：极简 48px，仅保留 [流程图] 与 [成本效能] 两个 Tab ── */}
      <div className="h-12 px-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 gap-3">
        {/* 左侧：标题与状态 */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-xs font-black text-slate-800 tracking-tight shrink-0">
            执行全景
          </span>
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
              isCacheHit
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : message.isThinking
                ? "bg-cyan-50 border-cyan-200 text-cyan-700 animate-pulse"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            {isCacheHit
              ? "⚡ 缓存秒回"
              : message.isThinking
              ? "处理中..."
              : `✓ ${(totalMs / 1000).toFixed(1)}s`}
          </span>
        </div>

        {/* 中间/右侧：两个明确 Tab (流程图 + 成本效能) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab("flow")}
              className={`flex items-center gap-1 px-3 py-1 rounded-md transition cursor-pointer ${
                activeTab === "flow"
                  ? "bg-white text-blue-700 font-bold shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>流程图</span>
            </button>
            <button
              onClick={() => setActiveTab("finops")}
              className={`flex items-center gap-1 px-3 py-1 rounded-md transition cursor-pointer ${
                activeTab === "finops"
                  ? "bg-white text-emerald-700 font-bold shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>成本效能</span>
            </button>
          </div>

          {/* 下载完整交付总结报告 */}
          {message?.content && (
            <button
              onClick={() => downloadSummaryReport(message)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold transition cursor-pointer border border-transparent hover:border-blue-200"
              title="下载完整巡检交付总结 (Markdown 报告)"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">下载总结</span>
            </button>
          )}

          {onToggleLayout && (
            <button
              onClick={onToggleLayout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title={isSplit ? "切换为浮层抽屉" : "固定分栏"}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="关闭 (ESC)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 核心内容区：无任何多余中间垫层，五大类卡片自适应容器宽度 ── */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-hide">
        {/* TAB 1: 流程图 (五大标准执行阶段) */}
        {activeTab === "flow" && (
          <InspectorStepCards
            timeline={timeline}
            message={message}
            activeStepId={activeStepId}
            onSelectStep={onSelectStep}
            isThinking={message.isThinking}
          />
        )}

        {/* TAB 2: 成本效能 (Tokens 与缓存指标) */}
        {activeTab === "finops" && (
          <div className="space-y-3 p-1">
            <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-900 p-3 rounded-xl border border-emerald-200">
              <span className="font-bold flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                算力开销与降本指标
              </span>
              <button
                onClick={loadFinOpsStats}
                disabled={isLoadingFinOps}
                className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition cursor-pointer"
                title="刷新数据"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingFinOps ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {finOpsStats ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-[11px] text-slate-400">累计节约 Tokens</span>
                  <div className="text-base font-black font-mono text-emerald-700">
                    {finOpsStats.totalSavedTokens?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-[11px] text-slate-400">历史问答秒回次数</span>
                  <div className="text-base font-black font-mono text-blue-700">
                    {finOpsStats.hitCount?.toLocaleString() || 0} 次
                  </div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-[11px] text-slate-400">累计节约等待耗时</span>
                  <div className="text-base font-black font-mono text-purple-700">
                    {(finOpsStats.totalSavedDurationMs / 1000).toFixed(1)}s
                  </div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                  <span className="text-[11px] text-slate-400">本地缓存问答总条目</span>
                  <div className="text-base font-black font-mono text-slate-800">
                    {finOpsStats.cachedEntriesCount || 0} 条
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-2">
              <button
                onClick={handleClearCache}
                disabled={isClearing}
                className="w-full py-2 px-3 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearing ? "正在清理中..." : "清空历史问答缓存"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
