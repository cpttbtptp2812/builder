import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SecretStarButton, SecretStarModal } from "./SecretStarGate";

/** 全站顶栏 — 品牌标识 + 分段导航 + 隐藏星星 */
export function SiteHeader() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  const onResume = loc.pathname === "/resume";
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <Link to="/" className="site-header-mark" aria-label="作品集首页">
          <span className="site-header-mark-icon" aria-hidden="true" />
          <span className="site-header-mark-label">Frontend · Automation</span>
        </Link>

        <div className="site-header-actions">
          <nav className="site-header-nav" aria-label="主导航">
            <Link to="/" className={onHome ? "on" : ""}>
              作品
            </Link>
            <Link to="/resume" className={onResume ? "on" : ""}>
              个人履历
            </Link>
          </nav>
          <SecretStarButton onOpen={() => setGateOpen(true)} />
          {!onHome && (
            <Link
              to="/"
              className="site-header-exit"
              title="退出返回主页"
              aria-label="退出返回主页"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v7A1.5 1.5 0 0 0 3.5 13H6M10.5 11.5L14 8l-3.5-3.5M14 8H5.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>退出</span>
            </Link>
          )}
        </div>
      </header>

      <SecretStarModal open={gateOpen} onClose={() => setGateOpen(false)} />
    </>
  );
}
