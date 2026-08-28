import { useEffect, useRef, useState } from "react";
import { REPLAY_STEPS } from "../../data/scenarios";
import { useStore } from "../../store";

type LogLine = { api: string; ok: boolean; ts: number };

const TARGET_ATTR: Record<string, string> = {
  "nav.products": "products",
  "table.sku-list": "sku-list",
  "input.price": "price",
  "button.submit": "submit",
};

/** 真实 DOM 回放 — 产品模式强调技术 + 逐步视觉冲击 */
export function RealDomReplay({ productMode = false }: { productMode?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const replayActive = useStore((s) => s.replayActive);
  const replayStep = useStore((s) => s.replayStep);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [price, setPrice] = useState("¥99");
  const [currentApi, setCurrentApi] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; w: number; h: number } | null>(null);
  const prevStep = useRef(-1);

  useEffect(() => {
    if (!replayActive || replayStep === prevStep.current) return;
    prevStep.current = replayStep;
    void runStep(replayStep);
  }, [replayActive, replayStep]);

  useEffect(() => {
    if (!replayActive) {
      prevStep.current = -1;
      setLogs([]);
      setPrice("¥99");
      setCurrentApi(null);
      setSubmitted(false);
      setSpotlight(null);
      rootRef.current?.querySelectorAll(".replay-active").forEach((el) => {
        el.classList.remove("replay-active");
      });
    }
  }, [replayActive]);

  function push(api: string, ok: boolean) {
    setCurrentApi(api);
    setLogs((prev) => [...prev, { api, ok, ts: Date.now() }]);
  }

  function highlightEl(el: Element) {
    el.classList.add("replay-active");
    const root = rootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setSpotlight({
      top: rect.top - rootRect.top,
      left: rect.left - rootRect.left,
      w: rect.width,
      h: rect.height,
    });
  }

  async function runStep(idx: number) {
    const root = rootRef.current;
    const step = REPLAY_STEPS[idx];
    if (!root || !step) return;

    root.querySelectorAll(".replay-active").forEach((el) => el.classList.remove("replay-active"));

    const attr = TARGET_ATTR[step.selector] ?? "";
    const sel = `[data-replay="${attr}"]`;
    const el = root.querySelector(sel);
    push(`document.querySelector("${sel}")`, !!el);
    if (!el) return;

    await pause(350);
    highlightEl(el);
    push(`element.scrollIntoView({ block: "center", behavior: "smooth" })`, true);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await pause(500);

    if (attr === "price") {
      const input = el.querySelector("input");
      if (input instanceof HTMLInputElement) {
        input.classList.add("replay-typing");
        push("input.focus()", true);
        await pause(250);
        setPrice("¥1");
        await pause(120);
        setPrice("¥12");
        await pause(120);
        setPrice("¥129");
        input.classList.remove("replay-typing");
        push('input.dispatchEvent(new InputEvent("input", { bubbles: true }))', true);
      }
    }

    if (attr === "submit" && el instanceof HTMLButtonElement) {
      el.classList.add("replay-clicking");
      push('button.dispatchEvent(new MouseEvent("click", { bubbles: true }))', true);
      await pause(400);
      el.classList.remove("replay-clicking");
      setSubmitted(true);
      push('await fetch("/api/sku/price") → 200 OK', true);
    }
  }

  return (
    <aside className={`real-replay ${productMode ? "product" : ""}`}>
      <header>
        <div>
          <h2>{productMode ? "浏览器自动化回放" : "ReplaySDK · 真实 DOM API"}</h2>
          {productMode && (
            <p className="real-replay-sub">ReplaySDK 注入目标 Tab · querySelector / scrollIntoView / dispatchEvent</p>
          )}
        </div>
        <span className={`replay-badge ${replayActive ? "live" : submitted ? "done" : ""}`}>
          {replayActive ? `STEP ${replayStep + 1}/${REPLAY_STEPS.length}` : submitted ? "✓ 完成" : "idle"}
        </span>
      </header>

      {productMode && (
        <div className="replay-step-rail">
          {REPLAY_STEPS.map((s, i) => (
            <div
              key={s.selector}
              className={`replay-step-pill ${replayActive && i === replayStep ? "active" : ""} ${(replayActive && i < replayStep) || submitted ? "done" : ""}`}
            >
              <span>{i + 1}</span>
              <em>{s.label}</em>
            </div>
          ))}
        </div>
      )}

      {productMode && currentApi && replayActive && (
        <div className="replay-api-flash" key={currentApi}>
          <span className="replay-api-tag">LIVE API</span>
          <code>{currentApi}</code>
        </div>
      )}

      <div className="real-replay-body">
        <div className={`real-replay-shell ${replayActive ? "running" : ""}`} ref={rootRef}>
          {spotlight && replayActive && (
            <div
              className="replay-spotlight-ring"
              style={{
                top: spotlight.top - 4,
                left: spotlight.left - 4,
                width: spotlight.w + 8,
                height: spotlight.h + 8,
              }}
            />
          )}
          <div className="mock-chrome">
            <i /><i /><i />
            <span>merchant.example.com / sku</span>
            {replayActive && <em className="replay-chrome-live">ReplaySDK executing</em>}
          </div>
          <div className={`real-replay-page ${replayActive ? "dim-idle" : ""}`}>
            <nav data-replay="products" className="mock-nav">商品管理</nav>
            <table data-replay="sku-list" className="mock-table">
              <thead><tr><th>SKU</th><th>价格</th></tr></thead>
              <tbody>
                <tr className={price !== "¥99" ? "price-updated" : ""}>
                  <td>A-1024</td>
                  <td>
                    <strong>{price}</strong>
                    {price !== "¥99" && <span className="price-badge">已改</span>}
                  </td>
                </tr>
              </tbody>
            </table>
            <label data-replay="price" className="mock-field">
              新价格
              <input className="price" value={price} readOnly />
            </label>
            <button
              type="button"
              data-replay="submit"
              className={`mock-btn submit ${submitted ? "success" : ""}`}
            >
              {submitted ? "✓ 提交成功" : "提交改价"}
            </button>
          </div>
        </div>

        {productMode ? (
          <div className="replay-tech-live">
            <header>
              <strong>技术事件流</strong>
              <span>每步对应真实 Web API</span>
            </header>
            <ol className="replay-tech-steps">
              {REPLAY_STEPS.map((s, i) => (
                <li
                  key={s.selector}
                  className={replayActive && i === replayStep ? "active" : i < replayStep || submitted ? "done" : ""}
                >
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>
            <pre className="replay-tech-log">
              {logs.length === 0 && !replayActive && (
                <span className="dim">选择工作流后自动执行，API 逐步打出…</span>
              )}
              {logs.map((l) => (
                <div key={l.ts} className={`replay-log-line ${l.ok ? "ok" : "fail"}`}>
                  {l.ok ? "✓" : "✗"} {l.api}
                </div>
              ))}
            </pre>
          </div>
        ) : (
          <div className="real-replay-log">
            <span className="tech-badge sm">scrollIntoView · dispatchEvent</span>
            <pre>
              {logs.map((l) => (
                <div key={l.ts} className={l.ok ? "ok" : "fail"}>
                  {l.ok ? "✓" : "✗"} {l.api}
                </div>
              ))}
              {logs.length === 0 && <span className="dim">等待 runProcess()…</span>}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
}

function pause(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}
