import { useMemo, useState } from "react";
import { StepShell } from "./StepShell";

const FIELDS = ["origin", "path", "title", "readyState"] as const;

export function StepContext() {
  const page =
    typeof window !== "undefined"
      ? {
          origin: window.location.origin,
          path: window.location.hash || window.location.pathname,
          title: document.title,
          readyState: document.readyState,
        }
      : { origin: "—", path: "—", title: "—", readyState: "—" };
  const [on, setOn] = useState<Record<(typeof FIELDS)[number], boolean>>({
    origin: true,
    path: true,
    title: true,
    readyState: false,
  });
  const [budget, setBudget] = useState(2048);
  const reserved = 512;
  const used = useMemo(() => {
    const picked: Record<string, string> = {};
    for (const k of FIELDS) if (on[k]) picked[k] = page[k];
    return JSON.stringify(picked).length;
  }, [on, page]);

  return (
    <StepShell id="context">
      <label className="agent-step-slider">
        token budget {budget}
        <input type="range" min={256} max={4096} step={128} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
      </label>
      <dl className="agent-step-dl">
        {FIELDS.map((k) => (
          <div key={k}>
            <dt>
              <label>
                <input
                  type="checkbox"
                  checked={on[k]}
                  onChange={() => setOn((prev) => ({ ...prev, [k]: !prev[k] }))}
                />
                {k}
              </label>
            </dt>
            <dd>{on[k] ? page[k] : "— 已裁掉"}</dd>
          </div>
        ))}
        <div>
          <dt>budget</dt>
          <dd>
            used {used} / max {budget} · reservedForTools {reserved} · 剩余 {Math.max(0, budget - reserved - used)}
          </dd>
        </div>
      </dl>
    </StepShell>
  );
}
