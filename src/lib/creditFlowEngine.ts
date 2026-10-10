/** 信贷多轮流程 — 每轮用户一句，推进一步（对话触发，非自动演示） */

import { allRunnableSkills } from "./agentSkills";
import {
  CREDIT_FLOWS,
  creditFlowById,
  matchCreditFlowId,
  type CreditFlowDef,
  type CreditFlowStepDef,
} from "./creditFlowCatalog";
import { disbursementPaper, paperForSkill, type WorkPaper } from "./workPaper";
import { flowUiRequiresDrawer } from "./creditFlowUiGate";
import { uiForFlowStep, type CreditFlowUi, type FlowActionDef } from "./creditFlowUi";

export type FlowStageItem = {
  id: string;
  label: string;
  rawIndex: number;
  status: "done" | "active" | "pending";
};

export type CreditFlowState = {
  flowId: string;
  /** 下一句要展示的步骤下标（0-based，含 transient） */
  stepIndex: number;
  /** 已到达过的最远步骤（raw index） */
  maxStepIndex?: number;
  /** 当前 UI 正在查看的步骤（raw index） */
  viewStepIndex?: number;
};

export type CreditFlowProgressItem = {
  id: string;
  label: string;
  status: "done" | "active" | "pending";
};

export type CreditFlowShowcase = {
  title: string;
  body: string;
  tone?: "info" | "bridge" | "success";
  phase?: string;
  flowId?: string;
  stepId?: string;
  ui?: CreditFlowUi | null;
  actions?: FlowActionDef[];
  /** 已自动完成的中间步骤（如拉取要素） */
  progress?: CreditFlowProgressItem[];
  stepIndex?: number;
  stepTotal?: number;
  stages?: FlowStageItem[];
};

export type CreditFlowTurnResult = {
  markdown: string;
  showcaseFlow: CreditFlowShowcase;
  paper: WorkPaper | null;
  nextState: CreditFlowState | null;
  flow: CreditFlowDef | null;
  done: boolean;
  /** 本步未满足办理条件，未推进 stepIndex */
  blocked?: boolean;
};

/** 结束多轮流程（含「退出流程」等整句，避免 `\b` 在中文里截断「退出」） */
export function isFlowExitQuery(raw: string): boolean {
  const q = flowTurnUserQuery(raw).trim();
  if (!q) return false;
  return /^(退出流程|退出|取消|结束流程|终止流程|结束)(?:$|[，。！\s])/u.test(q);
}

function allowedStepCompletes(flowId: string, stepId: string): string[] {
  const { ui, actions } = uiForFlowStep(flowId, stepId);
  const out = actions.map((a) => a.sendAs.trim());
  if (ui?.kind === "form") out.push(ui.submitSendAs.trim());
  if (ui?.kind === "contract_edit") out.push(ui.submitSendAs.trim());
  return [...new Set(out.filter(Boolean))];
}

/** 用户本轮真实意图（不被 expandQuery 的「追问：」包装影响） */
export function flowTurnUserQuery(raw: string): string {
  const t = raw.trim();
  const chase = /(?:^|\n)追问：(.+)$/s.exec(t);
  if (chase?.[1]) return chase[1].trim();
  return t;
}

function matchesStepComplete(query: string, allowed: string[]): boolean {
  const q = flowTurnUserQuery(query);
  if (!q) return false;
  if (allowed.some((a) => q === a)) return true;
  // 兼容只发了按钮文案前半段
  return allowed.some(
    (a) => a.length >= 4 && q.length >= 4 && (q.includes(a) || a.includes(q)),
  );
}

/** Hub：判断用户这句是否在推进当前信贷流程（而非普通问答） */
export function isCreditFlowAdvanceQuery(
  query: string,
  state: CreditFlowState | null | undefined,
): boolean {
  if (!state?.flowId) return false;
  const flow = creditFlowById(state.flowId);
  if (!flow) return false;
  const q = flowTurnUserQuery(query);
  if (!q) return false;
  if (isFlowExitQuery(q)) return true;

  const pendingIdx =
    state.stepIndex > 0 ? state.stepIndex - 1 : 0;
  const pending = flow.steps[pendingIdx];
  if (!pending) return false;
  return matchesStepComplete(q, allowedStepCompletes(flow.id, pending.id));
}

