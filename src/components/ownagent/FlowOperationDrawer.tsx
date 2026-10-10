import { useCallback, useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

import type { OwnChatMessage } from "../../lib/ownagentSessions";

import type { WorkPaper } from "../../lib/workPaper";

import { paperDrawerTitle } from "../../lib/workPaper";

import {

  filterDrawerActions,

  flowActionNeedsCompletion,

  initialFlowValidation,

  type FlowUiValidation,

} from "../../lib/creditFlowUiGate";

import { CreditFlowActions, CreditFlowInteractive } from "./CreditFlowInteractive";

import { WorkPaperView } from "./WorkPaper";



type Flow = NonNullable<OwnChatMessage["showcaseFlow"]>;



export function FlowOperationDrawer({

  flow,

  paper,

  open,

  busy,

  onClose,

  onSend,

}: {

  flow: Flow | null;

  paper?: WorkPaper | null;

  open: boolean;

  busy?: boolean;

  onClose: () => void;

  onSend: (text: string) => void;

}) {

  const [validation, setValidation] = useState<FlowUiValidation>({ ready: true, hint: "" });

  const validationRef = useRef(validation);

  validationRef.current = validation;



  const onValidationChange = useCallback((v: FlowUiValidation) => {

    setValidation((prev) => (prev.ready === v.ready && prev.hint === v.hint ? prev : v));

  }, []);



  useEffect(() => {

    if (!open || !flow) return;

    onValidationChange(initialFlowValidation(flow.ui ?? null));

  }, [open, flow?.flowId, flow?.stepId, flow?.ui, onValidationChange]);



  useEffect(() => {

    if (!open) return;

    const onKey = (ev: KeyboardEvent) => {

      if (ev.key === "Escape") onClose();

    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);

  }, [open, onClose]);



  if (!open || !flow) return null;



  const needsGate = flowActionNeedsCompletion(flow.ui ?? null);

  const actions = filterDrawerActions(flow.actions, flow.ui ?? null);

  const canAct = !needsGate || validation.ready;

  const withPaper = Boolean(paper);

  const paperInteractive = flow.stepId === "contract_risks";



  const headTitle = withPaper

    ? paperDrawerTitle(paper!)

    : flow.title.replace(/^[^\s]+\s/u, "").trim() || flow.title;

  const headSub = withPaper

    ? "上方预览文书，下方完成核对与提交，无需关闭再开面板"

    : `${flow.phase ?? "信贷办理"} · 完成本步操作后，再点下方按钮推进流程`;



  return createPortal(

    <div className="oa-work-drawer-back oa-flow-drawer-back" onClick={onClose} role="presentation">

      <aside

        className={`oa-work-drawer oa-flow-drawer${withPaper ? " is-with-paper" : ""}`}

        onClick={(ev) => ev.stopPropagation()}

        aria-label={headTitle}

      >

        <header className="oa-work-drawer-head">

          <div>

            <strong>{headTitle}</strong>

            <p>{headSub}</p>

          </div>

          <button type="button" onClick={onClose} aria-label="关闭">

            ×

          </button>

        </header>

        <div className="oa-work-drawer-body oa-flow-drawer-body">

          {paper ? (

            <section className="oa-flow-drawer-paper" aria-label="文书预览">

              <WorkPaperView paper={paper} interactive={paperInteractive} />

            </section>

          ) : null}

          <section className="oa-flow-drawer-ops">

            <div className="oa-flow-drawer-intro">

              {flow.body.split("\n").map((line, i) => (

                <p key={i}>{line.replace(/\*\*(.+?)\*\*/g, "$1")}</p>

              ))}

            </div>

            {flow.ui ? (

              <CreditFlowInteractive

                ui={flow.ui}

                disabled={busy}

                panel

                onValidationChange={onValidationChange}

                onAutoAdvance={(sendAs) => {

                  if (needsGate && !validationRef.current.ready) return;

                  onSend(sendAs);

                }}

              />

            ) : null}

            {needsGate && !validation.ready && validation.hint ? (

              <p className="oa-flow-drawer-hint" role="status">

                {validation.hint}

              </p>

            ) : null}

            {actions.length ? (

              <CreditFlowActions

                actions={actions}

                disabled={busy || !canAct}

                onPick={(sendAs) => {
                  if (flow.ui?.kind === "submission_success" && sendAs === "继续") {
                    onClose();
                    return;
                  }
                  onSend(sendAs);
                  if (flow.ui?.kind === "submission_success") onClose();
                }}

              />

            ) : null}

          </section>

        </div>

      </aside>

    </div>,

    document.body,

  );

}

