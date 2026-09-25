import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AGENT_SKILLS, getBuiltinSkill, getLiveCatalog, type AgentSkill } from "../../lib/agentSkills";
import { extractUrlFromText } from "../../lib/releaseInspect";
import {
  candidateVersion,
  discardDraftsForSkill,
  getAppliedSkill,
  getPublishedVersion,
  listVersionHistory,
  newestDraftForSkill,
  publishSkillVersion,
  resolveBaselineRaw,
  saveNewVersionDraft,
  SKILL_OPEN_EVENT,
  SKILL_PUBLISH_EVENT,
  takePendingSkillOpen,
} from "../../lib/skillCompareStore";
import { reportToMarkdown, runFullSkillCompare, type SkillFullCompareReport } from "../../lib/skillCompareReport";
import { runSkillCompare, type SkillCompareResult } from "../../lib/skillCompareEngine";
import { parseSkillMarkdown, type ParsedSkillDoc } from "../../lib/skillMarkdown";
import {
  canFormEdit,
  moveStep,
  removeStep,
  renameStep,
  setBody,
  setDescription,
  setTriggers,
  splitTriggerInput,
} from "../../lib/skillFormEdit";
import { diffStats, foldDiff, lineDiff } from "../../lib/lineDiff";
import { INITIAL_SKILL_VERSION } from "../../lib/skillVersion";
import {
  defaultSampleQuery,
  fmtUpdatedAt,
  humanVerdict,
  sampleTriggers,
  skillDisplayTitle,
  skillSubtitle,
  stepPipelineText,
  stepShortLabel,
} from "./skillVerUi";
import { OaBtn, OaPage } from "./OaUi";
import {
  addTriggerTo,
  ImpactPanel,
  NlEditBox,
  RecentQueries,
  RouteProbe,
  TriggerAdvice,
  useSkillImpact,
} from "./SkillInsights";
import type { SkillImpact } from "../../lib/skillImpact";
import { skillQueryStats } from "../../lib/skillQueryLog";

type Tab = "overview" | "edit" | "check" | "history";

function onlineRaw(skillId: string): string {
  return resolveBaselineRaw(skillId, getBuiltinSkill(skillId)?.manifest ?? "");
}

function verdictTone(level: SkillFullCompareReport["verdict"]["level"]) {
  if (level === "approve") return "ok";
  if (level === "warn") return "warn";
  return "fail";
}

function plainBody(body: string): string {
  return body
    .replace(/^#{1,4}\s+.*$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string) => {
    setMsg(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3000);
  }, []);
  const node = msg ? <div className="own-skm-toast" role="status">{msg}</div> : null;
  return { show, node };
}

/** 技能管理 — 列表 → 概览 / 编辑 / 检查发布 / 发布记录 */
export function SkillComparePanel() {
  const [skillId, setSkillId] = useState<string | null>(takePendingSkillOpen);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    const open = () => {
      const id = takePendingSkillOpen();
      if (id) setSkillId(id);
    };
    window.addEventListener(SKILL_PUBLISH_EVENT, refresh);
    window.addEventListener(SKILL_OPEN_EVENT, open);
    return () => {
      window.removeEventListener(SKILL_PUBLISH_EVENT, refresh);
      window.removeEventListener(SKILL_OPEN_EVENT, open);
    };
  }, []);

  if (!skillId) return <SkillList tick={tick} onOpen={setSkillId} />;
  return (
    <SkillDetail
      key={skillId}
      skillId={skillId}
      onBack={() => {
        setSkillId(null);
        setTick((n) => n + 1);
      }}
    />
  );
}

function SkillList({ tick, onOpen }: { tick: number; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const skills = useMemo(() => {
    const live = new Map(getLiveCatalog().map((s) => [s.id, s]));
    return AGENT_SKILLS.map((b) => live.get(b.id) ?? b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    const hit = k
      ? skills.filter((s) =>
          [s.name, s.description, ...s.triggers].some((t) => t.toLowerCase().includes(k)),
        )
      : skills;
    return [...hit].sort((a, b) => Number(Boolean(newestDraftForSkill(b.id))) - Number(Boolean(newestDraftForSkill(a.id))));
  }, [skills, q]);

  const pendingCount = skills.filter((s) => newestDraftForSkill(s.id)).length;

  return (
    <OaPage title="技能管理" desc="每个技能决定「用户这样说时，AI 按什么步骤回答」。点进去可以查看、修改、检查后发布。">
      <div className="own-skm-list-bar">
        <input
          className="own-skm-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜技能名称或用户说法，例如：上线、年假"
        />
        <span className="own-skm-list-count">
          共 {skills.length} 个技能{pendingCount ? ` · ${pendingCount} 个有未发布的修改` : ""}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="own-ver-hint">没有匹配「{q}」的技能。</p>
      ) : (
        <ul className="own-skill-ver-grid">
          {rows.map((s) => (
            <SkillListCard key={s.id} skill={s} onOpen={() => onOpen(s.id)} />
          ))}
        </ul>
      )}
    </OaPage>
  );
}

