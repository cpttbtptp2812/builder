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
import { allRunnableSkills, getSkill, type AgentSkill, type SkillTraceStep } from "../../lib/agentSkills";
import { routeQuery, skillLabel } from "../../lib/skillRouter";
import { catalogWith } from "../../lib/skillImpact";
import { parseSkillMarkdown } from "../../lib/skillMarkdown";
import { defaultSampleQuery, sampleTriggers } from "./skillVerUi";
import {
  catchPhrase,
  draftCatches,
  graspAgainst,
  rivalName,
  weekQueriesForSkill,
  type GraspSide,
} from "../../lib/skillSentence";
import { suggestCaseFromTrace, applyTraceSuggestion } from "../../lib/traceCaseSuggest";

const GRADERS: { id: OutcomeGrader["kind"]; label: string }[] = [
  { id: "skeleton", label: "步骤要对上" },
  { id: "all_ok", label: "每一步都跑通" },
  { id: "release_overall", label: "整体结论是可以发" },
  { id: "min_steps", label: "至少跑够几步" },
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
  onClaim,
  draftRaw,
  fromTrace,
  onCheck,
  checking = false,
}: {
  skillId: string;
  onChanged: () => void;
  /** 带着这句去对话里问 */
  onAsk?: (query: string) => void;
  /** 把抽出的说法写进技能草稿 */
  onClaim?: (phrase: string) => void;
  draftRaw?: string;
  fromTrace?: { query: string; trace: SkillTraceStep[] };
  /** 发版检查入口，传入时在列表下方显示「只检查不发布」按钮 */
  onCheck?: () => void;
  checking?: boolean;
}) {
  const skill = getSkill(skillId);
  const catalog = useMemo(() => {
    const live = allRunnableSkills();
    return draftRaw ? catalogWith(skillId, draftRaw, live) : live;
  }, [skillId, draftRaw]);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [showRule, setShowRule] = useState(false);
  const [grader, setGrader] = useState<OutcomeGrader["kind"]>("skeleton");
  const [minSteps, setMinSteps] = useState(2);
  const cases = useMemo(() => listAllCasesForSkill(skillId, SKILL_TRACE_CASES), [skillId, tick]);
  const mine = cases.filter(isCustom).length;
  const week = useMemo(
    () => weekQueriesForSkill(skillId).filter((q) => !cases.some((c) => c.query.trim() === q)),
    [skillId, cases],
  );

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
    bump(claimMessage(text));
  }

  function claimMessage(text: string) {
    const triggers = parseSkillMarkdown(draftRaw ?? skill?.manifest ?? "").triggers;
    if (draftCatches(text, skillId, catalog)) return "已加上。这句归这个技能，发版时会问。";
    const rival = rivalName(text, skillId, catalog);
    if (rival) return `已加上。这句话现在更会交给「${rival}」。比一比谁答得过，再决定接不接住。`;
    const phrase = catchPhrase(text, triggers);
    if (phrase && onClaim) {
      onClaim(phrase);
      return `已加上，并写进说法「${phrase}」。这句现在归这个技能。`;
    }
    return "已加上。下次发版检查会问这句。";
  }

  function adoptWeek(text: string) {
    if (!skill?.steps.length) return;
    if (cases.some((c) => c.query.trim() === text)) return;
    const row = caseFromSkillSteps(
      skillId,
      text,
      skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
      { grader: buildGrader(), probeUrl: urlIn(text) },
    );
    saveCustomCase(row);
    bump(claimMessage(text));
  }

  function changeRule(row: CustomSkillTraceCase, kind: OutcomeGrader["kind"], count?: number) {
    saveCustomCase({ ...row, grader: buildGrader(kind, count ?? minSteps) });
    setTick((n) => n + 1);
    onChanged();
  }

  const presets = useMemo(() => {
    const own = [defaultSampleQuery(skillId, skill?.triggers ?? []), ...sampleTriggers(skill?.triggers ?? [], 3)];
    return [...new Set(own.map((s) => s.trim()))].filter((p) => p && !cases.some((c) => c.query.trim() === p));
  }, [skillId, skill, cases]);

  return (
    <div className="own-qbank">
      <form
        className="own-qbank-add"
        onSubmit={(e) => {
          e.preventDefault();
          addCase();
        }}
      >
        <div className="own-qbank-hdr">
          <label htmlFor={`qbank-${skillId}`} className="own-qbank-label">
            <span className="own-qbank-dot" />
            发版时要问的话
          </label>
          <span className="own-qbank-badge">{cases.length} 句</span>
        </div>

        <div className="own-qbank-compose">
          <div className="own-qbank-input-wrap">
            <span className="own-qbank-prompt-sign">&gt;</span>
            <input
              id={`qbank-${skillId}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`客户会怎么说，例如：${defaultSampleQuery(skillId, skill?.triggers ?? [])}`}
            />
          </div>
          <button type="submit" className="own-qbank-submit-btn" disabled={!query.trim()}>
            加进去
          </button>
        </div>

        {presets.length ? (
          <div className="own-qbank-presets">
            <span className="own-qbank-preset-label">这个技能常被这样问：</span>
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                className="own-qbank-preset-chip"
                onClick={() => setQuery(p)}
                title="填进输入框，确认后再加"
              >
                {p}
              </button>
            ))}
          </div>
        ) : null}

        <div className="own-qbank-tools">
          <button type="button" className="own-qbank-quiet" onClick={() => setShowRule((v) => !v)}>
            {showRule ? "收起判定方式" : "怎么算答对"}
          </button>
          {fromTrace?.trace.length ? (
            <button type="button" className="own-qbank-quiet" onClick={addFromTrace}>
              用刚才那次的问法
            </button>
          ) : null}
        </div>
        {showRule ? (
          <div className="own-qbank-rule">
            <span>算答对的标准：</span>
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

      <div className="own-qbank-info-bar">
        <span className="own-qbank-info-icon">ℹ</span>
        <span>
          发版检查会把这 <strong>{cases.length}</strong> 句挨个问一遍{mine ? `（其中 ${mine} 句是您加的）` : ""}，新版答不上就不让发。
        </span>
      </div>

      {week.length ? (
        <div className="own-week">
          <p className="own-week-title">最近客户真的问过、还没加进来的</p>
          <ul>
            {week.map((q) => (
              <li key={q}>
                <span>{q}</span>
                <button type="button" onClick={() => adoptWeek(q)}>加进去</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {cases.length ? (
        <ul className="own-qbank-list">
          {cases.map((row) => (
            <QuestionRow
              key={row.id}
              skillId={skillId}
              catalog={catalog}
              triggers={parseSkillMarkdown(draftRaw ?? skill?.manifest ?? "").triggers}
              row={row}
              onAsk={onAsk}
              onClaim={onClaim}
              onDelete={() => {
                deleteCustomCase(skillId, row.id);
                bump("已移出。发版检查不再问这句。");
              }}
              onRule={(kind, count) => {
                if (!isCustom(row)) return;
                changeRule(row, kind, count);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="own-qbank-empty">还没有要问的话。在上面写一句客户会怎么说，发版检查就会拿它来问新版。</p>
      )}

      {onCheck ? (
        <div className="own-qbank-check-bar">
          <button
            type="button"
            className="own-qbank-check-btn"
            disabled={checking}
            onClick={onCheck}
          >
            {checking ? "检查中…" : "只检查不发布"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function QuestionRow({
  skillId,
  catalog,
  triggers,
  row,
  onAsk,
  onClaim,
  onDelete,
  onRule,
}: {
  skillId: string;
  catalog: AgentSkill[];
  triggers: string[];
  row: SkillTraceCase;
  onAsk?: (query: string) => void;
  onClaim?: (phrase: string) => void;
  onDelete: () => void;
  onRule: (kind: OutcomeGrader["kind"], count?: number) => void;
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
    <li className={mine ? "is-mine" : "is-builtin"}>
      <div className="own-qbank-top">
        <p className="own-qbank-query-text">{row.query}</p>
        <div className="own-qbank-top-acts">
          {onAsk ? (
            <button type="button" className="own-qbank-pill-btn" onClick={() => onAsk(row.query)}>
              去对话里问
            </button>
          ) : null}
          <button type="button" className="own-qbank-pill-btn" disabled={racing} onClick={() => void compare()}>
            {racing ? "比较中…" : "看哪个技能答得好"}
          </button>
        </div>
      </div>
      {!matched && phrase && onClaim ? (
        <button type="button" className="own-qbank-claim" onClick={() => onClaim(phrase)}>
          把说法「{phrase}」写进技能，让这句归这里
        </button>
      ) : null}
      {race ? (
        <ul className="own-grasp">
          {race.map((s) => (
            <li key={s.id} className={s.pass ? "is-pass" : ""}>
              <strong>{s.label}</strong>
              <span>{s.total ? `${s.ok}/${s.total} 步跑通` : "跑不了"}{s.pass ? " · 算答对" : " · 没答对"}</span>
              {s.here && !matched && phrase && onClaim ? (
                <button type="button" onClick={() => onClaim(phrase)}>归入本技能</button>
              ) : null}
              {s.here && matched ? <em>现在归它</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="own-qbank-meta">
        <span className={`own-qbank-origin ${mine ? "is-custom" : "is-system"}`}>
          {mine ? "您加的" : "自带"}
        </span>
        {mine ? (
          <select
            aria-label="怎么算答对"
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
          <span className="own-qbank-grader-tag">{graderLabel(kind)}</span>
        )}
        {elsewhere ? <span className="own-qbank-route-tag is-rival">现在交给：{who.label}</span> : null}
        {who.kind !== "skill" ? <span className="own-qbank-route-tag is-unrouted">没有技能接</span> : null}
        {mine ? (
          <button type="button" className="own-qbank-del-btn" onClick={onDelete}>
            移除
          </button>
        ) : null}
      </div>
      {elsewhere ? <small>这句现在会交给「{skillLabel(who.skill ?? { name: who.label, description: who.label })}」。点「看哪个技能答得好」比一比，再决定要不要接过来。</small> : null}
      {who.kind !== "skill" ? <small>这句话现在没有技能能接。给技能加一个对应的说法，它才会被接住。</small> : null}
    </li>
  );
}
