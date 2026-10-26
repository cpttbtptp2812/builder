import { useState } from "react";
import { FeaturedWorkCard } from "../components/home/FeaturedWorkCard";
import { ExtensionHomeCard } from "../components/home/ExtensionHomeCard";
import { ToolkitHomeCard } from "../components/home/ToolkitHomeCard";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { WorkBriefModal } from "../components/WorkBriefModal";
import { PlatformLab } from "../components/platform/PlatformLab";
import { PERSONAL_EXTENSIONS } from "../data/clipHubExtensions";
import { profile } from "../data/profile";
import { ENGINEERING_WORKS, IMEAN_WORKS, LAB_WORKS, PERSONAL_WORKS } from "../data/works";
import { formatWorkTenure, useWorkTenure } from "../lib/workTenure";

type CategoryTab = "all" | "lab" | "platform" | "personal" | "engineering";

/** 技术实验室与作品展台（采用深色高对比度玻璃拟态，全站统一视觉） */
export function LabPage() {
  const [briefSlug, setBriefSlug] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const tenure = useWorkTenure(profile.careerStart);

  const tabs: { id: CategoryTab; label: string; count: number }[] = [
    { id: "all", label: "全部内容", count: LAB_WORKS.length + IMEAN_WORKS.length + PERSONAL_WORKS.length + ENGINEERING_WORKS.length + 1 },
    { id: "lab", label: "算法与实验台", count: LAB_WORKS.length + 1 },
    { id: "platform", label: "平台项目", count: IMEAN_WORKS.length },
    { id: "personal", label: "独立产品与插件", count: PERSONAL_WORKS.length + PERSONAL_EXTENSIONS.length + 1 },
    { id: "engineering", label: "工程实践", count: ENGINEERING_WORKS.length },
  ];

  return (
    <div className="oa-landing-page oa-lab-page oa-page-enter">
      <SiteHeader />

      <main className="oa-landing-inner">
        {/* 实验室与作品库顶部介绍卡片 */}
        <header className="lab-header-hero">
          <div className="lab-badge-row">
            <span className="lab-status-badge">Innovation Lab & Works</span>
            <span className="lab-tenure-badge">
              从业 <strong>{formatWorkTenure(tenure)}</strong>
            </span>
          </div>
          <h1>{profile.name} · 创新实验室与作品库</h1>
          <p className="site-home-pitch">
            {profile.title} · {profile.subtitle}。{profile.homePitchPrefix}{" "}
            <strong className="site-home-tenure-inline">{formatWorkTenure(tenure)}</strong>
            ，{profile.homePitchBody}
          </p>

          {/* 高对比度分类筛选器 */}
          <div className="lab-category-filter" role="tablist" aria-label="作品分类筛选">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`lab-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="lab-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>
        </header>

        {/* 1. OwnAgent 算法实验台 (HiGHS MILP, Merkle 验真, 规则求解) */}
        {(activeTab === "all" || activeTab === "lab") && (
          <section className="works-section works-section-own-lab" aria-label="OwnAgent 实验台">
            <div className="works-section-head">
              <h2 className="works-section-label">⚡ 交互实验台</h2>
              <span className="works-section-hint">事件溯源 · HiGHS MILP · Merkle 证据 · 规则求解</span>
            </div>
            <PlatformLab />
          </section>
        )}

        {/* 2. 技术探索与实验室卡片 */}
        {(activeTab === "all" || activeTab === "lab") && (
          <section className="works-section works-section-lab">
            <div className="works-section-head">
              <h2 className="works-section-label">🧪 技术前沿探索</h2>
              <span className="works-section-hint">Agent Trace · SSE · 定位 · SDK 机制</span>
            </div>
            <div className="home-featured-grid home-featured-grid--lab">
              {LAB_WORKS.map((w) => (
                <FeaturedWorkCard key={w.id} work={w} compact onBrief={() => setBriefSlug(w.slug)} />
              ))}
            </div>
          </section>
        )}

        {/* 3. 平台实践 (iMean 在职) */}
        {(activeTab === "all" || activeTab === "platform") && (
          <section className="works-section works-section-imean">
            <div className="works-section-head">
              <h2 className="works-section-label">💼 平台项目</h2>
              <span className="works-section-hint">iMean 在职 · 企业级智能体平台</span>
            </div>
            <div className="home-featured-grid home-featured-grid--platform">
              {IMEAN_WORKS.map((w) => (
                <FeaturedWorkCard key={w.id} work={w} compact={false} onBrief={() => setBriefSlug(w.slug)} />
              ))}
            </div>
          </section>
        )}

        {/* 4. 个人产品与拓展套件 */}
        {(activeTab === "all" || activeTab === "personal") && (
          <section className="works-section works-section-personal">
            <div className="works-section-head">
              <h2 className="works-section-label">🚀 独立产品与套件</h2>
              <span className="works-section-hint">独立设计、全栈研发与工具生态</span>
            </div>
            <div className="home-featured-grid home-featured-grid--personal">
              {PERSONAL_WORKS.map((w) => (
                <FeaturedWorkCard key={w.id} work={w} compact={false} onBrief={() => setBriefSlug(w.slug)} />
              ))}
              {PERSONAL_EXTENSIONS.map((ext) => (
                <ExtensionHomeCard key={ext.id} ext={ext} />
              ))}
              <ToolkitHomeCard />
            </div>
          </section>
        )}

        {/* 5. 工程重构实践 (阿里剑池) */}
        {(activeTab === "all" || activeTab === "engineering") && (
          <section className="works-section works-section-engineering">
            <div className="works-section-head">
              <h2 className="works-section-label">⚙️ 工程实践</h2>
              <span className="works-section-hint">阿里剑池 · 性能重构与大型工程</span>
            </div>
            <div className="home-featured-grid home-featured-grid--solo">
              {ENGINEERING_WORKS.map((w) => (
                <FeaturedWorkCard key={w.id} work={w} compact={false} onBrief={() => setBriefSlug(w.slug)} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
      <WorkBriefModal slug={briefSlug} onClose={() => setBriefSlug(null)} />
    </div>
  );
}
