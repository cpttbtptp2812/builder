import { Link } from "react-router-dom";
import { profile } from "../data/profile";

/** 全站页脚 — OwnAgent 品牌 / 作品 / 简历 / 插件集 / 邮件 */
export function SiteFooter() {
  return (
    <footer className="site-home-foot">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start" }}>
        <span>
          © {new Date().getFullYear()} <strong>OwnAgent</strong> · Powered by {profile.name}
        </span>
        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
          Domain: ownagent.com.cn · Next-Gen Autonomous AI Agent Platform
        </span>
      </div>
      <nav className="site-home-foot-nav" aria-label="页脚导航">
        <Link to="/">OwnAgent 首页</Link>
        <Link to="/work/ownagent">智能体工作台</Link>
        <Link to="/lab">创新实验室与作品</Link>
        <Link to="/resume">个人履历</Link>
        <Link to="/tools/extensions">联调工具包</Link>
        <a href={`mailto:${profile.email}`}>商务与合作</a>
      </nav>
    </footer>
  );
}
