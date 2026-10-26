import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SiteHeader, type PortalTab } from "../components/SiteHeader";
import { HomePage } from "./HomePage";
import { LabPage } from "./LabPage";
import { ResumePage } from "./ResumePage";

/**
 * UnifiedAppPortal — 统一单页门户体系（同一页面内无缝平滑切换）
 * 彻底消除“右上角导航点一下跳一个页面”的突兀感：
 * 1. 首页与工作室深度融合为「OwnAgent」旗舰平台单页；
 * 2. 导航栏简化为三大核心板块：[ OwnAgent ] [ 实验室 ] [ 个人履历 ]；
 * 3. 顶栏全站常驻不卸载，点击切换仅在同一个页面内平滑变更内容区域；
 * 4. 同步更新 URL Hash，保持外部链接可直接分享直达对应板块。
 */
export function UnifiedAppPortal() {
  const location = useLocation();
  const navigate = useNavigate();

  // 根据当前路径初始化 Tab
  function getTabFromPath(pathname: string): PortalTab {
    if (pathname.startsWith("/lab")) return "lab";
    if (pathname.startsWith("/resume") || pathname === "/about") return "resume";
    return "ownagent";
  }

  const [activeTab, setActiveTab] = useState<PortalTab>(() => getTabFromPath(location.pathname));

  // 当外部链接跳转或浏览器前进后退时，自动同步激活 Tab
  useEffect(() => {
    const nextTab = getTabFromPath(location.pathname);
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [location.pathname, activeTab]);

  // 点击顶栏 Tab：在同一个页面内瞬时切换，并平滑同步 URL
  function handleSelectTab(tab: PortalTab) {
    if (tab === activeTab) return;
    setActiveTab(tab);

    let targetPath = "/";
    if (tab === "lab") targetPath = "/lab";
    else if (tab === "resume") targetPath = "/resume";

    // 切换 URL 时使用 replace 保持平滑，不产生生硬的页面重载
    navigate(targetPath, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="oa-unified-portal">
      {/* 顶栏常驻，切 Tab 时绝不卸载或跳动 */}
      <SiteHeader
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      />

      {/* 同一页面内的选项卡视图区 */}
      <div className="oa-portal-stage" key={activeTab}>
        {activeTab === "ownagent" && (
          <HomePage onNavigateTab={handleSelectTab} embedMode />
        )}
        {activeTab === "lab" && (
          <LabPage embedMode />
        )}
        {activeTab === "resume" && (
          <ResumePage embedMode />
        )}
      </div>
    </div>
  );
}
