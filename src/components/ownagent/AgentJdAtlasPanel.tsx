import { useMemo, useState } from "react";
import {
  JD_CATEGORY_LABEL,
  JD_SKILLS,
  jdCoverageStats,
  listJdSkills,
  type JdCategory,
  type JdViewId,
} from "../../lib/agentJdRequirements";

const COVERAGE_LABEL = {
  done: "已落地",
  partial: "部分实现",
  roadmap: "规划中",
} as const;

/** 岗位图谱 — BOSS JD 关键词 ↔ 理论 ↔ 本项目实践 */
export function AgentJdAtlasPanel({ onGo }: { onGo: (view: JdViewId) => void }) {
  const [cat, setCat] = useState<JdCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(JD_SKILLS[0]?.id ?? null);

  const stats = useMemo(() => jdCoverageStats(), []);
  const skills = useMemo(() => listJdSkills(cat === "all" ? undefined : cat), [cat]);

  return (
    <div className="oa-jd-atlas">
      <header className="oa-jd-head">
        <div>
          <h2>能力图谱</h2>
          <p>
            AI Agent 系统能力全景 · 每条含
            <strong> 原理说明</strong> 与 <strong>产品落点</strong>
          </p>
        </div>
        <div className="oa-jd-stats">
          <span className="oa-jd-stat">
            <strong>{stats.done}</strong>/{stats.total} 已落地
          </span>
          <span className="oa-jd-stat muted">{stats.partial} 部分</span>
          <span className="oa-jd-stat accent">覆盖率 {stats.pct}%</span>
        </div>
      </header>

      <div className="oa-jd-filters">
        <button type="button" className={cat === "all" ? "on" : ""} onClick={() => setCat("all")}>
          全部
        </button>
        {(Object.keys(JD_CATEGORY_LABEL) as JdCategory[]).map((c) => (
          <button key={c} type="button" className={cat === c ? "on" : ""} onClick={() => setCat(c)}>
            {JD_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <div className="oa-jd-list">
        {skills.map((s) => {
          const open = openId === s.id;
          return (
            <article key={s.id} className={`oa-jd-card${open ? " open" : ""} cov-${s.coverage}`}>
              <button type="button" className="oa-jd-card-head" onClick={() => setOpenId(open ? null : s.id)}>
                <span className={`oa-jd-cov oa-jd-cov--${s.coverage}`}>{COVERAGE_LABEL[s.coverage]}</span>
                <strong>{s.title}</strong>
                <span className="oa-jd-kw">{s.jdKeywords.slice(0, 3).join(" · ")}</span>
              </button>
              {open && (
                <div className="oa-jd-card-body">
                  <section>
                    <h4>关键词</h4>
                    <div className="oa-jd-tags">
                      {s.jdKeywords.map((k) => (
                        <span key={k}>{k}</span>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h4>原理说明</h4>
                    <p>{s.theory}</p>
                  </section>
                  <section>
                    <h4>产品落点</h4>
                    <p className="oa-jd-map">{s.projectMap}</p>
                  </section>
                  <section className="oa-jd-interview">
                    <h4>能力要点</h4>
                    <blockquote>{s.theory}</blockquote>
                  </section>
                  <footer>
                    <span className="oa-jd-try">体验：{s.tryHint}</span>
                    <button type="button" className="oa-panel-primary sm" onClick={() => onGo(s.view)}>
                      去实践 →
                    </button>
                  </footer>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
