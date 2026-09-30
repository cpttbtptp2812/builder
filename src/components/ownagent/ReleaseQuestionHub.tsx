import { useMemo, useState } from "react";
import type { QueryCompareRow, SkillFullCompareReport } from "../../lib/skillCompareReport";
import type { GateQuestionKind } from "../../lib/skillGateQuestions";
import { listGateQuestionRows } from "../../lib/skillGateQuestions";
import {
  caseFromSkillSteps,
  deleteCustomCase,
  listAllCasesForSkill,
  saveCustomCase,
  type CustomSkillTraceCase,
} from "../../lib/skillTraceCaseStore";
import { SKILL_TRACE_CASES, type SkillTraceCase } from "../../lib/provingGround";
import type { OutcomeGrader } from "../../lib/scmOutcome";
import type { SkillTraceStep } from "../../lib/agentSkills";
import { allRunnableSkills, getSkill } from "../../lib/agentSkills";
import { catalogWith } from "../../lib/skillImpact";
import { parseSkillMarkdown } from "../../lib/skillMarkdown";
import { catchPhrase, draftCatches, rivalName, weekQueriesForSkill } from "../../lib/skillSentence";
import { suggestCaseFromTrace, applyTraceSuggestion } from "../../lib/traceCaseSuggest";
import { ScmCaseQuestionRow } from "./ScmCaseQuestionRow";
import { SkillClauseRead } from "./SkillClauseNote";
import { queryComparePresentation } from "./skillVerUi";

const GRADERS: { id: OutcomeGrader["kind"]; label: string }[] = [
  { id: "skeleton", label: "步骤要对上" },
  { id: "all_ok", label: "每步都成功" },
  { id: "release_overall", label: "总结果通过" },
  { id: "min_steps", label: "至少走完几步" },
];

function isCustom(row: SkillTraceCase): row is CustomSkillTraceCase {
  return "custom" in row && row.custom === true;
}

function urlIn(query: string) {
  const hit = query.match(/https?:\/\/[^\s]+/i)?.[0];
  return hit?.replace(/[),。，、]+$/u, "");
}

