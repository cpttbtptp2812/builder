import { useState } from "react";
import { explainDiscovery, type SkillDiscoveryRow } from "../../lib/agentSkills";

const PRESETS = [
  "分析本站性能，探活并看 ttfb metrics",
  "看看页面里可交互元素的 dom 定位分布",
  "跑一遍改价上架的自动化流程",
  "今天天气怎么样",
];

/** OwnAgent · 技能路由 — trigger 加权打分，看清为什么选中这个技能 */
export function SkillRoutePanel() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SkillDiscoveryRow[]>([]);

  function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setRows(explainDiscovery(text));
  }

  const winner = rows.find((r) => r.score > 0);

  return (
    <div className="own-panel">
      <p className="own-panel-lead">
        一句话进来，先决定<strong>交给哪个技能</strong>。每个技能在 SKILL.md 里声明 triggers，
        命中长词记 2 分、短词 1 分，Top-1 才进入执行。
      </p>

      <div className="agent-trace-input-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例如：分析本站性能，探活并看 ttfb"
          onKeyDown={(e) => {
            if (e.key === "Enter") run(query);
          }}
        />
        <button type="button" className="agent-trace-send" onClick={() => run(query)}>
          路由
        </button>
      </div>
      <div className="agent-trace-quick">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => run(p)}>
            {p}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="agent-trace-empty">输入一句话，看打分过程</p>
      ) : (
        <>
          <p className="own-route-verdict">
            {winner ? (
              <>
                选中 <strong>{winner.skill.name}</strong>（{winner.score} 分） · 工具链{" "}
                <code>{winner.skill.tools.join(" → ")}</code>
              </>
            ) : (
              <>没有技能命中（都是 0 分），会兜底走 site-analyzer</>
            )}
          </p>
          <ul className="own-route-list">
            {rows.map((r) => (
              <li key={r.skill.id} className={r === winner ? "win" : ""}>
                <div className="own-route-head">
                  <strong>{r.skill.name}</strong>
                  <em>{r.score} 分</em>
                </div>
                <p>{r.skill.description}</p>
                {r.breakdown.length > 0 ? (
                  <div className="own-route-terms">
                    {r.breakdown.map((b) => (
                      <span key={b.trigger}>
                        {b.trigger} +{b.points}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="own-route-terms empty">未命中 triggers</div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
