import { useSyncExternalStore } from "react";
import { getSkillClauses, previewClause, subscribeSkillHost, type SkillClause } from "../../lib/skillHost";

export function useSkillClauses(skillId: string): SkillClause[] {
  return useSyncExternalStore(
    (onStoreChange) => subscribeSkillHost(skillId, onStoreChange),
    () => getSkillClauses(skillId),
    () => getSkillClauses(skillId),
  );
}

export function clauseChanged(clauses: SkillClause[]): boolean {
  return clauses.some((clause) => clause.fresh);
}

export function clausesReadyForChat(clauses: SkillClause[]): boolean {
  return clauses.some((clause) => clause.fresh) && clauses.every((clause) => clause.phase !== "dirty" && clause.phase !== "running");
}

function noteText(clause: SkillClause): string {
  if (!clause.fresh || clause.phase === "same") return "还是现在这样";
  if (clause.phase === "running") return "正在重做这一步";
  if (clause.phase === "done") return `重做完了。这一段现在是「${clause.draftHeard}」。`;
  if (!clause.onlineHeard) return "这是新的一步，回答里会多出这一段。";
  if (clause.draftHeard !== clause.onlineHeard) {
    return `客户听到的回答里，这一段会变。线上是「${clause.onlineHeard}」，改成「${clause.draftHeard}」。`;
  }
  return "客户听到的回答里，这一段会变。";
}

export function SkillClauseNote({
  clause,
  onPreview,
}: {
  clause: SkillClause;
  onPreview: () => void;
}) {
  const dirty = clause.fresh && clause.phase === "dirty";
  return (
    <p className={`own-clause-note is-${clause.phase}`}>
      {noteText(clause)}
      {dirty ? (
        <button type="button" onClick={onPreview}>
          看这句会变成什么样
        </button>
      ) : null}
    </p>
  );
}

export function SkillClauseRead({
  skillId,
  query,
  onAsk,
}: {
  skillId: string;
  query: string;
  onAsk?: (query: string) => void;
}) {
  const clauses = useSkillClauses(skillId);
  if (!clauses.length) return null;
  const ready = clausesReadyForChat(clauses);
  const waiting = clauses.some((clause) => clause.phase === "dirty" || clause.phase === "running");
  return (
    <div className="own-clause-read">
      <p>
        {clauses.map((clause, index) => {
          const live = clause.phase === "running" ? "正在重做这一步" : clause.phase === "done" ? clause.draftHeard : clause.onlineHeard || clause.draftHeard;
          return (
            <span key={clause.stepId}>
              {index ? "，" : ""}
              <span className={clause.fresh ? `own-clause-bit is-${clause.phase}` : "own-clause-bit"}>{live}</span>
            </span>
          );
        })}
      </p>
      {waiting ? <small>先看改变的那一段会变成什么样，再去对话里问。</small> : null}
      {clauses.some((clause) => clause.phase === "dirty") ? (
        <button type="button" onClick={() => previewClause(skillId, clauses.find((clause) => clause.phase === "dirty")!.stepId)}>
          看这句会变成什么样
        </button>
      ) : null}
      {ready ? (
        <button type="button" onClick={() => onAsk(query)}>
          用这句去对话里问
        </button>
      ) : null}
    </div>
  );
}
