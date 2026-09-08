import { useEffect, useState } from "react";
import { runRouterEvalAsync } from "../../lib/backendBridge";
import { ROUTER_EVAL_CASES, routerEvalSummary } from "../../lib/evalHarness";

/** Eval Lab 卡片预览 — 显示真实跑批数字 */
export function MiniEvalLive() {
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [pass, setPass] = useState(0);

  useEffect(() => {
    void runRouterEvalAsync().then((res) => {
      const s = routerEvalSummary(res.rows);
      setAccuracy(s.accuracy);
      setPass(s.pass);
    });
  }, []);

  return (
    <div className="mini-live mini-eval" onClick={(e) => e.stopPropagation()}>
      <div className="mini-live-head">
        <span className="live-pulse teaser">EVAL</span>
        <span className="mini-live-label">跑批评测</span>
      </div>
      <div className="mini-eval-body">
        <div className="mini-eval-score">
          <strong>{accuracy != null ? `${accuracy}%` : "…"}</strong>
          <span>Router 准确率</span>
        </div>
        <ul className="mini-eval-meta">
          <li>
            {pass}/{ROUTER_EVAL_CASES.length} 用例通过
          </li>
          <li>Skill 工具链 P50/P99</li>
          <li>失败样本可复现</li>
        </ul>
      </div>
    </div>
  );
}
