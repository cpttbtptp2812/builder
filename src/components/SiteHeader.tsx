import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SecretStarButton, SecretStarModal } from "./SecretStarGate";

/** 全站顶栏 — OwnAgent 旗舰品牌标识 + 统一全局导航 */
export function SiteHeader() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  const onWorkbench = loc.pathname.startsWith("/work/ownagent");
  const onLab = loc.pathname === "/lab";
  const onResume = loc.pathname === "/resume";
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <Link to="/" className="site-header-mark" aria-label="OwnAgent 官网首页">
          <span className="site-header-mark-icon" aria-hidden="true" style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)", borderRadius: "6px" }} />
          <span className="site-header-mark-label" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>OwnAgent</span>
          <span className="site-header-mark-tag" style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: "4px", background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
            v2.4
          </span>
        </Link>

        <div className="site-header-actions">
          <nav className="site-header-nav" aria-label="主导航">
            <Link to="/" className={onHome ? "on" : ""}>
              首页
            </Link>
            <Link to="/work/ownagent" className={onWorkbench ? "on" : ""}>
              工作台
            </Link>
            <Link to="/lab" className={onLab ? "on" : ""}>
              实验室
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
              title="返回 OwnAgent 首页"
              aria-label="返回 OwnAgent 首页"
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
              <span>主页</span>
            </Link>
          )}
        </div>
      </header>

      <SecretStarModal open={gateOpen} onClose={() => setGateOpen(false)} />
    </>
  );
}
