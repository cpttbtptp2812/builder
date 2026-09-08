import { Link } from "react-router-dom";
import { profile } from "../data/profile";

/** 全站页脚 — 作品 / 简历 / 插件集 / 邮件 */
export function SiteFooter() {
  return (
    <footer className="site-home-foot">
      <span>
        © {new Date().getFullYear()} {profile.name}
      </span>
      <nav className="site-home-foot-nav" aria-label="页脚导航">
        <Link to="/">全部作品</Link>
        <Link to="/resume">个人履历</Link>
        <Link to="/tools/extensions">插件集</Link>
        <Link to="/tools/clips">片段库</Link>
        <a href={`mailto:${profile.email}`}>邮件</a>
      </nav>
    </footer>
  );
}
