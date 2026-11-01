import React from "react";
import {
  Sparkles,
  Compass,
  ShieldCheck,
  Wrench,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Check,
} from "lucide-react";
import { AgentStep, StepPhase } from "@/lib/agentTimeline";

interface MilestoneConfig {
  phase: StepPhase;
  stepNum: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MILESTONES: MilestoneConfig[] = [
  { phase: "intent", stepNum: "1", name: "意图解析", icon: Sparkles },
  { phase: "workflow", stepNum: "2", name: "任务编排", icon: Compass },
  { phase: "context", stepNum: "3", name: "规程注入", icon: ShieldCheck },
  { phase: "skill", stepNum: "4", name: "技能调度", icon: Wrench },
  { phase: "llm", stepNum: "5", name: "认知推演", icon: BrainCircuit },
  { phase: "delivery", stepNum: "6", name: "交付闭环", icon: CheckCircle2 },
];

interface AgentMiniFlowProps {
  timeline: AgentStep[];
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  isThinking?: boolean;
}

export const AgentMiniFlow: React.FC<AgentMiniFlowProps> = ({
  timeline,
  activeStepId,
  onSelectStep,
}) => {
  const getMilestoneState = (phase: StepPhase) => {
    const matchingSteps = timeline.filter((s) => s.phase === phase);
    if (matchingSteps.length === 0) {
      return { status: "pending" as const, stepId: null };
    }
    const runningStep = matchingSteps.find((s) => s.status === "running");
    if (runningStep) {
      return { status: "running" as const, stepId: runningStep.stepId };
    }
    return { status: "done" as const, stepId: matchingSteps[matchingSteps.length - 1].stepId };
  };

  const handleClick = (stepId: string | null) => {
    if (stepId && onSelectStep) {
      onSelectStep(stepId);
    }
  };

  return (
    <div className="flex items-center justify-between gap-1 px-1 py-1 overflow-x-auto scrollbar-hide">
      {MILESTONES.map((m, idx) => {
        const { status, stepId } = getMilestoneState(m.phase);
        const isSelected = stepId && activeStepId === stepId;
        const Icon = m.icon;

        return (
          <React.Fragment key={m.phase}>
            <button
              onClick={() => handleClick(stepId)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 border ${
                isSelected
                  ? "bg-blue-50 border-blue-400 text-blue-700 font-bold ring-1 ring-blue-200"
                  : status === "running"
                  ? "bg-cyan-50 border-cyan-400 text-cyan-700 animate-pulse font-bold"
                  : status === "done"
                  ? "bg-emerald-50/60 border-emerald-300 text-emerald-800 hover:bg-emerald-100/60"
                  : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
              }`}
              title={`阶段 ${m.stepNum}: ${m.name}`}
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                {status === "running" ? (
                  <Loader2 className="w-3 h-3 text-cyan-600 animate-spin" />
                ) : status === "done" ? (
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                ) : (
                  <Icon className="w-3 h-3 text-slate-400" />
                )}
              </span>
              <span className="text-[11px] whitespace-nowrap">{m.name}</span>
            </button>

            {idx < MILESTONES.length - 1 && (
              <div
                className={`h-[1.5px] w-3 shrink-0 rounded-full ${
                  status === "done" ? "bg-emerald-300" : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
