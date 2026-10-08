import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { previewClause, renderSkillHost, type SkillClause } from "../../lib/skillHost";
import { AGENT_SKILLS, getBuiltinSkill, getLiveCatalog, isAnswerLayerSkill, type AgentSkill } from "../../lib/agentSkills";
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
import { buildReleaseGateSummary, downloadReportJson } from "../../lib/releaseGate";
import { buildReleaseWitness, downloadReleaseWitness } from "../../lib/releaseWitness";
import { runRouteFuzzScan, type RouteFuzzReport } from "../../lib/skillRouteFuzz";
import { runShadowReplayGate, type ShadowReplayReport } from "../../lib/skillShadowReplay";
import { ReleaseCheckExtras } from "./ReleaseCheckExtras";
import { ReleaseDependencyCard } from "./ReleaseDependencyCard";
import { CompareSideColumn, downloadFullReportMd, FullCompareReport } from "./releaseCompareUi";
import { ScmAttributionPanel } from "./ScmAttributionPanel";
import { releaseGateLevel, gateLead, customerReason } from "./ScmVisuals";
import { runPageToolWalk, type PageWalkResult } from "./PageToolWalk";
import { buildReleaseDependencyProof, type ReleaseDependencyProof } from "../../lib/releaseDependencyProof";
import { listGateQuestionRows } from "../../lib/skillGateQuestions";
import { listPageTools } from "../../lib/pageTools";
import { runFullSkillCompare, type SkillFullCompareReport } from "../../lib/skillCompareReport";
import {
  decideReleaseApproval,
  ensureTeamSession,
  findReleaseApproval,
  loadBaselineTags,
  listPendingReleaseApprovals,
  submitReleaseApproval,
  type BaselineTags,
  type ReleaseApproval,
} from "../../lib/teamGateClient";
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
import { needsSkillRepair, repairSkillMarkdown } from "../../lib/skillRepair";
import { diffStats, foldDiff, lineDiff } from "../../lib/lineDiff";
import { INITIAL_SKILL_VERSION } from "../../lib/skillVersion";
import {
  defaultSampleQuery,
  fmtUpdatedAt,
  humanVerdict,
  queryComparePresentation,
  sampleTriggers,
  skillDisplayTitle,
  skillSubtitle,
  stepPipelineText,
  stepShortLabel,
} from "./skillVerUi";
import {
  batchInstallSkills,
  buildSkillsExportBundle,
  downloadText,
  loadImportedSkills,
  readSkillImportFiles,
  removeImportedSkill,
  type SkillExportRecord,
} from "../../lib/importedSkills";
import { buildZip, downloadBlob } from "../../lib/zipStore";
import { apiFetch } from "../../lib/apiClient";
import { SkillEvolutionPanel } from "./SkillEvolution";
import { ScmCaseEditor } from "./ScmCaseEditor";
import { SkillBreakPanel } from "./SkillBreak";
import { PageToolWalk } from "./PageToolWalk";
import { SkillClauseNote, useSkillClauses } from "./SkillClauseNote";
import { SkillFromDemoDialog } from "./SkillFromDemo";
import { TraceFeedbackPanel } from "./TraceFeedbackPanel";
import { SkillGovernancePanel } from "./SkillGovernancePanel";
import { OaBtn, OaPage } from "./OaUi";
import { noteLivePublished } from "../../lib/catalogSets";
import {
  addTriggerTo,
  ImpactPanel,
  NlEditBox,
  TriggerAdvice,
  useSkillImpact,
} from "./SkillInsights";
import type { SkillImpact } from "../../lib/skillImpact";
import { skillQueryStats } from "../../lib/skillQueryLog";

type Tab = "overview" | "edit" | "cases" | "check" | "history";

function onlineRaw(skillId: string): string {
  return resolveBaselineRaw(skillId, getBuiltinSkill(skillId)?.manifest ?? "");
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
async function alignCanonicalGate(report: SkillFullCompareReport, raw: string, version: string) {
  const apiGate = await apiFetch<NonNullable<SkillFullCompareReport["canonicalGate"]>>("/skill-gate/check", {
    method: "POST",
    body: JSON.stringify({
      skillId: report.skillId,
      raw,
      environment: "prod",
      candidateVersion: version,
    }),
  });
  if (apiGate?.gate && apiGate.skillId === report.skillId && apiGate.coverage && Array.isArray(apiGate.failedCases)) {
    report.canonicalGate = apiGate;
  }
  return report;
}

export function SkillComparePanel({ initialTab }: { initialTab?: Tab } = {}) {
  const [skillId, setSkillId] = useState<string | null>(takePendingSkillOpen);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      noteLivePublished();
      setTick((n) => n + 1);
    };
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
      initialTab={initialTab}
      onBack={() => {
        setSkillId(null);
        setTick((n) => n + 1);
      }}
    />
  );
}

