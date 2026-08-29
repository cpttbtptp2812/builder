import { useState } from "react";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { profile } from "../data/profile";
import { WORKS } from "../data/works";

export function HomePage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);

  return (
    <>
      <SiteShell footer={<SiteFooter />}>
        <header className="site-home-head">
          <p className="site-home-eyebrow">Portfolio</p>
          <h1>{profile.name}</h1>
          <p className="site-tagline">{profile.tagline}</p>
        </header>

        <section className="works-section">
          <div className="works-section-head">
            <h2 className="works-section-label">全部作品</h2>
            <span className="works-section-count">{WORKS.length} 项</span>
          </div>
          <div className="home-featured-grid">
            {WORKS.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} onBrief={() => setBriefSlug(w.slug)} />
            ))}
          </div>
        </section>
      </SiteShell>

      <WorkBriefModal slug={briefSlug} onClose={() => setBriefSlug(null)} />
    </>
  );
}
