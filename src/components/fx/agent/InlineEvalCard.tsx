import { policyEvalSummary, runPolicyEval } from "../../../lib/policyDesk";
import { routerEvalSummary, runRouterEval } from "../../../lib/evalHarness";
import { runPolicyEvalAsync, runRouterEvalAsync } from "../../../lib/backendBridge";
import { peekRuntimeConfig } from "../../../lib/runtimeConfig";
import type { InlineEvalView } from "../../../lib/chatFrontier";

function toInlineView(
  kind: "policy" | "router",
  rows: Array<{ id: string; query: string; pass: boolean; detail: string }>,
  accuracy: number,
  pass: number,
  total: number,
  leakedCommit?: number,
  runtime?: "server" | "local",
): InlineEvalView {
  return {
    kind,
    accuracy,
    pass,
    total,
    leakedCommit,
    rows,
    runtime,
  };
}

export async function runInlineEvalAsync(kind: "policy" | "router" = "policy"): Promise<InlineEvalView> {
  const preferServer = peekRuntimeConfig().features.preferServerEval;

  if (kind === "router") {
    const res = preferServer ? await runRouterEvalAsync() : { rows: runRouterEval(), runtime: "local" as const };
    const sum = routerEvalSummary(res.rows);
    return toInlineView(
      "router",
      res.rows.map((r) => ({
        id: r.id,
        query: r.query,
        pass: r.pass,
        detail: `期望 ${r.expectedSkillId} → ${r.predictedSkillId ?? "—"} (${r.predictedScore.toFixed(1)})`,
      })),
      sum.accuracy,
      res.rows.filter((r) => r.pass).length,
      res.rows.length,
      undefined,
      res.runtime,
    );
  }

  const res = preferServer
    ? await runPolicyEvalAsync()
    : { rows: runPolicyEval(), summary: policyEvalSummary(runPolicyEval()), runtime: "local" as const };
  return toInlineView(
    "policy",
    res.rows.map((r) => ({
      id: r.id,
      query: r.query,
      pass: r.pass,
      detail: `${r.expectedCap}/${r.expectedOutcome} → ${r.predictedCap}/${r.predictedOutcome}`,
    })),
    res.summary.accuracy,
    res.summary.pass,
    res.summary.total,
    res.summary.leakedCommit,
    res.runtime,
  );
}

/** 同步回退（无后端时） */
export function runInlineEval(kind: "policy" | "router" = "policy"): InlineEvalView {
  if (kind === "router") {
    const rows = runRouterEval();
    const sum = routerEvalSummary(rows);
    return toInlineView(
      "router",
      rows.map((r) => ({
        id: r.id,
        query: r.query,
        pass: r.pass,
        detail: `期望 ${r.expectedSkillId} → ${r.predictedSkillId ?? "—"} (${r.predictedScore.toFixed(1)})`,
      })),
      sum.accuracy,
      rows.filter((r) => r.pass).length,
      rows.length,
      undefined,
      "local",
    );
  }
  const rows = runPolicyEval();
  const sum = policyEvalSummary(rows);
  return toInlineView(
    "policy",
    rows.map((r) => ({
      id: r.id,
      query: r.query,
      pass: r.pass,
      detail: `${r.expectedCap}/${r.expectedOutcome} → ${r.predictedCap}/${r.predictedOutcome}`,
    })),
    sum.accuracy,
    sum.pass,
    sum.total,
    sum.leakedCommit,
    "local",
  );
}

/** 对话内评测卡 — Router / Policy 回归 */
export function InlineEvalCard({ eval: data }: { eval: InlineEvalView }) {
  return (
    <div className={`ua-eval ${data.accuracy >= 80 ? "ok" : "warn"}`}>
      <header>
        <strong>{data.kind === "policy" ? "制度评测" : "路由评测"}</strong>
        <span>
          {data.accuracy}% · {data.pass}/{data.total}
          {data.runtime ? ` · ${data.runtime === "server" ? "SQLite API" : "浏览器"}` : ""}
        </span>
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
