import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { TechBadgeBar } from "../TechBadgeBar";
import type { Work } from "../../data/works";
import { MiniMatchLive } from "./MiniMatchLive";
import { MiniTeaserLive } from "./MiniTeaserLive";
import { MiniToolLive } from "./MiniToolLive";

function WorkMiniDemo({ work }: { work: Work }) {
  if (work.slug === "imean") return <MiniMatchLive />;
  if (work.slug === "agent") return <MiniToolLive />;
  return <MiniTeaserLive work={work} />;
}

export function FeaturedWorkCard({
  work,
  onBrief,
}: {
  work: Work;
  onBrief: () => void;
}) {
  return (
    <article
      className="home-featured-card"
      style={{ "--card-accent": work.accent } as CSSProperties}
    >
      <div className="home-featured-top">
        <div>
          <span className="home-featured-badge">{work.subtitle}</span>
          <h3>{work.title}</h3>
          <p>{work.desc}</p>
          <TechBadgeBar items={work.stack.slice(0, 4)} />
        </div>
        <time>{work.period}</time>
      </div>

      <div className="home-featured-demo">
        <WorkMiniDemo work={work} />
      </div>

      <div className="home-featured-actions">
        <Link to={`/work/${work.slug}?demo=1`} className="home-featured-cta">
          进入完整演示
          <span aria-hidden>→</span>
        </Link>
        <button type="button" className="home-note-btn" onClick={onBrief}>
          笔记
        </button>
      </div>
    </article>
  );
}
