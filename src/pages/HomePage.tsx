import { useState } from "react";
import { Link } from "react-router-dom";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { SiteHeader } from "../components/SiteHeader";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { profile } from "../data/profile";
import { WORKS } from "../data/works";

export function HomePage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);

  return (
    <div className="site-home">
      <div className="site-home-ambient" aria-hidden="true" />
      <div className="site-home-inner">
        <SiteHeader />

        <header className="site-home-head">
          <p className="site-home-eyebrow">Portfolio</p>
          <h1>{profile.name}</h1>
          <p className="site-tagline">{profile.tagline}</p>
        </header>

        <section className="works-section">
          <h2 className="works-section-label">全部作品</h2>
          <div className="home-featured-grid">
            {WORKS.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} onBrief={() => setBriefSlug(w.slug)} />
            ))}
          </div>
        </section>

        <footer className="site-home-foot">
          <span>© {new Date().getFullYear()} {profile.name}</span>
          <nav className="site-home-foot-nav">
            <Link to="/resume">完整简历</Link>
            <a href={`mailto:${profile.email}`}>邮件</a>
          </nav>
        </footer>
      </div>

      <WorkBriefModal slug={briefSlug} onClose={() => setBriefSlug(null)} />
    </div>
  );
}
