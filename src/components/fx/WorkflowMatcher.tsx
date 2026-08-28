import { useState } from "react";
import { WORKFLOWS, matchWorkflows } from "../../data/demo";
import { idbGet, idbSet } from "../../lib/idbCache";

/** 语义匹配 — 产品模式隐藏底层 API 标签 */
export function WorkflowMatcher({
  onPick,
  productMode = false,
}: {
  onPick: (title: string) => void;
  productMode?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReturnType<typeof matchWorkflows> | null>(null);
  const [loading, setLoading] = useState(false);
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);

  async function search(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    setResults(null);
    setCacheHit(null);

    const key = `wf:${text.trim().toLowerCase()}`;
    const cached = await idbGet<ReturnType<typeof matchWorkflows>>(key);

    if (cached) {
      await pause(280);
      setResults(cached);
      setCacheHit(true);
      setLoading(false);
      return;
    }

    await pause(520);
    const matched = matchWorkflows(text);
    await idbSet(key, matched);
    setResults(matched);
    setCacheHit(false);
    setLoading(false);
  }

  const presets = ["批量改价上架", "异常订单排查", "发布前检查"];

  return (
    <div className={`wf-matcher ${productMode ? "product" : ""}`}>
      {!productMode && (
        <div className="wf-matcher-meta">
          <span className="tech-badge sm">IndexedDB</span>
          {cacheHit === true && <span className="cache-hit">cache hit · idbGet()</span>}
          {cacheHit === false && <span className="cache-miss">cache miss · idbSet()</span>}
        </div>
      )}
      {productMode && cacheHit !== null && (
        <p className="wf-matcher-subtle">
          {cacheHit ? "⚡ 命中历史匹配，即时返回" : "🔍 已从场景库完成语义匹配"}
        </p>
      )}

      <form
        className="wf-matcher-input"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="描述要自动化的任务，例如：帮我把电商 SKU 批量改价…"
        />
        <button type="submit" disabled={loading}>
          {loading ? "匹配中…" : productMode ? "发送" : "语义匹配"}
        </button>
      </form>

      <div className="wf-matcher-presets">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setQuery(p);
              void search(p);
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {loading && (
        <div className="wf-matcher-loading">
          {WORKFLOWS.slice(0, 3).map((w, i) => (
            <div key={w.id} className="match-bar" style={{ animationDelay: `${i * 120}ms` }}>
              <span>{w.title}</span>
              <i style={{ width: `${30 + i * 20}%` }} />
            </div>
          ))}
        </div>
      )}

      {results && !loading && (
        <div className="wf-matcher-results">
          <header>
            <strong>Top {results.length} 匹配</strong>
            <span>{productMode ? "选择后点「运行」开始回放" : "chatMatchWorkflows · 向量 + 标签"}</span>
          </header>
          {results.map((r) => {
            const wf = WORKFLOWS.find((w) => w.id === r.id);
            return (
              <button
                key={r.id}
                type="button"
                className="wf-matcher-pick"
                onClick={() => onPick(r.title)}
              >
                <div>
                  <strong>{r.title}</strong>
                  <span>{wf?.desc}</span>
                  <em>{wf?.channel} · {wf?.steps} 步</em>
                </div>
                <div className="wf-score">
                  <b>{Math.round(r.score * 100)}%</b>
                  <span>运行 →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function pause(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}
