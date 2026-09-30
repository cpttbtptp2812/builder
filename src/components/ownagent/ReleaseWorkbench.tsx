import { useMemo, useState } from "react";
import type { SkillImpact } from "../../lib/skillImpact";
import type { SkillCompareResult } from "../../lib/skillCompareEngine";
import { foldDiff, lineDiff } from "../../lib/lineDiff";
import type { ParsedSkillDoc } from "../../lib/skillMarkdown";
import type { SkillFullCompareReport } from "../../lib/skillCompareReport";
import type { RouteFuzzReport } from "../../lib/skillRouteFuzz";
import type { ShadowReplayReport } from "../../lib/skillShadowReplay";
import type { ReleaseDependencyProof } from "../../lib/releaseDependencyProof";
import { ReleaseCheckExtras } from "./ReleaseCheckExtras";
import { ReleaseDependencyCard } from "./ReleaseDependencyCard";
import { CheckQuestions } from "./CheckQuestions";
import { ReleaseQuestionHub } from "./ReleaseQuestionHub";
import { ReleaseGateHero } from "./ScmVisuals";
import { ScmAttributionPanel } from "./ScmAttributionPanel";
import { SkillBreakPanel } from "./SkillBreak";
import { PageToolWalk, type PageWalkResult } from "./PageToolWalk";
import { ImpactPanel } from "./SkillInsights";
import {
  buildReleaseGateSummary,
  CompareSideColumn,
  downloadFullReportMd,
  downloadReportJson,
  FullCompareReport,
  humanVerdict,
} from "./releaseCompareUi";
import { getSkill } from "../../lib/agentSkills";
import { defaultSampleQuery, sampleTriggers, stepPipelineText } from "./skillVerUi";
import { listGateQuestionRows } from "../../lib/skillGateQuestions";

