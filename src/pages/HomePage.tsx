import { useState } from "react";
import { Link } from "react-router-dom";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { SiteShell } from "../components/SiteShell";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { profile } from "../data/profile";
import { WORKS } from "../data/works";

export function HomePage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);

  return (
    <>
      <SiteShell
        footer={
          <footer className="site-home-foot">
            <span>
              © {new Date().getFullYear()} {profile.name}
            </span>
            <nav className="site-home-foot-nav">
              <Link to="/resume">完整简历</Link>
              <a href={`mailto:${profile.email}`}>邮件</a>
            </nav>
          </footer>
        }
      >
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
