import { useMemo, useState } from "react";
import { AGENT_SKILLS, getLiveCatalog } from "../../lib/agentSkills";
import { SKILL_TRACE_CASES } from "../../lib/provingGround";
import {
  deleteCustomCase,
  exportCustomCasesJson,
  importCustomCasesJson,
  listAllCasesForSkill,
  listAllCustomCases,
  saveCustomCase,
  type CustomSkillTraceCase,
} from "../../lib/skillTraceCaseStore";
import type { OutcomeGrader } from "../../lib/scmOutcome";
import { localCaseCount, pullCasesFromRepo, pushCasesToRepo } from "../../lib/skillCaseSync";
import { routeQuery } from "../../lib/skillRouter";
import { OaBtn, OaPage } from "./OaUi";

const GRADERS: { id: OutcomeGrader["kind"]; label: string }[] = [
  { id: "skeleton", label: "骨架一致" },
  { id: "all_ok", label: "全部 ok" },
  { id: "release_overall", label: "release overall" },
  { id: "min_steps", label: "最少步数" },
];

export function CaseManagementPanel({
  onAddToCompare,
  onPickQuery,
  embedded = false,
  fixedSkillId,
}: {
  /** 把这道题放进上线前对比用的题目 */
  onAddToCompare?: (query: string) => void;
  /** 选中一题，供同一条线上的过程查看使用 */
  onPickQuery?: (query: string) => void;
  embedded?: boolean;
  fixedSkillId?: string;
} = {}) {
  const [skillId, setSkillId] = useState(fixedSkillId ?? AGENT_SKILLS[0]?.id ?? "release-inspector");
  const [tick, setTick] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useMemo(() => ({ current: null as HTMLInputElement | null }), []);

  const skills = useMemo(() => getLiveCatalog().filter((s) => s.runnable), [tick]);
  const allCases = useMemo(() => listAllCasesForSkill(skillId, SKILL_TRACE_CASES), [skillId, tick]);
  const customOnly = useMemo(() => listAllCustomCases().filter((c) => c.skillId === skillId), [skillId, tick]);

  function bump() {
    setTick((n) => n + 1);
  }

  async function syncToRepo() {
    setSyncing(true);
    const res = await pushCasesToRepo();
    setSyncing(false);
        setSyncNote(res ? `已交给团队发版检查（${res.cases} 条）` : "团队检查服务没开。可先下载文件，交给负责发版的同事。");
  }

  async function pullFromRepo() {
    setSyncing(true);
    const res = await pullCasesFromRepo();
    setSyncing(false);
    if (!res) {
      setSyncNote("没能从团队那边取回问题。确认发版检查服务已打开。");
      return;
    }
    bump();
    setSyncNote(`已从团队同步 ${res.cases} 条问题`);
  }

  function exportJson() {
    const blob = new Blob([exportCustomCasesJson()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ownagent-cases.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const r = importCustomCasesJson(String(reader.result));
        bump();
        alert(`已导入 ${r.cases} 条问题（${r.skills} 个技能）`);
      } catch {
        alert("导入失败：文件格式不对");
      }
    };
    reader.readAsText(file);
  }

  return (
    <OaPage
      chrome={!embedded}
      title="发布前要问的问题"
      desc="写下客户会问这个技能的话。发版时会拿这些问题再跑一遍：以前答对的，改完之后还得答对，否则不能发布。"
      actions={
        <>
          <OaBtn size="sm" variant="ghost" disabled={syncing} onClick={() => void syncToRepo()}>
            交给团队
          </OaBtn>
          <OaBtn size="sm" variant="ghost" disabled={syncing} onClick={() => void pullFromRepo()}>
            从团队同步
          </OaBtn>
          <OaBtn size="sm" variant="ghost" onClick={exportJson}>
            下载 JSON
          </OaBtn>
          <OaBtn size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
            导入 JSON
          </OaBtn>
          <input
            ref={(el) => { fileRef.current = el; }}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </>
      }
    >
      {syncNote ? <p className="own-ver-hint">{syncNote} · 你加的问题 {localCaseCount()} 条</p> : null}
      <div className="oa-case-mgmt-bar">
        <label>
          哪个技能
          {fixedSkillId ? (
            <strong>{skills.find((s) => s.id === skillId)?.name ?? skillId}</strong>
          ) : (
            <select value={skillId} onChange={(e) => { setSkillId(e.target.value); setEditId(null); }}>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </label>
        <span className="oa-case-mgmt-count">
          共 {allCases.length} 题（系统自带 {allCases.length - customOnly.length} · 你加的 {customOnly.length}）
        </span>
      </div>

      <div className="oa-case-mgmt-grid">
        <section className="oa-case-mgmt-section">
          <h3>这些问题</h3>
          <ul className="oa-case-mgmt-list">
            {allCases.map((c) => (
              <li key={c.id} className={"custom" in c && c.custom ? "is-custom" : "is-builtin"}>
                <div>
                  <code>{c.query.slice(0, 72)}{c.query.length > 72 ? "…" : ""}</code>
                  <small>
                    {(() => {
                      const d = routeQuery(c.query);
                      return d.kind === "skill" ? `交给${d.label} · ` : "还没有技能会接 · ";
                    })()}
                    {"grader" in c && c.grader ? `${GRADERS.find((g) => g.id === c.grader?.kind)?.label ?? "步骤要对上"} · ` : ""}
                    {"custom" in c && c.custom ? "你加的" : "系统自带"}
                  </small>
                </div>
                <div className="oa-case-mgmt-ops">
                  {onPickQuery ? (
                    <button type="button" className="own-skill-inline-btn" onClick={() => onPickQuery(c.query)}>
                      看过程
                    </button>
                  ) : null}
                  {onAddToCompare ? (
                    <button type="button" className="own-skill-inline-btn" onClick={() => onAddToCompare(c.query)}>
                      放进对比题
                    </button>
                  ) : null}
                  {"custom" in c && c.custom ? (
                    <>
                      <button type="button" className="own-skill-inline-btn" onClick={() => setEditId(c.id)}>编辑</button>
                      <button
                        type="button"
                        className="own-skill-inline-btn"
                        onClick={() => {
                          if (window.confirm("删掉这道题？发版检查将不再用它。")) {
                            deleteCustomCase(skillId, c.id);
                            bump();
                          }
                        }}
                      >
                        删
                      </button>
                    </>
                  ) : onAddToCompare ? null : (
                    <span className="oa-case-mgmt-readonly">只读</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {editId ? (
          <CaseEditForm
            key={editId}
            skillId={skillId}
            caseId={editId}
            onSaved={() => { setEditId(null); bump(); }}
            onCancel={() => setEditId(null)}
          />
        ) : null}
      </div>
    </OaPage>
  );
}

function CaseEditForm({
  skillId,
  caseId,
  onSaved,
  onCancel,
}: {
  skillId: string;
  caseId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const existing = listAllCustomCases().find((c) => c.id === caseId && c.skillId === skillId);
  const [query, setQuery] = useState(existing?.query ?? "");
  const [grader, setGrader] = useState<OutcomeGrader["kind"]>(existing?.grader?.kind ?? "skeleton");
  const [note, setNote] = useState(existing?.note ?? "");
  const [minSteps, setMinSteps] = useState(
    existing?.grader?.kind === "min_steps" ? existing.grader.count : 2,
  );

  if (!existing) return null;

  function buildGrader(): OutcomeGrader {
    if (grader === "release_overall") return { kind: "release_overall", min: "pass" };
    if (grader === "min_steps") return { kind: "min_steps", count: minSteps };
    if (grader === "all_ok") return { kind: "all_ok" };
    return { kind: "skeleton" };
  }

  function save() {
    saveCustomCase({
      ...existing,
      query: query.trim(),
      grader: buildGrader(),
      note: note.trim() || undefined,
    });
    onSaved();
  }

  return (
    <section className="oa-case-edit-form">
      <h3>改这道题</h3>
      <label>
        客户会怎么问
        <textarea rows={2} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label>
        怎样算答对
        <select value={grader} onChange={(e) => setGrader(e.target.value as OutcomeGrader["kind"])}>
          {GRADERS.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
      </label>
      {grader === "min_steps" ? (
        <label>
          最少步数
          <input type="number" min={1} value={minSteps} onChange={(e) => setMinSteps(Number(e.target.value))} />
        </label>
      ) : null}
      <label>
        备注
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
      </label>
      <div className="oa-case-edit-actions">
        <OaBtn size="sm" variant="ghost" onClick={onCancel}>取消</OaBtn>
        <OaBtn size="sm" onClick={save} disabled={!query.trim()}>保存</OaBtn>
      </div>
    </section>
  );
}
