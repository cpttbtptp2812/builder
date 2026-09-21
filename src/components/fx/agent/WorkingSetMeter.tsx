import type { WorkingSet } from "../../../lib/workingSet";

/** 工作集 / 记忆预算 — 对齐理论 context */
export function WorkingSetMeter({ ws }: { ws: WorkingSet }) {
  const pct = Math.min(100, Math.round((ws.usedTokens / Math.max(ws.budgetTokens, 1)) * 100));
  const skillShare = ws.skillHint ? 18 : 0;
  const memShare = Math.min(50, ws.longTermKeys.length * 8);
  const turnShare = Math.max(0, pct - skillShare - memShare);

  return (
    <details className="ua-ws">
      <summary>
        <span className="ua-ws-bar" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </span>
        <strong>工作集 {ws.usedTokens}/{ws.budgetTokens}</strong>
        {ws.skillHint && <em>{ws.skillHint.split("（")[0]}</em>}
      </summary>
      <div className="ua-ws-body">
        <div className="ua-ws-seg" aria-hidden>
          {skillShare > 0 && <i className="skill" style={{ width: `${skillShare}%` }} title="技能" />}
          {memShare > 0 && <i className="mem" style={{ width: `${memShare}%` }} title="长期记忆" />}
          {turnShare > 0 && <i className="turn" style={{ width: `${turnShare}%` }} title="近期对话" />}
        </div>
        <ul>
          {ws.skillHint && <li>技能提示：{ws.skillHint}</li>}
          {ws.longTermKeys.length > 0 && <li>长期键：{ws.longTermKeys.join("、")}</li>}
          {!ws.longTermKeys.length && !ws.skillHint && <li>本轮工作集较空，主要依赖当前问句。</li>}
        </ul>
      </div>
    </details>
  );
}
