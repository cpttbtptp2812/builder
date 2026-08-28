import type { CSSProperties } from "react";
import { getWorkExplain } from "../data/workExplains";
import { getWork } from "../data/works";

/** 项目演示页顶部 — 通俗说明 + 对比 */
export function WorkGuide({ slug }: { slug: string }) {
  const guide = getWorkExplain(slug);
  const work = getWork(slug);
  if (!guide) return null;

  return (
    <section
      className="work-guide"
      style={{ "--guide-accent": work?.accent ?? "#0d9488" } as CSSProperties}
    >
      {work && (
        <p className="work-guide-desc-match">
          <span>首页描述</span>
          {work.desc}
        </p>
      )}
      <p className="work-guide-label">一句话理解</p>
      <h2 className="work-guide-oneliner">{guide.oneLiner}</h2>
      <p className="work-guide-proves">
        <strong>演示在证明：</strong>
        {guide.demoProves}
      </p>

      {guide.compare && (
        <div className="work-guide-compare">
          <div className="work-guide-compare-card usual">
            <span className="work-guide-compare-tag">常见做法</span>
            <strong>{guide.compare.usual.title}</strong>
            <p>{guide.compare.usual.desc}</p>
          </div>
          <div className="work-guide-compare-arrow" aria-hidden>
            →
          </div>
          <div className="work-guide-compare-card here">
            <span className="work-guide-compare-tag">这个演示</span>
            <strong>{guide.compare.here.title}</strong>
            <p>{guide.compare.here.desc}</p>
          </div>
        </div>
      )}

      <div className="work-guide-steps">
        <strong>怎么试</strong>
        <ol>
          {guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
