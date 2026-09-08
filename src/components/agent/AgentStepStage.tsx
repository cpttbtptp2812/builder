import { useEffect, useState, type ComponentType } from "react";
import { AgentPlatformLab } from "../fx/AgentPlatformLab";
import { AgentSkillsDemo } from "../fx/AgentSkillsDemo";
import { EvalLabPanel } from "../fx/EvalLabPanel";
import { FlowOrchestrator } from "./FlowOrchestrator";
import { StepPlay } from "./steps/StepPlay";
import { STEP_TECH } from "./steps/stepTech";
import { getStep, isStepId, STEP_DEMOS, STEP_REGISTRY, type StepId } from "./steps";

const NEXT_STEP: Partial<Record<StepId, StepId>> = {
  nlu: "intent",
  intent: "entity",
  entity: "plan",
  plan: "context",
  context: "dsl",
  dsl: "manage",
  manage: "pattern",
  pattern: "engine",
  engine: "mech",
  mech: "ctrl",
  ctrl: "browser",
};

const PREV_STEP: Partial<Record<StepId, StepId>> = Object.fromEntries(
  Object.entries(NEXT_STEP).map(([from, to]) => [to, from]),
) as Partial<Record<StepId, StepId>>;

const STEP_LABS: Partial<Record<StepId, ComponentType>> = {
  intent: () => <AgentSkillsDemo embedded hideFlow initialSkillId="router" />,
  plan: () => <AgentPlatformLab embedded hideFlow initialScene="multi-agent" />,
  dsl: () => <FlowOrchestrator initialTab="dsl" />,
  manage: () => <FlowOrchestrator initialTab="manage" />,
  pattern: () => <FlowOrchestrator initialTab="pattern" />,
  ctrl: () => <EvalLabPanel compact />,
  browser: () => <AgentSkillsDemo embedded hideFlow initialSkillId="site-analyzer" />,
  mcp: () => <AgentSkillsDemo embedded hideFlow initialSkillId="mcp" />,
  kb: () => <AgentPlatformLab embedded hideFlow initialScene="rag" />,
};

export function AgentStepStage({
  stepId,
  expanded = false,
  playTick = 0,
}: {
  stepId: string;
  expanded?: boolean;
  playTick?: number;
}) {
  const id = isStepId(stepId) ? stepId : "nlu";
  const meta = getStep(id);
  const tech = STEP_TECH[id];
  const Demo = STEP_DEMOS[id];
  const Lab = expanded ? STEP_LABS[id] : undefined;
  const prev = PREV_STEP[id] ? STEP_REGISTRY[PREV_STEP[id]!].label : null;
  const next = NEXT_STEP[id] ? STEP_REGISTRY[NEXT_STEP[id]!].label : "运行时按需调用";
  const [techOpen, setTechOpen] = useState(false);

  useEffect(() => {
    setTechOpen(false);
  }, [id]);

  return (
    <section className="agent-step-stage" aria-live="polite" data-active-step={id}>
      <header className="agent-step-head">
        <span>{meta.kicker}</span>
        <div className="agent-step-title-row">
          <h2>{meta.label}</h2>
          <button
            type="button"
            className={`agent-step-tech-btn${techOpen ? " on" : ""}`}
            aria-expanded={techOpen}
            onClick={() => setTechOpen((v) => !v)}
          >
            {techOpen ? "收起技术说明" : "技术说明"}
          </button>
        </div>
        <p className="agent-step-sub">
          {meta.sub}
          {prev ? ` · 上一口是「${prev}」` : " · 整条链路从这里开始"}
          {` · 做完交给「${next}」`}
        </p>
        <code>{meta.api}</code>
      </header>

      {techOpen && (
        <aside className="agent-step-tech" aria-label={`${meta.label}的技术说明`}>
          <b>用了什么技术</b>
          <ul className="agent-step-tech-stack">
            {tech.stack.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p>{tech.how}</p>
          <b>怎么做到的</b>
          <ul className="agent-step-tech-bits">
            {tech.bits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </aside>
      )}

      <div className="agent-step-brief">
        <div className="agent-step-purpose">
          <div>
            <b>做什么</b>
            <p>{meta.job}</p>
          </div>
          <div>
            <b>为了什么</b>
            <p>{meta.why}</p>
          </div>
          <div>
            <b>解决什么</b>
            <p>{meta.problem}</p>
          </div>
        </div>
        <p>{meta.explain}</p>
        <div className="agent-step-io">
          <div>
            <b>吃进去</b>
            <code>{meta.io.in}</code>
          </div>
          <div>
            <b>吐出来</b>
            <code>{meta.io.out}</code>
          </div>
        </div>
        <ul className="agent-step-points">
          {meta.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="agent-step-lab">
        <b>动手对照</b>
        <p>左边是没做好 / 做错的样子，点按钮看做对之后差在哪。这是帮助理解，不是把图改掉。</p>
        <StepPlay key={`${id}-${playTick}`} stepId={id} />
      </div>

      <div className="agent-step-lab">
        <b>这一步的实验室</b>
        {Lab ? <Lab /> : <Demo />}
      </div>
    </section>
  );
}
