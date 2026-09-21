import type { PipelineStage } from "../../../lib/workingSet";

/** 理论四段流水线的对话内进度条 */
export function PipelineStrip({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="ua-pipeline" aria-label="本轮流水线">
      {stages.map((s, i) => (
        <div key={s.id} className={`ua-pipe-step ${s.status}`}>
          {i > 0 && <i className="ua-pipe-line" aria-hidden />}
          <em>{s.lane}</em>
          <strong>{s.label}</strong>
        </div>
      ))}
    </div>
  );
}
