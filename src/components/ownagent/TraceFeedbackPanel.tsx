import { useEffect, useState } from "react";
import { apiFetch, checkBackendHealth } from "../../lib/apiClient";
import { fetchTraceClusters, type TraceClusterRow } from "../../lib/skillGateClient";
import { ensureTeamSession } from "../../lib/teamGateClient";

type Suggestion = {
  id: string;
  skillId: string;
  query: string;
  fingerprint: string;
  createdAt: string;
};

export function TraceFeedbackPanel({ onToast }: { onToast: (message: string) => void }) {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [clusters, setClusters] = useState<TraceClusterRow[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [open, setOpen] = useState(true);

  async function refresh() {
    const health = await checkBackendHealth(true);
    setOnline(Boolean(health?.ok));
    if (!health?.ok) {
      setRows([]);
      setClusters([]);
      return;
    }
    await ensureTeamSession();
    const [suggestions, clusterRows] = await Promise.all([
      apiFetch<{ suggestions: Suggestion[] }>("/skill-gate/trace-suggestions?status=pending"),
      fetchTraceClusters(),
    ]);
    setRows(suggestions?.suggestions ?? []);
    setClusters(clusterRows);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function review(id: string, decision: "accept" | "reject") {
    const result = await apiFetch<{ ok: boolean }>(`/skill-gate/trace-suggestions/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
    if (!result?.ok) {
      onToast("处理失败，请确认 API 已启动且已登录团队账号");
      return;
    }
    onToast(decision === "accept" ? "已写入 .ownagent/cases.json 回归集" : "已忽略建议");
    await refresh();
  }

  if (online === false) {
    return (
      <section className="oa-trace-feedback oa-trace-feedback--offline">
        <p>
          生产 Trace 回流需 API（<code>npm run dev:full</code> 或 Docker）。连接后对话失败 run 会自动 ingest 并生成 case 建议。
        </p>
      </section>
    );
  }

  if (!rows.length && !clusters.length && online !== true) return null;

  return (
    <section className="oa-trace-feedback">
      <header className="oa-trace-feedback-head">
        <strong>生产 Trace 回流</strong>
        <button type="button" className="own-skill-inline-btn" onClick={() => void refresh()}>
          刷新
        </button>
        <button type="button" className="own-skill-inline-btn" onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "展开"}
        </button>
      </header>
      {open ? (
        <>
          {clusters.length ? (
            <div className="oa-trace-clusters">
              <h4>失败聚类</h4>
              <ul>
                {clusters.slice(0, 8).map((c) => (
                  <li key={c.fingerprint}>
                    <code>{c.skillId}</code>
                    <span>
                      {c.tool ?? "—"} · {c.errorClass?.slice(0, 48) ?? "—"} · ×{c.occurrenceCount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="oa-trace-feedback-empty">暂无失败聚类（成功 run 也会 ingest，仅失败会聚类）。</p>
          )}
          {rows.length ? (
            <div className="oa-trace-suggestions">
              <h4>待审核 case 建议 {rows.length}</h4>
              <ul>
                {rows.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>{row.skillId}</strong>
                      <span>{row.query}</span>
                    </div>
                    <div>
                      <button type="button" className="own-skill-inline-btn" onClick={() => void review(row.id, "accept")}>
                        加入回归集
                      </button>
                      <button type="button" className="own-skill-inline-btn" onClick={() => void review(row.id, "reject")}>
                        忽略
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
