import type { PolicyTrustView } from "../../../lib/chatFrontier";

const CAP_LABEL: Record<PolicyTrustView["cap"], string> = {
  read: "查询",
  mutate: "需审批",
  abstain: "无法回答",
};

const OUTCOME_LABEL: Record<PolicyTrustView["outcome"], string> = {
  GROUNDED: "已核对出处",
  POLICY_CONFLICT: "存在冲突",
  NEEDS_HITL: "待人工确认",
  COMMITTED: "已提交",
  REFUSED: "已拒绝回答",
};

/** 出处与能力说明 — 客户可读 */
export function PolicyTrustCard({ trust }: { trust: PolicyTrustView }) {
  const conflict = trust.outcome === "POLICY_CONFLICT";
  const refused = trust.outcome === "REFUSED";

  return (
    <div className={`ua-trust ${trust.outcome.toLowerCase()}`}>
      <header>
        <div className="ua-trust-badges">
          <span className={`ua-cap ${trust.cap}`}>{CAP_LABEL[trust.cap]}</span>
          <span className="ua-outcome">{OUTCOME_LABEL[trust.outcome]}</span>
        </div>
        <em>{trust.reason}</em>
      </header>

      {conflict && (
        <div className="ua-conflict">
          <strong>条款冲突</strong>
          <p>同一条件下存在不同取值，已分别列出，不会合并成一句结论。请人工裁决。</p>
        </div>
      )}

      {refused && (
        <div className="ua-refuse">
          <strong>超出制度范围</strong>
          <p>手册未收录该类事实，系统不会猜测或编造。</p>
        </div>
      )}

      {trust.citations.length > 0 && (
        <ul className="ua-citations">
          {trust.citations.map((c) => (
            <li key={c.id} className={c.status === "abolished" ? "abolished" : ""}>
              <code>{c.id}</code>
              {c.status === "abolished" && <em>已废止</em>}
              {c.value != null && c.status !== "abolished" && <em>{c.value}</em>}
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
