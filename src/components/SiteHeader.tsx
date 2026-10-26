import { useLocation, useNavigate } from "react-router-dom";

export type PortalTab = "ownagent" | "lab" | "resume";

interface SiteHeaderProps {
  activeTab?: PortalTab;
  onSelectTab?: (tab: PortalTab) => void;
  standalone?: boolean;
}

/**
 * 全站常驻顶栏 — 极简三大板块选项卡（同一页面内平滑切换）
 * 1. OwnAgent（深度合并首页与工作台为统一旗舰平台）
 * 2. 实验室（技术探索、算法实验台与全量作品库）
 * 3. 个人履历（架构背景、项目履历与联系方式）
 */
export function SiteHeader({ activeTab: propActiveTab, onSelectTab }: SiteHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // 若未传入 activeTab，则根据当前路由自动匹配
  const currentTab: PortalTab =
    propActiveTab ??
    (location.pathname.startsWith("/lab")
      ? "lab"
      : location.pathname.startsWith("/resume") || location.pathname === "/about"
      ? "resume"
      : "ownagent");

  const handleTabClick = (tab: PortalTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else {
      const target = tab === "lab" ? "/lab" : tab === "resume" ? "/resume" : "/";
      navigate(target);
    }
  };

  return (
    <header className="site-header oa-persistent-header">
      <div
        className="site-header-mark"
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.65rem" }}
        onClick={() => handleTabClick("ownagent")}
        title="切换至 OwnAgent 旗舰平台"
      >
        <span
          className="site-header-mark-icon"
          aria-hidden="true"
          style={{
            background: "linear-gradient(135deg, #6366f1, #06b6d4)",
            borderRadius: "6px",
            boxShadow: "0 0 12px rgba(99, 102, 241, 0.45)",
          }}
        />
        <span className="site-header-mark-label">OwnAgent</span>
        <span
          className="site-header-mark-tag"
          style={{
            fontSize: "0.68rem",
            padding: "1px 6px",
            borderRadius: "4px",
            background: "rgba(99, 102, 241, 0.15)",
            color: "#818cf8",
            border: "1px solid rgba(99, 102, 241, 0.3)",
          }}
        >
          v2.4
        </span>
      </div>

      <div className="site-header-actions">
        <nav className="site-header-nav" role="tablist" aria-label="全站三联平滑导航">
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "ownagent"}
            className={currentTab === "ownagent" ? "on" : ""}
            onClick={() => handleTabClick("ownagent")}
          >
            OwnAgent
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "lab"}
            className={currentTab === "lab" ? "on" : ""}
            onClick={() => handleTabClick("lab")}
          >
            实验室
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "resume"}
            className={currentTab === "resume" ? "on" : ""}
            onClick={() => handleTabClick("resume")}
          >
            个人履历
          </button>
        </nav>
      </div>
    </header>
  );
}
