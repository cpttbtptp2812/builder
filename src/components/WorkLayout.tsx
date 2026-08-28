import type { CSSProperties } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { getWork } from "../data/works";

export function WorkLayout() {
  const { slug } = useParams();
  const work = slug ? getWork(slug) : null;

  return (
    <div className="work-shell site-work" style={{ "--work-accent": work?.accent ?? "#5eead4" } as CSSProperties}>
      <div className="site-work-inner">
        <SiteHeader />
        <div className="work-subhead">
          <Link to="/" className="work-back">← 全部作品</Link>
          {work && (
            <div className="work-title">
              <strong>{work.title}</strong>
              <span>{work.subtitle}</span>
            </div>
          )}
        </div>
        <main className="work-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
