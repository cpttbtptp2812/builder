import { useEffect, useMemo, useState } from "react";
import { AgentProductDemo } from "../fx/AgentProductDemo";
import { checkBackendHealth } from "../../lib/apiClient";
import { allRunnableSkills, CUSTOMER_SKILL_IDS, type AgentSkill } from "../../lib/agentSkills";
import { downloadText } from "../../lib/importedSkills";
import { isLlmProbeLive, loadLlmConfig } from "../../lib/llmConfig";
import { requirementsForSkill } from "../../lib/productSkillInputs";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";
import { liveVersionLabel, publishedAppliedAt, syncServerLiveSkills } from "../../lib/skillPublished";
import { queueUserDeskDraft } from "../../lib/userDeskBridge";
import { defaultSampleQuery, fmtUpdatedAt, skillDisplayTitle, skillSubtitle, stepNamesText } from "./skillVerUi";

type Pane = "desk" | "skills" | "sheets";

const PANES: { id: Pane; index: string; label: string; hint: string }[] = [
  { id: "desk", index: "01", label: "办理", hint: "从一句话开始" },
  { id: "skills", index: "02", label: "能办什么", hint: "三件事" },
  { id: "sheets", index: "03", label: "我的表格", hint: "下载后自己填" },
];

const MARK: Record<string, string> = {
  "ledger-desk": "账",
  "ticket-desk": "单",
  "shift-desk": "班",
};

