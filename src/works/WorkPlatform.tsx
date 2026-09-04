import { AgentPlatformLab } from "../components/fx/AgentPlatformLab";
import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";
import { getWork } from "../data/works";

/** Agent Platform Lab — 引导式三能力演示 */
export function WorkPlatform() {
  const skills = getWork("skills");

  return (
    <div className="work-platform work-tech-lab">
      <AgentPlatformLab />

      {skills && (
        <WorkTechDeepLinks
          intro="Platform Lab 是「平台层」总览。往下看 Skill 层：同一套 MCP 工具怎么被 SKILL.md 流水线逐步调用："
          links={[skills]}
        />
      )}
    </div>
  );
}
