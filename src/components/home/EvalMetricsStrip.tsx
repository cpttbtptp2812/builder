import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { runRouterEvalAsync } from "../../lib/backendBridge";
import { ROUTER_EVAL_CASES, routerEvalSummary } from "../../lib/evalHarness";

/** 首页实时评测条 — 突出「有数字」而非假 Demo */
export function EvalMetricsStrip() {
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [pass, setPass] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void runRouterEvalAsync().then((res) => {
      if (cancelled) return;
      const s = routerEvalSummary(res.rows);
      setAccuracy(s.accuracy);
      setPass(s.pass);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="eval-metrics-strip" aria-label="Agent 评测指标">
      <div className="eval-metrics-strip-inner">
        <span className="eval-metrics-label">Eval Lab · 实时跑批</span>
        <strong className="eval-metrics-value">
          {loading ? "…" : accuracy != null ? `${accuracy}%` : "—"}
        </strong>
        <span className="eval-metrics-sub">
          Router 准确率 · {pass}/{ROUTER_EVAL_CASES.length} 通过
        </span>
        <Link to="/work/eval" className="eval-metrics-link">
          打开评测 →
        </Link>
      </div>
    </aside>
  );
}
