import { useSearchParams } from "react-router-dom";
import { AgentSkillsDemo } from "../components/fx/AgentSkillsDemo";
import { WorkGuide } from "../components/WorkGuide";
import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";
import { getWork } from "../data/works";

/** SkillForge — Skill Runtime Lab */
export function WorkSkills() {
  const [params] = useSearchParams();
  const trySkillId = params.get("try") ?? params.get("skill");
  const agent = getWork("agent");

  return (
    <div className="work-skills work-tech-lab">
      <WorkGuide slug="skills" />

      <AgentSkillsDemo initialSkillId={trySkillId} trySkillId={trySkillId} />

      {agent && (
        <WorkTechDeepLinks
          intro="上面 Skill 流水线的 http_probe、browser_snapshot、workflow_run 走同一套 MCP tools/call。要看 SSE 流式对话 + 完整 JSON-RPC 报文对照 + Reasoning / Tool Call 产品体验："
          links={[agent]}
        />
      )}
    </div>
  );
}
