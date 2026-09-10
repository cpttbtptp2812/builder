import { useState } from "react";
import { Link } from "react-router-dom";
import { ExtensionHomeCard } from "../components/home/ExtensionHomeCard";
import { ToolkitHomeCard } from "../components/home/ToolkitHomeCard";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { WorkTenureLive } from "../components/WorkTenureLive";
import { STANDALONE_EXTENSIONS } from "../data/clipHubExtensions";
import { profile } from "../data/profile";
import { HOME_AGENT, LAB_WORKS, PROJECT_WORKS } from "../data/works";

export function HomePage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);

  return (
    <>
      <SiteShell footer={<SiteFooter />}>
        <header className="site-home-hero">
          {/* <p className="site-home-eyebrow">
            {profile.title}
            <span className="site-home-eyebrow-sep">·</span>
            {profile.careerStartLabel}
          </p> */}
          <h1>{profile.name}</h1>
          <p className="site-home-pitch">{profile.homePitch}</p>
          <WorkTenureLive startDate={profile.careerStart} startLabel={profile.careerStartLabel} />

          {/* <ul className="site-home-metrics" aria-label="概要">
            {profile.homeMetrics.map((m) => (
              <li key={m.label}>
                <strong>{m.value}</strong>
                <span>{m.label}</span>
              </li>
            ))}
          </ul> */}
        </header>

        <section className="works-section works-section-agent">
          <div className="works-section-head">
            <h2 className="works-section-label">AI Agent</h2>
            <span className="works-section-hint">对话 · Skills · RAG · 路由回归</span>
          </div>
          <div className="home-featured-grid">
            <FeaturedWorkCard work={HOME_AGENT} compact onBrief={() => setBriefSlug(HOME_AGENT.slug)} />
          </div>
        </section>

        <section className="works-section works-section-projects">
          <div className="works-section-head">
            <h2 className="works-section-label">项目</h2>
            <span className="works-section-hint">iMean 自动化平台相关</span>
          </div>
          <div className="home-featured-grid">
            {PROJECT_WORKS.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} compact onBrief={() => setBriefSlug(w.slug)} />
            ))}
          </div>
        </section>
        
        <section className="works-section works-section-extensions">
          <div className="works-section-head">
            <h2 className="works-section-label">浏览器扩展</h2>
            <span className="works-section-hint">
              <Link to="/tools/extensions">联调工具包</Link>
            </span>
          </div>
          <div className="home-featured-grid">
            <ToolkitHomeCard />
            {STANDALONE_EXTENSIONS.map((ext) => (
              <ExtensionHomeCard key={ext.id} ext={ext} />
            ))}
          </div>
        </section>

       

        <section className="works-section works-section-lab">
          <div className="works-section-head">
            <h2 className="works-section-label">更多</h2>
            <span className="works-section-hint">SSE / 定位 / SDK / 录制</span>
          </div>
          <div className="home-featured-grid">
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
