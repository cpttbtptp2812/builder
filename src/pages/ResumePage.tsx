import { ResumeJobCard } from "../components/ResumeJobCard";
import { ResumeProjectCard } from "../components/ResumeProjectCard";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { WorkTenureLive } from "../components/WorkTenureLive";
import {
  advantages,
  education,
  experience,
  profile,
  resumeProjects,
  skills,
} from "../data/profile";

interface ResumePageProps {
  embedMode?: boolean;
}

/** 完整个人履历页（支持单页嵌入与独立页面，深色高对比度） */
export function ResumePage({ embedMode = false }: ResumePageProps) {
  const content = (
    <main className="oa-landing-inner resume-body oa-page-enter" style={{ paddingTop: embedMode ? "1.5rem" : "2.5rem" }}>
      {/* 履历 Hero 个人概述卡片 */}
      <section className="resume-hero lab-header-hero">
        <div className="resume-hero-grid">
          <div>
            <div className="lab-badge-row">
              <span className="lab-status-badge">Career Profile</span>
              <span className="lab-tenure-badge">
                从业 <strong>10年+ 经验</strong>
              </span>
            </div>
            <h1 style={{ color: "#ffffff", fontSize: "2.4rem", fontWeight: 850, margin: "0.2rem 0 0.8rem" }}>
              {profile.name}
            </h1>
            <p className="resume-meta" style={{ color: "#38bdf8", fontSize: "1.05rem", fontWeight: 650, margin: "0 0 0.4rem" }}>
              {profile.title} · {profile.subtitle}
            </p>
            <p className="resume-meta resume-meta-sub" style={{ color: "#94a3b8", fontSize: "0.92rem", margin: "0 0 1.2rem" }}>
              {profile.degree} · {profile.availability} · {profile.location}
            </p>
            <p className="resume-summary" style={{ color: "#e2e8f0", fontSize: "1rem", lineHeight: 1.7, margin: "0 0 1.2rem" }}>
              {profile.summary}
            </p>
            <div style={{ margin: "1rem 0" }}>
              <WorkTenureLive startDate={profile.careerStart} />
            </div>
            <ul className="resume-metrics" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: 0, listStyle: "none" }}>
              {profile.highlights.map((h) => (
                <li
                  key={h}
                  style={{
                    background: "rgba(99, 102, 241, 0.15)",
                    border: "1px solid rgba(129, 140, 248, 0.3)",
                    color: "#c7d2fe",
                    padding: "0.3rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  ✓ {h}
                </li>
              ))}
            </ul>
          </div>

          <aside
            className="resume-contact-card"
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              padding: "1.5rem",
              alignSelf: "flex-start",
            }}
          >
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.75rem 1rem", fontSize: "0.9rem" }}>
              <dt style={{ color: "#94a3b8", fontWeight: 600 }}>电话</dt>
              <dd style={{ margin: 0 }}>
                <a href={`tel:${profile.phone}`} style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}>
                  {profile.phone}
                </a>
              </dd>
              <dt style={{ color: "#94a3b8", fontWeight: 600 }}>邮箱</dt>
              <dd style={{ margin: 0 }}>
                <a href={`mailto:${profile.email}`} style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}>
                  {profile.email}
                </a>
              </dd>
              <dt style={{ color: "#94a3b8", fontWeight: 600 }}>教育</dt>
              <dd style={{ margin: 0, color: "#e2e8f0" }}>
                {education.school}（{education.tag}）· {education.degree} · {education.period}
              </dd>
            </dl>
          </aside>
        </div>
      </section>

      {/* 个人优势 */}
      <section className="resume-section" style={{ margin: "3.5rem 0" }}>
        <div className="works-section-head">
          <h2 className="works-section-label">🌟 个人优势</h2>
          <span className="works-section-hint">全栈架构 · 自动化 · 高性能工程</span>
        </div>
        <ul className="resume-advantages" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", padding: 0, listStyle: "none" }}>
          {advantages.map((text) => (
            <li
              key={text}
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "14px",
                padding: "1.2rem 1.4rem",
                color: "#cbd5e1",
                fontSize: "0.92rem",
                lineHeight: 1.65,
              }}
            >
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* 项目经历 */}
      <section className="resume-section resume-section-projects" style={{ margin: "3.5rem 0" }}>
        <div className="works-section-head">
          <h2 className="works-section-label">🚀 核心项目经历</h2>
          <span className="works-section-hint">OwnAgent · iMean · 阿里剑池</span>
        </div>
        <div className="resume-project-grid" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {[...resumeProjects]
            .sort((a, b) => {
              const order = ["ownagent", "imean", "jianchi"];
              return order.indexOf(a.id) - order.indexOf(b.id);
            })
            .map((p) => (
              <ResumeProjectCard key={p.id} project={p} />
            ))}
        </div>
      </section>

      {/* 工作经历 */}
      <section className="resume-section resume-section-jobs" style={{ margin: "3.5rem 0" }}>
        <div className="works-section-head">
          <h2 className="works-section-label">💼 工作经历</h2>
          <span className="works-section-hint">大厂与独角兽全流程实践</span>
        </div>
        <div className="resume-jobs-list" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          {experience.map((job) => (
            <ResumeJobCard key={job.company} job={job} />
          ))}
        </div>
      </section>

      {/* 技能概览 */}
      <section className="resume-section resume-section-tight" style={{ margin: "3.5rem 0" }}>
        <div className="works-section-head">
          <h2 className="works-section-label">🛠️ 技能图谱</h2>
          <span className="works-section-hint">语言、框架、引擎与运维栈</span>
        </div>
        <div className="resume-skill-tags" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {skills.flatMap((g) => g.items).map((item) => (
            <span
              key={item}
              style={{
                background: "rgba(30, 41, 59, 0.7)",
                border: "1px solid rgba(148, 163, 184, 0.25)",
                color: "#e2e8f0",
                padding: "0.35rem 0.85rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </section>
    </main>
  );

  if (embedMode) {
    return (
      <div className="oa-resume-embed">
        {content}
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="oa-landing-page oa-resume-page oa-page-enter">
      <SiteHeader />
      {content}
      <SiteFooter />
    </div>
  );
}