function canAdvanceToStep(flow: CreditFlowDef, targetIndex: number, query: string): { ok: true } | { ok: false; reason: string } {
  if (targetIndex <= 0) return { ok: true };
  const prev = flow.steps[targetIndex - 1];
  if (!prev) return { ok: true };
  const { ui } = uiForFlowStep(flow.id, prev.id);
  if (!flowUiRequiresDrawer(ui)) return { ok: true };
  const allowed = allowedStepCompletes(flow.id, prev.id);
  if (matchesStepComplete(query, allowed)) return { ok: true };
  return {
    ok: false,
    reason: `请先在本步办理面板完成操作，再点「${allowed[0] ?? "确认"}」推进（不要只在输入框发「继续」）。`,
  };
}

const PAPER_QUERY: Record<string, string> = {
  contract: "审查这份借款合同",
  credit: "测算这笔授信额度",
  checklist: "核对这笔放款材料齐不齐",
  occupancy: "查这户额度占用超没超",
  flow: "市场部9600报销单现在走到哪",
  collateral: "重估这批押品，标出跌幅过大的",
};

function paperForStep(step: CreditFlowStepDef): WorkPaper | null {
  if (!step.paper || step.paper === "none") return null;
  if (step.paper === "disbursement") return disbursementPaper();
  const q = step.paperQuery?.trim() || PAPER_QUERY[step.paper] || "";
  const skills = allRunnableSkills();
  const pick =
    step.paper === "contract" || step.paper === "checklist"
      ? skills.find((s) => s.id === "contract-desk")
      : step.paper === "credit" || step.paper === "occupancy"
        ? skills.find((s) => s.id === "data-desk")
        : step.paper === "flow"
          ? skills.find((s) => s.id === "flow-desk")
          : step.paper === "collateral"
            ? skills.find((s) => s.id === "sheet-desk")
            : undefined;
  if (!pick || !q) return null;
  return paperForSkill(pick, q);
}

function visibleFlowSteps(flow: CreditFlowDef) {
  return flow.steps
    .map((step, rawIndex) => ({ step, rawIndex }))
    .filter(({ step }) => !step.transient);
}

export function buildFlowStages(flow: CreditFlowDef, maxRaw: number, activeRaw: number): FlowStageItem[] {
  return visibleFlowSteps(flow).map(({ step, rawIndex }) => ({
    id: step.id,
    label: step.label,
    rawIndex,
    status: rawIndex === activeRaw ? "active" : rawIndex <= maxRaw ? "done" : "pending",
  }));
}

function stepCard(
  flow: CreditFlowDef,
  step: CreditFlowStepDef,
  done: boolean,
  extra?: Pick<CreditFlowShowcase, "progress" | "stepIndex" | "stepTotal" | "stages">,
  rawIndex?: number,
): CreditFlowShowcase {
  const { ui, actions } = uiForFlowStep(flow.id, step.id);
  const visible = visibleFlowSteps(flow);
  const visibleIndex = visible.findIndex((v) => v.step.id === step.id);
  const ri = rawIndex ?? flow.steps.findIndex((s) => s.id === step.id);
  return {
    title: step.title,
    body: step.body,
    tone: done ? "success" : step.tone ?? "info",
    phase: `${flow.name} · ${step.label}`,
    flowId: flow.id,
    stepId: step.id,
    ui: done ? null : ui,
    actions: done ? [] : actions,
    stepIndex: extra?.stepIndex ?? (visibleIndex >= 0 ? visibleIndex + 1 : undefined),
    stepTotal: extra?.stepTotal ?? visible.length,
    progress: extra?.progress,
    stages: extra?.stages,
  };
}

/** 从某一步重新办理（该步及之后视为待重做） */
export function rewindCreditFlowToRawStep(state: CreditFlowState, rawIndex: number): CreditFlowState {
  const flow = creditFlowById(state.flowId);
  const max = flow ? Math.min(rawIndex, flow.steps.length - 1) : rawIndex;
  return {
    flowId: state.flowId,
    stepIndex: Math.max(0, max),
    maxStepIndex: Math.max(state.maxStepIndex ?? 0, max),
    viewStepIndex: max,
  };
}

/** 流程卡片上的按钮文案（如「开始审查」）是否属于信贷流程操作 */
export function isHubFlowButtonQuery(query: string): boolean {
  const q = flowTurnUserQuery(query.trim());
  if (!q) return false;
  for (const flow of CREDIT_FLOWS) {
    for (const step of flow.steps) {
      if (matchesStepComplete(q, allowedStepCompletes(flow.id, step.id))) return true;
    }
  }
  return false;
}