function SkillListCard({ skill, onOpen }: { skill: AgentSkill; onOpen: () => void }) {
  const ver = getPublishedVersion(skill.id);
  const draft = newestDraftForSkill(skill.id);
  const applied = getAppliedSkill(skill.id);
  const samples = sampleTriggers(skill.triggers);
  const usage = skillQueryStats(skill.id);

  return (
    <li>
      <button type="button" className={draft ? "own-skill-ver-card own-skill-ver-card--draft" : "own-skill-ver-card"} onClick={onOpen}>
        <header>
          <strong>{skillDisplayTitle(skill)}</strong>
          <span className="own-skill-ver-tag">v{ver}</span>
        </header>
        <p className="own-skill-ver-desc">{skillSubtitle(skill)}</p>
        <p className="own-skill-ver-pipe-line">步骤：{stepPipelineText(skill.steps)}</p>
        {samples.length ? <p className="own-skill-ver-samples">用户常说：{samples.join("、")}</p> : null}
        <footer>
          <span>{fmtUpdatedAt(applied?.appliedAt)}</span>
          {usage.handled ? <span>近 7 天接手 {usage.handled} 句</span> : null}
          {draft ? <em className="own-skill-ver-pending">草稿 v{draft.version} 未发布</em> : <span className="own-skill-ver-ok">运行中</span>}
        </footer>
      </button>
    </li>
  );
}

