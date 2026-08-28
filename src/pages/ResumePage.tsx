import { Link } from "react-router-dom";
import { ResumeJobCard } from "../components/ResumeJobCard";
import { ResumeProjectCard } from "../components/ResumeProjectCard";
import { SiteHeader } from "../components/SiteHeader";
import {
  advantages,
  education,
  expectedJobs,
  experience,
  profile,
  resumeProjects,
  skills,
} from "../data/profile";

/** 完整履历 — Boss 直聘结构 */
export function ResumePage() {
  return (
    <div className="site-home site-resume">
      <div className="site-home-ambient" aria-hidden="true" />

      <div className="site-home-inner">
        <SiteHeader />

        <Link to="/" className="site-resume-back">
          ← 返回全部作品
        </Link>

        <main className="resume-body">
          <section className="resume-hero">
            <div className="resume-hero-grid">
              <div>
                <p className="site-home-eyebrow">Resume</p>
                <h1>{profile.name}</h1>
                <p className="resume-meta">
                  {profile.years} 年经验 · {profile.degree} · {profile.availability}
                </p>
                <p className="resume-meta-sub">
                  {profile.title} · {profile.location}
                </p>
              </div>
              <aside className="resume-contact-card">
                <h3>联系方式</h3>
                <dl>
                  <dt>电话</dt>
                  <dd>
                    <a href={`tel:${profile.phone}`}>{profile.phone}</a>
                  </dd>
                  <dt>邮箱</dt>
                  <dd>
                    <a href={`mailto:${profile.email}`}>{profile.email}</a>
                  </dd>
                  <dt>教育</dt>
                  <dd>
                    {education.school}（{education.tag}）· {education.degree}
                  </dd>
                  <dt>在校时间</dt>
                  <dd>{education.period}</dd>
                </dl>
              </aside>
            </div>

            <ul className="resume-metrics">
              {profile.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>

          <section className="resume-section">
            <h2>个人优势</h2>
            <ul className="resume-advantages">
              {advantages.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </section>

       

          <section className="resume-section">
            <h2>工作经历</h2>
            <div className="resume-jobs-list">
              {experience.map((job) => (
                <ResumeJobCard key={job.company} job={job} />
              ))}
            </div>
          </section>

          <section className="resume-section">
            <h2>项目经历</h2>
            <p className="resume-section-lead">
              带「可演示」标签的项目可点击进入作品站交互演示。
            </p>
            <div className="resume-project-grid">
              {resumeProjects.map((p) => (
                <ResumeProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>

          <section className="resume-section">
            <h2>技能概览</h2>
            <div className="resume-skills-grid">
              {skills.map((g) => (
                <div key={g.group} className="resume-skill-group">
                  <h3>{g.group}</h3>
                  <ul>
                    {g.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="site-home-foot">
          <Link to="/" className="site-resume-foot-back">
            ← 返回全部作品
          </Link>
          <nav className="site-home-foot-nav">
            <a href={`mailto:${profile.email}`}>邮件联系</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
