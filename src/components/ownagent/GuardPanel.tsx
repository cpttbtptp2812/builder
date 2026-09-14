import { useMemo, useState } from "react";
import {
  classifyCapability,
  listTickets,
  policyEvalSummary,
  resolveTicket,
  runPolicyDesk,
  runPolicyEval,
  type PolicyDeskResult,
} from "../../lib/policyDesk";

const PRESETS = [
  "满一年年假几天",
  "有人说年假 5 天也有人说 10 天",
  "加班能不能抵年假",
  "帮我开通公司 VPN",
  "公司什么时候上市",
];

/** OwnAgent · 能力锁 — 问句先分流，改权限只预演 */
export function GuardPanel() {
  const [query, setQuery] = useState(PRESETS[0]!);
  const [result, setResult] = useState<PolicyDeskResult | null>(() => runPolicyDesk(PRESETS[0]!));
  const [evalRows, setEvalRows] = useState(() => runPolicyEval());
  const [tickets, setTickets] = useState(() => listTickets());

  const envelope = useMemo(() => classifyCapability(query), [query]);
  const summary = useMemo(() => policyEvalSummary(evalRows), [evalRows]);

  function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setResult(runPolicyDesk(text));
    setTickets(listTickets());
    setEvalRows(runPolicyEval());
  }

  function decide(id: string, status: "allowed" | "denied") {
    resolveTicket(id, status);
    setTickets(listTickets());
    if (result?.ticket?.id === id) {
      setResult({
        ...result,
        ticket: { ...result.ticket, status },
        outcome: status === "allowed" ? "COMMITTED" : "NEEDS_HITL",
        markdown:
          status === "allowed"
            ? `${result.markdown}\n\n人工已允许，工单 ${id} 才提交。对话里没有直接开通。`
            : `${result.markdown}\n\n人工已拒绝，工单作废。`,
      });
    }
  }

  return (
    <div className="own-panel own-guard">
      <p className="own-panel-lead">
        问句先锁能力：<strong>只读 / 只许起草 / 直接拒绝</strong>。
        制度答案必须带条款编号；开通 VPN 只出工单，人点允许才提交。
      </p>

      <div className="own-guard-caps">
        <span className={`own-guard-chip ${envelope.cap}`}>{envelope.cap}</span>
        <em>{envelope.reason}</em>
      </div>

      <div className="agent-trace-input-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="满一年年假几天 / 帮我开通 VPN"
          onKeyDown={(e) => {
            if (e.key === "Enter") run(query);
          }}
        />
        <button type="button" className="agent-trace-send" onClick={() => run(query)}>
          跑一遍
        </button>
      </div>
      <div className="agent-trace-quick">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => run(p)}>
            {p}
          </button>
        ))}
      </div>

      {result ? (
        <div className="own-guard-result">
          <p className="own-guard-outcome">
            结果码 <code>{result.outcome}</code>
            {result.ticket ? (
              <>
                {" "}
                · 工单 <code>{result.ticket.id}</code> · {result.ticket.status}
              </>
            ) : null}
          </p>
          <pre>{result.markdown}</pre>
          {result.citations.length > 0 ? (
            <ul className="own-guard-cites">
              {result.citations.map((c) => (
                <li key={c.id}>
                  <code>{c.id}</code> {c.text}
                </li>
              ))}
            </ul>
          ) : null}
          {result.ticket?.status === "draft" ? (
            <div className="own-guard-hitl">
              <button type="button" onClick={() => decide(result.ticket!.id, "allowed")}>
                允许提交
              </button>
              <button type="button" className="ghost" onClick={() => decide(result.ticket!.id, "denied")}>
                拒绝
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="own-guard-eval">
        <h4>
          评测 {summary.pass}/{summary.total} · 对话里误开通 {summary.leakedCommit}
        </h4>
        <ul>
          {evalRows.map((row) => (
            <li key={row.id} className={row.pass ? "pass" : "fail"}>
              <strong>{row.query}</strong>
              <span>
                {row.expectedCap}/{row.expectedOutcome} → {row.predictedCap}/{row.predictedOutcome}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {tickets.length > 0 ? (
        <p className="own-guard-tickets">
          工单队列：{tickets.map((t) => `${t.id} ${t.status}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
