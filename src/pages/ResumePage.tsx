import { Link } from "react-router-dom";
import { ResumeJobCard } from "../components/ResumeJobCard";
import { ResumeProjectCard } from "../components/ResumeProjectCard";
import { SiteHeader } from "../components/SiteHeader";
import {
  advantages,
  education,
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
                <h1>{profile.name}</h1>
                <p className="resume-meta">
                  {profile.title} · {profile.years} 年 · {profile.degree} · {profile.availability} · {profile.location}
                </p>
                <ul className="resume-metrics">
                  {profile.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
              <aside className="resume-contact-card">
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
                    {education.school}（{education.tag}）· {education.degree} · {education.period}
                  </dd>
                </dl>
              </aside>
            </div>
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
            <div className="resume-project-grid">
              {resumeProjects.map((p) => (
                <ResumeProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>

          <section className="resume-section resume-section-tight">
            <h2>技能概览</h2>
            <div className="resume-skill-tags">
              {skills.flatMap((g) => g.items).map((item) => (
                <span key={item}>{item}</span>
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
