import { useState } from "react";
import { Link } from "react-router-dom";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { WorkTenureLive } from "../components/WorkTenureLive";
import { profile } from "../data/profile";
import { HOME_PRODUCT, LAB_WORKS, PROJECT_WORKS } from "../data/works";

export function HomePage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);

  return (
    <>
      <SiteShell footer={<SiteFooter />}>
        <header className="site-home-hero">
          <p className="site-home-eyebrow">
            {profile.title}
            <span className="site-home-eyebrow-sep">·</span>
            {profile.careerStartLabel}
          </p>
          <h1>{profile.name}</h1>
          <p className="site-home-pitch">{profile.homePitch}</p>
          <WorkTenureLive startDate={profile.careerStart} startLabel={profile.careerStartLabel} />

          <ul className="site-home-metrics" aria-label="概要">
            {profile.homeMetrics.map((m) => (
              <li key={m.label}>
                <strong>{m.value}</strong>
                <span>{m.label}</span>
              </li>
            ))}
          </ul>
        </header>

        <section className="works-section works-section-product">
          <div className="works-section-head">
            <h2 className="works-section-label">浏览器扩展</h2>
            <span className="works-section-hint">自用工具 · 可下载</span>
          </div>
          <div className="home-featured-grid home-featured-grid--product">
            <FeaturedWorkCard work={HOME_PRODUCT} onBrief={() => setBriefSlug(HOME_PRODUCT.slug)} />
          </div>
          <div className="home-product-extra">
            <Link to="/tools/clips" className="home-product-extra-link">
              <span className="home-product-extra-icon">📎</span>
              <span>
                <strong>片段库</strong>
                <em>标签 · 全文搜索 · 按站点分组</em>
              </span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        <section className="works-section works-section-projects">
          <div className="works-section-head">
            <h2 className="works-section-label">项目</h2>
            <span className="works-section-hint">iMean 自动化平台相关</span>
          </div>
          <div className="home-featured-grid home-featured-grid--flagship">
            {PROJECT_WORKS.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} onBrief={() => setBriefSlug(w.slug)} />
            ))}
          </div>
        </section>

        <section className="works-section works-section-lab">
          <div className="works-section-head">
            <h2 className="works-section-label">更多</h2>
            <span className="works-section-hint">Agent / SSE / 定位 / SDK 等模块</span>
          </div>
          <div className="home-featured-grid home-featured-grid--lab">
            {LAB_WORKS.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} compact onBrief={() => setBriefSlug(w.slug)} />
            ))}
          </div>
        </section>
      </SiteShell>

      <WorkBriefModal slug={briefSlug} onClose={() => setBriefSlug(null)} />
    </>
  );
}
