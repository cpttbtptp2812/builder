import { useState, type CSSProperties } from "react";
import { getStep, type StepId } from "./registry";
import { STEP_PLAYS, type StepPlaySpec } from "./stepPlays";

export function StepPlay({ stepId }: { stepId: StepId }) {
  const spec = STEP_PLAYS[stepId];
  const meta = getStep(stepId);
  const [on, setOn] = useState(false);

  return (
    <div className={`step-play kind-${spec.kind}${on ? " is-on" : " is-off"}`} style={{ "--play": meta.color } as CSSProperties}>
      <p className="step-play-ask">{spec.ask}</p>
      <PlayBody spec={spec} on={on} />
      <div className="step-play-io">
        <div className={on ? "" : "is-bad"}>
          <b>{spec.offLabel}</b>
          <code>{spec.left}</code>
        </div>
        <div className={on ? "is-ok" : ""}>
          <b>{spec.onLabel}</b>
          <code>{on ? spec.right : "点下面按钮才出现"}</code>
        </div>
      </div>
      <p className="step-play-why">{spec.why}</p>
      <div className="step-play-actions">
        <button type="button" className={on ? "ghost" : "go"} onClick={() => setOn((v) => !v)}>
          {on ? spec.reset : spec.cta}
        </button>
      </div>
    </div>
  );
}

function PlayBody({ spec, on }: { spec: StepPlaySpec; on: boolean }) {
  switch (spec.kind) {
    case "stall":
      return (
        <ol className="step-play-beats">
          {(spec.chips ?? []).map((c, i) => (
            <li key={c} data-state={!on && i === 1 ? "stuck" : on || i === 0 ? "done" : "wait"}>
              <b>{c}</b>
              <span>{!on && i === 1 ? "停在这里" : i === 0 ? "已做" : on ? "已通过" : "还没到"}</span>
            </li>
          ))}
        </ol>
      );
    case "duel":
      return (
        <div className="step-play-duel">
          {(spec.scores ?? []).map((s) => {
            const w = on ? s.b : s.a;
            return (
              <div key={s.name}>
                <span>
                  {s.name} <em>{(w / 100).toFixed(2)}</em>
                </span>
                <i>
                  <b style={{ width: `${w}%` }} />
                </i>
              </div>
            );
          })}
        </div>
      );
    case "fill":
    case "lock":
      return (
        <ul className="step-play-slots">
          {(spec.slots ?? []).map((s) => (
            <li key={s.k} data-on={on ? "1" : "0"}>
              <em>{s.k}</em>
              <strong>{on ? s.filled : s.empty}</strong>
            </li>
          ))}
        </ul>
      );
    case "split":
      return (
        <div className={`step-play-split${on ? " is-on" : ""}`}>
          {(spec.chips ?? []).map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      );
    case "overflow":
      return (
        <div className="step-play-bar" data-on={on ? "1" : "0"}>
          <i style={{ width: on ? "46%" : "100%" }} />
          <em>{on ? "3680 / 8000" : "8120 / 8000 爆了"}</em>
        </div>
      );
    case "versus":
      return (
        <div className="step-play-versus">
          <div className={!on ? "is-bad" : ""}>
            <b>没有这一步</b>
            <p>{spec.left}</p>
          </div>
          <div className={on ? "is-ok" : "is-dim"}>
            <b>做了这一步</b>
            <p>{spec.right}</p>
          </div>
        </div>
      );
    case "race":
      return (
        <div key={on ? "par" : "seq"} className="step-play-race" data-on={on ? "1" : "0"}>
          {(spec.tracks ?? []).map((t, i) => (
            <div key={t.name}>
              <span>{t.name}</span>
              <i>
                <b style={{ animationDelay: on ? "0s" : `${i * 1.05}s` }} />
              </i>
            </div>
          ))}
        </div>
      );
    case "retry":
      return (
        <ul className="step-play-retry">
          {(spec.chips ?? []).map((c, i) => {
            const fail = c.includes("超时");
            const state = !on ? "dead" : fail ? "retry" : "ok";
            return (
              <li key={c} data-state={state}>
                {c}
                {state === "retry" && <em>重试</em>}
              </li>
            );
          })}
        </ul>
      );
    case "blur":
      return (
        <div className={`step-play-shot${on ? " is-on" : ""}`}>
          <div>
            <span />
            <span />
            <span />
          </div>
          <p>{on ? "真按钮齐了" : "还在转圈"}</p>
        </div>
      );
    case "gate":
      return (
        <div className={`step-play-gate${on ? " is-on" : ""}`}>
          <code>{on ? "http_probe" : "probe"}</code>
          <span>{on ? "→" : "×"}</span>
          <code>runtime</code>
        </div>
      );
    default:
      return null;
  }
}
