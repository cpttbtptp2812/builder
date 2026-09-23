import { useCallback, useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

function apiHeaders(token: string) {
  return { "Content-Type": "application/json", "x-admin-token": token };
}

type GapRow = { query: string; count: number; avg_ground: number; avg_hits: number };
type LogRow = {
  id: string;
  query: string;
  answer_preview: string;
  groundedness: number;
  hit_count: number;
  mode: string;
  created_at: string;
};

type OpsData = {
  summary: { gapCount: number; lowConfidenceCount: number; pendingPublishCount: number; plazaTotal: number };
  gaps: GapRow[];
  lowConfidence: LogRow[];
  pendingPublish: LogRow[];
};

export function OperationsPanel({
  token,
  onGoKnowledge,
  onGoPlaza,
}: {
  token: string;
  onGoKnowledge: () => void;
  onGoPlaza: () => void;
}) {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/operations`, { headers: apiHeaders(token) });
      if (res.ok) setData(await res.json() as OpsData);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="adm-loading">加载运营数据…</div>;
  if (!data) return <div className="adm-empty-state"><p>无法加载运营数据，请确认后端已启动</p></div>;

  const { summary, gaps, lowConfidence, pendingPublish } = data;

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>知识运营</h2>
          <p>系统自动汇总缺口、低置信度回答和待沉淀问答，帮助管理员持续优化知识库</p>
        </div>
        <button type="button" className="adm-btn" onClick={() => void load()}>刷新</button>
      </div>

      <div className="adm-kpi-grid">
        {[
          { label: "知识缺口", value: String(summary.gapCount), sub: "检索未命中或置信度低", icon: "🕳️" },
          { label: "待校对", value: String(summary.lowConfidenceCount), sub: "低置信度 AI 回答", icon: "⚠️" },
          { label: "待沉淀", value: String(summary.pendingPublishCount), sub: "答得好但未发布广场", icon: "📤" },
          { label: "广场条目", value: String(summary.plazaTotal), sub: "已共享问答", icon: "🌐" },
        ].map((k) => (
          <div key={k.label} className="adm-kpi-card">
            <span className="adm-kpi-icon">{k.icon}</span>
            <span className="adm-kpi-val">{k.value}</span>
            <span className="adm-kpi-label">{k.label}</span>
            <span className="adm-kpi-sub">{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="adm-ops-grid">
        <section className="adm-section adm-ops-card">
          <h3 className="adm-section-title">知识缺口清单</h3>
          <p className="adm-ops-hint">被多次提问但知识库支撑不足的问题，建议补充文档或发布到广场</p>
          {gaps.length === 0 ? (
            <p className="adm-empty-hint">暂无缺口，知识覆盖良好</p>
          ) : (
            <div className="adm-ops-list">
              {gaps.map((g) => (
                <div key={g.query} className="adm-ops-row">
                  <div>
                    <strong>{g.query}</strong>
                    <span>被问 {g.count} 次 · 平均置信度 {g.avg_ground}% · 命中 {g.avg_hits} 段</span>
                  </div>
                  <button type="button" className="adm-btn adm-btn--sm adm-btn--primary" onClick={onGoKnowledge}>
                    补知识
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="adm-section adm-ops-card">
          <h3 className="adm-section-title">低置信度回答</h3>
          <p className="adm-ops-hint">AI 已回答但依据不足，建议人工校对后更新知识库</p>
          {lowConfidence.length === 0 ? (
            <p className="adm-empty-hint">暂无待校对项</p>
          ) : (
            <div className="adm-ops-list">
              {lowConfidence.map((r) => (
                <div key={r.id} className="adm-ops-row">
                  <div>
                    <strong>{r.query}</strong>
                    <span>置信度 {r.groundedness}% · {r.mode} · {new Date(r.created_at).toLocaleString("zh-CN")}</span>
                    {r.answer_preview ? <em>{r.answer_preview.slice(0, 80)}…</em> : null}
                  </div>
                  <button type="button" className="adm-btn adm-btn--sm" onClick={onGoKnowledge}>校对</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="adm-section adm-ops-card adm-ops-card--wide">
          <h3 className="adm-section-title">待发布到广场</h3>
          <p className="adm-ops-hint">AI 回答质量较好但尚未共享，发布后可被同事零 Token 命中</p>
          {pendingPublish.length === 0 ? (
            <p className="adm-empty-hint">暂无待沉淀问答</p>
          ) : (
            <div className="adm-ops-list">
              {pendingPublish.map((r) => (
                <div key={r.id} className="adm-ops-row">
                  <div>
                    <strong>{r.query}</strong>
                    <span>置信度 {r.groundedness}% · 命中 {r.hit_count} 段</span>
                    {r.answer_preview ? <em>{r.answer_preview.slice(0, 100)}…</em> : null}
                  </div>
                  <button type="button" className="adm-btn adm-btn--sm adm-btn--primary" onClick={onGoPlaza}>
                    去发布
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