/** 会话进度丢失时，从卡片展示步 + 可选快照恢复办理指针 */
export function resumeCreditFlowFromShowcase(
  showcase: Pick<CreditFlowShowcase, "flowId" | "stepId" | "stages">,
  checkpoint: CreditFlowState | null | undefined,
): CreditFlowState | null {
  if (!showcase.flowId || !showcase.stepId || showcase.stepId === "__exit__") return null;
  if (checkpoint?.flowId === showcase.flowId) return checkpoint;
  const flow = creditFlowById(showcase.flowId);
  if (!flow) return null;
  const raw = flow.steps.findIndex((s) => s.id === showcase.stepId);
  if (raw < 0) return null;
  let maxRaw = raw;
  for (const s of showcase.stages ?? []) {
    if (s.status !== "pending") maxRaw = Math.max(maxRaw, s.rawIndex);
  }
  let stepIndex = raw + 1;
  while (stepIndex < flow.steps.length && flow.steps[stepIndex]?.transient) {
    stepIndex += 1;
  }
  return {
    flowId: showcase.flowId,
    stepIndex,
    maxStepIndex: maxRaw,
    viewStepIndex: raw,
  };
}

/** 点击阶段条：查看/操作已到达的步骤（不推进游标） */
export function displayCreditFlowAt(state: CreditFlowState, rawViewIndex: number): CreditFlowTurnResult | null {
  const flow = creditFlowById(state.flowId);
  if (!flow) return null;
  const maxRaw = state.maxStepIndex ?? Math.max(0, state.stepIndex - 1);
  const view = Math.min(Math.max(0, rawViewIndex), maxRaw);
  const step = flow.steps[view];
  if (!step) return null;

  const progress = collectDoneTransients(flow, view);
  const visible = visibleFlowSteps(flow);
  const visibleIndex = visible.findIndex((v) => v.rawIndex === view);
  const stages = buildFlowStages(flow, maxRaw, view);

  return {
    markdown: step.body.split("\n")[0] ?? step.label,
    showcaseFlow: stepCard(
      flow,
      step,
      false,
      {
        progress: progress.length ? progress : undefined,
        stepIndex: visibleIndex >= 0 ? visibleIndex + 1 : undefined,
        stepTotal: visible.length,
        stages,
      },
      view,
    ),
    paper: paperForStep(step),
    nextState: { ...state, viewStepIndex: view },
    flow,
    done: false,
  };
}

function collectDoneTransients(flow: CreditFlowDef, beforeIndex: number): CreditFlowProgressItem[] {
  const progress: CreditFlowProgressItem[] = [];
  for (let i = 0; i < beforeIndex; i++) {
    const s = flow.steps[i];
    if (s?.transient) progress.push({ id: s.id, label: s.label, status: "done" });
  }
  return progress;
}

function skipTransientSteps(flow: CreditFlowDef, startIndex: number) {
  const progress: CreditFlowProgressItem[] = [];
  let index = startIndex;
  while (index < flow.steps.length && flow.steps[index]?.transient) {
    const s = flow.steps[index]!;
    progress.push({ id: s.id, label: s.label, status: "done" });
    index += 1;
  }
  return { index, progress };
}

function formatMarkdown(flow: CreditFlowDef, step: CreditFlowStepDef, done: boolean): string {
  if (done) {
    return `「${flow.name}」整套流程已走完。\n${step.hint ? step.hint : "如需重新开始，直接说流程名称即可。"}`;
  }
  const hint = step.hint ? `\n\n${step.hint}` : "";
  return `${step.title.replace(/^[^\s]+\s/u, "")}${hint}`;
}

export type CreditFlowTurnOpts = {
  /** 来自 `{flowId}-flow-desk` 技能，固定流程 */
  forcedFlowId?: string | null;
};

