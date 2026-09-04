import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Work } from "../../data/works";

export function WorkCard({
  work,
  onBrief,
}: {
  work: Work;
  onBrief: () => void;
}) {
  return (
    <article
      className="home-work-card-wrap"
      style={{ "--card-accent": work.accent } as CSSProperties}
    >
      <Link to={`/work/${work.slug}`} className="home-work-card">
        <div className="home-work-card-top">
          <h3>{work.title}</h3>
          {work.impact ? <span className="home-work-card-impact">{work.impact}</span> : null}
        </div>
        <p>{work.desc}</p>
        <span className="home-work-card-arrow">查看演示 →</span>
      </Link>
      <button type="button" className="home-note-btn outline" onClick={onBrief}>
        笔记
      </button>
    </article>
  );
}
