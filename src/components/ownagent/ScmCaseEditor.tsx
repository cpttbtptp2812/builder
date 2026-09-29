import { useMemo, useState } from "react";
import {
  caseFromSkillSteps,
  deleteCustomCase,
  listAllCasesForSkill,
  saveCustomCase,
  type CustomSkillTraceCase,
} from "../../lib/skillTraceCaseStore";
import { SKILL_TRACE_CASES, type SkillTraceCase } from "../../lib/provingGround";
import type { OutcomeGrader } from "../../lib/scmOutcome";
import { getSkill, type SkillTraceStep } from "../../lib/agentSkills";
import { routeQuery } from "../../lib/skillRouter";
import { suggestCaseFromTrace, applyTraceSuggestion } from "../../lib/traceCaseSuggest";

const GRADERS: { id: OutcomeGrader["kind"]; label: string }[] = [
  { id: "skeleton", label: "步骤要对上" },
  { id: "all_ok", label: "每步都成功" },
  { id: "release_overall", label: "总结果通过" },
  { id: "min_steps", label: "至少走完几步" },
];

function graderLabel(kind: OutcomeGrader["kind"] | undefined) {
  return GRADERS.find((g) => g.id === kind)?.label ?? "步骤要对上";
}

function isCustom(row: SkillTraceCase): row is CustomSkillTraceCase {
  return "custom" in row && row.custom === true;
}

function urlIn(query: string) {
  const hit = query.match(/https?:\/\/[^\s]+/i)?.[0];
  return hit?.replace(/[),。，、]+$/u, "");
}

export function ScmCaseEditor({
  skillId,
  onChanged,
  onAsk,
  fromTrace,
}: {
  skillId: string;
  onChanged: () => void;
  /** 带着这句去对话里问 */
  onAsk?: (query: string) => void;
  fromTrace?: { query: string; trace: SkillTraceStep[] };
}) {
  const skill = getSkill(skillId);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [showRule, setShowRule] = useState(false);
  const [grader, setGrader] = useState<OutcomeGrader["kind"]>("skeleton");
  const [minSteps, setMinSteps] = useState(2);
  const cases = useMemo(() => listAllCasesForSkill(skillId, SKILL_TRACE_CASES), [skillId, tick]);
  const mine = cases.filter(isCustom).length;

  function buildGrader(kind = grader, count = minSteps): OutcomeGrader {
    if (kind === "release_overall") return { kind: "release_overall", min: "pass" };
    if (kind === "min_steps") return { kind: "min_steps", count };
    if (kind === "all_ok") return { kind: "all_ok" };
    return { kind: "skeleton" };
  }

  function bump(message: string) {
    setTick((n) => n + 1);
    setHint(message);
    onChanged();
  }

  function addFromTrace() {
    if (!fromTrace) return;
    const suggestion = suggestCaseFromTrace(skillId, fromTrace.query, fromTrace.trace);
    if (!suggestion) {
      setHint("这次处理记录里没有能变成问题的问法");
      return;
    }
    applyTraceSuggestion(skillId, suggestion);
    bump("已把刚才那次问法加进来");
  }

  function addCase() {
    const text = query.trim();
    if (!text) return;
    if (!skill?.steps.length) {
      setHint("这个技能还没有步骤。先到「编辑」写好，再加问题。");
      return;
    }
    if (cases.some((c) => c.query.trim() === text)) {
      setHint("这句已经在下面了");
      return;
    }
    const row = caseFromSkillSteps(
      skillId,
      text,
      skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
      { grader: buildGrader(), probeUrl: urlIn(text) },
    );
    saveCustomCase(row);
    setQuery("");
    bump("已加上。下次发版检查会问这句。");
  }

  function changeRule(row: CustomSkillTraceCase, kind: OutcomeGrader["kind"], count?: number) {
    saveCustomCase({ ...row, grader: buildGrader(kind, count ?? minSteps) });
    setTick((n) => n + 1);
    onChanged();
  }

  return (
    <div className="own-qbank">
      <form
        className="own-qbank-add"
        onSubmit={(e) => {
          e.preventDefault();
          addCase();
        }}
      >
        <label htmlFor={`qbank-${skillId}`}>写一句客户会问的话</label>
        <div className="own-qbank-compose">
          <input
            id={`qbank-${skillId}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：帮我巡检 https://example.com 能否上线"
          />
          <button type="submit" disabled={!query.trim()}>
            加上
          </button>
        </div>
        <div className="own-qbank-tools">
          <button type="button" className="own-qbank-quiet" onClick={() => setShowRule((v) => !v)}>
            {showRule ? "收起答对标准" : "怎样算答对"}
          </button>
          {fromTrace?.trace.length ? (
            <button type="button" className="own-qbank-quiet" onClick={addFromTrace}>
              用刚才那次问法
            </button>
          ) : null}
        </div>
        {showRule ? (
          <div className="own-qbank-rule">
            <span>新加的题，这样算答对</span>
            <select value={grader} onChange={(e) => setGrader(e.target.value as OutcomeGrader["kind"])}>
              {GRADERS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            {grader === "min_steps" ? (
              <input
                type="number"
                min={1}
                value={minSteps}
                aria-label="最少步数"
                onChange={(e) => setMinSteps(Number(e.target.value))}
              />
            ) : null}
          </div>
        ) : null}
      </form>

      {hint ? <p className="own-qbank-hint">{hint}</p> : null}

      <p className="own-qbank-count">
        发版时会问这 {cases.length} 句{mine ? `，其中 ${mine} 句是你加的` : ""}。自带的会一直用来检查。
      </p>

      {cases.length ? (
        <ul className="own-qbank-list">
          {cases.map((row) => (
            <QuestionRow
              key={row.id}
              skillId={skillId}
              row={row}
              onAsk={onAsk}
              onDelete={() => {
                deleteCustomCase(skillId, row.id);
                bump("已删掉。发版检查不再问这句。");
              }}
              onRule={(kind, count) => {
                if (!isCustom(row)) return;
                changeRule(row, kind, count);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="own-qbank-empty">还没有问题。写一句客户会问的话，发版时就用它检查。</p>
      )}
    </div>
  );
}

function QuestionRow({
  skillId,
  row,
  onAsk,
  onDelete,
  onRule,
}: {
  skillId: string;
  row: SkillTraceCase;
  onAsk?: (query: string) => void;
  onDelete: () => void;
  onRule: (kind: OutcomeGrader["kind"], count?: number) => void;
}) {
  const who = routeQuery(row.query);
  const mine = isCustom(row);
  const kind = row.grader?.kind ?? "skeleton";
  const matched = who.kind === "skill" && who.skillId === skillId;
  const elsewhere = who.kind === "skill" && who.skillId !== skillId;

  return (
    <li className={mine ? "is-mine" : "is-builtin"}>
      <div className="own-qbank-top">
        <p>{row.query}</p>
        {onAsk ? (
          <button type="button" onClick={() => onAsk(row.query)}>
            去对话里问
          </button>
        ) : null}
      </div>
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
        <small>这句话对不上这个技能，发版检查用不上。换成这个技能能接住的问法，或先去编辑里加上对应说法。</small>
      ) : null}
      {who.kind !== "skill" ? <small>还没有技能会接这句话，发版检查覆盖不到。</small> : null}
    </li>
  );
}
