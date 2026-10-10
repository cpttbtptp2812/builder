import { memo } from "react";

import type { OwnChatMessage } from "../../lib/ownagentSessions";

import { flowUiRequiresDrawer, flowUsesUnifiedHubDrawer } from "../../lib/creditFlowUiGate";

import { CreditFlowActions, CreditFlowInteractive } from "./CreditFlowInteractive";



type Flow = NonNullable<OwnChatMessage["showcaseFlow"]>;



function FlowProgressRail({
  flow,
  live,
  onSelectStage,
}: {
  flow: Flow;
  live?: boolean;
  onSelectStage?: (rawIndex: number) => void;
}) {
  const items = flow.progress ?? [];
  const stages = flow.stages ?? [];
  const stepIndex = flow.stepIndex ?? 0;
  const stepTotal = flow.stepTotal ?? 0;
  const pct =
    stepTotal > 0 ? Math.min(100, Math.round((stepIndex / stepTotal) * 100)) : live ? 35 : 0;

  return (
    <div className={`oa-flow-rail${live ? " is-live" : ""}`}>
      <div className="oa-flow-rail-head">
        <span>
          步骤 {stepIndex}/{stepTotal || "—"}
        </span>
        {live ? <em>处理中…</em> : pct ? <em>{pct}%</em> : null}
      </div>
      <div className="oa-flow-rail-track" aria-hidden>
        <div className="oa-flow-rail-fill" style={{ width: `${live ? Math.max(pct, 18) : pct}%` }} />
      </div>
      {stages.length ? (
        <div className="oa-flow-stage-row" role="tablist" aria-label="流程阶段">
          {stages.map((s) => {
            const clickable = s.status !== "pending" && !!onSelectStage;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.status === "active"}
                disabled={!clickable}
                className={`oa-flow-stage-chip is-${s.status}`}
                onClick={() => clickable && onSelectStage?.(s.rawIndex)}
              >
                {s.status === "done" ? "✓" : s.status === "active" ? "●" : "○"} {s.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {items.length ? (
        <ul className="oa-flow-rail-steps">
          {items.map((p) => (
            <li key={p.id} className={`is-${p.status}`}>
              {p.status === "done" ? "✓" : "·"} {p.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}



export const ShowcaseFlowBubble = memo(function ShowcaseFlowBubble({

  flow,

  onFlowSend,

  flowBusy,

  onOpenDrawer,

  drawerOpen,

  liveProgress,
  onSelectStage,
  hubMode,
}: {
  flow: Flow;
  onFlowSend?: (text: string) => void;
  flowBusy?: boolean;
  onOpenDrawer?: () => void;
  drawerOpen?: boolean;
  /** 同一张卡片上展示进行中的拉取/校验动画 */
  liveProgress?: boolean;
  /** 点击阶段条回到已到达步骤 */
  onSelectStage?: (rawIndex: number) => void;
  hubMode?: boolean;
}) {

  const tone = flow.tone ?? "info";

  const inDrawer = hubMode
    ? flowUsesUnifiedHubDrawer(flow.flowId, flow.stepId, flow.ui ?? null)
    : flowUiRequiresDrawer(flow.ui ?? null);

  const inlineUi = flow.ui && !inDrawer ? flow.ui : null;

  const inlineActions = inDrawer ? [] : (flow.actions ?? []);

  const showRail = liveProgress || (flow.progress?.length ?? 0) > 0 || (flow.stepTotal ?? 0) > 0;



  return (

    <div className={`oa-showcase-flow is-${tone}${inDrawer ? " is-drawer-step" : ""}`}>

      <header>

        <div className="oa-showcase-flow-title">

          <span className="oa-showcase-flow-badge" aria-hidden>

            流程

          </span>

          <strong>{flow.title}</strong>

        </div>

        {flow.phase ? <span className="oa-showcase-flow-phase">{flow.phase}</span> : null}

      </header>

      {showRail ? (
        <FlowProgressRail flow={flow} live={liveProgress} onSelectStage={onSelectStage} />
      ) : null}

      <div className="oa-showcase-flow-body">

        {flow.body.split("\n").map((line, i) => (

          <p key={i}>{line.replace(/\*\*(.+?)\*\*/g, "$1")}</p>

        ))}

        {inDrawer ? (

          <div className="oa-showcase-flow-drawer-cta">

            <p className="oa-showcase-flow-drawer-lead">
              本步在右侧办理面板完成预览与操作（合同与核对同一侧栏），再点面板内按钮推进。
            </p>

            <button

              type="button"

              className={`oa-flow-action primary${drawerOpen ? " is-active" : ""}`}

              onClick={() => onOpenDrawer?.()}

            >

              {drawerOpen ? "办理面板已打开" : "打开办理面板"}

            </button>

          </div>

        ) : null}

        {inlineUi ? (

          <CreditFlowInteractive

            ui={inlineUi}

            disabled={flowBusy}

            onAutoAdvance={(sendAs) => onFlowSend?.(sendAs)}

          />

        ) : null}

        {inlineActions.length ? (

          <CreditFlowActions

            actions={inlineActions}

            disabled={flowBusy || liveProgress}

            onPick={(sendAs) => onFlowSend?.(sendAs)}

          />

        ) : null}

      </div>

    </div>

  );

});


