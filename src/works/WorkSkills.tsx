import { useSearchParams } from "react-router-dom";
import { AgentSkillsDemo } from "../components/fx/AgentSkillsDemo";
import { WorkGuide } from "../components/WorkGuide";
import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";
import { getWork } from "../data/works";

/** SkillForge — Skill Runtime Lab */
export function WorkSkills() {
  const [params] = useSearchParams();
  const trySkillId = params.get("try") ?? params.get("skill");
  const platform = getWork("platform");

  return (
    <div className="work-skills work-tech-lab">
      <WorkGuide slug="skills" />

      <AgentSkillsDemo initialSkillId={trySkillId} trySkillId={trySkillId} />

      {platform && (
        <WorkTechDeepLinks
          intro="Skill 是 MCP 之上的意图层。再往上看平台层：RAG 怎么召回知识、三个 Agent 怎么分工、Router 准确率多少 — 在 Platform Lab 30 秒跑通："
          links={[platform]}
        />
      )}
    </div>
  );
}