export function processCreditFlowTurn(
  query: string,
  state: CreditFlowState | null | undefined,
  opts?: CreditFlowTurnOpts,
): CreditFlowTurnResult {
  const q = flowTurnUserQuery(query);
  if (isFlowExitQuery(q)) {
    return {
      markdown: "已退出当前信贷流程。需要时再说出流程名称（如「贷前调查」「智能放款校验」）即可重新进入。",
      showcaseFlow: {
        title: "流程已结束",
        body: "当前多轮对话流程已关闭，不会自动续聊。",
        tone: "info",
        phase: "信贷流程",
        flowId: state?.flowId,
        stepId: "__exit__",
      },
      paper: null,
      nextState: null,
      flow: null,
      done: true,
    };
  }

  let flow: CreditFlowDef | undefined;
  let index: number;

  if (state?.flowId) {
    flow = creditFlowById(state.flowId);
    if (!flow) {
      return {
        markdown: "上一段流程状态无效，请重新说出要办的流程名称。",
        showcaseFlow: { title: "请重新选流程", body: "会话里的流程指针已失效。", tone: "info" },
        paper: null,
        nextState: null,
        flow: null,
        done: true,
      };
    }
    const gate = canAdvanceToStep(flow, state.stepIndex, q);
    if (!gate.ok) {
      const prevRaw = Math.max(0, state.stepIndex - 1);
      const prevStep = flow.steps[prevRaw]!;
      const maxRaw = state.maxStepIndex ?? prevRaw;
      const stages = buildFlowStages(flow, maxRaw, prevRaw);
      const blocked = stepCard(
        flow,
        prevStep,
        false,
        {
          stepIndex: visibleFlowSteps(flow).findIndex((v) => v.step.id === prevStep.id) + 1,
          stepTotal: visibleFlowSteps(flow).length,
          stages,
        },
        prevRaw,
      );
      return {
        markdown: gate.reason,
        showcaseFlow: {
          ...blocked,
          body: `${gate.reason}\n\n${prevStep.body}`,
          tone: "bridge",
        },
        paper: paperForStep(prevStep),
        nextState: state,
        flow,
        done: false,
        blocked: true,
      };
    }
    index = state.stepIndex;
  } else {
    const id = opts?.forcedFlowId ?? matchCreditFlowId(q);
    flow = id ? creditFlowById(id) : undefined;
    if (!flow) {
      return {
        markdown: "没有识别到信贷流程入口。可以说：贷前调查、合同审查、智能放款校验、额度测算、押品重估、报销流程等。",
        showcaseFlow: {
          title: "未匹配流程",
          body: "本技能按多轮对话推进；请先说出要做的业务场景关键词。",
          tone: "info",
          phase: "信贷流程",
        },
        paper: null,
        nextState: null,
        flow: null,
        done: true,
      };
    }
    index = 0;
  }

  if (index >= flow.steps.length) {
    return {
      markdown: `「${flow.name}」已在上一轮走完。要说「${flow.triggers[0] ?? flow.name}」可从头再来。`,
      showcaseFlow: {
        title: "流程已完成",
        body: "没有待推进的步骤。",
        tone: "success",
        phase: flow.name,
      },
      paper: null,
      nextState: null,
      flow,
      done: true,
    };
  }

  const leadProgress = collectDoneTransients(flow, index);
  const skipped = skipTransientSteps(flow, index);
  const showIndex = skipped.index;
  const progress = [...leadProgress, ...skipped.progress];
  if (showIndex >= flow.steps.length) {
    const last = flow.steps[flow.steps.length - 1]!;
    return {
      markdown: `「${flow.name}」整套流程已走完。`,
      showcaseFlow: stepCard(flow, last, true, { progress, stepIndex: flow.steps.length, stepTotal: flow.steps.length }),
      paper: null,
      nextState: null,
      flow,
      done: true,
    };
  }

  const step = flow.steps[showIndex]!;
  const isLast = showIndex >= flow.steps.length - 1;
  const paper = paperForStep(step);
  const visibleSteps = flow.steps.filter((s) => !s.transient);
  const visibleIndex = visibleSteps.findIndex((s) => s.id === step.id);
  const maxRaw = Math.max(state?.maxStepIndex ?? -1, showIndex);
  const stages = buildFlowStages(flow, maxRaw, showIndex);
  const showcaseFlow = stepCard(
    flow,
    step,
    isLast,
    {
      progress: progress.length ? progress : undefined,
      stepIndex: visibleIndex >= 0 ? visibleIndex + 1 : showIndex + 1,
      stepTotal: visibleSteps.length,
      stages,
    },
    showIndex,
  );
  const markdown = formatMarkdown(flow, step, isLast);

  let nextIndex = showIndex + 1;
  while (nextIndex < flow.steps.length && flow.steps[nextIndex]?.transient) {
    nextIndex += 1;
  }

  return {
    markdown,
    showcaseFlow,
    paper,
    nextState: isLast
      ? null
      : {
          flowId: flow.id,
          stepIndex: nextIndex,
          maxStepIndex: maxRaw,
          viewStepIndex: showIndex,
        },
    flow,
    done: isLast,
  };
}
