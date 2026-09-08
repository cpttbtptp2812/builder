import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { runRouterEvalAsync, runSkillBenchmarkAsync } from "../../lib/backendBridge";
import {
  ROUTER_EVAL_CASES,
  routerEvalSummary,
  type RouterEvalRow,
  type ToolMetrics,
} from "../../lib/evalHarness";

type Props = {
  compact?: boolean;
};

/** Agent 评测跑批 — Router 回归 + Skill 工具链压测 */
export function EvalLabPanel({ compact = false }: Props) {
  const [evalRows, setEvalRows] = useState<RouterEvalRow[]>([]);
  const [toolMetrics, setToolMetrics] = useState<ToolMetrics | null>(null);
  const [runtime, setRuntime] = useState<"server" | "local">("local");
  const [running, setRunning] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);

  const summary = useMemo(() => routerEvalSummary(evalRows), [evalRows]);
  const fails = useMemo(() => evalRows.filter((r) => !r.pass), [evalRows]);

  const runRouter = useCallback(async () => {
    setRunning(true);
    try {
      const res = await runRouterEvalAsync();
      setEvalRows(res.rows);
      setRuntime(res.runtime);
    } finally {
      setRunning(false);
    }
  }, []);

  const runBenchmark = useCallback(async () => {
    setBenchRunning(true);
    try {
      const bench = await runSkillBenchmarkAsync();
      if (bench) {
        setToolMetrics(bench.metrics);
        setRuntime(bench.runtime);
      }
    } finally {
      setBenchRunning(false);
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    setBenchRunning(true);
    try {
      const [routerRes, bench] = await Promise.all([runRouterEvalAsync(), runSkillBenchmarkAsync()]);
      setEvalRows(routerRes.rows);
      setRuntime(routerRes.runtime);
      if (bench) setToolMetrics(bench.metrics);
    } finally {
      setRunning(false);
      setBenchRunning(false);
    }
  }, []);

  useEffect(() => {
    void runRouter();
  }, [runRouter]);

  return (
    <div className={`eval-lab${compact ? " eval-lab--compact" : ""}`}>
      <header className="eval-lab-head">
        <div>
          <p className="eval-lab-eyebrow">Skill 路由</p>
          <h3>Router 回归 + 工具链压测</h3>
          <p className="eval-lab-desc">
            {ROUTER_EVAL_CASES.length} 条固定用例，批量检查 Skill 路由是否正确，并统计工具调用延迟。
          </p>
        </div>
        <span className="eval-lab-runtime">{runtime === "server" ? "SQLite 服务端" : "浏览器离线"}</span>
      </header>

      <div className="platform-eval-cards eval-lab-metrics">
        <div className={`platform-eval-card ${summary.accuracy >= 80 ? "ok" : "warn"}`}>
          <span>Router 准确率</span>
          <strong>{evalRows.length ? `${summary.accuracy}%` : "—"}</strong>
          <em>
            {summary.pass}/{summary.total} 通过
          </em>
        </div>
        <div className="platform-eval-card">
          <span>平均路由分</span>
          <strong>{evalRows.length ? summary.avgScore : "—"}</strong>
          <em>explainDiscovery</em>
        </div>
        {toolMetrics ? (
          <>
            <div className="platform-eval-card ok">
              <span>工具成功率</span>
              <strong>{toolMetrics.successRate}%</strong>
              <em>{toolMetrics.totalCalls} 次调用</em>
            </div>
            <div className="platform-eval-card">
              <span>延迟 P50 / P99</span>
              <strong>
                {toolMetrics.p50Ms} / {toolMetrics.p99Ms}
              </strong>
              <em>ms · Skill Benchmark</em>
            </div>
          </>
        ) : (
          <div className="platform-eval-card">
            <span>工具链压测</span>
            <strong>未跑</strong>
            <em>跑全量评测一并执行</em>
          </div>
        )}
      </div>

      <div className="eval-lab-actions">
        <button type="button" className="eval-lab-btn primary" onClick={() => void runAll()} disabled={running || benchRunning}>
          {running || benchRunning ? "运行中…" : "运行全部用例"}
        </button>
        <button type="button" className="eval-lab-btn" onClick={() => void runRouter()} disabled={running}>
          ↻ Router 回归
        </button>
        <button type="button" className="eval-lab-btn" onClick={() => void runBenchmark()} disabled={benchRunning}>
          Skill 压测
        </button>
      </div>

      {fails.length > 0 && (
        <section className="eval-lab-fails">
          <h4>失败样本 ({fails.length})</h4>
          <ul>
            {fails.map((row) => (
              <li key={row.id}>
                <strong>{row.query}</strong>
                <span>
                  期望 <code>{row.expectedSkillId}</code> → 实际 <code>{row.predictedSkillId ?? "—"}</code>
                </span>
                {row.note && <em>{row.note}</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && (
        <details className="platform-details eval-lab-table-wrap" open={fails.length > 0}>
          <summary>全部 {ROUTER_EVAL_CASES.length} 条用例</summary>
          <table className="platform-eval-table">
            <thead>
              <tr>
                <th>输入</th>
                <th>期望 Skill</th>
                <th>实际</th>
                <th>分数</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {evalRows.map((row) => (
                <tr key={row.id} className={row.pass ? "pass" : "fail"}>
                  <td>{row.query}</td>
                  <td>
                    <code>{row.expectedSkillId}</code>
                  </td>
                  <td>
                    <code>{row.predictedSkillId ?? "—"}</code>
                  </td>
                  <td>{row.predictedScore.toFixed(2)}</td>
                  <td>{row.pass ? "✓" : "✗"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {compact && (
        <p className="eval-lab-more">
          <Link to="/work/dev-debug?tab=eval">打开完整路由测试 →</Link>
        </p>
      )}
    </div>
  );

}
