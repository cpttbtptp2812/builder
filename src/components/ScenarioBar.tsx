import { runScenario, streamReply } from "../engine";
import { GENERAL_PROMPTS, PROJECT_PROMPTS } from "../data/knowledge";
import { SCENARIOS } from "../data/scenarios";

export function ScenarioBar({
  sessionId,
  think,
}: {
  sessionId: string;
  think: boolean;
}) {
  return (
    <div className="scenario-wrap">
      <div className="scenario-bar">
        <span className="scenario-label">交互演示</span>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`scenario-chip ${s.project}`}
            title={s.desc}
            onClick={() => runScenario(sessionId, s.id, think)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="scenario-bar">
        <span className="scenario-label">项目深聊</span>
        {GENERAL_PROMPTS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="scenario-chip resume"
            onClick={() => streamReply(sessionId, s.prompt, { think })}
          >
            {s.label}
          </button>
        ))}
        {PROJECT_PROMPTS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`scenario-chip ${s.project}`}
            onClick={() => streamReply(sessionId, s.prompt, { think })}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
