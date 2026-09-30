/** 试句：与清单分离时可编辑；供检查对比与「对话验收」使用（只此一处，不重复输入框） */
export function ReleaseTrySentenceBar({
  testQuery,
  setTestQuery,
  recommended,
  triggerSamples,
  checking,
  onDialogueAccept,
  showDialogue,
}: {
  testQuery: string;
  setTestQuery: (q: string) => void;
  recommended: string;
  triggerSamples: string[];
  checking: boolean;
  onDialogueAccept: () => void;
  showDialogue: boolean;
}) {
  return (
    <section className="own-rel__try" aria-labelledby="rel-try-label">
      <h4 id="rel-try-label" className="own-rel__try-title">
        试句
      </h4>
      <p className="own-rel__try-hint">可与清单不同，只用于「试句对比」和「对话验收」。点清单某行也会填入这里。</p>
      <div className="own-skill-ver-chips own-skill-ver-chips--click own-rel__try-chips">
        <button type="button" className={testQuery === recommended ? "on" : ""} disabled={checking} onClick={() => setTestQuery(recommended)}>
          推荐例句
        </button>
        {triggerSamples.map((t) => (
          <button
            key={t}
            type="button"
            className={testQuery === `帮我${t}` ? "on" : ""}
            disabled={checking}
            onClick={() => setTestQuery(`帮我${t}`)}
          >
            {t}
          </button>
        ))}
      </div>
      <textarea
        id="skill-test-query"
        className="own-skill-ver-query-input own-rel-query-input"
        rows={2}
        value={testQuery}
        onChange={(e) => setTestQuery(e.target.value)}
        disabled={checking}
        placeholder="例如：帮我巡检 https://example.com 能否上线"
      />
      {showDialogue ? (
        <div className="own-qbank-once own-rel__try-actions">
          <button type="button" className="own-compare-secondary-btn" disabled={checking} onClick={onDialogueAccept}>
            对话验收
          </button>
          <span className="own-ver-hint">用上面试句去对话里真人跑一遍（底部 sticky 里也有）。</span>
        </div>
      ) : null}
    </section>
  );
}
