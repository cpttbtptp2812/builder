import { useState } from "react";
import { ExtensionHomeCard } from "../components/home/ExtensionHomeCard";
import { ToolkitHomeCard } from "../components/home/ToolkitHomeCard";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { PERSONAL_EXTENSIONS } from "../data/clipHubExtensions";
import { profile } from "../data/profile";
import { IMEAN_WORKS, LAB_WORKS, PERSONAL_WORKS } from "../data/works";
import { formatWorkTenure, useWorkTenure } from "../lib/workTenure";

export function HomePage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);
  const tenure = useWorkTenure(profile.careerStart);

  return (
    <>
      <SiteShell pageClass="site-home-compact">
        <header className="site-home-hero site-home-hero--compact">
          <p className="site-home-eyebrow">
            {profile.title}
            <span className="site-home-eyebrow-sep">·</span>
            {profile.subtitle}
          </p>
          <h1>{profile.name}</h1>
          <p className="site-home-pitch">
            {profile.homePitchPrefix}{" "}
            <strong className="site-home-tenure-inline">{formatWorkTenure(tenure)}</strong>
            ，{profile.homePitchBody}
          </p>
        </header>

        <section className="works-section works-section-imean">
          <div className="works-section-head">
            <h2 className="works-section-label">平台</h2>
            <span className="works-section-hint">iMean 在职</span>
          </div>
          <div className="home-featured-grid home-featured-grid--platform">
            {IMEAN_WORKS.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} compact onBrief={() => setBriefSlug(w.slug)} />
            ))}
          </div>
        </section>

        <section className="works-section works-section-personal">
          <div className="works-section-head">
            <h2 className="works-section-label">个人产品</h2>
            <span className="works-section-hint">独立设计与开发</span>
          </div>
          <div className="home-featured-grid home-featured-grid--personal">
            {PERSONAL_WORKS.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} compact onBrief={() => setBriefSlug(w.slug)} />
            ))}
            {PERSONAL_EXTENSIONS.map((ext) => (
              <ExtensionHomeCard key={ext.id} ext={ext} />
            ))}
            <ToolkitHomeCard />
          </div>
        </section>

        <section className="works-section works-section-lab">
          <div className="works-section-head">
            <h2 className="works-section-label">技术实验室</h2>
            <span className="works-section-hint">Agent Trace · SSE · 定位 · SDK</span>
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
