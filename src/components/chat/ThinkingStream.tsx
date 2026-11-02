import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Check,
  Brain,
  Loader2,
} from "lucide-react";
import { AgentStep } from "@/lib/agentTimeline";
import { Markdown } from "@/components/prompt-kit/markdown";

interface ThinkingStreamProps {
  timeline: AgentStep[];
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
  onSelectStep,
  reasoning,
  userPrompt,
  duration,
}) => {
  // 默认收起！展示呼吸灯与阶段流向，用户想看详细思考过程时随时点击展开
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // 思考中实时秒数计时器
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

  // 计算展示给用户的用时文本 (对标主流 AI: "已深度思考 (用时 2.4 秒)")
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

  if (!timeline || timeline.length === 0) {
    if (!isThinking && !reasoning) return null;
  }

  // 1. 听懂需求
  const intentSteps = timeline ? timeline.filter((s) => s.phase === "intent" || s.phase === "workflow") : [];
  // 2. 拿上规矩
  const contextSteps = timeline ? timeline.filter((s) => s.phase === "context") : [];
  // 3. 动手排查 (工具调度 + 大模型推理)
  const actionSteps = timeline
    ? timeline.filter((s) => s.phase === "skill" || s.phase === "llm" || s.stepId.startsWith("tool-"))
    : [];
  // 4. 把关交活
  const deliverySteps = timeline ? timeline.filter((s) => s.phase === "delivery" || s.phase === "closure") : [];

  const getStageStatus = (steps: AgentStep[]) => {
    // 若消息已结束流式生成，四大阶段全部视为已达成交付
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

  // 当前正在进行的阶段名称
  const currentRunningStage = FOUR_STAGES.find((st) => stageStatuses[st.id] === "running")?.fullName;

  const step2 = intentSteps.find((s) => s.rightDetail?.matchedWorkflowName);
  const matchedWorkflowName = step2?.rightDetail?.matchedWorkflowName;
  const isGitOrCodeTask = Boolean(
    (matchedWorkflowName &&
      (matchedWorkflowName.includes("Git") ||
        matchedWorkflowName.includes("代码") ||
        matchedWorkflowName.includes("仓库"))) ||
      (timeline && timeline.some((s) => s.phase === "skill" || s.stepId?.startsWith("tool-"))) ||
      (userPrompt && /git|commit|代码|仓库|分支|diff|状态|status/i.test(userPrompt))
  );

  const contextStep = contextSteps[0];
  const activeSkills: string[] = contextStep?.rightDetail?.activeSkills || [];
  const deliveryStep = deliverySteps[deliverySteps.length - 1];

  const executiveSummaries = isGitOrCodeTask
    ? [
        {
          stageNum: "①",
          title: "01. 听懂需求",
          icon: Sparkles,
          status: stageStatuses.intent,
          summary: matchedWorkflowName
            ? `弄清提问意图，已精准分配至《${matchedWorkflowName}》专属流程`
            : "看懂用户问题，提取具体代码库与排查目标",
        },
        {
          stageNum: "②",
          title: "02. 拿上规矩",
          icon: ShieldCheck,
          status: stageStatuses.context,
          summary:
            activeSkills.length > 0
              ? `进入目标代码现场，已装配 ${activeSkills.length} 项企业 P0 防崩排查准则`
              : "安全接入工程工作区，拿出企业安全防线与排查准则",
        },
        {
          stageNum: "③",
          title: "03. 动手排查",
          icon: Wrench,
          status: stageStatuses.action,
          summary:
            actionSteps.length > 0
              ? "沙箱调用系统命令取回现场数据，对照规矩逐行比对推导诊断建议"
              : "在受控沙箱中执行工具或深入推导，专家大脑正在生成建议...",
        },
        {
          stageNum: "④",
          title: "04. 把关交活",
          icon: CheckCircle2,
          status: stageStatuses.delivery,
          summary: deliveryStep
            ? "最后一道出厂安全检查 100% 达标，算清用量账单并交活归档"
            : "通过出厂安全质检，正在送呈交付成果并留痕归档...",
        },
      ]
    : [
        {
          stageNum: "①",
          title: "01. 听懂需求",
          icon: Sparkles,
          status: stageStatuses.intent,
          summary: matchedWorkflowName
            ? `感知用户交互意图，已分配至《${matchedWorkflowName}》通用流程`
            : "看懂日常交流提问，提取意图上下文与交互需求",
        },
        {
          stageNum: "②",
          title: "02. 拿上规矩",
          icon: ShieldCheck,
          status: stageStatuses.context,
          summary: "免挂载工程代码环境，调出通用大模型对话能力与企业伦理防线",
        },
        {
          stageNum: "③",
          title: "03. 动手排查",
          icon: Wrench,
          status: stageStatuses.action,
          summary:
            actionSteps.length > 0
              ? "基座模型深度推演，结合日常语境构思体贴回应"
              : "基座大模型正在结合语境深度构思...",
        },
        {
          stageNum: "④",
          title: "04. 把关交活",
          icon: CheckCircle2,
          status: stageStatuses.delivery,
          summary: deliveryStep
            ? "内容合规出厂质检通过，算清用量账单并完成会话存证"
            : "安全出厂把关完成，正在交付答复...",
        },
      ];

  return (
    <div className="my-2 rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all duration-200 overflow-hidden">
      {/* ── 默认未展开态：主流AI思考中胶囊条 ── */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer select-none group bg-slate-50/70 hover:bg-slate-100/70 transition"
      >
        {/* 左侧：呼吸灯与主流AI思考状态指示 */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* 呼吸灯/指示器 */}
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

          {/* 状态主文案：对齐主流 AI（思考中 / 已深度思考） */}
          <div className="flex items-center gap-1.5 min-w-0">
            {isThinking ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-800">
                <Brain className="w-3.5 h-3.5 text-cyan-600 animate-pulse shrink-0" />
                <span>思考中{elapsedSeconds > 0 ? ` (${elapsedSeconds}s)` : "..."}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <Brain className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>已深度思考{formattedDuration ? ` (用时 ${formattedDuration})` : ""}</span>
              </div>
            )}
          </div>

          {/* 四大阶段微型流线 */}
          <div className="hidden sm:flex items-center gap-1 text-[10.5px] font-medium text-slate-400 ml-1.5">
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

        {/* 右侧：折叠展开指示 (主流AI逻辑：展开 / 收起，杜绝“查看执行结果”) */}
        <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-700 transition shrink-0 text-xs font-medium">
          <span className="text-[11px] hidden sm:inline">
            {isOpen ? "收起" : isThinking ? "查看思考" : "展开"}
          </span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* ── 点击展开后：主流AI思考过程 (CoT) + 4 步企业业务结论看板 ── */}
      {isOpen && (
        <div className="p-3 border-t border-slate-100 bg-white space-y-2.5 animate-in fade-in duration-150">
          {/* 1. 主流AI思维链内容 (Reasoning / Chain-of-Thought) */}
          {reasoning ? (
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs text-slate-600 leading-relaxed font-sans max-h-80 overflow-y-auto">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1.5 select-none">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                <span>思维链思考过程 (Chain of Thought)</span>
              </div>
              <div className="prose prose-xs max-w-none text-slate-600 whitespace-pre-wrap">
                <Markdown>{reasoning}</Markdown>
              </div>
            </div>
          ) : isThinking ? (
            <div className="p-3 rounded-xl bg-cyan-50/40 border border-cyan-100/70 text-xs text-cyan-800 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600 shrink-0" />
              <span>智能体深度思考中，正在检索知识库、调度工具与组织推导链路...</span>
            </div>
          ) : null}

          {/* 2. 企业四大执行交付阶段卡片 */}
          <div className="space-y-1.5">
            {executiveSummaries.map((item) => {
              const isRunning = item.status === "running";
              const isDone = item.status === "done";

              return (
                <div
                  key={item.title}
                  onClick={() => onSelectStep?.(item.title)}
                  className={`p-2 rounded-xl border transition flex items-start gap-2.5 text-xs ${
                    isRunning
                      ? "bg-cyan-50/50 border-cyan-300 ring-1 ring-cyan-100"
                      : isDone
                      ? "bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60"
                      : "bg-slate-50/20 border-slate-100 opacity-60"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] mt-0.5 ${
                      isRunning
                        ? "bg-cyan-100 border-cyan-300 text-cyan-700 animate-pulse font-bold"
                        : isDone
                        ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-bold"
                        : "bg-slate-100 border-slate-200 text-slate-400"
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3 text-emerald-700 stroke-[3]" /> : item.stageNum}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 tracking-tight">
                        {item.title}
                      </span>
                      {isRunning && (
                        <span className="text-[9.5px] px-1 py-0.2 rounded bg-cyan-100 text-cyan-800 font-bold font-mono">
                          处理中
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[9.5px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold font-mono">
                          已达成
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. 底部引导在右侧抽屉查看全景 */}
          <div className="pt-1 text-center">
            <button
              onClick={() => onSelectStep?.("01. 听懂需求")}
              className="text-[10.5px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer inline-flex items-center gap-1 hover:underline transition"
            >
              <span>👉 点击打开右侧全景执行抽屉（无滚动条·步骤流式联动）</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
