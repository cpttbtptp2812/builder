import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CursorParticles } from "./CursorParticles";
import { SiteAmbient } from "./SiteAmbient";
import { SiteHeader } from "./SiteHeader";

type Props = {
  pageClass?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** 首页 / 履历 — 统一宽度、背景与切页动画 */
export function SiteShell({ pageClass = "", children, footer }: Props) {
  const { pathname } = useLocation();

  return (
    <div className={`site-home ${pageClass}`.trim()}>
      <SiteAmbient />
      <CursorParticles />

      <div className="site-home-inner">
        <SiteHeader />

        <div key={pathname} className="site-page-main">
          {children}
        </div>

        {footer}
      </div>
    </div>
  );
}
