import { TechBadgeBar } from "../components/TechBadgeBar";
import { WorkGuide } from "../components/WorkGuide";
import { SseSplitView } from "../components/fx/SseSplitView";
import { STREAM_PROBE } from "../data/streamProbe";
import { getWork } from "../data/works";

/** StreamProbe — 流式 API 浏览器调试器（作品页 · 技术演示） */
export function WorkStreamProbe() {
  const work = getWork("streamprobe");

  return (
    <div className="work-streamprobe work-tech-lab">
      <WorkGuide slug="streamprobe" />
      <TechBadgeBar items={work?.stack ?? STREAM_PROBE.stack.slice(0, 4)} />

      <div className="tech-lab">
        <header className="tech-lab-head tech-lab-head--compact">
          <h3>帧级观测演示</h3>
          <p>左侧 Raw SSE 帧 · 右侧 AI SDK 语义解析</p>
        </header>
        <SseSplitView />
      </div>
    </div>
  );
}
