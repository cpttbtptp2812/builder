import { useState } from "react";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { SiteShell } from "../components/SiteShell";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { PlatformLab } from "../components/platform/PlatformLab";
import { LAB_WORKS } from "../data/works";

/** 主页技术实验室卡片 + OwnAgent 实验台 */
export function LabPage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);

  return (
    <>
      <SiteShell pageClass="site-lab">
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

        <section className="works-section works-section-own-lab" aria-label="OwnAgent 实验台">
          <PlatformLab />
        </section>
      </SiteShell>

      <WorkBriefModal slug={briefSlug} onClose={() => setBriefSlug(null)} />
    </>
  );
}
