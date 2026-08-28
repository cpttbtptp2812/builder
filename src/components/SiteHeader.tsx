import { Link, useLocation } from "react-router-dom";

/** 全站顶栏 — 品牌标识 + 分段导航 */
export function SiteHeader() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  const onResume = loc.pathname === "/resume";

  return (
    <header className="site-header">
      <Link to="/" className="site-header-mark" aria-label="作品集首页">
        <span className="site-header-mark-icon" aria-hidden="true" />
        <span className="site-header-mark-label">Frontend · Automation</span>
      </Link>

      <nav className="site-header-nav" aria-label="主导航">
        <Link to="/" className={onHome ? "on" : ""}>
          作品
        </Link>
        <Link to="/resume" className={onResume ? "on" : ""}>
          完整简历
        </Link>
      </nav>
    </header>
  );
}