/** 用户端：办事对话、已发布技能、空白材料。草稿和治理留在管理端。 */
export function SkillUserClient({ onAdmin }: { onAdmin: () => void }) {
  const [pane, setPane] = useState<Pane>("desk");
  const [rev, setRev] = useState(0);
  const [service, setService] = useState<boolean | null>(null);
  const [modelOn, setModelOn] = useState(() => isLlmProbeLive(loadLlmConfig()));

  useEffect(() => {
    const refresh = () => setRev((n) => n + 1);
    window.addEventListener(SKILL_PUBLISH_EVENT, refresh);
    window.addEventListener("ownagent:live-skills-updated", refresh);
    void syncServerLiveSkills().finally(refresh);
    void checkBackendHealth().then((h) => setService(Boolean(h?.ok)));
    return () => {
      window.removeEventListener(SKILL_PUBLISH_EVENT, refresh);
      window.removeEventListener("ownagent:live-skills-updated", refresh);
    };
  }, []);

  useEffect(() => {
    const sync = () => setModelOn(isLlmProbeLive(loadLlmConfig()));
    window.addEventListener("ownagent:config-updated", sync);
    return () => window.removeEventListener("ownagent:config-updated", sync);
  }, []);

  const skills = useMemo(() => {
    const live = allRunnableSkills();
    return CUSTOMER_SKILL_IDS.map((id) => live.find((s) => s.id === id)).filter((s): s is AgentSkill => Boolean(s));
  }, [rev]);

  function runSkill(skill: AgentSkill) {
    queueUserDeskDraft(defaultSampleQuery(skill.id, skill.triggers));
    setPane("desk");
  }

  return (
    <div className="uc-shell">
      <header className="uc-top">
        <div className="uc-brand">
          <span className="uc-mark" aria-hidden>
            OA
          </span>
          <div>
            <p className="uc-kicker">OwnAgent</p>
            <strong>我要办理</strong>
          </div>
        </div>
        <div className="uc-lamps" aria-label="状态">
          <span className={`uc-lamp${service ? " on" : ""}`}>
            <i />
            {service === null ? "正在连接" : service ? "可以办理" : "暂时办不了"}
          </span>
          <span className="uc-lamp on">
            <i />
            可办 {skills.length} 件事
          </span>
          <button
            type="button"
            className={`uc-lamp uc-lamp-btn${modelOn ? " on" : ""}`}
            title={modelOn ? "你的模型已接上" : "到办理页点「接入」，填你自己的密钥"}
            onClick={() => setPane("desk")}
          >
            <i />
            {modelOn ? "你的模型已接上" : "还没接上你的模型"}
          </button>
        </div>
        <button type="button" className="uc-admin" onClick={onAdmin}>
          管理端
        </button>
      </header>

      <div className="uc-body">
        <nav className="uc-nav" aria-label="用户端">
          {PANES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`uc-nav-btn${pane === item.id ? " on" : ""}`}
              aria-current={pane === item.id ? "page" : undefined}
              onClick={() => setPane(item.id)}
            >
              <span>{item.index}</span>
              <strong>{item.label}</strong>
              <em>{item.hint}</em>
            </button>
          ))}
        </nav>

        <div className="uc-stage">
          <div className={`uc-pane uc-chat${pane === "desk" ? " on" : ""}`}>
            <ol className="uc-try">
              <li>
                <button type="button" onClick={() => setPane("desk")}>
                  <b>1</b>
                  选一件事
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setPane("sheets")}>
                  <b>2</b>
                  准备你的表
                </button>
              </li>
              <li>
                <span>
                  <b>3</b>
                  发送后按提示上传
                </span>
              </li>
            </ol>
            <AgentProductDemo listenUserRun sessionScope="user" />
          </div>

          <section className={`uc-pane uc-board${pane === "skills" ? " on" : ""}`} aria-label="能办什么">
            <header className="uc-board-head">
              <p>02</p>
              <h1>现在能办这三件事</h1>
            </header>
            <div className="uc-grid">
              {skills.map((skill, index) => (
                <SkillCard key={skill.id} skill={skill} index={index + 1} onRun={() => runSkill(skill)} />
              ))}
            </div>
          </section>

          <section className={`uc-pane uc-board${pane === "sheets" ? " on" : ""}`} aria-label="我的表格">
            <header className="uc-board-head">
              <p>03</p>
              <h1>先下载空白表，填上你的数字</h1>
            </header>
            <div className="uc-grid">
              {skills.map((skill) => (
                <SheetCard key={skill.id} skill={skill} onBack={() => setPane("desk")} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SkillCard({ skill, index, onRun }: { skill: AgentSkill; index: number; onRun: () => void }) {
  const version = liveVersionLabel(skill.id);
  const updated = publishedAppliedAt(skill.id);
  const steps = stepNamesText(skill.steps, skill.id);
  const shown = steps.slice(0, 4);
  const example = defaultSampleQuery(skill.id, skill.triggers);

  return (
    <article className="uc-card">
      <div className="uc-card-top">
        <span className="uc-glyph" aria-hidden>
          {MARK[skill.id] ?? String(index).padStart(2, "0")}
        </span>
        <span className="uc-ver">v{version}</span>
      </div>
      <h2>{skillDisplayTitle(skill)}</h2>
      <p className="uc-sub">{skillSubtitle(skill)}</p>
      {updated ? <p className="uc-meta">{fmtUpdatedAt(updated)}</p> : null}
      <p className="uc-label">可以这样说</p>
      <p className="uc-quote">{example}</p>
      <div className="uc-actions">
        <button type="button" className="uc-go" onClick={onRun}>
          用这句试试
        </button>
        <button type="button" className="uc-ghost" onClick={() => downloadText(`${skill.id}.SKILL.md`, skill.manifest)}>
          下载这一版
        </button>
      </div>
      <p className="uc-label">步骤</p>
      <ol className="uc-steps">
        {shown.map((step, i) => (
          <li key={`${i}-${step}`}>{step}</li>
        ))}
      </ol>
      {steps.length > shown.length ? <p className="uc-more">还有 {steps.length - shown.length} 步</p> : null}
    </article>
  );
}

function SheetCard({ skill, onBack }: { skill: AgentSkill; onBack: () => void }) {
  const sheets = requirementsForSkill(skill.id);
  return (
    <article className="uc-card">
      <div className="uc-card-top">
        <span className="uc-glyph" aria-hidden>
          {MARK[skill.id] ?? "表"}
        </span>
        <span className="uc-ver">{sheets.length} 张表</span>
      </div>
      <h2>{skillDisplayTitle(skill)}</h2>
      <p className="uc-sub">下载后改成你自己的数字。填好后回到办理，发送，再按提示上传。</p>
      <button type="button" className="uc-go" onClick={onBack}>
        填好了，去办理
      </button>
      <ul className="uc-sheets">
        {sheets.map((sheet) => (
          <li key={sheet.slot}>
            <span>{sheet.label}</span>
            <button
              type="button"
              className="uc-ghost"
              onClick={() => downloadText(sheet.filename, sheet.templateCsv, "text/csv;charset=utf-8")}
            >
              下载空白表
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
