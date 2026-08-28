import { useEffect } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { profile } from "../data/profile";
import { useStore } from "../store";

const links = [
  { to: "/demo/chat", label: "对话演示", icon: "💬" },
  { to: "/demo/projects", label: "项目经历", icon: "📁" },
  { to: "/demo/agents", label: "智能体", icon: "🤖" },
  { to: "/demo/workflows", label: "工作流库", icon: "📋" },
  { to: "/demo/history", label: "会话历史", icon: "🕐" },
];

export function Shell() {
  const initShowcase = useStore((s) => s.initShowcase);
  const resetDemo = useStore((s) => s.resetDemo);

  useEffect(() => {
    initShowcase();
  }, [initShowcase]);

  return (
    <div className="app showcase">
      <aside className="aside">
        <div className="logo">
          <span>{profile.name}</span>
          <small>{profile.title} · 技术演示</small>
          <Link to="/" className="back-home">
            ← 项目首页
          </Link>
          <Link to="/about" className="back-home secondary">
            完整简历 →
          </Link>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "on" : "")}>
              <span>{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="aside-metrics">
          {profile.highlights.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="aside-foot">
          <a href={`mailto:${profile.email}`}>联系</a>
          <button type="button" onClick={() => { resetDemo(); initShowcase(); }}>
            重置演示
          </button>
        </div>
      </aside>
      <section className="content">
        <Outlet />
      </section>
    </div>
  );
}
