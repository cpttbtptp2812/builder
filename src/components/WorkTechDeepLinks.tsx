import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

export type TechDeepLink = {
  slug: string;
  title: string;
  subtitle: string;
  desc: string;
  stack: string[];
  accent: string;
};

type Props = {
  intro: string;
  links: TechDeepLink[];
};

/** 成品页底部 — 醒目的底层技术实验室入口 */
export function WorkTechDeepLinks({ intro, links }: Props) {
  return (
    <section className="work-tech-deep-bar" aria-label="底层技术实验室">
      <div className="work-tech-deep-bar-head">
        <span className="work-tech-deep-bar-badge">底层技术</span>
        <div>
          <h3 className="work-tech-deep-bar-title">想深挖实现？点进实验室 →</h3>
          <p className="work-tech-deep-bar-intro">{intro}</p>
        </div>
      </div>

      <div className="work-tech-deep-bar-grid">
        {links.map((item) => (
          <Link
            key={item.slug}
            to={`/work/${item.slug}`}
            className="work-tech-deep-card"
            style={{ "--tech-accent": item.accent } as CSSProperties}
          >
            <div className="work-tech-deep-card-top">
              <span className="work-tech-deep-card-kicker">{item.subtitle}</span>
              <span className="work-tech-deep-card-go" aria-hidden>
                进入
              </span>
            </div>
            <strong className="work-tech-deep-card-title">{item.title}</strong>
            <p className="work-tech-deep-card-desc">{item.desc}</p>
            <div className="work-tech-deep-card-tags">
              {item.stack.slice(0, 4).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
