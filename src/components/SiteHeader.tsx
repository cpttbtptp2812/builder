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
              完整简历
            </Link>
          </nav>
          <SecretStarButton onOpen={() => setGateOpen(true)} />
        </div>
      </header>

      <SecretStarModal open={gateOpen} onClose={() => setGateOpen(false)} />
    </>
  );
}
