import type { FlowEvidence } from "../../../lib/turnFlowJournal";

/** 单条证据 — 相关度条 + 可点击联动左侧答复 */
export function FlowEvidenceCard({
  item,
  index,
  onClick,
  linked,
}: {
  item: FlowEvidence;
  index: number;
  onClick?: () => void;
  linked?: boolean;
}) {
  const scorePct = item.score != null ? Math.round(item.score * 100) : null;
  const clickable = item.kind === "hit" && onClick;

  return (
    <button
      type="button"
      className={`ua-flow-evidence${clickable ? " clickable" : ""}${linked ? " linked" : ""}`}
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="ua-flow-evidence-head">
        <span className="ua-flow-evidence-kind">{kindLabel(item.kind)}</span>
        {scorePct != null && <span className="ua-flow-evidence-score">{scorePct}%</span>}
      </div>
      <strong>{item.title}</strong>
      {item.excerpt && <p>{item.excerpt}</p>}
      {scorePct != null && (
        <div className="ua-flow-evidence-bar" aria-hidden>
          <i style={{ width: `${scorePct}%` }} />
        </div>
      )}
      {clickable && <em className="ua-flow-evidence-link">点击查看左侧引用 →</em>}
    </button>
  );
}

function kindLabel(kind: FlowEvidence["kind"]) {
  const map = { query: "问句", route: "路由", hit: "检索", tool: "工具", stream: "生成" };
  return map[kind];
}
