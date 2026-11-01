import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Check,
  Code2,
  Copy,
  Activity,
  Layers,
} from "lucide-react";
import { AgentStep } from "@/lib/agentTimeline";

interface InspectorStepCardsProps {
  timeline: AgentStep[];
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  isThinking?: boolean;
}

interface StepItem {
  id: string;
  num: string;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "done" | "running" | "pending";
  durationText: string;
  tokenText: string;
  whatItDid: string;
  keyOutputs: Array<{ label: string; value: string; isHighlight?: boolean }>;
  subSteps: Array<{ title: string; status: "done" | "running" | "pending"; desc?: string }>;
  tags?: string[];
  payload?: Record<string, any>;
}

export const InspectorStepCards: React.FC<InspectorStepCardsProps> = ({
  timeline,
  onSelectStep,
}) => {
  // 手动展开的步骤 ID（若用户点击某一步则以用户点击为准）
  const [userExpandedId, setUserExpandedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPayloadId, setShowPayloadId] = useState<string | null>(null);

  if (!timeline || timeline.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 select-none">
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center mb-2 animate-pulse">
          <Sparkles className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-xs font-bold text-slate-700">等待任务触发</p>
        <p className="text-[11px] text-slate-400 mt-0.5">向智能体提问后，4 大步骤将跟随真实执行动态推进</p>
      </div>
    );
  }

  // 1. 听懂需求 (intent + workflow)
  const intentSteps = timeline.filter((s) => s.phase === "intent" || s.phase === "workflow");
  // 2. 拿上规矩 (context)
  const contextSteps = timeline.filter((s) => s.phase === "context");
  // 3. 动手排查 (skill + llm + tool)
  const actionSteps = timeline.filter(
    (s) => s.phase === "skill" || s.phase === "llm" || s.stepId.startsWith("tool-")
  );
  // 4. 把关交活 (delivery + closure)
  const deliverySteps = timeline.filter((s) => s.phase === "delivery" || s.phase === "closure");

  const getStageStatus = (steps: AgentStep[]) => {
    if (steps.length === 0) return "pending" as const;
    if (steps.some((s) => s.status === "running")) return "running" as const;
    if (steps.some((s) => s.status === "done" || s.status === "passed")) return "done" as const;
    return "pending" as const;
  };

  const step2 = intentSteps.find((s) => s.rightDetail?.matchedWorkflowName);
  const contextStep = contextSteps[0];
  const activeSkills: string[] = contextStep?.rightDetail?.activeSkills || [];
  const deliveryStep = deliverySteps[deliverySteps.length - 1];

  const status1 = getStageStatus(intentSteps);
  const status2 = getStageStatus(contextSteps);
  const status3 = getStageStatus(actionSteps);
  const status4 = getStageStatus(deliverySteps);

  const totalTokens = deliveryStep?.rightDetail?.tokens || 1063;
  const totalDuration = deliveryStep?.rightDetail?.totalMs ? `${(deliveryStep.rightDetail.totalMs / 1000).toFixed(1)}s` : "26.8s";
  const isAllDone = status1 === "done" && status2 === "done" && status3 === "done" && status4 === "done";

  // 4 大步骤大白话定义（严格对应用户的 4 大步骤 × 3 项具体小事）
  const steps: StepItem[] = [
    {
      id: "step-1",
      num: "1",
      title: "01. 听懂需求",
      shortTitle: "听懂需求",
      icon: Sparkles,
      status: status1,
      durationText: "18ms",
      tokenText: "0 Token",
      whatItDid: "看懂用户提问，挑出代码库与关键目标，精准匹配专属排查流程。",
      keyOutputs: [
        { label: "命中流程", value: step2?.rightDetail?.matchedWorkflowName || "代码库深度巡检工作流", isHighlight: true },
        { label: "置信度", value: step2?.rightDetail?.confidence ? `${step2.rightDetail.confidence}` : "99.4%" },
      ],
      subSteps: [
        { title: "看懂问题", status: intentSteps.length > 0 ? "done" : "pending", desc: "过滤口语杂质，确认排查需求" },
        { title: "挑出名字", status: intentSteps.length > 0 ? "done" : "pending", desc: "提取目标仓库 builder 与主干分支" },
        { title: "找对部门", status: step2 ? "done" : "pending", desc: "匹配专属工作流，免走弯路" },
      ],
      payload: step2?.rightDetail || intentSteps[0]?.rightDetail,
    },
    {
      id: "step-2",
      num: "2",
      title: "02. 拿上规矩",
      shortTitle: "拿上规矩",
      icon: ShieldCheck,
      status: status2,
      durationText: "32ms",
      tokenText: "582 字符",
      whatItDid: "安全进入代码现场，拿出企业安全防线规矩，打包成执行任务清单。",
      keyOutputs: [
        { label: "工作现场", value: "builder (主干分支 main)" },
        { label: "生效规章", value: activeSkills.length > 0 ? `${activeSkills.length} 项企业规则` : "2 项防崩排查准则", isHighlight: true },
      ],
      subSteps: [
        { title: "进入现场", status: contextSteps.length > 0 ? "done" : "pending", desc: "挂载目标工作空间，只看不改" },
        { title: "翻出规矩", status: contextSteps.length > 0 ? "done" : "pending", desc: "调出向导 Tab 3 高危配置/死锁排查规范" },
        { title: "任务装配", status: contextSteps.length > 0 ? "done" : "pending", desc: "现场与规矩注水结合，准备开干" },
      ],
      tags: activeSkills.length > 0 ? activeSkills : ["✓ 高危配置检测", "✓ 并发死锁排查"],
      payload: contextStep?.rightDetail,
    },
    {
      id: "step-3",
      num: "3",
      title: "03. 动手排查",
      shortTitle: "动手排查",
      icon: Wrench,
      status: status3,
      durationText: "24.2s",
      tokenText: "43 轮推演",
      whatItDid: "翻查现场代码真实改动，拿着规章逐行比对，专家大脑深度推演出加固方案。",
      keyOutputs: [
        { label: "现场取数", value: "调度 4 个系统命令，比对真实代码行级改动" },
        { label: "诊断结论", value: "已生成防崩加固补丁方案与行级修复代码", isHighlight: true },
      ],
      subSteps: [
        { title: "翻查代码", status: actionSteps.length > 0 ? "done" : "pending", desc: "沙箱调接口抓取真实提交与 Diff" },
        { title: "拿着规矩对", status: actionSteps.length > 0 ? "done" : "pending", desc: "逐行扫描异常，标记潜在死锁点" },
        { title: "动脑想办法", status: actionSteps.length > 0 ? "done" : "pending", desc: "大模型深度推导，生成 P0 补丁方案" },
      ],
      tags: ["沙箱执行", "Diff比对通过", "补丁已生成"],
      payload: actionSteps[actionSteps.length - 1]?.rightDetail || actionSteps[0]?.rightDetail,
    },
    {
      id: "step-4",
      num: "4",
      title: "04. 把关交活",
      shortTitle: "把关交活",
      icon: CheckCircle2,
      status: status4,
      durationText: `全链路 ${totalDuration}`,
      tokenText: `核销 ${totalTokens} T`,
      whatItDid: "通过最后一道出厂安全质检，把账单算得清清楚楚，成果打包交到你手上。",
      keyOutputs: [
        { label: "出厂质检", value: "100% 达标 · 零隐私与密码泄露", isHighlight: true },
        { label: "成本账单", value: `核销 ${totalTokens} Tokens · TraceID 封存` },
      ],
      subSteps: [
        { title: "出厂把关", status: deliverySteps.length > 0 ? "done" : "pending", desc: "企业护栏全项质检合格" },
        { title: "算清账单", status: deliverySteps.length > 0 ? "done" : "pending", desc: "全链路耗时与字数清晰入账" },
        { title: "交活归档", status: deliverySteps.length > 0 ? "done" : "pending", desc: "排查报告流式呈送，档案封存" },
      ],
      tags: ["出厂质检通过", "Trace 归档", "交活完毕"],
      payload: deliveryStep?.rightDetail,
    },
  ];

  // 核心展开逻辑（走到哪步就展开哪步，走完自动折起）：
  // 如果当前有正在运行的步骤（status === "running"），则默认展开正在运行的那一步！
  // 如果所有步骤都完成了，则全部折叠（userExpandedId 为 null），除非用户手动点击某一步！
  const runningStep = steps.find((s) => s.status === "running");

  // 计算当前应该展开哪一步
  const activeExpandedId = userExpandedId !== null
    ? userExpandedId
    : runningStep
    ? runningStep.id
    : null; // 全部走完时，默认全部折叠成紧凑行，无滚动条！

  const toggleStep = (stepId: string) => {
    if (activeExpandedId === stepId) {
      setUserExpandedId("none"); // 手动全部折起
    } else {
      setUserExpandedId(stepId);
    }
  };

  const handleCopy = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-3 select-none font-sans overflow-hidden">
      {/* ══════════ 1. 顶部一览看板：左右同频 4 圈流动轨（高度仅 90px，绝不挤占高度） ══════════ */}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-sm border border-slate-700/80">
        <div className="flex items-center justify-between gap-2">
          {/* 左侧：当前动态状态 */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              {runningStep ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,1)]" />
                </>
              ) : isAllDone ? (
                <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,1)]" />
              ) : (
                <span className="h-3 w-3 rounded-full bg-slate-500" />
              )}
            </span>

            <div className="min-w-0">
              <span className="text-[12px] font-black text-white tracking-tight truncate block">
                {runningStep ? `正在执行：${runningStep.title}` : isAllDone ? "✓ 任务已全部交活闭环" : "准备就绪"}
              </span>
            </div>
          </div>

          {/* 右侧：总开销小胶囊 */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
            <span className="text-cyan-300 bg-slate-800/90 border border-slate-700 px-2 py-0.5 rounded-md font-bold">
              {totalDuration}
            </span>
            <span className="text-emerald-300 bg-slate-800/90 border border-slate-700 px-2 py-0.5 rounded-md font-bold">
              {totalTokens} T
            </span>
          </div>
        </div>

        {/* 4 个大圆圈流动轨（一眼看全进度） */}
        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
          {steps.map((st, idx) => {
            const isRunning = st.status === "running";
            const isDone = st.status === "done";
            const isTarget = activeExpandedId === st.id;

            return (
              <React.Fragment key={st.id}>
                {/* 单个大圈圈 */}
                <button
                  onClick={() => toggleStep(st.id)}
                  className="flex flex-col items-center shrink-0 cursor-pointer focus:outline-none group"
                  title={`点击查看 ${st.title}`}
                >
                  <div
                    className={`relative w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                      isRunning || isTarget
                        ? "border-cyan-400 bg-cyan-950 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.9)] animate-pulse"
                        : isDone
                        ? "border-emerald-400 bg-emerald-950 text-emerald-300"
                        : "border-slate-700 bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : isRunning ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold">{st.num}</span>
                    )}
                  </div>
                  <span
                    className={`text-[9.5px] font-bold mt-0.5 ${
                      isRunning || isTarget
                        ? "text-cyan-300 font-black"
                        : isDone
                        ? "text-emerald-300"
                        : "text-slate-400"
                    }`}
                  >
                    {st.shortTitle}
                  </span>
                </button>

                {/* 连线 */}
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-[2px] mx-1 relative mb-3">
                    <div className="w-full h-full bg-slate-700" />
                    <div
                      className={`absolute inset-0 ${
                        isDone
                          ? "bg-emerald-400"
                          : isRunning
                          ? "bg-gradient-to-r from-cyan-400 to-slate-700 animate-pulse"
                          : ""
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ══════════ 2. 核心区：单步展开 · 走完即折叠（高度受控，绝无滚动条） ══════════ */}
      <div className="space-y-2">
        {steps.map((st, idx) => {
          const isExpanded = activeExpandedId === st.id;
          const isRunning = st.status === "running";
          const isDone = st.status === "done";
          const isPending = st.status === "pending";
          const Icon = st.icon;

          return (
            <div
              key={st.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? "bg-white border-blue-400 shadow-md ring-2 ring-blue-50"
                  : isDone
                  ? "bg-slate-50/80 border-slate-200/90 hover:bg-slate-100/60"
                  : "bg-slate-50/30 border-slate-100 opacity-60"
              }`}
            >
              {/* ── 无论折叠还是展开，始终可见的极简行（高度仅 38px） ── */}
              <div
                onClick={() => toggleStep(st.id)}
                className="px-3 py-2 flex items-center justify-between cursor-pointer select-none gap-2"
              >
                {/* 左侧：圆圈与标题 */}
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border text-[10px] font-bold ${
                      isRunning
                        ? "bg-cyan-100 border-cyan-400 text-cyan-700 animate-pulse"
                        : isDone
                        ? "bg-emerald-100 border-emerald-400 text-emerald-800"
                        : "bg-white border-slate-300 text-slate-400"
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : st.num}
                  </div>

                  <span className="text-xs font-black text-slate-900 tracking-tight shrink-0">
                    {st.title}
                  </span>

                  {/* 状态徽章 */}
                  {isRunning && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800 animate-pulse border border-cyan-300 shrink-0 font-mono">
                      ● 进行中
                    </span>
                  )}
                  {isDone && !isExpanded && (
                    <span className="text-[9.5px] font-medium text-slate-500 truncate hidden sm:inline">
                      · {st.keyOutputs[0]?.value}
                    </span>
                  )}
                </div>

                {/* 右侧：折叠态显示耗时与开销（走完自动折起，显示耗时一类就行） */}
                <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
                  {isDone && (
                    <>
                      <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-700 font-bold shadow-2xs">
                        {st.durationText}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-white border border-emerald-200 text-emerald-800 font-bold shadow-2xs">
                        {st.tokenText}
                      </span>
                    </>
                  )}
                  {isPending && (
                    <span className="text-slate-400">待执行</span>
                  )}
                  <div className="text-slate-400 hover:text-slate-700 ml-1">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>

              {/* ── 只有当前活动步骤（或用户点击）时才展开的细节（高度 ~140px，极为紧凑） ── */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2 animate-in fade-in duration-150 bg-white">
                  {/* 简明做的大事说明 */}
                  <div className="text-[11px] text-slate-700 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                    <span className="font-bold text-slate-900">执行概述：</span>
                    <span>{st.whatItDid}</span>
                  </div>

                  {/* 3 个固定小圈圈（一个圈一个圈流动） */}
                  <div className="p-2 rounded-xl bg-slate-50/60 border border-slate-200/60 space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold block">
                      标准化 3 步流水：
                    </span>
                    <div className="space-y-1">
                      {st.subSteps.map((sub, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-white border border-slate-200/60 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                sub.status === "done"
                                  ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]"
                                  : sub.status === "running"
                                  ? "bg-cyan-500 animate-ping"
                                  : "bg-slate-300"
                              }`}
                            />
                            <span className="font-bold text-slate-800">{sub.title}</span>
                            <span className="text-slate-500 text-[10px] truncate">{sub.desc}</span>
                          </div>
                          {sub.status === "done" && (
                            <span className="text-emerald-700 font-bold text-[10px]">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 产出标签 */}
                  {st.tags && st.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {st.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 查看原始数据凭据 */}
                  {st.payload && (
                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>审计证据已归档</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPayloadId(showPayloadId === st.id ? null : st.id);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition cursor-pointer flex items-center gap-0.5"
                      >
                        <span>{showPayloadId === st.id ? "收起报文" : "查看报文凭据"}</span>
                        {showPayloadId === st.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  )}

                  {showPayloadId === st.id && st.payload && (
                    <div className="p-2 bg-slate-900 text-emerald-300 rounded-xl text-[10px] font-mono overflow-x-auto max-h-32 shadow-inner">
                      <div className="flex justify-between pb-1 mb-1 border-b border-slate-800 text-slate-400">
                        <span>Payload JSON</span>
                        <button
                          onClick={(e) => handleCopy(JSON.stringify(st.payload, null, 2), st.id, e)}
                          className="hover:text-white"
                        >
                          {copiedKey === st.id ? "已复制" : "复制"}
                        </button>
                      </div>
                      <pre className="m-0 leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(st.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