export function ReleaseWorkbench({
  skillId,
  online,
  draft,
  liveVersion,
  draftVersion,
  onlineParsed,
  draftParsed,
  testQuery,
  setTestQuery,
  checking,
  reportStale,
  single,
  report,
  impact,
  shadowReport,
  fuzzReport,
  pageWalkReport,
  depProof,
  onCaseClaim,
  onCaseChanged,
  onAskInChat,
}: {
  skillId: string;
  online: string;
  draft: string;
  liveVersion: string;
  draftVersion: string;
  onlineParsed: ParsedSkillDoc;
  draftParsed: ParsedSkillDoc;
  testQuery: string;
  setTestQuery: (q: string) => void;
  checking: boolean;
  reportStale: boolean;
  single: SkillCompareResult | null;
  report: SkillFullCompareReport | null;
  impact: SkillImpact;
  shadowReport: ShadowReplayReport | null;
  fuzzReport: RouteFuzzReport | null;
  pageWalkReport: PageWalkResult | null;
  depProof: ReleaseDependencyProof | null;
  onCaseClaim?: (phrase: string) => void;
  onCaseChanged?: () => void;
  onAskInChat?: (query: string) => void;
}) {
  const hasReport = Boolean(report && !checking);
  const recommended = defaultSampleQuery(skillId, draftParsed.triggers);
  const triggerSamples = sampleTriggers(draftParsed.triggers, 6);
  const dialogueOk = hasReport && report && !reportStale && report.verdict.level !== "reject";
  const [showAllDiff, setShowAllDiff] = useState(false);
  const gateCount = listGateQuestionRows(skillId).length;

  const diff = useMemo(() => lineDiff(online, draft), [online, draft]);
  const diffRows = useMemo(() => (showAllDiff ? diff : foldDiff(diff)), [diff, showAllDiff]);

  const changeSummary = useMemo(() => {
    const addedT = draftParsed.triggers.filter((t) => !onlineParsed.triggers.includes(t));
    const removedT = onlineParsed.triggers.filter((t) => !draftParsed.triggers.includes(t));
    const stepsBefore = stepPipelineText(onlineParsed.steps);
    const stepsAfter = stepPipelineText(draftParsed.steps);
    const parts: string[] = [];
    if (addedT.length) parts.push(`新增 ${addedT.join("、")}`);
    if (removedT.length) parts.push(`删除 ${removedT.join("、")}`);
    if (stepsBefore !== stepsAfter) parts.push("步骤有变");
    if (onlineParsed.description !== draftParsed.description) parts.push("说明有变");
    if (onlineParsed.body.trim() !== draftParsed.body.trim()) parts.push("正文有变");
    return parts.length ? parts.join(" · ") : "改动较小";
  }, [onlineParsed, draftParsed]);

  const changeBullets = useMemo(() => {
    const addedT = draftParsed.triggers.filter((t) => !onlineParsed.triggers.includes(t));
    const removedT = onlineParsed.triggers.filter((t) => !draftParsed.triggers.includes(t));
    const stepsBefore = stepPipelineText(onlineParsed.steps);
    const stepsAfter = stepPipelineText(draftParsed.steps);
    const lines: string[] = [];
    if (onlineParsed.description !== draftParsed.description) lines.push(`说明改为「${draftParsed.description}」`);
    if (addedT.length) lines.push(`新增说法：${addedT.join("、")}`);
    if (removedT.length) lines.push(`删除说法：${removedT.join("、")}`);
    if (stepsBefore !== stepsAfter) lines.push(`步骤：${stepsBefore} → ${stepsAfter}`);
    if (onlineParsed.body.trim() !== draftParsed.body.trim()) lines.push("详细说明有改动");
    return lines.length ? lines : ["与线上相比只有格式或参数微调"];
  }, [onlineParsed, draftParsed]);

  const gateReasons = hasReport && report ? buildReleaseGateSummary(report).reasons : [];

  const signalBad =
    (shadowReport && shadowReport.routeDriftCount + shadowReport.executionRegressCount > 0) ||
    (fuzzReport && fuzzReport.lostCount > 0) ||
    (pageWalkReport && !pageWalkReport.ok);

  let statusLabel = "未检查";
  if (checking) statusLabel = "检查中…";
  else if (hasReport && reportStale) statusLabel = "需重新检查";
  else if (hasReport) statusLabel = humanVerdict(report!.verdict.level).title;

  return (
    <div className={`own-rel${checking ? " is-busy" : ""}`}>
      <header className="own-rel__mast">
        <div>
          <p className="own-rel__ver">
            v{liveVersion} → v{draftVersion}
          </p>
          <p className="own-rel__delta">{changeSummary}</p>
        </div>
        <span className={`own-rel__status${checking ? " is-run" : hasReport && reportStale ? " is-stale" : hasReport && report?.verdict.level === "reject" ? " is-bad" : hasReport ? " is-ok" : ""}`}>
          {statusLabel}
        </span>
      </header>

      {checking ? (
        <div className="own-rel__progress" aria-busy="true">
          <div className="own-rel__progress-track">
            <div className="own-rel__progress-fill" />
          </div>
        </div>
      ) : null}

      {reportStale && report ? <p className="own-rel__banner is-warn">草稿已改，当前是上次检查结果。</p> : null}

      {!hasReport && !checking ? (
        <p className="own-rel__banner is-neutral">用底部「只检查不发布」跑清单；点某行选试句。</p>
      ) : null}

      <CheckQuestions
        skillId={skillId}
        report={report}
        checking={checking}
        hideQuestionList
        showProgressSeal
        showRecheck={false}
        showStatusLine={false}
        onAsk={onAskInChat}
      />

      {hasReport && report ? (
        <div className="own-rel__verdict-wrap">
          <ReleaseGateHero
            skillName={getSkill(skillId)?.name ?? skillId}
            baselineVersion={liveVersion}
            candidateVersion={draftVersion}
            verdictLevel={report.verdict.level}
            verdictTitle={humanVerdict(report.verdict.level).title}
            scm={report.scm}
            caseCount={gateCount}
            reasons={gateReasons}
            actions={
              <>
                <button type="button" className="own-skill-inline-btn" onClick={() => downloadFullReportMd(report, skillId)}>
                  导出
                </button>
                <button type="button" className="own-skill-inline-btn" onClick={() => downloadReportJson(report)}>
                  JSON
                </button>
              </>
            }
          />
        </div>
      ) : null}

      <ReleaseQuestionHub
        skillId={skillId}
        draftRaw={draft}
        testQuery={testQuery}
        setTestQuery={setTestQuery}
        hasReport={hasReport}
        report={report}
        checking={checking}
        recommended={recommended}
        triggerSamples={triggerSamples}
        onDialogueAccept={() => onAskInChat?.(testQuery.trim() || recommended)}
        showDialogue={Boolean(dialogueOk)}
        onAsk={onAskInChat}
        onClaim={onCaseClaim}
        onChanged={onCaseChanged}
      />

      {hasReport && single ? (
        <section className="own-rel__section">
          <h3 className="own-rel__section-title">试句对比</h3>
          <p className="own-rel__section-meta">{single.query}</p>
          <div className="own-compare-columns">
            <CompareSideColumn title={`线上 v${liveVersion}`} side={single.baseline} other={single.candidate} />
            <CompareSideColumn title={`草稿 v${draftVersion}`} side={single.candidate} other={single.baseline} highlight />
          </div>
          <ScmAttributionPanel
            skillId={skillId}
            defaultExpanded={false}
            autoOpen={!single.baseline.traceOk || !single.candidate.traceOk || single.verdict.level !== "approve"}
            compare={{
              query: single.query,
              baselineTrace: single.baseline.trace,
              candidateTrace: single.candidate.trace,
            }}
          />
        </section>
      ) : null}

      {skillId === "release-inspector" && hasReport && depProof ? (
        <section className="own-rel__section">
          <ReleaseDependencyCard proof={depProof} />
        </section>
      ) : null}

      {impact.gained.length || impact.lost.length ? (
        <section className="own-rel__section">
          <ImpactPanel impact={impact} />
        </section>
      ) : null}

      {hasReport && report ? (
        <div className="own-rel__deep">
          <details className="own-rel__fold" open={signalBad}>
            <summary>运行信号（回流 · 邻域 · 本页试跑）</summary>
            <ReleaseCheckExtras
              skillId={skillId}
              draftRaw={draft}
              checking={false}
              shadow={shadowReport}
              fuzz={fuzzReport}
              pageWalk={pageWalkReport}
              flat
            />
          </details>
          <details className="own-rel__fold">
            <summary>技术报告</summary>
            <FullCompareReport report={report} skillId={skillId} heroReasons={gateReasons} />
          </details>
          <details className="own-rel__fold">
            <summary>草稿改动</summary>
            <ul className="own-rel-bullets">
              {changeBullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="own-skm-diff-head">
              <strong>逐行 diff</strong>
              <button type="button" className="own-skill-inline-btn" onClick={() => setShowAllDiff((v) => !v)}>
                {showAllDiff ? "只看改动" : "全文"}
              </button>
            </div>
            <div className="own-skm-diff">
              {diffRows.map((r, i) =>
                r.kind === "fold" ? (
                  <button key={i} type="button" className="own-skm-diff-fold" onClick={() => setShowAllDiff(true)}>
                    … {r.count} 行未改
                  </button>
                ) : (
                  <div key={i} className={`own-skm-diff-line own-skm-diff-line--${r.kind}`}>
                    <span className="own-skm-diff-no">{r.oldNo ?? ""}</span>
                    <span className="own-skm-diff-no">{r.newNo ?? ""}</span>
                    <span className="own-skm-diff-sign">{r.kind === "add" ? "+" : r.kind === "del" ? "−" : ""}</span>
                    <code>{r.text || " "}</code>
                  </div>
                ),
              )}
            </div>
            <PageToolWalk skillId={skillId} draftRaw={draft} />
            <SkillBreakPanel skillId={skillId} draftRaw={draft} />
          </details>
        </div>
      ) : null}
    </div>
  );
}
