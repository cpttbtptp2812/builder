import { Link, useLocation } from "react-router-dom";

/** 全站顶栏 — 作品 / 履历 */
export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  const onResume = loc.pathname === "/resume";

  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand">
        wangxu.dev
      </Link>
      {!minimal && (
        <nav className="site-header-nav">
          <Link to="/" className={onHome ? "on" : ""}>
            作品
          </Link>
          <Link to="/resume" className={onResume ? "on" : ""}>
            完整简历
          </Link>
        </nav>
      )}
      <Link to="/resume" className={`btn-resume ${onResume ? "on" : ""}`}>
        完整简历 →
      </Link>
    </header>
  );
}
