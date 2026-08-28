import { useNavigate } from "react-router-dom";
import {
  education,
  experience,
  profile,
  projects,
  skills,
} from "../data/profile";
import { useStore } from "../store";

const NAV = [
  { id: "about", label: "关于" },
  { id: "projects", label: "项目" },
  { id: "skills", label: "技能" },
  { id: "experience", label: "经历" },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function LandingPage() {
  const login = useStore((s) => s.login);
  const openChat = useStore((s) => s.openChat);
  const nav = useNavigate();

  function enterDemo() {
    login(profile.name);
    openChat("master");
    nav("/demo/chat");
  }

  return (
    <div className="portfolio">
      <header className="site-nav">
        <div className="site-nav-inner">
          <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); scrollTo("top"); }}>
            {profile.name}
            <span>{profile.title}</span>
          </a>
          <nav className="site-links">
            {NAV.map((n) => (
              <button key={n.id} type="button" onClick={() => scrollTo(n.id)}>
                {n.label}
              </button>
            ))}
            <button type="button" className="nav-cta" onClick={enterDemo}>
              交互演示
            </button>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-grid">
            <div>
              <p className="eyebrow">Portfolio · {profile.years} 年开发经验</p>
              <h1>
                {profile.name}
                <br />
                <em>{profile.title}</em>
              </h1>
              <p className="lead">{profile.summary}</p>
              <div className="hero-actions">
                <button type="button" className="cta" onClick={enterDemo}>
                  查看 AI 交互演示
                </button>
                <a className="ghost-btn" href={`mailto:${profile.email}`}>
                  联系我
                </a>
              </div>
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

        <section id="about" className="section">
          <h2>关于我</h2>
          <p className="section-lead">
            具备 React / TypeScript 全栈前端能力，从 Java 后端转型，历经银行核心系统、阿里企业级重构到 AI 自动化平台。
            本站点为<strong>可部署静态页</strong>，内置基于{" "}
            <code>tianyangAgent/agent</code> 与 <code>imean-ai</code> 架构的交互演示，无需后端即可上传百度 BOS。
          </p>
        </section>

        <section id="projects" className="section">
          <h2>代表项目</h2>
          <p className="section-lead">对照真实仓库实现，标注可在线体验的模块。</p>
          <div className="project-grid">
            {projects.map((p) => (
              <article key={p.id} className="project-card">
                <header>
                  <div>
                    <h3>{p.name}</h3>
                    <p className="project-meta">{p.role} · {p.period}</p>
                  </div>
                  {p.demo && (
                    <span className="badge">可演示</span>
                  )}
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
              </article>
            ))}
          </div>
          <div className="demo-banner">
            <div>
              <h3>在线交互演示</h3>
              <p>
                流式对话、工作流匹配、执行进度、MCP 工具卡、智能体切换 — 对齐 Agent + iMean AI 核心 UI 流程。
              </p>
            </div>
            <button type="button" className="cta" onClick={enterDemo}>
              进入演示 →
            </button>
          </div>
        </section>

        <section id="skills" className="section">
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

        <section id="experience" className="section">
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
        <p>
          © {new Date().getFullYear()} {profile.name} · 静态站点可托管于
          {" "}<a href="https://cloud.baidu.com/product/bos.html" target="_blank" rel="noreferrer">百度智能云 BOS</a>
        </p>
        <button type="button" className="ghost-btn sm" onClick={enterDemo}>
          交互演示
        </button>
      </footer>
    </div>
  );
}
