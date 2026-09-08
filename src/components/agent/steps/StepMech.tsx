import { useMemo, useState } from "react";
import { StepShell } from "./StepShell";

const TEMPLATES = {
  url: "${origin}${path}",
  method: "HEAD",
  query: "${title}",
};

export function StepMech() {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const title = typeof window !== "undefined" ? document.title : "page";
  const [vars, setVars] = useState({ origin, path, title });
  const [phase, setPhase] = useState<"bound" | "sandboxed" | "hitl" | "done">("bound");

  const injected = useMemo(
    () => ({
      url: TEMPLATES.url.replace("${origin}", vars.origin).replace("${path}", vars.path),
      method: TEMPLATES.method,
      query: TEMPLATES.query.replace("${title}", vars.title),
    }),
    [vars],
  );

  return (
    <StepShell id="mech">
      <div className="agent-step-vars">
        {(["origin", "path", "title"] as const).map((k) => (
          <label key={k}>
            {k}
            <input value={vars[k]} onChange={(e) => setVars((v) => ({ ...v, [k]: e.target.value }))} />
          </label>
        ))}
      </div>
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>key</th>
            <th>template</th>
            <th>injected</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(TEMPLATES).map(([key, tpl]) => (
            <tr key={key}>
              <td>
                <code>{key}</code>
              </td>
              <td>
                <code>{tpl}</code>
              </td>
              <td>
                <code>{injected[key as keyof typeof injected]}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="agent-step-sample">sandbox = {phase}</p>
      <div className="agent-step-actions">
        <button
          type="button"
          onClick={() => {
            setPhase("sandboxed");
            window.setTimeout(() => setPhase("hitl"), 400);
          }}
        >
          sandbox.call()
        </button>
        <button type="button" disabled={phase !== "hitl"} onClick={() => setPhase("done")}>
          HITL 放行
        </button>
        <button type="button" onClick={() => setPhase("bound")}>
          reset
        </button>
      </div>
    </StepShell>
  );
}
