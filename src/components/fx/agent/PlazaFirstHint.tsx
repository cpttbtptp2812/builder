import { useEffect, useRef, useState } from "react";
import { listPlaza, type PlazaItem } from "../../../lib/plazaFeed";

/** 对话页顶部：提醒先搜广场，并即时显示已有答案 */
export function PlazaFirstHint({
  onOpenPlaza,
  onUseAnswer,
  onAsk,
}: {
  onOpenPlaza: () => void;
  onUseAnswer: (question: string, answer: string) => void;
  onAsk: (q?: string) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlazaItem[]>([]);
  const [total, setTotal] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void listPlaza("", 1).then((d) => setTotal(d.total));
  }, []);

  function search(val: string) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!val.trim()) { setHits([]); return; }
      const data = await listPlaza(val.trim(), 4);
      setHits(data.items);
    }, 280);
  }

  return (
    <div className="plaza-hint">
      <div className="plaza-hint-banner">
        <div>
          <strong>先去知识广场找</strong>
          <p>同事问过的答案都在广场里，找到就不用再花一次 AI。</p>
        </div>
        <button type="button" className="kf-btn kf-btn--publish" onClick={onOpenPlaza}>
          打开知识广场{total > 0 ? ` · ${total}` : ""}
        </button>
      </div>

      <div className="kf-search">
        <svg className="kf-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <input
          className="kf-search-input"
          value={q}
          onChange={e => search(e.target.value)}
          placeholder="先搜广场：例如「产品怎么收费」"
        />
      </div>

      {q.trim() && (
        <div className="plaza-hint-hits">
          {hits.length === 0 ? (
            <div className="plaza-hint-miss">
              <span>广场里暂时没有这条</span>
              <button type="button" className="kf-btn kf-btn--ask" onClick={() => onAsk(q.trim())}>
                现在问 AI
              </button>
            </div>
          ) : hits.map(hit => (
            <button
              key={hit.id}
              type="button"
              className="plaza-hint-hit"
              onClick={() => onUseAnswer(hit.question, hit.answer)}
            >
              <span className="kf-q-badge">Q</span>
              <span className="plaza-hint-hit-body">
                <strong>{hit.question}</strong>
                <em>{hit.answer.replace(/\s+/g, " ").slice(0, 72)}{hit.answer.length > 72 ? "…" : ""}</em>
              </span>
              <span className="plaza-hint-hit-go">直接用</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
