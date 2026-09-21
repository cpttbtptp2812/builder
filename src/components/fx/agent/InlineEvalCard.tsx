import { policyEvalSummary, runPolicyEval } from "../../../lib/policyDesk";
import { routerEvalSummary, runRouterEval } from "../../../lib/evalHarness";
import type { InlineEvalView } from "../../../lib/chatFrontier";

export function runInlineEval(kind: "policy" | "router" = "policy"): InlineEvalView {
  if (kind === "router") {
    const rows = runRouterEval();
    const sum = routerEvalSummary(rows);
    return {
      kind: "router",
      accuracy: sum.accuracy,
      pass: rows.filter((r) => r.pass).length,
      total: rows.length,
      rows: rows.map((r) => ({
        id: r.id,
        query: r.query,
        pass: r.pass,
        detail: `期望 ${r.expectedSkillId} → ${r.predictedSkillId ?? "—"} (${r.predictedScore.toFixed(1)})`,
      })),
    };
  }
  const rows = runPolicyEval();
  const sum = policyEvalSummary(rows);
  return {
    kind: "policy",
    accuracy: sum.accuracy,
    pass: sum.pass,
    total: sum.total,
    leakedCommit: sum.leakedCommit,
    rows: rows.map((r) => ({
      id: r.id,
      query: r.query,
      pass: r.pass,
      detail: `${r.expectedCap}/${r.expectedOutcome} → ${r.predictedCap}/${r.predictedOutcome}`,
    })),
  };
}

/** 对话内评测卡 — 对齐理论 ctrl · 运行管控 */
export function InlineEvalCard({ eval: data }: { eval: InlineEvalView }) {
  return (
    <div className={`ua-eval ${data.accuracy >= 80 ? "ok" : "warn"}`}>
      <header>
        <strong>{data.kind === "policy" ? "制度评测" : "路由评测"}</strong>
        <span>{data.accuracy}% · {data.pass}/{data.total}</span>
      </header>
      {data.leakedCommit != null && data.leakedCommit > 0 && (
        <p className="ua-eval-leak">泄漏提交 {data.leakedCommit} 次（不应发生）</p>
      )}
      <ul>
        {data.rows.map((r) => (
          <li key={r.id} className={r.pass ? "pass" : "fail"}>
            <code>{r.id}</code>
            <span>{r.query}</span>
            <em>{r.detail}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
