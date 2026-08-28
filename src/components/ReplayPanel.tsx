import { REPLAY_STEPS } from "../data/scenarios";
import { useStore } from "../store";

export function ReplayPanel() {
  const replayActive = useStore((s) => s.replayActive);
  const replayStep = useStore((s) => s.replayStep);

  const activeIdx = replayActive ? Math.min(replayStep, REPLAY_STEPS.length - 1) : -1;

  return (
    <aside className="replay-panel">
      <header>
        <h2>DOM 回放</h2>
        <span className={`replay-badge ${replayActive ? "live" : ""}`}>
          {replayActive ? "执行中" : "待机"}
        </span>
      </header>
      <p className="replay-hint">iMean ReplaySDK · 元素定位 + 步骤引导</p>

      <div className="mock-browser">
        <div className="mock-chrome">
          <i /><i /><i />
          <span>merchant.example.com / sku</span>
        </div>
        <div className="mock-page">
          <nav className={`mock-nav ${activeIdx === 0 ? "hl" : ""}`}>
            商品管理
          </nav>
          <table className={`mock-table ${activeIdx === 1 ? "hl" : ""}`}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>价格</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>A-1024</td>
                <td>¥99</td>
              </tr>
            </tbody>
          </table>
          <label className={`mock-field ${activeIdx === 2 ? "hl" : ""}`}>
            新价格
            <input readOnly value="¥129" />
          </label>
          <button type="button" className={`mock-btn ${activeIdx === 3 ? "hl" : ""}`}>
            提交改价
          </button>
          {activeIdx >= 0 && (
            <div className="guide-popover">
              {REPLAY_STEPS[activeIdx]?.label}
            </div>
          )}
        </div>
      </div>

      <ol className="replay-steps">
        {REPLAY_STEPS.map((s, i) => (
          <li key={s.selector} className={i === activeIdx ? "on" : i < activeIdx ? "done" : ""}>
            <code>{s.selector}</code>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
