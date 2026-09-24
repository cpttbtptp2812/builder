/** 广场优先路由 — 对话内展示真实路由决策（非顶栏统计） */

import type { PlazaSourceView } from "../../../lib/ownagentSessions";

export function PlazaRouteCard({
  source,
  onOpenPlaza,
}: {
  source: PlazaSourceView;
  onOpenPlaza?: () => void;
}) {
  return (
    <div className="plaza-route-card" role="status">
      <div className="plaza-route-card-head">
        <span className="plaza-route-badge">广场优先路由</span>
        <span className="plaza-route-score">匹配 {source.matchScore}%</span>
      </div>
      <p className="plaza-route-desc">
        发送前检索知识广场，命中已验证问答 → <strong>跳过 LLM</strong>，直接返回同事答案。
      </p>
      <dl className="plaza-route-meta">
        <div>
          <dt>原问句</dt>
          <dd>{source.question}</dd>
        </div>
        <div>
          <dt>贡献者</dt>
          <dd>{source.author}</dd>
        </div>
      </dl>
      {onOpenPlaza && (
        <button type="button" className="plaza-route-link" onClick={onOpenPlaza}>
          在知识广场查看
        </button>
      )}
    </div>
  );
}
