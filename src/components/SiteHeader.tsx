import { useLocation, useNavigate } from "react-router-dom";

export type PortalTab = "home" | "workbench" | "lab" | "resume";

interface SiteHeaderProps {
  activeTab?: PortalTab;
  onSelectTab?: (tab: PortalTab) => void;
  onEnterWorkbench?: () => void;
  standalone?: boolean;
}

/**
 * 全站常驻顶栏 — 专业 SaaS 门户规范
 * 左侧：OwnAgent 品牌 Logo
 * 中间/右侧：[ 首页 ] [ 实验室 ] [ 个人履历 ] + 高亮行动召唤 [ 进入工作台 → ]
 */
export function SiteHeader({
  activeTab: propActiveTab,
  onSelectTab,
  onEnterWorkbench,
}: SiteHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // 若未传入 activeTab，则根据当前路由自动匹配
  const currentTab: PortalTab =
    propActiveTab ??
    (location.pathname.startsWith("/lab")
      ? "lab"
      : location.pathname.startsWith("/resume") || location.pathname === "/about"
      ? "resume"
      : location.pathname.startsWith("/work") || location.pathname === "/workbench"
      ? "workbench"
      : "home");

  const handleTabClick = (tab: PortalTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else {
      const target =
        tab === "lab"
          ? "/lab"
          : tab === "resume"
          ? "/resume"
          : tab === "workbench"
          ? "/work/ownagent"
          : "/";
      navigate(target);
    }
  };

  return (
    <header className="site-header oa-persistent-header">
      <div
        className="site-header-mark"
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.65rem" }}
        onClick={() => handleTabClick("home")}
        title="返回 OwnAgent 首页"
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
          企业版
        </span>
      </div>

      <div className="site-header-actions">
        <nav className="site-header-nav" role="tablist" aria-label="全站导航">
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === "home"}
            className={currentTab === "home" ? "on" : ""}
            onClick={() => handleTabClick("home")}
          >
            首页
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