function SkillList({ tick, onOpen }: { tick: number; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [envTags, setEnvTags] = useState<BaselineTags>({});

  useEffect(() => {
    const note = sessionStorage.getItem("oa-version-saved");
    if (!note) return;
    toast.show(note);
    const timer = window.setTimeout(() => sessionStorage.removeItem("oa-version-saved"), 0);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void loadBaselineTags().then(setEnvTags);
  }, [tick]);

  const builtinIds = useMemo(() => new Set(AGENT_SKILLS.map((s) => s.id)), []);
  const importedIds = useMemo(() => new Set(loadImportedSkills().map((s) => s.id)), [tick]);

  const skills = useMemo(() => {
    const live = new Map(getLiveCatalog().map((s) => [s.id, s]));
    const builtin = AGENT_SKILLS.filter((b) => !isAnswerLayerSkill(b.id)).map((b) => live.get(b.id) ?? b);
    const extra = loadImportedSkills().filter((s) => !live.has(s.id));
    return [...builtin, ...extra];
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
  const selectedRows = rows.filter((s) => selected.has(s.id));
  const exportTargets = selectedRows.length ? selectedRows : rows;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedRows.length === rows.length && rows.length > 0) setSelected(new Set());
    else setSelected(new Set(rows.map((s) => s.id)));
  }

  function exportRecords(list: AgentSkill[]): SkillExportRecord[] {
    return list.map((s) => ({
      id: s.id,
      raw: s.manifest,
      source: importedIds.has(s.id) ? "imported" : getAppliedSkill(s.id) ? "published" : "builtin",
    }));
  }

  function exportJson() {
    const name = exportTargets.length === skills.length ? "ownagent-skills.json" : "ownagent-skills-selected.json";
    downloadText(name, buildSkillsExportBundle(exportRecords(exportTargets)), "application/json;charset=utf-8");
    toast.show(`已导出 ${exportTargets.length} 个技能`);
  }

  function exportMarkdown() {
    for (const s of exportTargets) downloadText(`${s.id}.SKILL.md`, s.manifest);
    toast.show(`已导出 ${exportTargets.length} 份 SKILL.md`);
  }

  const factoryManifest = useMemo(() => new Map(AGENT_SKILLS.map((s) => [s.id, s.manifest])), []);
  const changedRows = skills.filter((s) => importedIds.has(s.id) || factoryManifest.get(s.id) !== s.manifest);
  const repoTargets = selectedRows.length ? selectedRows : changedRows;

  function exportToRepo() {
    if (!repoTargets.length) {
      toast.show("没有已发布或导入的改动，线上版本和仓库一致");
      return;
    }
    const readme = [
      "把本压缩包里的 skills 文件夹解压到项目的 src/ 目录下，覆盖同名文件。",
      "然后提交并推送：",
      "",
      "  git add src/skills",
      '  git commit -m "update skills"',
      "  git push",
      "",
      "GitHub Actions 构建完成后，所有访客都会用上这些技能。",
      "",
      "包含技能：",
      ...repoTargets.map((s) => `- ${s.id}（${s.name}）`),
    ].join("\n");
    const zip = buildZip([
      ...repoTargets.map((s) => ({ path: `skills/${s.id}/SKILL.md`, text: s.manifest })),
      { path: "README.txt", text: readme },
    ]);
    downloadBlob("ownagent-skills-repo.zip", zip);
    toast.show(`已打包 ${repoTargets.length} 个技能，解压到 src/ 后提交即可上线`);
  }

  function removeSelectedImported() {
    const ids = selectedRows.filter((s) => importedIds.has(s.id)).map((s) => s.id);
    if (!ids.length) {
      toast.show("所选里没有可删除的导入技能（内置技能不能删）");
      return;
    }
    if (!window.confirm(`删除 ${ids.length} 个导入技能？不影响内置出厂版。`)) return;
    for (const id of ids) removeImportedSkill(id);
    setSelected(new Set());
    window.dispatchEvent(new CustomEvent(SKILL_PUBLISH_EVENT));
    toast.show(`已删除 ${ids.length} 个导入技能`);
  }

  async function onImportFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const list = await readSkillImportFiles(files);
      if (!list.length) {
        toast.show("文件里没有可识别的 SKILL 内容");
        return;
      }
      const taken = new Set([...skills.map((s) => s.id)]);
      const result = batchInstallSkills(list, taken, {
        knownBuiltinIds: builtinIds,
        onBuiltinDraft: (skillId, raw, name) => {
          saveNewVersionDraft(skillId, raw, name);
        },
      });
      setImportOpen(false);
      window.dispatchEvent(new CustomEvent(SKILL_PUBLISH_EVENT));
      const parts: string[] = [];
      if (result.installed.length) parts.push(`新导入 ${result.installed.length} 个`);
      if (result.drafted.length) parts.push(`${result.drafted.length} 个已写入草稿（对应内置技能）`);
      if (result.errors.length) parts.push(`${result.errors.length} 个失败`);
      toast.show(parts.join(" · ") || "导入完成");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "导入失败");
    }
  }

  const lead = pendingCount ? `${pendingCount} 个改过，还没检查。` : undefined;

  return (
    <OaPage title="技能" hideHead>
      {toast.node}
      {lead ? <p className="oa-skill-lead">{lead}</p> : null}
      <div className="oa-skill-toolbar">
        <div className="oa-skill-tools">
          <input
            className="own-skm-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索技能或说法"
            aria-label="搜索技能"
          />
          <button type="button" className="oa-bar-btn" onClick={toggleAll} disabled={!rows.length}>
            {selectedRows.length === rows.length && rows.length ? "取消全选" : "全选"}
          </button>
          <button type="button" className="oa-bar-btn" onClick={() => setImportOpen((v) => !v)}>
            {importOpen ? "收起" : "导入"}
          </button>
          <button type="button" className="oa-bar-btn" onClick={exportJson} disabled={!exportTargets.length}>
            导出
          </button>
          <button type="button" className="oa-bar-btn" onClick={exportToRepo} disabled={!repoTargets.length}>
            同步仓库
          </button>
          <BatchCheckBar skills={skills} onToast={toast.show} />
          <SkillEvolutionPanel onToast={toast.show} onOpenSkill={onOpen} />
          {selectedRows.some((s) => importedIds.has(s.id)) ? (
            <button type="button" className="oa-bar-btn is-danger" onClick={removeSelectedImported}>
              删除
            </button>
          ) : null}
        </div>
        <button type="button" className="oa-skill-create" onClick={() => setCreating(true)}>
          新建技能
        </button>
      </div>
      {importOpen ? (
        <div
          className="oa-m-import"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onImportFiles(e.dataTransfer.files);
          }}
        >
          <p>拖入 SKILL.md、JSON 或文件夹</p>
          <div className="oa-m-actions">
            <button type="button" className="oa-bar-btn" onClick={exportMarkdown} disabled={!exportTargets.length}>
              另存为 MD
            </button>
            <button type="button" className="oa-skill-create" onClick={() => fileRef.current?.click()}>
              选择文件
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept=".md,.markdown,.json,text/markdown,application/json"
            onChange={(e) => {
              void onImportFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {creating ? (
        <SkillFromDemoDialog
          initial={{ name: "", description: "", triggers: [], tools: ["knowledge_search"], queries: [], clashes: [] }}
          onClose={() => setCreating(false)}
          onSaved={(_, name) => toast.show(`已新建技能「${name}」`)}
        />
      ) : null}

      {rows.length === 0 ? (
        <p className="own-ver-hint">没有匹配「{q}」的技能。</p>
      ) : (
        <ul className="own-skill-ver-grid">
          {rows.map((s) => (
            <SkillListCard
              key={s.id}
              skill={s}
              checked={selected.has(s.id)}
              imported={importedIds.has(s.id)}
              onToggle={() => toggle(s.id)}
              onOpen={() => onOpen(s.id)}
              envTag={envTags[s.id]}
            />
          ))}
        </ul>
      )}
      <TeamApprovalBar onToast={toast.show} />
      <TraceFeedbackPanel onToast={toast.show} />
      <SkillGovernancePanel />
    </OaPage>
  );
}

function SkillListCard({
  skill,
  checked,
  imported,
  onToggle,
  onOpen,
  envTag,
}: {
  skill: AgentSkill;
  checked: boolean;
  imported: boolean;
  onToggle: () => void;
  onOpen: () => void;
  envTag?: { staging?: string; prod?: string };
}) {
  const ver = getPublishedVersion(skill.id);
  const prod = envTag?.prod ?? null;
  const staging = envTag?.staging ?? null;
  const draft = newestDraftForSkill(skill.id);
  const applied = getAppliedSkill(skill.id);
  const samples = sampleTriggers(skill.triggers);
  const usage = skillQueryStats(skill.id);

  return (
    <li className={checked ? "own-skill-ver-item own-skill-ver-item--on" : "own-skill-ver-item"}>
      <div className="own-skill-ver-card-inner">
        <label
          className="own-skill-ver-check"
          title={`选择 ${skill.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`选择 ${skill.name}`}
          />
        </label>
        <button
          type="button"
          className={draft ? "own-skill-ver-card own-skill-ver-card--draft" : "own-skill-ver-card"}
          onClick={onOpen}
        >
          <header>
            <strong>{skillDisplayTitle(skill)}</strong>
            <span className="own-skill-ver-tag">v{ver}</span>
            {imported ? <span className="own-skill-ver-tag own-skill-ver-tag--import">导入</span> : null}
            {prod ? <span className="own-skill-ver-tag">线上 {prod}</span> : null}
            {staging ? <span className="own-skill-ver-tag">预发 {staging}</span> : null}
          </header>
          <p className="own-skill-ver-desc">{skillSubtitle(skill)}</p>
          <p className="own-skill-ver-pipe-line">步骤：{stepPipelineText(skill.steps)}</p>
          {samples.length ? <p className="own-skill-ver-samples">用户常说：{samples.join("、")}</p> : null}
          <footer>
            <span>{fmtUpdatedAt(applied?.appliedAt)}</span>
            {usage.handled ? <span>近 7 天接手 {usage.handled} 句</span> : null}
            {draft ? <em className="own-skill-ver-pending">改过了，还没看能不能发</em> : <span className="own-skill-ver-ok">正在用</span>}
          </footer>
        </button>
      </div>
    </li>
  );
}

function SkillDetail({ skillId, onBack, initialTab }: { skillId: string; onBack: () => void; initialTab?: Tab }) {
  const toast = useToast();
  const builtin = getBuiltinSkill(skillId);

  const [online, setOnline] = useState(() => onlineRaw(skillId));
  const [draft, setDraft] = useState(() => {
    const base = newestDraftForSkill(skillId)?.raw ?? onlineRaw(skillId);
    const { raw, changed, fixes } = repairSkillMarkdown(base, skillId);
    return changed ? raw : base;
  });
  const [repairNote, setRepairNote] = useState<string | null>(() => {
    const base = newestDraftForSkill(skillId)?.raw ?? onlineRaw(skillId);
    const { changed, fixes } = repairSkillMarkdown(base, skillId);
    return changed && fixes.length ? fixes.join("、") : null;
  });
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [historyOpen, setHistoryOpen] = useState(initialTab === "history");
  const [editing, setEditing] = useState(initialTab === "edit");
  const [casesOpen, setCasesOpen] = useState(initialTab === "cases");
  const [liveVersion, setLiveVersion] = useState(() => getPublishedVersion(skillId));
  const [testQuery, setTestQuery] = useState(() => defaultSampleQuery(skillId, builtin?.triggers ?? []));
  const [single, setSingle] = useState<SkillCompareResult | null>(null);
  const [report, setReport] = useState<SkillFullCompareReport | null>(null);
  const [reportRaw, setReportRaw] = useState<string | null>(null);
  const [shadowReport, setShadowReport] = useState<ShadowReplayReport | null>(null);
  const [fuzzReport, setFuzzReport] = useState<RouteFuzzReport | null>(null);
  const [pageWalkReport, setPageWalkReport] = useState<PageWalkResult | null>(null);
  const [depProof, setDepProof] = useState<ReleaseDependencyProof | null>(null);
  const [checking, setChecking] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [baselineTick, setBaselineTick] = useState(0);
  const [serverTags, setServerTags] = useState<{ staging?: string; prod?: string }>({});
  useEffect(() => {
    void loadBaselineTags().then((tags) => setServerTags(tags[skillId] ?? {}));
  }, [skillId, baselineTick]);

  const onlineParsed = useMemo(() => parseSkillMarkdown(online), [online]);
  const draftParsed = useMemo(() => parseSkillMarkdown(draft), [draft]);
  useEffect(() => {
    renderSkillHost(skillId, onlineParsed.steps, draftParsed.steps);
  }, [skillId, onlineParsed, draftParsed]);
  const hasChanges = draft.trim() !== online.trim();
  const draftVersion = candidateVersion(skillId);
  const stats = useMemo(() => diffStats(lineDiff(online, draft)), [online, draft]);
  const reportStale = report != null && reportRaw !== draft;
  const title = skillDisplayTitle({ name: onlineParsed.name || skillId, description: onlineParsed.description });
  const skillName = builtin?.name ?? skillId;
  const impact = useSkillImpact(skillId, online, draft);
  const realLost = impact.lost.filter((s) => s.source === "real");

  useEffect(() => {
    if (repairNote) {
      toast.show(`已自动修复：${repairNote}`);
      setRepairNote(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次打开提示
  }, []);

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
    setChecking(true);
    setSingle(null);
    setShadowReport(null);
    setFuzzReport(null);
    setPageWalkReport(null);
    setDepProof(null);
    const snapshot = draft;
    try {
      const q = testQuery.trim();
      const urlQuery =
        q ||
        listGateQuestionRows(skillId).map((r) => r.query).find((text) => extractUrlFromText(text)) ||
        "";
      const pageWalkPromise =
        listPageTools().length > 0
          ? Promise.race([
              runPageToolWalk(skillId, snapshot),
              new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 28_000)),
            ]).catch(() => null)
          : Promise.resolve(null);

      const depPromise =
        skillId === "release-inspector" && urlQuery && extractUrlFromText(urlQuery)
          ? buildReleaseDependencyProof(urlQuery).catch(() => null)
          : Promise.resolve(null);

      const [compared, shadow, fuzz, pageWalk, dep] = await Promise.all([
        runFullSkillCompare({
          skillId,
          skillName: title,
          baselineRaw: online,
          candidateRaw: snapshot,
          baselineVersion: liveVersion,
          candidateVersion: draftVersion,
          extraQuery: q || undefined,
        }),
        runShadowReplayGate({ skillId, baselineRaw: online, candidateRaw: snapshot }),
        runRouteFuzzScan({ skillId, baselineRaw: online, candidateRaw: snapshot }),
        pageWalkPromise,
        depPromise,
      ]);
      const full = await alignCanonicalGate(compared, snapshot, draftVersion);
      setReport(full);
      await ensureTeamSession();
      await apiFetch("/skill-gate/baseline", {
        method: "POST",
        body: JSON.stringify({
          skillId,
          raw: snapshot,
          version: draftVersion,
          env: "staging",
        }),
      });
      setBaselineTick((n) => n + 1);
      setShadowReport(shadow);
      setFuzzReport(fuzz);
      setPageWalkReport(pageWalk);
      setDepProof(dep);
      setReportRaw(snapshot);
      return full;
    } catch (err) {
      toast.show(`检查没跑完：${err instanceof Error ? err.message : "未知错误"}`);
      return null;
    } finally {
      setChecking(false);
    }
  }

  /** 只跑单句对比，不触发全量检查 */
  async function runSingleOnly(query: string) {
    const q = query.trim();
    if (!q) return;
    setTestQuery(q);
    try {
      const result = await runSkillCompare({
        skillId,
        baselineRaw: online,
        candidateRaw: draft,
        query: q,
        probeUrl: extractUrlFromText(q) ?? undefined,
      });
      setSingle(result);
    } catch {
      /* silent */
    }
  }

  const decided = report && !reportStale ? buildReleaseGateSummary(report) : null;
  const publishBlock: string | null = !hasChanges
    ? "还没有改动"
    : !draftParsed.ok
      ? `配置有错误：${draftParsed.issues.find((i) => i.level === "error")?.message ?? "格式不对"}`
      : null;

  /** 没检查过（或检查后又改过）就先自动检查，再按结果确认发布 */
  async function publish(force = false) {
    if (publishBlock || checking) return;
    const r = report && !reportStale ? report : await runCheck();
    if (!r) return;
    const gateNow = buildReleaseGateSummary(r);
    if (gateNow.gate === "BLOCK" && !force) {
      toast.show(`检查建议先别发布：${gateNow.reasons[0] ?? r.verdict.title}。看下方报告，确认无碍可点「我确认，仍要发布」`);
      return;
    }
    let approvalId: string | undefined;
    let approvalOffline = false;
    if (gateNow.gate === "WARN") {
      const approved = await findReleaseApproval(skillId, draftVersion, "approved");
      if (!approved) {
        const pending = await findReleaseApproval(skillId, draftVersion, "pending");
        const created = pending ?? await submitReleaseApproval({
          skillId,
          version: draftVersion,
          gate: gateNow.gate,
          note: gateNow.reasons[0],
        });
        if (created) {
          toast.show(`v${draftVersion} 已进入服务端审批。在技能列表批准后再发布。`);
          return;
        }
        approvalOffline = true;
      } else {
        approvalId = approved.id;
      }
    }
    if (
      realLost.length &&
      !window.confirm(
        `发布后，有 ${realLost.length} 句用户真实问过的话不再由这个技能处理，例如「${realLost[0]!.q}」会改由「${realLost[0]!.toLabel}」处理。确定发布吗？`,
      )
    )
      return;
    const shadow = shadowReport && reportRaw === draft ? shadowReport : null;
    const fuzz = fuzzReport && reportRaw === draft ? fuzzReport : null;
    if (shadow?.routeDriftCount && !window.confirm(`真实回流：${shadow.routeDriftCount} 条历史问句在新版下路由变了。仍要发布？`)) return;
    if (fuzz?.lostCount && !window.confirm(`路由邻域：${fuzz.lostCount} 种说法变体会被别的技能抢走。仍要发布？`)) return;
    const applied = publishSkillVersion(skillId, skillName, draft, r.verdict.title);
    const gate = buildReleaseGateSummary(r);
    await ensureTeamSession();
    const published = await apiFetch("/skill-gate/publish", {
      method: "POST",
      body: JSON.stringify({
        skillId,
        raw: draft,
        version: applied.version,
        gate: gate.gate,
        actor: "local",
        override: force,
        overrideReason: force ? "用户确认忽略 BLOCK 并发布" : undefined,
        environment: "prod",
        approvalId,
        note: gate.reasons[0] ?? r.verdict.title,
      }),
    });
    setBaselineTick((n) => n + 1);
    if (!published && !approvalOffline) toast.show("本地已发布，服务端 baseline 没有写上");
    try {
      const witness = await buildReleaseWitness({
        skillId,
        skillName: title,
        version: applied.version,
        manifest: draft,
        report: r,
        shadow,
        fuzz,
      });
      downloadReleaseWitness(witness);
    } catch {
      /* 见证包失败不挡发布 */
    }
    const next = reloadOnline();
    setDraft(next);
    setReport(null);
    setSingle(null);
    setReportRaw(null);
    setShadowReport(null);
    setFuzzReport(null);
    setPageWalkReport(null);
    setDepProof(null);
    toast.show(
      approvalOffline
        ? `已发布 v${applied.version}，本机已生效。本地服务没开，这次没有送去审核。`
        : `已发布 v${applied.version}，见证包已下载，用户提问时立即生效`,
    );
    setHistoryOpen(false);
    setEditing(false);
  }

  const publishRef = useRef(publish);
  publishRef.current = publish;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => {
    function run() {
      if (sessionStorage.getItem("oa-page-publish") !== skillId) return;
      sessionStorage.removeItem("oa-page-publish");
      if (draftRef.current.trim() === onlineRef.current.trim()) {
        toast.show("这个技能没有要发布的草稿");
        return;
      }
      void publishRef.current(false);
    }
    window.addEventListener("ownagent:page-publish", run);
    run();
    return () => window.removeEventListener("ownagent:page-publish", run);
  }, [skillId]);

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
    if (hasChanges && !window.confirm(`草稿里还有没发布的修改。用 ${label} 换掉草稿？`)) return;
    setDraft(raw);
    setReport(null);
    setSingle(null);
    setReportRaw(null);
    setHistoryOpen(false);
    toast.show(`已把 ${label} 放进草稿。检查通过后才能发布。`);
  }

  function askInChat(query?: string) {
    const text = (query ?? defaultSampleQuery(skillId, onlineParsed.triggers)).trim();
    if (text) sessionStorage.setItem("oa-pending-ask", text);
    window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "chat" } }));
  }

  async function rollbackTo(raw: string, version: string) {
    if (!window.confirm(`直接把线上换成 v${version} 的内容？会生成新版本号，旧记录都保留。`)) return;
    const applied = publishSkillVersion(skillId, skillName, raw, `回滚到 v${version} 的内容`, "rollback");
    await ensureTeamSession();
    await apiFetch("/skill-gate/baseline", {
      method: "POST",
      body: JSON.stringify({ skillId, raw, version: applied.version, env: "prod" }),
    });
    setBaselineTick((n) => n + 1);
    void apiFetch("/skill-gate/rollback", {
      method: "POST",
      body: JSON.stringify({ skillId, version, actor: "local" }),
    });
    const next = reloadOnline();
    if (!hasChanges) setDraft(next);
    toast.show(`已回滚：线上现为 v${applied.version}（内容同 v${version}）`);
  }

  async function exportAudit() {
    const audit = await apiFetch<{ schema: string; generatedAt: string; rows: unknown[] }>(
      `/skill-gate/audit/export?format=json&skillId=${encodeURIComponent(skillId)}`,
    );
    if (!audit) {
      toast.show("审计导出需要先启动本地服务");
      return;
    }
    downloadText(`ownagent-${skillId}-audit.json`, JSON.stringify(audit, null, 2), "application/json;charset=utf-8");
  }

  const sentenceCount = listGateQuestionRows(skillId).length;

  return (
    <OaPage title={title} desc={skillSubtitle({ description: onlineParsed.description })}>
      <div className="own-skill-ver-detail">
        <div className="sk-work-bar">
          <button type="button" className="own-skill-ver-back" onClick={onBack}>
            ← 全部技能
          </button>
          <div className="sk-work-ver" data-baseline-revision={baselineTick}>
            <span className="sk-work-ver-live">
              <i className="sk-status-dot is-live" />
              正在用 v{liveVersion}
            </span>
            {serverTags.staging ? (
              <span className="sk-work-ver-draft">
                <i className="sk-status-dot is-draft" />
                预发 v{serverTags.staging}
              </span>
            ) : null}
            <span className="sk-work-ver-arrow">→</span>
            {hasChanges ? (
              <span className="sk-work-ver-draft">
                <i className="sk-status-dot is-draft" />
                还没发 v{draftVersion}
                <em>{saved === "saving" ? "保存中…" : "已保存"}</em>
              </span>
            ) : (
              <span className="sk-work-ver-synced">和正在用的一样</span>
            )}
            <span className="sk-work-telemetry">
              {stats.added || stats.removed ? `改了 +${stats.added} −${stats.removed} 行` : "还没改内容"}
              {" · "}
              {sentenceCount} 句用来检查
            </span>
          </div>
          <div className="sk-work-actions">
            <button type="button" className="own-compare-secondary-btn" onClick={() => void exportAudit()}>
              导出记录
            </button>
            <button type="button" className="own-compare-secondary-btn sk-history-btn" onClick={() => setHistoryOpen(true)}>
              以前发过的版本
            </button>
          </div>
        </div>

        <div className="sk-work">
          <section className="sk-col">
            <header className="sk-col-h">
              <div className="sk-col-h-title">
                <span className="sk-col-h-tag">和现在比</span>
                <h2>和正在用的差别</h2>
              </div>
              <span className="sk-col-h-badge">{hasChanges ? `+${stats.added} −${stats.removed} 行变更` : "与线上基线一致"}</span>
            </header>
            <LiveSkillCompare
              liveVersion={liveVersion}
              draftVersion={draftVersion}
              online={onlineParsed}
              draft={draftParsed}
            />
            <details className="sk-fold" open={editing} onToggle={(e) => setEditing(e.currentTarget.open)}>
              <summary>改内容</summary>
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
            </details>
          </section>

          <section className="sk-col sk-col--right">
            <header className="sk-col-h">
              <div className="sk-col-h-title">
                <span className="sk-col-h-tag">能不能发</span>
                <h2>先看结论，再决定发不发</h2>
              </div>
              <span className="sk-col-h-badge">{hasChanges ? `目标 v${draftVersion}` : "等待草稿变更"}</span>
            </header>
            <details className="sk-fold" open={casesOpen} onToggle={(e) => setCasesOpen(e.currentTarget.open)}>
              <summary>用来检查的 {sentenceCount} 句话</summary>
              <ScmCaseEditor
                skillId={skillId}
                draftRaw={hasChanges ? draft : online}
                onAsk={(q) => askInChat(q)}
                onClaim={(phrase) => {
                  setDraft((d) => addTriggerTo(d, phrase));
                  toast.show(`已在草稿触发词中注入「${phrase}」`);
                }}
                onChanged={() => toast.show("已更新评测断言库。下次门禁检查将自动纳入。")}
              />
            </details>
            {hasChanges ? (
              <CheckView
                skillId={skillId}
                online={online}
                draft={draft}
                liveVersion={liveVersion}
                draftVersion={draftVersion}
                onlineParsed={onlineParsed}
                draftParsed={draftParsed}
                checking={checking}
                peek={single}
                report={report}
                reportStale={reportStale}
                impact={impact}
                shadowReport={shadowReport}
                fuzzReport={fuzzReport}
                pageWalkReport={pageWalkReport}
                depProof={depProof}
                onPeek={(q) => void runSingleOnly(q)}
                onClosePeek={() => setSingle(null)}
              />
            ) : (
              <div className="sk-gate-empty-box">
                <p className="sk-gate-empty">还没改。改一句说法或一个步骤之后，用这 {sentenceCount} 句话看能不能发。</p>
              </div>
            )}
            <div className="sk-release-actions">
              <button type="button" className="own-compare-secondary-btn" onClick={discard} disabled={!hasChanges}>
                放弃这次修改
              </button>
              <button
                type="button"
                className="own-compare-secondary-btn sk-check-trigger-btn"
                onClick={() => void runCheck()}
                disabled={Boolean(publishBlock) || checking}
              >
                {checking ? "正在检查…" : report && !reportStale ? "再查一次" : "检查能不能发"}
              </button>
              <OaBtn
                onClick={() => void publish()}
                disabled={Boolean(publishBlock) || checking || decided?.gate === "BLOCK"}
              >
                {checking ? "检查中…" : !report || reportStale ? "检查后发布" : `发布 v${draftVersion}`}
              </OaBtn>
            </div>
            {decided?.gate === "BLOCK" ? (
              <p className="own-ver-sticky-note own-ver-sticky-note--bad">
                {decided.reasons[0] ?? humanVerdict("reject").hint}{" "}
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
          </section>
        </div>
      </div>
      {historyOpen ? (
        <div className="sk-history-layer">
          <button type="button" className="sk-history-backdrop" aria-label="关闭历史版本" onClick={() => setHistoryOpen(false)} />
          <aside className="sk-history-drawer" role="dialog" aria-label="历史版本">
            <header className="sk-history-head">
              <strong>历史版本</strong>
              <button type="button" className="own-compare-secondary-btn" onClick={() => setHistoryOpen(false)}>关闭</button>
            </header>
            <History
              key={historyTick}
              skillId={skillId}
              liveVersion={liveVersion}
              builtinRaw={builtin?.manifest ?? ""}
              online={online}
              onView={startFrom}
              onRollback={rollbackTo}
            />
          </aside>
        </div>
      ) : null}
      {toast.node}
    </OaPage>
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
  const needsRepair = needsSkillRepair(raw);
  const [mode, setMode] = useState<"form" | "source">(formOk && !needsRepair ? "form" : "source");
  const changed = raw.trim() !== online.trim();

  function runRepair() {
    const { raw: fixed, fixes, changed: did } = repairSkillMarkdown(raw, skillId);
    if (!did) {
      onNotify("没有需要修复的内容");
      return;
    }
    onChange(fixed);
    onNotify(`已修复：${fixes.join("、")}`);
    if (canFormEdit(fixed)) setMode("form");
  }

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
        {needsRepair ? (
          <button type="button" className="own-skm-batch-btn" onClick={runRepair}>
            一键修复格式
          </button>
        ) : null}
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
          {!formOk ? (
            <p className="own-ver-parse-warn">
              缺少标准 YAML frontmatter（需以 <code>---</code> 开头）。点「一键修复格式」可自动生成。
            </p>
          ) : needsRepair ? (
            <p className="own-ver-parse-warn">配置不完整（缺 name / triggers / steps 等），建议点「一键修复格式」。</p>
          ) : null}
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
  const clauses = useSkillClauses(skillId);
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
              clause={clauses.find((clause) => clause.stepId === s.id)}
              onPreview={() => previewClause(skillId, s.id)}
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
  clause,
  onPreview,
  isNew,
  onRename,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  label: string;
  tool: string;
  clause?: SkillClause;
  onPreview: () => void;
  isNew: boolean;
  onRename: (label: string) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(label);
  useEffect(() => setText(label), [label]);
  const commitValue = (raw: string) => {
    const v = raw.trim();
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
          onBlur={(e) => commitValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitValue((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") setText(label);
          }}
          aria-label={`第 ${index + 1} 步名称`}
        />
        <small>使用工具：{tool.startsWith("__") ? "汇总生成回答" : tool}</small>
        {clause ? <SkillClauseNote clause={clause} onPreview={onPreview} /> : null}
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

function LiveSkillCompare({
  liveVersion,
  draftVersion,
  online,
  draft,
}: {
  liveVersion: string;
  draftVersion: string;
  online: ParsedSkillDoc;
  draft: ParsedSkillDoc;
}) {
  const addedTriggers = draft.triggers.filter((t) => !online.triggers.includes(t));
  const removedTriggers = online.triggers.filter((t) => !draft.triggers.includes(t));
  const onlineById = new Map(online.steps.map((s) => [s.id, s]));
  const draftById = new Map(draft.steps.map((s) => [s.id, s]));
  const descChanged = online.description !== draft.description;
  const stepsChanged = stepPipelineText(online.steps) !== stepPipelineText(draft.steps);
  const bodyChanged = online.body.trim() !== draft.body.trim();
  const notes: string[] = [];
  if (addedTriggers.length) notes.push(`新增说法 ${addedTriggers.length} 个`);
  if (removedTriggers.length) notes.push(`删除说法 ${removedTriggers.length} 个`);
  if (stepsChanged) notes.push("步骤有改动");
  if (descChanged) notes.push("说明有改动");
  if (bodyChanged && !descChanged) notes.push("详细说明有改动");
  if (!notes.length) notes.push("配置和现用版一样");

  return (
    <div className="rv-compare">
      <div className="rv-pane">
        <div className="rv-pane-head">
          <span className="rv-kicker">正在用</span>
          <span className="rv-ver">v{liveVersion}</span>
        </div>
        <div className="rv-block">
          <p className="rv-k">用户这样说</p>
          <div className="rv-triggers">
            {online.triggers.length
              ? online.triggers.map((t) => (
                  <span key={t} className={removedTriggers.includes(t) ? "rv-tag rv-tag--del" : "rv-tag"}>{t}</span>
                ))
              : <span className="rv-empty">还没有说法</span>}
          </div>
        </div>
        <div className="rv-block">
          <p className="rv-k">按这些步骤做</p>
          {online.steps.length ? (
            <ol className="rv-pipeline">
              {online.steps.map((s, idx) => (
                <li key={s.id} className={draftById.has(s.id) ? undefined : "is-gone"}>
                  <span className="rv-pipeline-step-idx">{idx + 1}</span>
                  {stepShortLabel(s)}
                </li>
              ))}
            </ol>
          ) : <span className="rv-empty">无执行步骤</span>}
        </div>
        {online.description ? (
          <div className="rv-block">
            <p className="rv-k">一句话说明</p>
            <p className="rv-desc">{online.description}</p>
          </div>
        ) : null}
      </div>
      <div className="rv-pane rv-pane--new">
        <div className="rv-pane-head">
          <span className="rv-kicker rv-kicker--new">这次改的</span>
          <span className="rv-ver">v{draftVersion}</span>
        </div>
        <div className="rv-block">
          <p className="rv-k">用户这样说</p>
          <div className="rv-triggers">
            {draft.triggers.length
              ? draft.triggers.map((t) => (
                  <span key={t} className={addedTriggers.includes(t) ? "rv-tag rv-tag--add" : "rv-tag"}>{t}</span>
                ))
              : <span className="rv-empty">还没有说法</span>}
          </div>
        </div>
        <div className="rv-block">
          <p className="rv-k">按这些步骤做</p>
          {draft.steps.length ? (
            <ol className="rv-pipeline">
              {draft.steps.map((s, idx) => (
                <li key={s.id} className={onlineById.has(s.id) ? undefined : "is-new"}>
                  <span className="rv-pipeline-step-idx">{idx + 1}</span>
                  {stepShortLabel(s)}
                </li>
              ))}
            </ol>
          ) : <span className="rv-empty">无执行步骤</span>}
        </div>
        {draft.description ? (
          <div className="rv-block">
            <p className="rv-k">一句话说明</p>
            <p className={descChanged ? "rv-desc rv-desc--changed" : "rv-desc"}>{draft.description}</p>
          </div>
        ) : null}
        <div className="rv-change-note-bar">
          <span className="rv-change-note-icon">⚡</span>
          <span className="rv-change-note-text">{notes.join(" · ")}</span>
        </div>
      </div>
    </div>
  );
}

function PeekCompare({
  skillId,
  liveVersion,
  draftVersion,
  peek,
}: {
  skillId: string;
  liveVersion: string;
  draftVersion: string;
  peek: SkillCompareResult;
}) {
  return (
    <div className="rv-peek">
      <div className="rv-single-cols">
        <CompareSideColumn title={`现用 v${liveVersion}`} side={peek.baseline} other={peek.candidate} />
        <CompareSideColumn title={`新版 v${draftVersion}`} side={peek.candidate} other={peek.baseline} highlight />
      </div>
      <ScmAttributionPanel
        skillId={skillId} defaultExpanded={false} customerMode
        autoOpen={!peek.baseline.traceOk || !peek.candidate.traceOk || peek.verdict.level !== "approve"}
        compare={{ query: peek.query, baselineTrace: peek.baseline.trace, candidateTrace: peek.candidate.trace }}
        forkPeerId={
          peek.baseline.routedSkillId && peek.candidate.routedSkillId &&
          peek.baseline.routedSkillId !== peek.candidate.routedSkillId
            ? peek.candidate.routedSkillId : undefined
        }
      />
    </div>
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
  checking,
  peek,
  report,
  reportStale,
  impact,
  shadowReport,
  fuzzReport,
  pageWalkReport,
  depProof,
  onPeek,
  onClosePeek,
}: {
  skillId: string;
  online: string;
  draft: string;
  liveVersion: string;
  draftVersion: string;
  onlineParsed: ParsedSkillDoc;
  draftParsed: ParsedSkillDoc;
  checking: boolean;
  peek: SkillCompareResult | null;
  report: SkillFullCompareReport | null;
  reportStale: boolean;
  impact: SkillImpact;
  shadowReport: ShadowReplayReport | null;
  fuzzReport: RouteFuzzReport | null;
  pageWalkReport: PageWalkResult | null;
  depProof: ReleaseDependencyProof | null;
  onPeek: (query: string) => void;
  onClosePeek: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const diff = useMemo(() => lineDiff(online, draft), [online, draft]);
  const diffRows = useMemo(() => (showAll ? diff : foldDiff(diff)), [diff, showAll]);
  const gateCount = listGateQuestionRows(skillId).length;

  const activeReport = reportStale ? null : report;
  const hasReport = Boolean(activeReport && !checking);
  const gateReasons = activeReport ? buildReleaseGateSummary(activeReport).reasons : [];
  const gate = activeReport ? releaseGateLevel(activeReport.verdict.level) : null;
  const lead = activeReport && gate ? gateLead(gate, activeReport.scm) : null;
  const notes = gate && gate !== "pass"
    ? [...new Set(gateReasons.map(customerReason))].slice(0, 3)
    : [];
  const effectRows = activeReport?.queryResults ?? [];
  const badRows = effectRows.filter((q) => q.routeDrift || q.traceChanged || q.verdictLevel === "reject");
  const badCount = badRows.length;
  const changeNotes = useMemo(() => {
    const notes: string[] = [];
    const oldTriggers = new Set(onlineParsed.triggers);
    const newTriggers = new Set(draftParsed.triggers);
    const addedTriggers = [...newTriggers].filter((t) => !oldTriggers.has(t));
    const removedTriggers = [...oldTriggers].filter((t) => !newTriggers.has(t));
    if (addedTriggers.length) notes.push(`新增说法「${addedTriggers.slice(0, 3).join("」「")}」`);
    if (removedTriggers.length) notes.push(`删除说法「${removedTriggers.slice(0, 3).join("」「")}」`);
    if (onlineParsed.steps.map((s) => `${s.id}:${s.tool}`).join("|") !== draftParsed.steps.map((s) => `${s.id}:${s.tool}`).join("|")) {
      notes.push(`执行步骤从 ${onlineParsed.steps.length} 步变为 ${draftParsed.steps.length} 步`);
    }
    if (onlineParsed.description !== draftParsed.description) notes.push("技能说明有修改");
    return notes.slice(0, 3);
  }, [onlineParsed, draftParsed]);

  return (
    <div id="skill-release-checklist" className="rv-page rv-page--bare">
      <section className="rv-change-summary">
        <strong>这次改了</strong>
        {changeNotes.length ? (
          <ul>{changeNotes.map((note) => <li key={note}>{note}</li>)}</ul>
        ) : (
          <p>源码有调整；将用 {gateCount} 句客户的话对比两版。</p>
        )}
      </section>
      {checking ? (
        <div className="rv-checking-bar">
          <div className="rv-checking-laser" />
          <div className="rv-checking-content">
            <span className="rv-checking-spin" />
            <div className="rv-checking-text">
              <strong>正在用 {gateCount} 句客户的话对比现用版和新版…</strong>
              <span>这次改动不会在检查期间消失。</span>
            </div>
          </div>
        </div>
      ) : null}

      {!hasReport && !checking ? (
        <div className="rv-gate-prompt-card">
          <div className="rv-gate-prompt-icon">🛡️</div>
          <div className="rv-gate-prompt-info">
            <strong>用 {gateCount} 句客户的话对比两版</strong>
            <p>点下面「检查能不能发」。先看结论，再决定发不发。</p>
          </div>
        </div>
      ) : null}

      {!checking && hasReport && activeReport && gate && lead ? (
        <div id="skill-release-verdict" className={`rv-verdict rv-verdict--${gate}`}>
          <div className="rv-verdict-top-bar">
            <span className={`rv-verdict-status-pill rv-verdict-status-pill--${gate}`}>
              <i className="rv-pulse-dot" />
              {lead.title}
            </span>
          </div>

          <div className="rv-verdict-main">
            <span className="rv-verdict-icon">{gate === "pass" ? "✓" : gate === "warn" ? "⚠" : "✕"}</span>
            <div className="rv-verdict-body">
              <strong className="rv-verdict-title">{lead.title}</strong>
              <span className="rv-verdict-reason">{notes[0] ?? lead.note}</span>
            </div>
          </div>

          <details className="rv-metrics-more">
            <summary>细看</summary>
            <div className="rv-metrics-ribbon">
              <div className="rv-metric-item">
                <span className="rv-metric-k">用来检查的问法</span>
                <strong className="rv-metric-v">{effectRows.length} 句</strong>
              </div>
              <div className="rv-metric-item">
                <span className="rv-metric-k">和正在用的不一样</span>
                <strong className={`rv-metric-v ${badCount ? "is-drift" : "is-safe"}`}>
                  {badCount ? `${badCount} 句` : "没有"}
                </strong>
              </div>
              <div className="rv-metric-item">
                <span className="rv-metric-k">结论</span>
                <strong className={`rv-metric-v is-${gate}`}>{lead.title}</strong>
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {!checking && hasReport && activeReport && badRows.length ? (
        <div className="rv-effect">
          <p className="rv-report-kicker rv-report-kicker--in">和线上不一样</p>
          <div className="rv-effect-wrap">
            <table className="rv-effect-table">
              <thead>
                <tr>
                  <th>客户的话</th>
                  <th>现用交给</th>
                  <th>新版交给</th>
                  <th>结果</th>
                  <th />
                </tr>
              </thead>
              {badRows.map((q, i) => {
                const pres = queryComparePresentation(q);
                const open = peek?.query === q.query;
                return (
                  <tbody key={`${q.query}-${i}`}>
                    <tr className={pres.tone === "ok" ? undefined : pres.tone === "bad" ? "is-bad" : "is-warn"}>
                      <td>{q.query}</td>
                      <td>{q.routeBaseline ?? "没有技能接手"}</td>
                      <td>{q.routeCandidate ?? "没有技能接手"}</td>
                      <td><span className={`rv-effect-pill is-${pres.tone}`}>{pres.badge}</span></td>
                      <td>
                        <button type="button" className="rv-act" onClick={() => (open ? onClosePeek() : onPeek(q.query))}>
                          {open ? "收起" : "看看这句"}
                        </button>
                      </td>
                    </tr>
                    {open && peek ? (
                      <tr className="rv-effect-peek">
                        <td colSpan={5}>
                          <PeekCompare skillId={skillId} liveVersion={liveVersion} draftVersion={draftVersion} peek={peek} />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                );
              })}
            </table>
          </div>
          {activeReport.liveProbeUsed ? <p className="rv-probe-note">含链接的句子已做真实探活。</p> : null}
        </div>
      ) : null}

      {hasReport && activeReport ? (
        <details className="rv-tech">
          <summary className="rv-tech-summary">细看 <span>源码 · 回流 · 压测 · 本页试跑</span></summary>
          <div className="rv-docs-acts">
            <button type="button" className="rv-btn" onClick={() => downloadFullReportMd(activeReport, skillId)}>
              导出 Markdown
            </button>
            <button type="button" className="rv-btn" onClick={() => downloadReportJson(activeReport)}>
              导出 JSON
            </button>
          </div>
          {skillId === "release-inspector" && depProof ? (
            <div className="own-check-board-dep"><ReleaseDependencyCard proof={depProof} /></div>
          ) : null}
          <FullCompareReport report={activeReport} skillId={skillId} heroReasons={gateReasons} hideQueryTable />
          <ReleaseCheckExtras skillId={skillId} draftRaw={draft} checking={false} shadow={shadowReport} fuzz={fuzzReport} pageWalk={pageWalkReport} flat />
          {impact.gained.length || impact.lost.length ? <ImpactPanel impact={impact} /> : null}
          <section className="own-compare-report-section">
            <h3>逐行对比 <span className="own-skm-ver-arrow">v{liveVersion} → v{draftVersion}</span></h3>
            <div className="own-skm-diff-head">
              <strong>源码</strong>
              <button type="button" className="own-skill-inline-btn" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "只看改动" : "显示全文"}
              </button>
            </div>
            <div className="own-skm-diff" role="table" aria-label="逐行对比">
              {diffRows.map((r, i) =>
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
            <PageToolWalk skillId={skillId} draftRaw={draft} />
            <SkillBreakPanel skillId={skillId} draftRaw={draft} />
          </section>
        </details>
      ) : null}
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
      <p className="own-ver-hint">现在客户用的在最上面。换回旧版会再发一个新版本，原来的记录还留着。</p>
      <ul>
        {entries.map((e) => {
          const isLive = e.version === liveVersion;
          const parsed = parseSkillMarkdown(e.raw);
          const story = isLive ? "客户现在用的就是这版。" : versionStory(online, e.raw);
          const when = e.at
            ? new Date(e.at).toLocaleString("zh-CN", { hour12: false })
            : "最初就有";
          const note = e.note && e.note !== "出厂内置配置" ? e.note : "";
          return (
            <li key={e.key} className={isLive ? "own-skm-history-row own-skm-history-row--live" : "own-skm-history-row"}>
              <div className="own-skm-history-top">
                <div className="own-skm-history-main">
                  <div className="own-skm-history-title">
                    <strong>v{e.version}</strong>
                    {isLive ? <span className="own-skill-ver-ok">正在用</span> : null}
                    <span className="own-skm-history-time">{when}</span>
                  </div>
                  <p>{story}</p>
                  {note ? <p className="own-skm-history-note">发布当时的结论：{e.kind === "rollback" ? "从旧版换回。" : ""}{note}</p> : null}
                </div>
                <div className="own-skm-history-ops">
                  <button type="button" className="own-compare-secondary-btn" onClick={() => setOpen(open === e.key ? null : e.key)}>
                    {open === e.key ? "收起" : "看看这版"}
                  </button>
                </div>
              </div>
              {open === e.key ? (
                <div className="own-skm-history-body">
                  <p>客户这样说会用到：{parsed.triggers.length ? parsed.triggers.join("、") : "还没写"}</p>
                  {parsed.steps.length ? (
                    <ol>
                      {parsed.steps.map((s, i) => (
                        <li key={s.id || i}>{s.label || s.tool}</li>
                      ))}
                    </ol>
                  ) : (
                    <p>这版没有写步骤。</p>
                  )}
                  {!isLive ? (
                    <div className="own-skm-history-ops">
                      <button type="button" className="own-compare-secondary-btn" onClick={() => onView(e.raw, `v${e.version}`)}>
                        放进草稿去检查
                      </button>
                      <button type="button" className="own-compare-secondary-btn own-compare-secondary-btn--danger" onClick={() => onRollback(e.raw, e.version)}>
                        换回这版
                      </button>
                    </div>
                  ) : null}
                  <details>
                    <summary>完整内容</summary>
                    <pre className="own-ver-readonly own-skm-history-pre">{e.raw}</pre>
                  </details>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function versionStory(onlineRaw: string, raw: string): string {
  const now = parseSkillMarkdown(onlineRaw);
  const then = parseSkillMarkdown(raw);
  const parts: string[] = [];
  const added = now.triggers.filter((t) => !then.triggers.includes(t));
  const removed = then.triggers.filter((t) => !now.triggers.includes(t));
  if (added.length) parts.push(`现在会接「${added.slice(0, 4).join("、")}」`);
  if (removed.length) parts.push(`这版会接「${removed.slice(0, 4).join("、")}」，现在不接`);
  if (then.steps.length !== now.steps.length) {
    parts.push(`步骤从 ${then.steps.length} 步变成现在的 ${now.steps.length} 步`);
  } else if (then.steps.some((s, i) => now.steps[i]?.label !== s.label || now.steps[i]?.tool !== s.tool)) {
    parts.push("回答步骤和现在不一样");
  }
  if (parts.length) return `${parts.join("。")}。`;
  const diff = diffStats(lineDiff(onlineRaw, raw));
  if (diff.added === 0 && diff.removed === 0) return "和现在线上一样。";
  return "说法和步骤没变，正文有改动。";
}

function BatchCheckBar({
  skills,
  onToast,
}: {
  skills: AgentSkill[];
  onToast: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = skills.filter((s) => newestDraftForSkill(s.id));

  async function runBatch() {
    if (!pending.length) {
      onToast("没有待发布草稿");
      return;
    }
    setBusy(true);
    let block = 0;
    let warn = 0;
    let pass = 0;
    try {
      for (const s of pending) {
        const draft = newestDraftForSkill(s.id)!;
        const online = resolveBaselineRaw(s.id, getBuiltinSkill(s.id)?.manifest ?? "");
        const report = await alignCanonicalGate(
          await runFullSkillCompare({
            skillId: s.id,
            skillName: skillDisplayTitle(s),
            baselineRaw: online,
            candidateRaw: draft.raw,
            baselineVersion: getPublishedVersion(s.id),
            candidateVersion: draft.version,
          }),
          draft.raw,
          draft.version,
        );
        const gate = buildReleaseGateSummary(report);
        if (gate.level === "block") block += 1;
        else if (gate.level === "warn") warn += 1;
        else pass += 1;
      }
      onToast(`批量检查完成：PASS ${pass} · WARN ${warn} · BLOCK ${block}`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "批量检查失败");
    } finally {
      setBusy(false);
    }
  }

  if (!pending.length) return null;

  return (
    <button
      type="button"
      className="own-skm-batch-btn"
      disabled={busy}
      title={`${pending.length} 个技能有待发布草稿`}
      onClick={() => void runBatch()}
    >
      {busy ? "批量检查中…" : `批量发版检查 (${pending.length})`}
    </button>
  );
}

function TeamApprovalBar({ onToast }: { onToast: (msg: string) => void }) {
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState<ReleaseApproval[]>([]);

  useEffect(() => {
    void listPendingReleaseApprovals().then(setPending);
  }, [tick]);

  if (!pending.length) return null;

  return (
    <div className="oa-team-approval">
      <strong>待审批 {pending.length}</strong>
      <ul>
        {pending.map((p) => (
          <li key={p.id}>
            <span>{p.skillId} v{p.version} · {p.gate}</span>
            <button
              type="button"
              className="own-skill-inline-btn"
              onClick={() => {
                void decideReleaseApproval(p.id, "approved").then((ok) => {
                  setTick((n) => n + 1);
                  onToast(ok ? `已批准 ${p.skillId}` : "批准没有写到服务端");
                });
              }}
            >
              批准
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
