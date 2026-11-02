import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react";
import { AgentStep } from "@/lib/agentTimeline";
import { Markdown } from "@/components/prompt-kit/markdown";

interface ThinkingStreamProps {
  timeline?: AgentStep[];
  isThinking?: boolean;
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  reasoning?: string | null;
  userPrompt?: string;
  duration?: string;
}

const FOUR_STAGES = [
  { id: "intent", num: "1", name: "听懂需求", fullName: "01. 听懂需求" },
  { id: "context", num: "2", name: "拿上规矩", fullName: "02. 拿上规矩" },
  { id: "action", num: "3", name: "动手排查", fullName: "03. 动手排查" },
  { id: "delivery", num: "4", name: "把关交活", fullName: "04. 把关交活" },
] as const;

export const ThinkingStream: React.FC<ThinkingStreamProps> = ({
  timeline,
  isThinking = false,
  reasoning,
  duration,
}) => {
  // ── 主流 AI 展开/收拢逻辑 ──
  // 1. 思考中 (isThinking === true)：默认自动展开！让用户直接看到大白话思维在逐字流淌
  // 2. 思考结束 (isThinking === false)：若用户未手动干预，自动优雅收拢
  // 3. 用户随时可点击展开/收起
  const userToggledRef = useRef<boolean>(false);
  const prevThinkingRef = useRef<boolean>(isThinking);
  const [isOpen, setIsOpen] = useState<boolean>(Boolean(isThinking));

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 状态联动：思考中自动展开，思考结束自动收起
  useEffect(() => {
    if (prevThinkingRef.current && !isThinking) {
      if (!userToggledRef.current) {
        setIsOpen(false);
      }
    }
    if (!prevThinkingRef.current && isThinking) {
      userToggledRef.current = false;
      setIsOpen(true);
    }
    prevThinkingRef.current = isThinking;
  }, [isThinking]);

  // 思考中秒数计时器
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isThinking) {
      setElapsedSeconds(1);
      const startTime = Date.now();
      timer = setInterval(() => {
        const sec = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        setElapsedSeconds(sec);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isThinking]);

  // 流式思维文本更新时自动向下平滑滚动，保持最新打字可见
  useEffect(() => {
    if (isThinking && isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [reasoning, isThinking, isOpen]);

  const handleToggle = () => {
    userToggledRef.current = true;
    setIsOpen((prev) => !prev);
  };

  // 格式化用时：对标主流 AI "已深度思考 (用时 2.4 秒)"
  const formattedDuration = (() => {
    if (duration && duration !== "处理中..." && duration !== "0s") {
      if (duration.endsWith("s")) {
        const val = parseFloat(duration);
        if (!isNaN(val)) return `${val} 秒`;
      }
      return duration;
    }
    if (elapsedSeconds > 0) {
      return `${elapsedSeconds} 秒`;
    }
    return "";
  })();

  // ── 折叠条上的 4 个阶段进度条状态判定 ──
  const intentSteps = timeline ? timeline.filter((s) => s.phase === "intent" || s.phase === "workflow") : [];
  const contextSteps = timeline ? timeline.filter((s) => s.phase === "context") : [];
  const actionSteps = timeline
    ? timeline.filter((s) => s.phase === "skill" || s.phase === "llm" || s.stepId.startsWith("tool-"))
    : [];
  const deliverySteps = timeline ? timeline.filter((s) => s.phase === "delivery" || s.phase === "closure") : [];

  const getStageStatus = (steps: AgentStep[]) => {
    if (!isThinking) return "done" as const;
    if (steps.length === 0) return "pending" as const;
    if (steps.some((s) => s.status === "running")) return "running" as const;
    if (steps.some((s) => s.status === "done" || s.status === "passed")) return "done" as const;
    return "pending" as const;
  };

  const stageStatuses = {
    intent: getStageStatus(intentSteps),
    context: getStageStatus(contextSteps),
    action: getStageStatus(actionSteps),
    delivery: getStageStatus(deliverySteps),
  };

  const currentRunningStage = FOUR_STAGES.find((st) => stageStatuses[st.id] === "running")?.fullName;

  // 如果没有思考内容且未在思考，不渲染
  if (!isThinking && (!reasoning || !reasoning.trim())) {
    return null;
  }

  return (
    <div className="my-2.5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all duration-200 overflow-hidden font-sans">
      {/* ── 顶部胶囊条：浅色高质感风格 + 保留 4 个阶段进度条 ── */}
      <div
        onClick={handleToggle}
        className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer select-none group bg-slate-50/80 hover:bg-slate-100/70 transition"
      >
        {/* 左侧：思考状态指示 + 4 个阶段进度条 */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* 呼吸灯 / 图标 */}
          <div className="relative flex items-center justify-center shrink-0">
            {isThinking ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            )}
          </div>

          {/* 状态主文案：思考中 / 已深度思考 */}
          <div className="flex items-center gap-1.5 min-w-0">
            {isThinking ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-900">
                <Brain className="w-4 h-4 text-cyan-600 animate-pulse shrink-0" />
                <span>思考中{elapsedSeconds > 0 ? ` (${elapsedSeconds} 秒)` : "..."}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <Brain className="w-4 h-4 text-slate-400 shrink-0" />
                <span>已深度思考{formattedDuration ? ` (用时 ${formattedDuration})` : ""}</span>
              </div>
            )}
          </div>

          {/* 折叠条上的 4 个阶段进度条 (用户明确要求保留) */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-slate-400 ml-2">
            {FOUR_STAGES.map((st, idx) => {
              const status = stageStatuses[st.id];
              const isCurrent = status === "running";
              const isPast = status === "done";

              return (
                <React.Fragment key={st.id}>
                  <span
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition ${
                      isCurrent
                        ? "bg-cyan-100 text-cyan-900 font-bold animate-pulse shadow-2xs"
                        : isPast
                        ? "text-emerald-700 font-semibold"
                        : "text-slate-400"
                    }`}
                  >
                    {isPast && <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />}
                    {st.name}
                  </span>
                  {idx < FOUR_STAGES.length - 1 && (
                    <span className="text-slate-300 text-[9px]">➔</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* 当前动作微型提示 */}
          {currentRunningStage && (
            <span className="text-[11px] font-mono text-cyan-700 font-semibold truncate hidden md:inline ml-1">
              · 正在{currentRunningStage}...
            </span>
          )}
        </div>

        {/* 右侧：展开 / 收起 */}
        <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-600 transition shrink-0 text-xs font-medium">
          <span className="text-[11px]">
            {isOpen ? "收起" : "展开"}
          </span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* ── 展开内容：纯白底/浅灰底、字体密集且稍大、纯粹大白话思维流 ── */}
      {isOpen && (
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 animate-in fade-in duration-150">
          <div
            ref={scrollContainerRef}
            className="max-h-80 overflow-y-auto pr-1.5 scroll-smooth"
          >
            {reasoning && reasoning.trim() ? (
              <div className="space-y-0.5 text-[13.5px] leading-snug text-slate-700 font-sans">
                <Markdown
                  components={{
                    p: ({ children }) => (
                      <p className="text-[13.5px] leading-snug text-slate-700 my-1">
                        {children}
                      </p>
                    ),
                    code: ({ children }) => (
                      <code className="bg-slate-200/70 text-cyan-900 rounded px-1.5 py-0.2 font-mono text-[12.5px] border border-slate-300/60">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {reasoning}
                </Markdown>
                {/* 思考中打字跳动光标 */}
                {isThinking && (
                  <span className="inline-block w-1.5 h-4 bg-cyan-600 ml-1 translate-y-0.5 animate-pulse rounded-xs" />
                )}
              </div>
            ) : isThinking ? (
              <div className="py-2.5 flex items-center gap-2 text-slate-500 text-[13px] italic">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-600 shrink-0" />
                <span>正在理清思路并调取现场情况...</span>
                <span className="inline-block w-1.5 h-4 bg-cyan-600 ml-1 animate-pulse rounded-xs" />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
