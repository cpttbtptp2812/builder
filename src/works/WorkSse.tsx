import { TechBadgeBar } from "../components/TechBadgeBar";
import { WorkGuide } from "../components/WorkGuide";
import { SseSplitView } from "../components/fx/SseSplitView";

/** GraphQL SSE → AI SDK Provider */
export function WorkSse() {
  return (
    <div className="work-sse work-tech-lab">
      <WorkGuide slug="sse" />
      <TechBadgeBar items={["SSE 帧解析", "UIMessage", "node:http", "useAutoResume"]} />

      <div className="tech-lab">
        <SseSplitView />
      </div>
    </div>
  );
}
