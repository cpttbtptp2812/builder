import { Link } from "react-router-dom";
import { education, experience, profile, skills } from "../data/profile";
import { PROJECT_DETAILS } from "../data/knowledge";

export function AboutPage() {
  return (
    <div className="portfolio about-full">
      <header className="site-nav">
        <div className="site-nav-inner">
          <Link className="brand" to="/">
            ← 返回首页
          </Link>
          <nav className="site-links">
            <Link to="/demo/projects">项目经历</Link>
            <a className="ghost-btn sm" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
          </nav>
        </div>
      </header>

      <main className="about-body">
        <section className="hero about-hero">
          <div className="hero-grid">
            <div>
              <p className="eyebrow">Portfolio · {profile.years} 年开发经验</p>
              <h1>{profile.name}</h1>
              <p className="lead">{profile.summary}</p>
              <ul className="metrics">
                {profile.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
            <aside className="hero-card">
              <h3>联系方式</h3>
              <dl>
                <dt>邮箱</dt>
                <dd><a href={`mailto:${profile.email}`}>{profile.email}</a></dd>
                <dt>电话</dt>
                <dd><a href={`tel:${profile.phone}`}>{profile.phone}</a></dd>
                <dt>城市</dt>
                <dd>{profile.location}</dd>
                <dt>教育</dt>
                <dd>{education.school} · {education.degree}</dd>
              </dl>
            </aside>
          </div>
        </section>

        <section className="section">
          <h2>全部项目（{PROJECT_DETAILS.length}）</h2>
          <p className="section-lead">
            在演示页可点击项目按钮与 AI 助手长聊每个项目的架构、难点与成果。
          </p>
          <div className="project-grid">
            {PROJECT_DETAILS.map((p) => (
              <article key={p.id} className="project-card">
                <header>
                  <div>
                    <h3>{p.name}</h3>
                    <p className="project-meta">{p.role} · {p.period}</p>
                  </div>
                  {p.demo && <span className="badge">可演示</span>}
                </header>
                {p.repo && <p className="repo-tag">{p.repo}</p>}
                <p>{p.desc}</p>
                <ul className="achievements">
                  {p.achievements.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <div className="stack">
                  {p.stack.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
                <Link to="/demo/projects" className="ghost-btn sm card-link">
                  查看详情 & 开聊 →
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>技术栈</h2>
          <div className="skills-grid">
            {skills.map((g) => (
              <div key={g.group} className="skill-group">
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

        <section className="section">
          <h2>工作经历</h2>
          <ol className="exp-list">
            {experience.map((e) => (
              <li key={e.company}>
                <div className="exp-dot" />
                <div>
                  <strong>{e.company}</strong>
                  <span>{e.role}</span>
                  <time>{e.period}</time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="site-foot">
        <p>© {new Date().getFullYear()} {profile.name}</p>
        <Link to="/demo/chat" className="ghost-btn sm">返回技术演示</Link>
      </footer>
    </div>
  );
}