function SkillDetail({ skillId, onBack }: { skillId: string; onBack: () => void }) {
  const toast = useToast();
  const builtin = getBuiltinSkill(skillId);

  const [online, setOnline] = useState(() => onlineRaw(skillId));
  const [draft, setDraft] = useState(() => newestDraftForSkill(skillId)?.raw ?? onlineRaw(skillId));
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [tab, setTab] = useState<Tab>(() => (newestDraftForSkill(skillId) ? "check" : "overview"));
  const [liveVersion, setLiveVersion] = useState(() => getPublishedVersion(skillId));
  const [testQuery, setTestQuery] = useState(() => defaultSampleQuery(skillId, builtin?.triggers ?? []));
  const [single, setSingle] = useState<SkillCompareResult | null>(null);
  const [report, setReport] = useState<SkillFullCompareReport | null>(null);
  const [reportRaw, setReportRaw] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);

  const onlineParsed = useMemo(() => parseSkillMarkdown(online), [online]);
  const draftParsed = useMemo(() => parseSkillMarkdown(draft), [draft]);
  const hasChanges = draft.trim() !== online.trim();
  const draftVersion = candidateVersion(skillId);
  const stats = useMemo(() => diffStats(lineDiff(online, draft)), [online, draft]);
  const reportStale = report != null && reportRaw !== draft;
  const title = skillDisplayTitle({ name: onlineParsed.name || skillId, description: onlineParsed.description });
  const skillName = builtin?.name ?? skillId;
  const impact = useSkillImpact(skillId, online, draft);
  const realLost = impact.lost.filter((s) => s.source === "real");

  useEffect(() => {
    if (!hasChanges) {
      if (newestDraftForSkill(skillId)) discardDraftsForSkill(skillId);
      setSaved("idle");
      return;
    }
    setSaved("saving");
    const t = window.setTimeout(() => {
      saveNewVersionDraft(skillId, draft, skillName);
      setSaved("saved");
    }, 500);
    return () => window.clearTimeout(t);
  }, [draft, hasChanges, skillId, skillName]);

  function reloadOnline() {
    const next = onlineRaw(skillId);
    setOnline(next);
    setLiveVersion(getPublishedVersion(skillId));
    setHistoryTick((n) => n + 1);
    return next;
  }

  async function runCheck(): Promise<SkillFullCompareReport | null> {
    if (!hasChanges) return null;
    setTab("check");
    setChecking(true);
    setSingle(null);
    const snapshot = draft;
    try {
      const q = testQuery.trim();
      const [one, full] = await Promise.all([
        q
          ? runSkillCompare({
              skillId,
              baselineRaw: online,
              candidateRaw: snapshot,
              query: q,
              probeUrl: extractUrlFromText(q) ?? undefined,
            })
          : Promise.resolve(null),
        runFullSkillCompare({
          skillId,
          skillName: title,
          baselineRaw: online,
          candidateRaw: snapshot,
          baselineVersion: liveVersion,
          candidateVersion: draftVersion,
          extraQuery: q || undefined,
        }),
      ]);
      setSingle(one);
      setReport(full);
      setReportRaw(snapshot);
      return full;
    } catch (err) {
      toast.show(`检查没跑完：${err instanceof Error ? err.message : "未知错误"}`);
      return null;
    } finally {
      setChecking(false);
    }
  }

  const publishBlock: string | null = !hasChanges
    ? "还没有改动"
    : !draftParsed.ok
      ? `配置有错误：${draftParsed.issues.find((i) => i.level === "error")?.message ?? "格式不对"}`
      : null;
  const checkHint = !report ? "点发布会先自动检查一遍" : reportStale ? "检查后又改过，发布时会重新检查" : null;

  /** 没检查过（或检查后又改过）就先自动检查，再按结果确认发布 */
  async function publish(force = false) {
    if (publishBlock || checking) return;
    const r = report && !reportStale ? report : await runCheck();
    if (!r) return;
    if (r.verdict.level === "reject" && !force) {
      toast.show(`检查建议先别发布：${r.verdict.title}。看下方报告，确认无碍可点「我确认，仍要发布」`);
      return;
    }
    if (r.verdict.level === "warn" && !window.confirm("检查发现有需要注意的地方，确定发布吗？")) return;
    if (
      realLost.length &&
      !window.confirm(
        `发布后，有 ${realLost.length} 句用户真实问过的话不再由这个技能处理，例如「${realLost[0]!.q}」会改由「${realLost[0]!.toLabel}」处理。确定发布吗？`,
      )
    )
      return;
    const applied = publishSkillVersion(skillId, skillName, draft, r.verdict.title);
    const next = reloadOnline();
    setDraft(next);
    setReport(null);
    setSingle(null);
    setReportRaw(null);
    toast.show(`已发布 v${applied.version}，用户提问时立即生效`);
    setTab("overview");
  }

  function discard() {
    if (!window.confirm(`放弃草稿 v${draftVersion}？线上 v${liveVersion} 不受影响。`)) return;
    discardDraftsForSkill(skillId);
    setDraft(online);
    setReport(null);
    setSingle(null);
    setReportRaw(null);
    toast.show("草稿已放弃");
  }

  function startFrom(raw: string, label: string) {
    setDraft(raw);
    setReport(null);
    setSingle(null);
    setReportRaw(null);
    setTab("check");
    toast.show(`已把 ${label} 的内容放进草稿，检查后可发布`);
  }

  function rollbackTo(raw: string, version: string) {
    if (!window.confirm(`直接把线上换成 v${version} 的内容？会生成新版本号，旧记录都保留。`)) return;
    const applied = publishSkillVersion(skillId, skillName, raw, `回滚到 v${version} 的内容`, "rollback");
    const next = reloadOnline();
    if (!hasChanges) setDraft(next);
    toast.show(`已回滚：线上现为 v${applied.version}（内容同 v${version}）`);
  }

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "overview", label: "概览" },
    { id: "edit", label: "修改", badge: hasChanges ? "草稿" : undefined },
    { id: "check", label: "检查并发布", badge: hasChanges ? `v${draftVersion}` : undefined },
    { id: "history", label: "发布记录" },
  ];

  return (
    <OaPage title={title} desc={skillSubtitle({ description: onlineParsed.description })}>
      <div className="own-skill-ver-detail">
        <div className="own-skill-ver-topbar">
          <button type="button" className="own-skill-ver-back" onClick={onBack}>
            ← 全部技能
          </button>
          <div className="own-skm-live-pill">
            线上 v{liveVersion} · {fmtUpdatedAt(getAppliedSkill(skillId)?.appliedAt)}
          </div>
        </div>

        <nav className="own-skill-ver-tabs" aria-label="技能管理">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
              {t.badge ? <em>{t.badge}</em> : null}
            </button>
          ))}
        </nav>

        {tab === "overview" ? (
          <Overview
            parsed={onlineParsed}
            skillId={skillId}
            hasChanges={hasChanges}
            draftVersion={draftVersion}
            stats={stats}
            onEdit={() => setTab("edit")}
            onCheck={() => setTab("check")}
            onTry={(q) => {
              setTestQuery(q);
              setTab(hasChanges ? "check" : "edit");
              if (!hasChanges) toast.show("已记下这句话。先改点内容，再到「检查并发布」用它对比");
            }}
          />
        ) : null}

        {tab === "edit" ? (
          <Editor
            skillId={skillId}
            raw={draft}
            online={online}
            onChange={(next) => setDraft(next)}
            onNotify={toast.show}
            onRestore={() => {
              if (hasChanges && !window.confirm("撤销全部修改，恢复成线上内容？")) return;
              setDraft(online);
            }}
          />
        ) : null}

        {tab === "check" ? (
          hasChanges ? (
            <CheckView
              skillId={skillId}
              online={online}
              draft={draft}
              liveVersion={liveVersion}
              draftVersion={draftVersion}
              onlineParsed={onlineParsed}
              draftParsed={draftParsed}
              testQuery={testQuery}
              setTestQuery={setTestQuery}
              checking={checking}
              single={single}
              report={report}
              reportStale={reportStale}
              impact={impact}
              onCheck={() => void runCheck()}
            />
          ) : (
            <div className="own-skm-empty">
              <p>现在和线上 v{liveVersion} 一模一样，没有要检查的内容。</p>
              <OaBtn onClick={() => setTab("edit")}>去修改</OaBtn>
            </div>
          )
        ) : null}

        {tab === "history" ? (
          <History
            key={historyTick}
            skillId={skillId}
            liveVersion={liveVersion}
            builtinRaw={builtin?.manifest ?? ""}
            online={online}
            onView={startFrom}
            onRollback={rollbackTo}
          />
        ) : null}

        {hasChanges && (tab === "edit" || tab === "check") ? (
          <div className="own-ver-sticky">
            <div className="own-ver-sticky-main">
              <div className="own-skm-bar-status">
                <strong>草稿 v{draftVersion}</strong>
                <span>
                  +{stats.added} −{stats.removed} 行 · {saved === "saving" ? "保存中…" : "已自动保存，关掉页面也不会丢"}
                </span>
                {impact.gained.length || impact.lost.length ? (
                  <button type="button" className={realLost.length ? "own-si-bar-impact is-lose" : "own-si-bar-impact"} onClick={() => setTab("check")}>
                    路由变化：新接手 {impact.gained.length} 句 · 不再接手 {impact.lost.length} 句
                  </button>
                ) : null}
                {report && !reportStale ? (
                  <span className={`own-ver-sticky-verdict own-ver-sticky-verdict--${verdictTone(report.verdict.level)}`}>
                    检查结果：{humanVerdict(report.verdict.level).title}
                  </span>
                ) : publishBlock || checkHint ? (
                  <span className="own-skm-bar-block">{publishBlock ?? checkHint}</span>
                ) : null}
              </div>
              <div className="own-ver-sticky-actions">
                <button type="button" className="own-compare-secondary-btn" onClick={discard}>
                  放弃草稿
                </button>
                <button
                  type="button"
                  className="own-compare-secondary-btn"
                  onClick={() => void runCheck()}
                  disabled={checking}
                >
                  {checking ? "检查中…" : report && !reportStale ? "重新检查" : "只检查不发布"}
                </button>
                <OaBtn
                  onClick={() => void publish()}
                  disabled={Boolean(publishBlock) || checking || (report?.verdict.level === "reject" && !reportStale)}
                >
                  {checking ? "检查中…" : !report || reportStale ? `检查并发布 v${draftVersion}` : `发布 v${draftVersion}`}
                </OaBtn>
              </div>
            </div>
            {report && !reportStale && report.verdict.level === "reject" ? (
              <p className="own-ver-sticky-note own-ver-sticky-note--bad">
                {humanVerdict("reject").hint}{" "}
                <button
                  type="button"
                  className="own-skill-inline-btn"
                  onClick={() => {
                    if (window.confirm("检查建议先别发布。确认了解风险，仍要发布？")) void publish(true);
                  }}
                >
                  我确认，仍要发布
                </button>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {toast.node}
    </OaPage>
  );
}

function Overview({
  parsed,
  skillId,
  hasChanges,
  draftVersion,
  stats,
  onEdit,
  onCheck,
  onTry,
}: {
  parsed: ParsedSkillDoc;
  skillId: string;
  hasChanges: boolean;
  draftVersion: string;
  stats: { added: number; removed: number };
  onEdit: () => void;
  onCheck: () => void;
  onTry: (q: string) => void;
}) {
  const sample = defaultSampleQuery(skillId, parsed.triggers);
  const detail = plainBody(parsed.body);

  return (
    <div className="own-skill-showcase">
      {hasChanges ? (
        <div className="own-skm-draft-banner">
          <span>
            有一份未发布的草稿 <strong>v{draftVersion}</strong>（+{stats.added} −{stats.removed} 行）
          </span>
          <div>
            <button type="button" className="own-skill-inline-btn" onClick={onEdit}>
              继续修改
            </button>
            <OaBtn onClick={onCheck}>去检查并发布</OaBtn>
          </div>
        </div>
      ) : (
        <div className="own-skm-draft-banner own-skm-draft-banner--idle">
          <span>以下是线上正在用的内容。</span>
          <OaBtn onClick={onEdit}>修改这个技能</OaBtn>
        </div>
      )}

      <section className="own-skill-showcase-block">
        <h3>这个技能做什么</h3>
        <p>{parsed.description || "（还没写说明）"}</p>
        {detail ? <p className="own-skm-detail-text">{detail}</p> : null}
      </section>

      <section className="own-skill-showcase-block">
        <h3>用户这样说时会用到它（{parsed.triggers.length}）</h3>
        {parsed.triggers.length ? (
          <div className="own-skill-ver-chips">
            {parsed.triggers.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        ) : (
          <p className="own-ver-parse-warn">没有设置说法，这个技能永远不会被用到。</p>
        )}
      </section>

      <section className="own-skill-showcase-block">
        <h3>回答步骤（按顺序执行）</h3>
        <ol className="own-skm-steps-view">
          {parsed.steps.map((s, i) => (
            <li key={`${s.id}-${i}`}>
              <em>{i + 1}</em>
              <div>
                <strong>{stepShortLabel(s)}</strong>
                <small>{s.tool.startsWith("__") ? "汇总生成回答" : `使用工具 ${s.tool}`}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="own-skill-showcase-block">
        <h3>试一句话：会交给哪个技能？</h3>
        <RouteProbe skillId={skillId} initial={sample} onCompare={onTry} />
      </section>

      <section className="own-skill-showcase-block">
        <h3>最近用户问了什么</h3>
        <RecentQueries skillId={skillId} />
      </section>
    </div>
  );
}

function Editor({
  skillId,
  raw,
  online,
  onChange,
  onNotify,
  onRestore,
}: {
  skillId: string;
  raw: string;
  online: string;
  onChange: (raw: string) => void;
  onNotify: (msg: string) => void;
  onRestore: () => void;
}) {
  const formOk = canFormEdit(raw);
  const [mode, setMode] = useState<"form" | "source">(formOk ? "form" : "source");
  const changed = raw.trim() !== online.trim();

  return (
    <section className="own-skm-editor">
      <header className="own-skm-editor-head">
        <div className="own-skill-ver-tabs own-skill-ver-tabs--sm">
          <button type="button" className={mode === "form" ? "on" : ""} onClick={() => setMode("form")} disabled={!formOk}>
            表单修改
          </button>
          <button type="button" className={mode === "source" ? "on" : ""} onClick={() => setMode("source")}>
            源码（高级）
          </button>
        </div>
        <span className="own-ver-hint">
          {changed ? "改动会自动存成草稿，线上不受影响，检查后再发布。" : "现在和线上一致。改任何内容都会自动存成草稿。"}
        </span>
        {changed ? (
          <button type="button" className="own-skill-inline-btn" onClick={onRestore}>
            撤销全部修改
          </button>
        ) : null}
      </header>

      {formOk ? (
        <NlEditBox
          raw={raw}
          onApply={(next, summary) => {
            onChange(next);
            onNotify(`已应用到草稿：${summary}`);
          }}
        />
      ) : null}

      {mode === "form" && formOk ? (
        <FormEditor skillId={skillId} raw={raw} online={online} onChange={onChange} />
      ) : (
        <>
          {!formOk ? <p className="own-ver-parse-warn">这份配置格式特殊，只能用源码修改。</p> : null}
          <textarea
            className="own-ver-textarea own-ver-textarea--solo"
            value={raw}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
          <SourceIssues raw={raw} />
        </>
      )}
    </section>
  );
}

function SourceIssues({ raw }: { raw: string }) {
  const parsed = useMemo(() => parseSkillMarkdown(raw), [raw]);
  const errors = parsed.issues.filter((i) => i.level === "error");
  if (!errors.length) return <p className="own-ver-parse-ok">格式正确</p>;
  return (
    <ul className="own-skm-issues">
      {errors.map((e, i) => (
        <li key={i}>{e.line ? `第 ${e.line} 行：` : ""}{e.message}</li>
      ))}
    </ul>
  );
}

function FormEditor({
  skillId,
  raw,
  online,
  onChange,
}: {
  skillId: string;
  raw: string;
  online: string;
  onChange: (raw: string) => void;
}) {
  const parsed = useMemo(() => parseSkillMarkdown(raw), [raw]);
  const base = useMemo(() => parseSkillMarkdown(online), [online]);
  const [desc, setDesc] = useState(parsed.description);
  const [body, setBodyText] = useState(parsed.body);
  const [newTrigger, setNewTrigger] = useState("");

  useEffect(() => {
    if (desc.trim() !== parsed.description) setDesc(parsed.description);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.description]);
  useEffect(() => {
    if (body.trim() !== parsed.body.trim()) setBodyText(parsed.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.body]);

  const baseTriggers = new Set(base.triggers);
  const removedTriggers = base.triggers.filter((t) => !parsed.triggers.includes(t));

  function addTriggers() {
    const incoming = splitTriggerInput(newTrigger).filter((t) => !parsed.triggers.includes(t));
    if (!incoming.length) {
      setNewTrigger("");
      return;
    }
    onChange(setTriggers(raw, [...parsed.triggers, ...incoming]));
    setNewTrigger("");
  }

  return (
    <div className="own-skm-form">
      <label className="own-skm-field">
        <span>一句话说明</span>
        <small>显示在技能列表里，告诉同事这个技能是干什么的。</small>
        <input
          value={desc}
          onChange={(e) => {
            setDesc(e.target.value);
            onChange(setDescription(raw, e.target.value.trim()));
          }}
          placeholder="例如：发布前巡检 — 检查网址能不能正常打开"
        />
        {desc.trim() !== base.description ? <em className="own-skm-changed">已修改</em> : null}
      </label>

      <div className="own-skm-field">
        <span>用户会怎么说（触发说法）</span>
        <small>用户的话里包含这些词，就会用到这个技能。点 × 删除，输入后按回车添加，多个用逗号隔开。</small>
        <div className="own-skm-trigger-box">
          {parsed.triggers.map((t) => (
            <span key={t} className={baseTriggers.has(t) ? "own-skm-chip" : "own-skm-chip own-skm-chip--add"}>
              {t}
              <button
                type="button"
                aria-label={`删除 ${t}`}
                onClick={() => onChange(setTriggers(raw, parsed.triggers.filter((x) => x !== t)))}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTriggers();
              } else if (e.key === "Backspace" && !newTrigger && parsed.triggers.length) {
                onChange(setTriggers(raw, parsed.triggers.slice(0, -1)));
              }
            }}
            onBlur={addTriggers}
            placeholder={parsed.triggers.length ? "添加说法…" : "例如：上线、验收"}
          />
        </div>
        {removedTriggers.length ? (
          <p className="own-skm-removed">
            相比线上删掉了：
            {removedTriggers.map((t) => (
              <button key={t} type="button" onClick={() => onChange(setTriggers(raw, [...parsed.triggers, t]))} title="点击加回来">
                {t} ↺
              </button>
            ))}
          </p>
        ) : null}
        {!parsed.triggers.length ? <p className="own-ver-parse-warn">至少要有一个说法，否则这个技能不会被用到。</p> : null}
        <TriggerAdvice skillId={skillId} raw={raw} onAdd={(p) => onChange(addTriggerTo(raw, p))} />
      </div>

      <div className="own-skm-field">
        <span>回答步骤</span>
        <small>AI 会按从上到下的顺序执行。可以改名字、调顺序、删掉不需要的步骤。</small>
        <ol className="own-skm-step-edit">
          {parsed.steps.map((s, i) => (
            <StepRow
              key={`${s.id}-${i}`}
              index={i}
              total={parsed.steps.length}
              label={s.label}
              tool={s.tool}
              isNew={!base.steps.some((b) => b.id === s.id)}
              onRename={(label) => onChange(renameStep(raw, i, label))}
              onMove={(d) => onChange(moveStep(raw, i, d))}
              onRemove={() => {
                if (window.confirm(`删掉步骤「${stepShortLabel(s)}」？删了之后回答里就没有这部分内容了。`)) onChange(removeStep(raw, i));
              }}
            />
          ))}
        </ol>
        {base.steps.filter((b) => !parsed.steps.some((s) => s.id === b.id)).length ? (
          <p className="own-skm-removed">
            相比线上少了步骤：{base.steps.filter((b) => !parsed.steps.some((s) => s.id === b.id)).map((b) => stepShortLabel(b)).join("、")}
            （想加回来可以点「撤销全部修改」或用源码）
          </p>
        ) : null}
        <p className="own-ver-hint">新增步骤需要选择具体工具和参数，请用「源码（高级）」添加。</p>
      </div>

      <label className="own-skm-field">
        <span>详细说明（选填）</span>
        <small>写给同事看的使用说明，例如适用场景、注意事项。不影响 AI 的回答。</small>
        <textarea
          rows={6}
          value={body}
          onChange={(e) => {
            setBodyText(e.target.value);
            onChange(setBody(raw, e.target.value));
          }}
        />
      </label>
    </div>
  );
}

function StepRow({
  index,
  total,
  label,
  tool,
  isNew,
  onRename,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  label: string;
  tool: string;
  isNew: boolean;
  onRename: (label: string) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(label);
  useEffect(() => setText(label), [label]);
  const commit = () => {
    const v = text.trim();
    if (!v) setText(label);
    else if (v !== label) onRename(v);
  };

  return (
    <li className={isNew ? "own-skm-step own-skm-step--new" : "own-skm-step"}>
      <em>{index + 1}</em>
      <div className="own-skm-step-main">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setText(label);
          }}
          aria-label={`第 ${index + 1} 步名称`}
        />
        <small>使用工具：{tool.startsWith("__") ? "汇总生成回答" : tool}</small>
      </div>
      <div className="own-skm-step-ops">
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="上移">↑</button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="下移">↓</button>
        <button type="button" onClick={onRemove} disabled={total <= 1} title={total <= 1 ? "至少保留一步" : "删除这一步"}>
          删除
        </button>
      </div>
    </li>
  );
}

function CheckView({
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
  single,
  report,
  reportStale,
  impact,
  onCheck,
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
  single: SkillCompareResult | null;
  report: SkillFullCompareReport | null;
  reportStale: boolean;
  impact: SkillImpact;
  onCheck: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const diff = useMemo(() => lineDiff(online, draft), [online, draft]);
  const rows = useMemo(() => (showAll ? diff : foldDiff(diff)), [diff, showAll]);

  const addedT = draftParsed.triggers.filter((t) => !onlineParsed.triggers.includes(t));
  const removedT = onlineParsed.triggers.filter((t) => !draftParsed.triggers.includes(t));
  const stepsBefore = stepPipelineText(onlineParsed.steps);
  const stepsAfter = stepPipelineText(draftParsed.steps);
  const summary: string[] = [];
  if (onlineParsed.description !== draftParsed.description) summary.push(`说明改成：「${draftParsed.description}」`);
  if (addedT.length) summary.push(`新增说法：${addedT.join("、")}`);
  if (removedT.length) summary.push(`删掉说法：${removedT.join("、")}`);
  if (stepsBefore !== stepsAfter) summary.push(`回答步骤原来是「${stepsBefore}」，改成「${stepsAfter}」`);
  if (onlineParsed.body.trim() !== draftParsed.body.trim()) summary.push("详细说明有改动");
  if (!summary.length) summary.push("只改了格式或参数，具体见下方逐行对比");

  const samples = sampleTriggers(draftParsed.triggers, 6);
  const recommended = defaultSampleQuery(skillId, draftParsed.triggers);

  return (
    <div className="own-skill-ver-compare">
      <section className="own-compare-report-section">
        <h3>
          改了什么 <span className="own-skm-ver-arrow">v{liveVersion} → v{draftVersion}</span>
        </h3>
        <ul className="own-skm-summary-list">
          {summary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <div className="own-skm-diff-head">
          <strong>逐行对比</strong>
          <button type="button" className="own-skill-inline-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "只看改动" : "显示全文"}
          </button>
        </div>
        <div className="own-skm-diff" role="table" aria-label="逐行对比">
          {rows.map((r, i) =>
            r.kind === "fold" ? (
              <button key={i} type="button" className="own-skm-diff-fold" onClick={() => setShowAll(true)}>
                … {r.count} 行没有改动（点击展开）
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
      </section>

      <ImpactPanel impact={impact} />

      <section className="own-skill-ver-try">
        <label htmlFor="skill-test-query">用一句用户可能说的话，对比改动前后怎么回答</label>
        <div className="own-skill-ver-chips own-skill-ver-chips--click">
          <button type="button" className={testQuery === recommended ? "on" : ""} onClick={() => setTestQuery(recommended)}>
            推荐例句
          </button>
          {samples.map((t) => (
            <button key={t} type="button" className={testQuery === `帮我${t}` ? "on" : ""} onClick={() => setTestQuery(`帮我${t}`)}>
              {t}
            </button>
          ))}
        </div>
        <textarea
          id="skill-test-query"
          className="own-skill-ver-query-input"
          rows={2}
          value={testQuery}
          onChange={(e) => setTestQuery(e.target.value)}
          placeholder="例如：帮我看看 https://example.com 能不能上线"
        />
        <p className="own-ver-hint">检查会用这句话 + 约 10 句常见说法，同时跑一遍现用版和新版；直接点底部「检查并发布」也会先跑这一步。</p>
        <div>
          <OaBtn onClick={onCheck} disabled={checking}>
            {checking ? "检查中…" : "检查改动"}
          </OaBtn>
        </div>
      </section>

      {checking ? <p className="own-skm-checking">正在分别用 v{liveVersion} 和 v{draftVersion} 回答，稍等几秒…</p> : null}

      {reportStale && !checking ? (
        <p className="own-skm-stale">下面是改动之前的检查结果，内容已经又改过了，请重新检查。</p>
      ) : null}

      {single && !checking ? (
        <div className={reportStale ? "own-skm-stale-box" : undefined}>
          <p className="own-skill-ver-try-caption">「{single.query}」这句话：</p>
          <div className="own-compare-columns">
            <CompareSideColumn title={`现用 v${liveVersion}`} side={single.baseline} other={single.candidate} />
            <CompareSideColumn title={`新版 v${draftVersion}`} side={single.candidate} other={single.baseline} highlight />
          </div>
        </div>
      ) : null}

      {report && !checking ? (
        <div className={reportStale ? "own-skm-stale-box" : undefined}>
          <FullCompareReport report={report} skillId={skillId} />
        </div>
      ) : null}
    </div>
  );
}

function CompareSideColumn({
  title,
  side,
  other,
  highlight,
}: {
  title: string;
  side: SkillCompareResult["baseline"];
  other: SkillCompareResult["baseline"];
  highlight?: boolean;
}) {
  const routeChanged = side.routedSkillId !== other.routedSkillId;
  return (
    <article className={highlight ? "own-compare-col own-compare-col--new" : "own-compare-col"}>
      <header>
        <h3>{title}</h3>
        <span className={side.traceOk ? "own-skill-badge ok" : "own-skill-badge warn"}>{side.traceOk ? "回答成功" : "回答失败"}</span>
      </header>
      <dl className="own-compare-facts">
        <div>
          <dt>交给哪个技能处理</dt>
          <dd className={routeChanged ? "own-compare-warn" : ""}>
            {side.routedSkillName ?? "没有技能接手"}
            {routeChanged ? "（和另一版不同）" : ""}
          </dd>
        </div>
        <div>
          <dt>执行的步骤</dt>
          <dd>{side.steps.map((s) => stepShortLabel(s)).join(" → ") || "无"}</dd>
        </div>
        <div>
          <dt>回答内容</dt>
          <dd className="own-compare-answer">{side.answerPreview}</dd>
        </div>
      </dl>
    </article>
  );
}

function FullCompareReport({ report, skillId }: { report: SkillFullCompareReport; skillId: string }) {
  const v = humanVerdict(report.verdict.level);
  const issues = report.risks.filter((r) => r.level !== "low");
  const bad = report.queryResults.filter((q) => q.routeDrift || q.traceChanged).length;

  function download() {
    const blob = new Blob([reportToMarkdown(report)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${skillId}-v${report.baselineVersion}-to-v${report.candidateVersion}-检查报告.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="own-skill-ver-report">
      <section className={`own-skill-ver-summary own-skill-ver-summary--${verdictTone(report.verdict.level)}`}>
        <h3>检查结论：{v.title}</h3>
        <p>
          {v.hint} 共试了 {report.queryResults.length} 句常见说法，{bad ? `${bad} 句表现和现用版不同` : "表现全部一致"}。
        </p>
        <button type="button" className="own-skill-inline-btn" onClick={download}>
          下载检查报告
        </button>
      </section>

      {issues.length ? (
        <section className="own-compare-report-section">
          <h3>需要注意（{issues.length}）</h3>
          <ul className="own-compare-risk-list">
            {issues.map((r, i) => (
              <li key={i} className={`own-compare-risk own-compare-risk--${r.level === "high" ? "fail" : "warn"}`}>
                <span className="own-compare-risk-badge">{r.level === "high" ? "严重" : "注意"}</span>
                <div>
                  <strong>{r.title}</strong>
                  <p>{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="own-compare-report-section own-skm-details" open={bad > 0}>
        <summary>
          <h3>逐句测试结果（{report.queryResults.length} 句{bad ? `，${bad} 句不同` : ""}）</h3>
        </summary>
        <div className="own-compare-table-wrap">
          <table className="own-compare-table">
            <thead>
              <tr>
                <th>用户说法</th>
                <th>现用版交给</th>
                <th>新版交给</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {report.queryResults.map((q, i) => (
                <tr key={i} className={q.routeDrift || q.traceChanged ? "own-compare-row-warn" : undefined}>
                  <td>{q.query}</td>
                  <td>{q.routeBaseline ?? "没有技能接手"}</td>
                  <td>{q.routeCandidate ?? "没有技能接手"}</td>
                  <td>{q.routeDrift ? "交给的技能变了" : q.traceChanged ? `步骤变了：${q.traceSummary}` : "一致"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function History({
  skillId,
  liveVersion,
  builtinRaw,
  online,
  onView,
  onRollback,
}: {
  skillId: string;
  liveVersion: string;
  builtinRaw: string;
  online: string;
  onView: (raw: string, label: string) => void;
  onRollback: (raw: string, version: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const entries = useMemo(() => {
    const seen = new Set<string>();
    const rows = listVersionHistory(skillId)
      .filter((h) => (seen.has(h.version) ? false : (seen.add(h.version), true)))
      .map((h) => ({ key: h.recordId, version: h.version, raw: h.raw, at: h.savedAt, note: h.note, kind: h.kind }));
    if (!seen.has(INITIAL_SKILL_VERSION)) {
      rows.push({ key: "builtin", version: INITIAL_SKILL_VERSION, raw: builtinRaw, at: "", note: "出厂内置配置", kind: "publish" });
    }
    return rows;
  }, [skillId, builtinRaw]);

  return (
    <section className="own-skm-history">
      <p className="own-ver-hint">每次发布都会留一条记录。回滚也会生成新版本号，旧记录不会被覆盖。</p>
      <ul>
        {entries.map((e) => {
          const isLive = e.version === liveVersion;
          const diff = diffStats(lineDiff(online, e.raw));
          return (
            <li key={e.key} className={isLive ? "own-skm-history-row own-skm-history-row--live" : "own-skm-history-row"}>
              <div className="own-skm-history-main">
                <strong>v{e.version}</strong>
                {isLive ? <span className="own-skill-ver-ok">线上正在用</span> : null}
                <span className="own-skm-history-time">{e.at ? new Date(e.at).toLocaleString("zh-CN") : "出厂"}</span>
                {e.note ? <span className="own-skm-history-note">{e.kind === "rollback" ? "↺ " : ""}{e.note}</span> : null}
                {!isLive ? <span className="own-skm-history-time">与线上相差 +{diff.added} −{diff.removed} 行</span> : null}
              </div>
              <div className="own-skm-history-ops">
                <button type="button" className="own-skill-inline-btn" onClick={() => setOpen(open === e.key ? null : e.key)}>
                  {open === e.key ? "收起" : "查看内容"}
                </button>
                {!isLive ? (
                  <>
                    <button type="button" className="own-skill-inline-btn" onClick={() => onView(e.raw, `v${e.version}`)}>
                      和线上对比
                    </button>
                    <button type="button" className="own-compare-secondary-btn" onClick={() => onRollback(e.raw, e.version)}>
                      回滚到这版
                    </button>
                  </>
                ) : null}
              </div>
              {open === e.key ? <pre className="own-ver-readonly own-skm-history-pre">{e.raw}</pre> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
