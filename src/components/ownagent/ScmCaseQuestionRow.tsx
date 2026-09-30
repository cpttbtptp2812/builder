import { useState } from "react";
import type { SkillTraceCase } from "../../lib/provingGround";
import type { OutcomeGrader } from "../../lib/scmOutcome";
import type { AgentSkill } from "../../lib/agentSkills";
import { routeQuery, skillLabel } from "../../lib/skillRouter";
import { catchPhrase, graspAgainst, type GraspSide } from "../../lib/skillSentence";

const GRADERS: { id: OutcomeGrader["kind"]; label: string }[] = [
  { id: "skeleton", label: "步骤要对上" },
  { id: "all_ok", label: "每步都成功" },
  { id: "release_overall", label: "总结果通过" },
  { id: "min_steps", label: "至少走完几步" },
];

function graderLabel(kind: OutcomeGrader["kind"] | undefined) {
  return GRADERS.find((g) => g.id === kind)?.label ?? "步骤要对上";
}

function isCustom(row: SkillTraceCase): boolean {
  return "custom" in row && row.custom === true;
}

export function ScmCaseQuestionRow({
  skillId,
  catalog,
  triggers,
  row,
  onAsk,
  onClaim,
  onDelete,
  onRule,
  compact = false,
}: {
  skillId: string;
  catalog: AgentSkill[];
  triggers: string[];
  row: SkillTraceCase;
  onAsk?: (query: string) => void;
  onClaim?: (phrase: string) => void;
  onDelete: () => void;
  onRule: (kind: OutcomeGrader["kind"], count?: number) => void;
  compact?: boolean;
}) {
  const who = routeQuery(row.query, catalog);
  const mine = isCustom(row);
  const kind = row.grader?.kind ?? "skeleton";
  const matched = who.kind === "skill" && who.skillId === skillId;
  const elsewhere = who.kind === "skill" && who.skillId !== skillId;
  const phrase = matched ? null : catchPhrase(row.query, triggers);
  const [racing, setRacing] = useState(false);
  const [race, setRace] = useState<GraspSide[] | null>(null);

  async function compare() {
    setRacing(true);
    try {
      setRace(await graspAgainst(row.query, skillId, catalog));
    } finally {
      setRacing(false);
    }
  }

  return (
    <div className={`own-qbank-list-item${mine ? " is-mine" : " is-builtin"}`}>
      {!compact ? (
        <div className="own-qbank-top">
          <p>{row.query}</p>
          {onAsk ? (
            <button type="button" onClick={() => onAsk(row.query)}>
              去对话里问
            </button>
          ) : null}
        </div>
      ) : onAsk ? (
        <button type="button" className="own-qbank-quiet own-qbank-ask-inline" onClick={() => onAsk(row.query)}>
          去对话里问
        </button>
      ) : null}
      {!matched && phrase && onClaim ? (
        <button type="button" className="own-qbank-claim" onClick={() => onClaim(phrase)}>
          用「{phrase}」接住这句
        </button>
      ) : null}
      <button type="button" className="own-qbank-quiet" disabled={racing} onClick={() => void compare()}>
        {racing ? "正在两边各跑一遍…" : "比一比谁更能答对"}
      </button>
      {race ? (
        <ul className="own-grasp">
          {race.map((s) => (
            <li key={s.id} className={s.pass ? "is-pass" : ""}>
              <strong>{s.label}</strong>
              <span>
                {s.total ? `${s.ok}/${s.total} 步成功` : "跑不起来"}
                {s.pass ? " · 这句能过" : " · 这句过不了"}
              </span>
              {s.here && !matched && phrase && onClaim ? (
                <button type="button" onClick={() => onClaim(phrase)}>
                  归这个技能
                </button>
              ) : null}
              {s.here && matched ? <em>就是现在这家</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="own-qbank-meta">
        <span>{mine ? "你加的" : "自带"}</span>
        {mine ? (
          <select
            aria-label="怎样算答对"
            value={kind}
            onChange={(e) => onRule(e.target.value as OutcomeGrader["kind"], row.grader?.kind === "min_steps" ? row.grader.count : undefined)}
          >
            {GRADERS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        ) : (
          <span>{graderLabel(kind)}</span>
        )}
        {elsewhere ? <span>现在会交给{who.label}</span> : null}
        {who.kind !== "skill" ? <span>还没有技能会接</span> : null}
        {mine ? (
          <button type="button" onClick={onDelete}>
            删除
          </button>
        ) : null}
      </div>
      {elsewhere ? (
        <small>现在会交给{skillLabel(who.skill ?? { name: who.label, description: who.label })}。比完再决定要不要用一句话接回来。</small>
      ) : null}
      {who.kind !== "skill" ? <small>还没有技能会接。用上面抽出的说法接住，发版才会问到这句。</small> : null}
    </div>
  );
}