/** 展开区：现用/新版路由只写一遍；只有变了才分两列 */
function QueryCompareRowDetail({ qr }: { qr: QueryCompareRow }) {
  const none = "没有技能接手";
  const rb = qr.routeBaseline ?? none;
  const rc = qr.routeCandidate ?? none;
  const same = !qr.routeDrift && rb === rc;
  return (
    <dl className="own-rel__route-dl">
      {same ? (
        <div>
          <dt>交给</dt>
          <dd>{rc}</dd>
        </div>
      ) : (
        <>
          <div>
            <dt>现用版交给</dt>
            <dd>{rb}</dd>
          </div>
          <div>
            <dt>新版交给</dt>
            <dd>{rc}</dd>
          </div>
        </>
      )}
      {qr.traceChanged ? (
        <div>
          <dt>步骤变化</dt>
          <dd>{qr.traceSummary || "与现用版不同"}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/** 发版唯一清单：问法 + 结果 + 试句 + 展开验收（无第二套列表） */
export function ReleaseQuestionHub({
  skillId,
  draftRaw,
  testQuery,
  setTestQuery,
  hasReport,
  report,
  checking,
  recommended,
  triggerSamples,
  onDialogueAccept,
  showDialogue,
  onAsk,
  onClaim,
  onChanged,
  fromTrace,
  checklistId = "skill-release-checklist",
}: {
  skillId: string;
  draftRaw: string;
  testQuery: string;
  setTestQuery: (q: string) => void;
  hasReport: boolean;
  report: SkillFullCompareReport | null;
  checking: boolean;
  recommended: string;
  triggerSamples: string[];
  onDialogueAccept?: () => void;
  showDialogue?: boolean;
  onAsk?: (query: string) => void;
  onClaim?: (phrase: string) => void;
  onChanged?: () => void;
  fromTrace?: { query: string; trace: SkillTraceStep[] };
  checklistId?: string;
}) {
  const skill = getSkill(skillId);
  const catalog = useMemo(() => {
    const live = allRunnableSkills();
    return draftRaw ? catalogWith(skillId, draftRaw, live) : live;
  }, [skillId, draftRaw]);
  const triggers = useMemo(() => parseSkillMarkdown(draftRaw ?? skill?.manifest ?? "").triggers, [draftRaw, skill?.manifest]);

  const [draft, setDraft] = useState("");
  const [tick, setTick] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [showRule, setShowRule] = useState(false);
  const [grader, setGrader] = useState<OutcomeGrader["kind"]>("skeleton");
  const [minSteps, setMinSteps] = useState(2);

  const cases = useMemo(() => listAllCasesForSkill(skillId, SKILL_TRACE_CASES), [skillId, tick]);
  const gateRows = useMemo(() => listGateQuestionRows(skillId), [skillId, tick]);
  const byQuery = useMemo(
    () => new Map((report?.queryResults ?? []).map((q) => [q.query.trim(), q])),
    [report],
  );
  const gateByQuery = useMemo(() => new Map(gateRows.map((r) => [r.query.trim(), r])), [gateRows]);
  const caseByQuery = useMemo(() => new Map(cases.map((c) => [c.query.trim(), c])), [cases]);

  const displayRows = useMemo((): { query: string; kind?: GateQuestionKind; sample?: boolean }[] => {
    if (hasReport && report?.queryResults.length) {
      return report.queryResults.map((qr) => {
        const t = qr.query.trim();
        const gate = gateByQuery.get(t);
        return { query: qr.query, kind: gate?.kind, sample: !gate };
      });
    }
    return gateRows.map((r) => ({ query: r.query, kind: r.kind }));
  }, [hasReport, report, gateRows, gateByQuery]);
  const tryQ = testQuery.trim();
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
    onChanged?.();
  }

  function claimMessage(text: string) {
    if (draftCatches(text, skillId, catalog)) return "已加入清单。";
    const rival = rivalName(text, skillId, catalog);
    if (rival) return `已加入（「${rival}」也会接类似话，可展开比一比）。`;
    const phrase = catchPhrase(text, triggers);
    if (phrase && onClaim) {
      onClaim(phrase);
      return `已加入，并写进说法「${phrase}」。`;
    }
    return "已加入清单。";
  }

  function addFromTrace() {
    if (!fromTrace) return;
    const suggestion = suggestCaseFromTrace(skillId, fromTrace.query, fromTrace.trace);
    if (!suggestion) {
      setHint("没有可用的问法");
      return;
    }
    applyTraceSuggestion(skillId, suggestion);
    bump("已加入刚才那次问法");
  }

  function addLine(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!skill?.steps.length) {
      setHint("请先在「编辑」写好步骤");
      return;
    }
    if (cases.some((c) => c.query.trim() === text)) {
      setTestQuery(text);
      setHint(null);
      return;
    }
    saveCustomCase(
      caseFromSkillSteps(
        skillId,
        text,
        skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
        { grader: buildGrader(), probeUrl: urlIn(text) },
      ),
    );
    setDraft("");
    setTestQuery(text);
    bump(claimMessage(text));
  }

  function adoptWeek(text: string) {
    if (!skill?.steps.length) return;
    if (cases.some((c) => c.query.trim() === text)) return;
    saveCustomCase(
      caseFromSkillSteps(
        skillId,
        text,
        skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
        { grader: buildGrader(), probeUrl: urlIn(text) },
      ),
    );
    setTestQuery(text);
    bump(claimMessage(text));
  }

  function changeRule(row: CustomSkillTraceCase, kind: OutcomeGrader["kind"], count?: number) {
    saveCustomCase({ ...row, grader: buildGrader(kind, count ?? minSteps) });
    setTick((n) => n + 1);
    onChanged?.();
  }

  const extraTry = tryQ && !displayRows.some((r) => r.query.trim() === tryQ);
  const listTitle =
    hasReport && report?.queryResults.length
      ? `检查结果 · ${report.queryResults.length} 句`
      : `检查清单 · ${gateRows.length} 条`;

  const gateBad =
    hasReport && report
      ? gateRows.filter((g) => {
          const q = byQuery.get(g.query.trim());
          return q && (q.verdictLevel === "reject" || q.routeDrift);
        }).length
      : 0;

  function caseRowForQuery(query: string): SkillTraceCase | null {
    const hit = caseByQuery.get(query.trim());
    if (hit) return hit;
    if (!skill?.steps.length) return null;
    return caseFromSkillSteps(
      skillId,
      query,
      skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
      { grader: buildGrader() },
    );
  }

  return (
    <section id={checklistId} className="own-rel__panel">
      <h3 className="own-rel__panel-title">{listTitle}</h3>
      {hasReport && report ? (
        <p
          className={`own-rel__panel-lead${gateBad > 0 ? " is-bad" : report.verdict.level === "approve" ? " is-ok" : " is-warn"}`}
        >
          {gateBad > 0
            ? `必问 ${gateRows.length} 句里有 ${gateBad} 句过不了，先别发。`
            : report.verdict.level === "warn"
              ? "必问句都过了，发之前看一眼说明。"
              : `必问句 ${gateRows.length} 句都过了。`}
          {report.liveProbeUsed ? " 含链接的句子已真实探活。" : ""}
        </p>
      ) : !checking ? (
        <p className="own-rel__panel-lead is-neutral">会检查必问句，并多跑几条触发样例；与底部「只检查不发布」同一次流程。</p>
      ) : null}

      <ul className="own-rel__list">
        {displayRows.map((row) => {
          const picked = tryQ === row.query.trim();
          const qr = byQuery.get(row.query.trim());
          const pres = qr ? queryComparePresentation(qr) : null;
          const c = caseByQuery.get(row.query.trim());
          const acceptRow = caseRowForQuery(row.query);
          const tone = pres?.tone ?? "wait";
          return (
            <li key={row.query} className={`own-rel__item is-${tone}${picked ? " is-pick" : ""}`}>
              <div className="own-rel__item-main">
                <button type="button" className="own-rel__item-q" disabled={checking} aria-pressed={picked} onClick={() => setTestQuery(row.query)}>
                  {row.kind ? <span className="own-rel__kind-tag">{row.kind}</span> : row.sample ? <span className="own-rel__kind-tag">样例</span> : null}
                  {row.query}
                  {picked ? <span className="own-rel__pick-tag">试句</span> : null}
                </button>
                <div className="own-rel__item-outcome">
                  {pres ? (
                    <>
                      <span className={`own-gate-pill is-${pres.tone}`}>{pres.badge}</span>
                      <span className="own-rel__item-route" title={pres.routeLine}>
                        {pres.routeLine}
                      </span>
                    </>
                  ) : (
                    <span className="own-gate-pill is-wait">待跑</span>
                  )}
                </div>
              </div>
              <details className="own-rel__item-more">
                <summary>验收与路由</summary>
                {pres?.detail ? <p className="own-rel__item-detail">{pres.detail}</p> : null}
                {qr ? <QueryCompareRowDetail qr={qr} /> : null}
                {acceptRow ? (
                  <ScmCaseQuestionRow
                    compact
                    skillId={skillId}
                    catalog={catalog}
                    triggers={triggers}
                    row={acceptRow}
                    onAsk={onAsk}
                    onClaim={onClaim}
                    onDelete={() => {
                      if (!c || !isCustom(c)) return;
                      deleteCustomCase(skillId, c.id);
                      bump("已删除");
                    }}
                    onRule={(kind, count) => {
                      if (!c || !isCustom(c)) return;
                      changeRule(c, kind, count);
                    }}
                  />
                ) : null}
                <SkillClauseRead skillId={skillId} query={row.query} onAsk={onAsk} />
              </details>
            </li>
          );
        })}
        {extraTry ? (
          <li className="own-rel__item is-wait is-pick">
            <div className="own-rel__item-main">
              <span className="own-rel__item-q own-rel__item-q--static">
                {tryQ}
                <span className="own-rel__pick-tag">试句</span>
              </span>
              <span className="own-gate-pill is-wait">{hasReport ? "—" : "待跑"}</span>
            </div>
          </li>
        ) : null}
        {!displayRows.length && !extraTry ? <li className="own-rel__empty">暂无问法，请在下方添加。</li> : null}
      </ul>

      <div className="own-rel__try">
        <label className="own-rel__try-label" htmlFor="skill-test-query">
          试句
        </label>
        <div className="own-rel__try-row">
          <input
            id="skill-test-query"
            className="own-rel__try-input"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            disabled={checking}
            placeholder="点清单某行会填入；也可自填"
          />
          {showDialogue && onDialogueAccept ? (
            <button type="button" className="own-compare-secondary-btn" disabled={checking} onClick={onDialogueAccept}>
              对话验收
            </button>
          ) : null}
        </div>
        <div className="own-skill-ver-chips own-skill-ver-chips--click own-rel__chips">
          <button type="button" className={testQuery === recommended ? "on" : ""} disabled={checking} onClick={() => setTestQuery(recommended)}>
            推荐
          </button>
          {triggerSamples.map((t) => (
            <button
              key={t}
              type="button"
              className={testQuery === `帮我${t}` ? "on" : ""}
              disabled={checking}
              onClick={() => setTestQuery(`帮我${t}`)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <details className="own-rel__manage">
        <summary>添加问法 · 规则 · 本周未收录</summary>
        <form className="own-rel__add" onSubmit={addLine}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="客户会问的一句话"
            disabled={checking}
            aria-label="添加问法"
          />
          <button type="submit" disabled={checking || !draft.trim()}>
            加入清单
          </button>
        </form>
        <div className="own-rel__manage-tools">
          <button type="button" className="own-qbank-quiet" disabled={checking} onClick={() => setShowRule((v) => !v)}>
            {showRule ? "收起答对标准" : "新题答对标准"}
          </button>
          {fromTrace?.trace.length ? (
            <button type="button" className="own-qbank-quiet" disabled={checking} onClick={addFromTrace}>
              用刚才问法
            </button>
          ) : null}
        </div>
        {showRule ? (
          <div className="own-qbank-rule">
            <select value={grader} onChange={(e) => setGrader(e.target.value as OutcomeGrader["kind"])}>
              {GRADERS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            {grader === "min_steps" ? (
              <input type="number" min={1} value={minSteps} aria-label="最少步数" onChange={(e) => setMinSteps(Number(e.target.value))} />
            ) : null}
          </div>
        ) : null}
        {week.length ? (
          <ul className="own-rel__week">
            {week.map((q) => (
              <li key={q}>
                <span>{q}</span>
                <button type="button" disabled={checking} onClick={() => adoptWeek(q)}>
                  收录
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      {hint ? <p className="own-qbank-hint">{hint}</p> : null}
    </section>
  );
}
