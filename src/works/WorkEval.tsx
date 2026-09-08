import { useEffect } from "react";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { EvalLabPanel } from "../components/fx/EvalLabPanel";
import { WorkGuide } from "../components/WorkGuide";
import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";
import { getWork } from "../data/works";

/** Skill 路由测试页 */
export function WorkEval() {
  const agent = getWork("agent");
  const skills = getWork("skills");
  const platform = getWork("platform");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const links = [agent, skills, platform].filter(Boolean);

  return (
    <div className="work-eval">
      <WorkGuide slug="eval" />
      <BackendStatusBar compact />
      <EvalLabPanel />
      {links.length > 0 && (
        <WorkTechDeepLinks
          intro="评测验证的是 Agent 链路质量。相关模块：对话入口、Skill 运行时、RAG / Multi-Agent 平台层。"
          links={links}
        />
      )}
    </div>
  );
}
