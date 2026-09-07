import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { TechBadgeBar } from "../TechBadgeBar";
import type { Work } from "../../data/works";
import { MiniClipHubLive } from "./MiniClipHubLive";
import { MiniMatchLive } from "./MiniMatchLive";
import { MiniTeaserLive } from "./MiniTeaserLive";
import { MiniSkillsLive } from "./MiniSkillsLive";
import { MiniToolLive } from "./MiniToolLive";

function WorkMiniDemo({ work }: { work: Work }) {
  if (work.slug === "extension-hub") return <MiniClipHubLive />;
  if (work.slug === "imean") return <MiniMatchLive />;
  if (work.slug === "skills") return <MiniSkillsLive />;
  if (work.slug === "agent") return <MiniToolLive />;
  return <MiniTeaserLive work={work} />;
}

export function FeaturedWorkCard({
  work,
  compact = false,
  onBrief,
}: {
  work: Work;
  compact?: boolean;
  onBrief: () => void;
}) {
  const isExtensionHub = work.slug === "extension-hub";
  const isFlagship = work.tier === "flagship";

  return (
    <article
      className={`home-featured-card${isFlagship ? " home-featured-card--flagship" : ""}${isExtensionHub ? " home-featured-card--product" : ""}${compact ? " home-featured-card--compact" : ""}`}
      style={{ "--card-accent": work.accent } as CSSProperties}
    >
      <div className="home-featured-top">
        <div className="home-featured-meta">
          <span className="home-featured-badge">{work.subtitle}</span>
          {work.impact && <span className="home-featured-impact">{work.impact}</span>}
        </div>
        <h3>{work.title}</h3>
        <p className="home-featured-hook">{work.hook}</p>
        {!compact && <p className="home-featured-desc">{work.desc}</p>}
        <TechBadgeBar items={work.stack.slice(0, 3)} />
      </div>

      {!compact && (
        <div className="home-featured-demo">
          <WorkMiniDemo work={work} />
        </div>
      )}

      <div className="home-featured-actions">
        {isExtensionHub ? (
          <Link to="/tools/extensions" className="home-featured-cta">
            浏览插件集
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <>
            <Link to={`/work/${work.slug}`} className="home-featured-cta">
              在线试用
              <span aria-hidden>→</span>
            </Link>
            <button type="button" className="home-note-btn" onClick={onBrief}>
              技术笔记
            </button>
          </>
        )}
      </div>
    </article>
  );
}
