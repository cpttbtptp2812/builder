import type { FollowUpPrompt } from "../../../lib/followUpPrompts";

/** 每条答复下的预制问句 — 已 RAG 预检，保证可答 */
export function FollowUpRail({
  prompts,
  disabled,
  onPick,
}: {
  prompts: FollowUpPrompt[];
  disabled?: boolean;
  onPick: (text: string) => void;
}) {
  if (!prompts.length) return null;

  return (
    <div className="ua-followup-rail">
      <header>
        <span className="ua-followup-rail-kicker">Smart Follow-up</span>
        <strong>继续探索</strong>
        <em>已预检知识库 · 点击必有答复</em>
      </header>
      <div className="ua-followup-rail-list">
        {prompts.map((p, i) => (
          <button
            key={`${p.docId}-${i}-${p.text}`}
            type="button"
            className="ua-followup-rail-item"
            disabled={disabled}
            onClick={() => onPick(p.text)}
          >
            <span className="ua-followup-rail-meta">
              <i className="ua-followup-verified" aria-hidden />
              <em>{p.hint}</em>
              <b>{Math.round(p.relevance * 100)}%</b>
            </span>
            <strong>{p.text}</strong>
            <span className="ua-followup-rail-go" aria-hidden>
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
