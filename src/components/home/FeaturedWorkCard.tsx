import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { getClipHubDownloadUrls } from "../../data/clipHubRelease";
import { TechBadgeBar } from "../TechBadgeBar";
import type { Work } from "../../data/works";
import { MiniClipHubLive } from "./MiniClipHubLive";
import { MiniMatchLive } from "./MiniMatchLive";
import { MiniTeaserLive } from "./MiniTeaserLive";
import { MiniToolLive } from "./MiniToolLive";

function WorkMiniDemo({ work }: { work: Work }) {
  if (work.slug === "clip-hub") return <MiniClipHubLive />;
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
  const isClipHub = work.slug === "clip-hub";
  const { extensionUrl } = isClipHub ? getClipHubDownloadUrls() : { extensionUrl: "" };

  return (
    <article
      className={`home-featured-card${isClipHub ? " home-featured-card--product" : ""}`}
      style={{ "--card-accent": work.accent } as CSSProperties}
    >
      <div className="home-featured-top">
        <span className="home-featured-badge">{work.subtitle}</span>
        <h3>{work.title}</h3>
        <p>{work.desc}</p>
        <TechBadgeBar items={work.stack.slice(0, 3)} />
      </div>

      <div className="home-featured-demo">
        <WorkMiniDemo work={work} />
      </div>

      <div className="home-featured-actions">
        {isClipHub ? (
          <>
            <Link to="/tools/clip-hub" className="home-featured-cta">
              下载与说明
              <span aria-hidden>→</span>
            </Link>
            <a
              href={extensionUrl}
              className="home-note-btn home-note-btn--dl"
              download
              rel="noopener noreferrer"
            >
              插件 zip
            </a>
          </>
        ) : (
          <>
            <Link to={`/work/${work.slug}?demo=1`} className="home-featured-cta">
              进入演示
              <span aria-hidden>→</span>
            </Link>
            <button type="button" className="home-note-btn" onClick={onBrief}>
              笔记
            </button>
          </>
        )}
      </div>
    </article>
  );
}
