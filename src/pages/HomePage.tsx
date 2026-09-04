import { useState } from "react";
import { Link } from "react-router-dom";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { WorkTenureLive } from "../components/WorkTenureLive";
import { profile } from "../data/profile";
import { FLAGSHIP_WORKS, LAB_WORKS } from "../data/works";

export function HomePage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);

  return (
    <>
      <SiteShell footer={<SiteFooter />}>
        <header className="site-home-hero">
          <p className="site-home-eyebrow">
            {profile.title}
            <span className="site-home-eyebrow-sep">·</span>
            {profile.availability}
          </p>
          <h1>{profile.name}</h1>
          <p className="site-home-pitch">{profile.homePitch}</p>
          <WorkTenureLive startDate={profile.careerStart} startLabel={profile.careerStartLabel} />

          <ul className="site-home-metrics" aria-label="核心成果">
            {profile.homeMetrics.map((m) => (
              <li key={m.label}>
                <strong>{m.value}</strong>
                <span>{m.label}</span>
              </li>
            ))}
          </ul>

      
        </header>

        <section className="works-section works-section-flagship">
          <div className="works-section-head">
            <h2 className="works-section-label">核心项目</h2>
            <span className="works-section-hint">均可在线试用 · 3 分钟看完</span>
          </div>
          <div className="home-featured-grid home-featured-grid--flagship">
            {FLAGSHIP_WORKS.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} onBrief={() => setBriefSlug(w.slug)} />
            ))}
          </div>
        </section>

        <section className="works-section works-section-lab">
          <div className="works-section-head">
            <h2 className="works-section-label">技术深潜</h2>
            <span className="works-section-hint">想深挖 SSE / 定位 / SDK 的实现细节</span>
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
