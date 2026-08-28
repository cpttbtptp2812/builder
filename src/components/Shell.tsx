import { NavLink, Outlet, Navigate, useNavigate, Link } from "react-router-dom";
import { useStore } from "../store";

const links = [
  { to: "/demo/chat", label: "对话", icon: "💬" },
  { to: "/demo/agents", label: "智能体", icon: "🤖" },
  { to: "/demo/workflows", label: "工作流库", icon: "📋" },
  { to: "/demo/history", label: "历史", icon: "🕐" },
  { to: "/demo/features", label: "能力地图", icon: "🗺" },
];

export function Shell() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const nav = useNavigate();

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="app">
      <aside className="aside">
        <div className="logo">
          <span>王旭 · 交互演示</span>
          <small>Agent + iMean AI</small>
          <Link to="/" className="back-home">← 返回作品集</Link>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "on" : "")}>
              <span>{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="aside-foot">
          <span>{user}</span>
          <button type="button" onClick={() => { logout(); nav("/"); }}>
            退出
          </button>
        </div>
      </aside>
      <section className="content">
        <Outlet />
      </section>
    </div>
  );
}
