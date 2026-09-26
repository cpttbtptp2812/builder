import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AgentSkill } from "../../lib/agentSkills";
import { allRunnableSkills, runSkill } from "../../lib/agentSkills";
import { installImportedMarkdown, readImportedRecords, recordsToSkills } from "../../lib/importedSkills";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";
import { extractUrlFromText } from "../../lib/releaseInspect";
import { splitTriggerInput } from "../../lib/skillFormEdit";
import {
  buildSkillMarkdown,
  currentHandler,
  DEMO_TOOL_LABELS,
  findClashes,
  type DemoDraft,
} from "../../lib/skillFromDemo";

const TOOL_ORDER = Object.keys(DEMO_TOOL_LABELS);

/** 把一段演示（对话或一组问题）存成技能 */
export function SkillFromDemoDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: DemoDraft;
  onClose: () => void;
  onSaved?: (id: string, name: string) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [triggers, setTriggers] = useState(initial.triggers);
  const [triggerInput, setTriggerInput] = useState("");
  const [tools, setTools] = useState(initial.tools);
  const [queriesText, setQueriesText] = useState(initial.queries.join("\n"));
  const [trial, setTrial] = useState<{ running: boolean; text?: string }>({ running: false });
  const [error, setError] = useState<string | null>(null);

  const queries = queriesText.split("\n").map((q) => q.trim()).filter(Boolean);
  const raw = useMemo(
    () => buildSkillMarkdown({ name: name.trim() || "我的技能", description, triggers, tools, queries }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, description, triggers, tools, queriesText],
  );
  const clashes = useMemo(() => findClashes(triggers), [triggers]);
  const handler = useMemo(() => currentHandler(initial.queries), [initial.queries]);

  function addTriggers() {
    const add = splitTriggerInput(triggerInput).filter((t) => !triggers.includes(t));
    if (add.length) setTriggers([...triggers, ...add]);
    setTriggerInput("");
  }

  function toggleTool(t: string) {
    setTools((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : TOOL_ORDER.filter((x) => x === t || prev.includes(x))));
  }

  async function runTrial() {
    const q = queries[0];
    if (!q) {
      setError("先写一句用户会怎么问，才能试运行");
      return;
    }
    setError(null);
    setTrial({ running: true });
    try {
      const skill = recordsToSkills([{ id: "__trial__", raw, importedAt: "" }])[0] as unknown as AgentSkill;
      const { result } = await runSkill(skill, q, undefined, { probeUrl: extractUrlFromText(q) ?? undefined });
      setTrial({ running: false, text: result.markdown ?? "已跑完，但没有产出文字结果。" });
    } catch (e) {
      setTrial({ running: false, text: `试运行失败：${e instanceof Error ? e.message : "未知错误"}` });
    }
  }

  function save() {
    if (!triggers.length) {
      setError("至少要有一个触发说法，否则用户怎么问都不会用到它");
      return;
    }
    if (!tools.length) {
      setError("至少选一个步骤");
      return;
    }
    const taken = new Set([...allRunnableSkills().map((s) => s.id), ...readImportedRecords().map((r) => r.id)]);
    const { record } = installImportedMarkdown(raw, taken);
    window.dispatchEvent(new CustomEvent(SKILL_PUBLISH_EVENT));
    onSaved?.(record.id, name.trim());
    onClose();
  }

  return createPortal(
    <div className="oa-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="oa-modal own-sfd" onClick={(e) => e.stopPropagation()}>
        <div className="own-sfd-head">
          <strong>存为技能</strong>
          <span>以后用户这样问，就按同样的步骤自动处理</span>
        </div>
        {handler ? (
          <p className="own-sfd-warn">
            这类问题现在已经由「{handler}」处理。如果只是想让它多认几种说法，去技能管理给它加说法更合适。
          </p>
        ) : null}

        <label className="own-sfd-field">
          <span>技能名称</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：竞品网站检查" />
        </label>
        <label className="own-sfd-field">
          <span>一句话说明</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="这个技能帮用户做什么" />
        </label>

        <div className="own-sfd-field">
          <span>用户这样说时触发</span>
          <div className="own-sfd-chips">
            {triggers.map((t) => (
              <button key={t} type="button" className="own-sfd-chip" onClick={() => setTriggers(triggers.filter((x) => x !== t))} title="点击移除">
                {t} ×
              </button>
            ))}
            <input
              value={triggerInput}
              onChange={(e) => setTriggerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTriggers();
                }
              }}
              onBlur={addTriggers}
              placeholder="再加一个，回车确认"
            />
          </div>
          {clashes.length ? (
            <small className="own-sfd-warn">
              {clashes.map((c) => `「${c.phrase}」已被「${c.skill}」使用`).join("；")}，可能会抢不过它。
            </small>
          ) : null}
        </div>

        <div className="own-sfd-field">
          <span>按顺序做这些事，最后汇总成回答</span>
          <div className="own-sfd-tools">
            {TOOL_ORDER.map((t) => (
              <label key={t}>
                <input type="checkbox" checked={tools.includes(t)} onChange={() => toggleTool(t)} />
                {DEMO_TOOL_LABELS[t]}
              </label>
            ))}
          </div>
          {tools.includes("http_probe") ? <small>问题里带网址时探活那个网址，否则探活本站。</small> : null}
        </div>

        <label className="own-sfd-field">
          <span>演示时的问法（一行一句，第一句用来试运行）</span>
          <textarea rows={3} value={queriesText} onChange={(e) => setQueriesText(e.target.value)} />
        </label>

        {trial.running || trial.text ? (
          <pre className="own-sfd-trial">{trial.running ? "试运行中…" : trial.text}</pre>
        ) : null}
        {error ? <p className="own-sfd-warn">{error}</p> : null}

        <details className="own-sfd-raw">
          <summary>查看生成的 SKILL.md</summary>
          <pre>{raw}</pre>
        </details>

        <div className="own-sfd-actions">
          <button type="button" className="own-skm-batch-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="own-skm-batch-btn" onClick={() => void runTrial()} disabled={trial.running}>
            试运行
          </button>
          <button type="button" className="own-skm-batch-btn own-sfd-primary" onClick={save}>
            保存技能
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
