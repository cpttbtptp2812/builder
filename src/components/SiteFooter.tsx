import { Link } from "react-router-dom";
import { profile } from "../data/profile";

/** 全站页脚 — 作品 / 简历 / ClipHub / 邮件 */
export function SiteFooter() {
  return (
    <footer className="site-home-foot">
      <span>
        © {new Date().getFullYear()} {profile.name}
      </span>
      <nav className="site-home-foot-nav" aria-label="页脚导航">
        <Link to="/">全部作品</Link>
        <Link to="/resume">完整简历</Link>
        <Link to="/tools/clip-hub">ClipHub 工具</Link>
        <a href={`mailto:${profile.email}`}>邮件</a>
      </nav>
    </footer>
  );
}
