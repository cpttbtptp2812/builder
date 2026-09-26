import { useCallback, useEffect, useState } from "react";
import {
  acceptSuggestion,
  analyzeEvolution,
  type EvolutionReport,
  type EvolutionSuggestion,
} from "../../lib/skillEvolution";
import { QUERY_LOG_EVENT } from "../../lib/skillQueryLog";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";
import { findClashes, inferTools, suggestTriggers, type DemoDraft } from "../../lib/skillFromDemo";
import { SkillFromDemoDialog } from "./SkillFromDemo";

const DISMISS_KEY = "ownagent:evolution-dismissed";

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

const keyOf = (s: EvolutionSuggestion) => `${s.skillId}|${s.phrase}`;

/** 技能进化 — 从真实提问里找出能改进的地方，一键采纳 */
export function SkillEvolutionPanel({ onToast, onOpenSkill }: { onToast: (msg: string) => void; onOpenSkill: (id: string) => void }) {
  const [report, setReport] = useState<EvolutionReport | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [peek, setPeek] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [demo, setDemo] = useState<DemoDraft | null>(null);

  const refresh = useCallback(() => {
    let alive = true;
    void analyzeEvolution().then((r) => alive && setReport(r));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let cancel = refresh();
    const again = () => {
      cancel();
      cancel = refresh();
    };
    window.addEventListener(QUERY_LOG_EVENT, again);
    window.addEventListener(SKILL_PUBLISH_EVENT, again);
    return () => {
      cancel();
      window.removeEventListener(QUERY_LOG_EVENT, again);
      window.removeEventListener(SKILL_PUBLISH_EVENT, again);
    };
  }, [refresh]);

  if (!report) return <div className="own-evo own-evo--loading">正在从最近的提问里找改进点…</div>;

  const suggestions = report.suggestions.filter((s) => !dismissed.has(keyOf(s)));
  const orphans = report.orphans.slice(0, 8);
  const total = suggestions.length + (orphans.length ? 1 : 0);
  if (!total) return null;

  function dismiss(s: EvolutionSuggestion) {
    const next = new Set(dismissed).add(keyOf(s));
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
    setDismissed(next);
  }

  function accept(s: EvolutionSuggestion) {
    try {
      const how = acceptSuggestion(s);
      dismiss(s);
      window.dispatchEvent(new CustomEvent(SKILL_PUBLISH_EVENT));
      onToast(
        how === "draft"
          ? `已把「${s.phrase}」加进「${s.skillName}」的草稿，检查后发布即可生效`
          : `已把「${s.phrase}」加进「${s.skillName}」`,
      );
    } catch (e) {
      onToast(e instanceof Error ? e.message : "采纳失败");
    }
  }

  function togglePick(q: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  }

  function newSkillFromOrphans() {
    const queries = orphans.filter((o) => picked.has(o.q)).map((o) => o.q);
    const triggers = suggestTriggers(queries);
    setDemo({
      name: triggers.find((t) => t.length >= 3) ?? "新技能",
      description: queries[0] ? `像这样的问题：${queries[0].slice(0, 40)}` : "",
      triggers,
      tools: inferTools(queries),
      queries,
      clashes: findClashes(triggers),
    });
  }

  return (
    <section className="own-evo">
      <button type="button" className="own-evo-head" onClick={() => setOpen((v) => !v)}>
        <span className="own-evo-dot" />
        <strong>发现 {total} 处可以改进</strong>
        <span className="own-evo-sub">
          来自{report.usingSamples ? "示例提问（真实提问还不够多）" : "最近的真实提问"}
          {suggestions.length ? ` · ${suggestions.length} 条说法建议` : ""}
          {orphans.length ? ` · ${report.orphans.length} 句没有技能能接` : ""}
        </span>
        <span className="own-evo-toggle">{open ? "收起" : "查看"}</span>
      </button>

      {open ? (
        <div className="own-evo-body">
          {suggestions.length ? (
            <ul className="own-evo-list">
              {suggestions.map((s) => (
                <li key={keyOf(s)}>
                  <div className="own-evo-line">
                    <span>
                      给
                      <button type="button" className="own-skill-inline-btn" onClick={() => onOpenSkill(s.skillId)}>
                        {s.skillName}
                      </button>
                      加上说法 <b>「{s.phrase}」</b>
                    </span>
                    <span className="own-si-gain">能多接住 {s.captured.length} 句</span>
                    {s.stolen.length ? <span className="own-si-warn-inline">会抢走其他技能 {s.stolen.length} 句</span> : null}
                    <span className="own-evo-acts">
                      <button type="button" className="own-skill-inline-btn" onClick={() => setPeek(peek === keyOf(s) ? null : keyOf(s))}>
                        {peek === keyOf(s) ? "收起" : "哪几句"}
                      </button>
                      <button type="button" className="own-skill-inline-btn" onClick={() => dismiss(s)}>
                        忽略
                      </button>
                      <button type="button" className="own-skm-batch-btn" onClick={() => accept(s)}>
                        采纳
                      </button>
                    </span>
                  </div>
                  {peek === keyOf(s) ? (
                    <ul className="own-si-examples">
                      {s.captured.map((c) => (
                        <li key={c.q}>「{c.q}」{c.source === "sample" ? <em> 示例</em> : null}</li>
                      ))}
                      {s.stolen.map((c) => (
                        <li key={c.q} className="own-si-warn-inline">
                          「{c.q}」原来归「{c.fromLabel}」
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {orphans.length ? (
            <div className="own-evo-orphans">
              <p>
                <b>这些问题现在没有技能能接</b>，勾选同一类的几句，可以直接生成一个新技能：
              </p>
              <ul>
                {orphans.map((o) => (
                  <li key={o.q}>
                    <label>
                      <input type="checkbox" checked={picked.has(o.q)} onChange={() => togglePick(o.q)} />
                      「{o.q}」
                      {o.source === "sample" ? <em> 示例</em> : o.count > 1 ? <em> ×{o.count}</em> : null}
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" className="own-skm-batch-btn" disabled={!picked.size} onClick={newSkillFromOrphans}>
                用勾选的 {picked.size || ""} 句生成新技能
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {demo ? (
        <SkillFromDemoDialog
          initial={demo}
          onClose={() => setDemo(null)}
          onSaved={(_, name) => {
            setPicked(new Set());
            onToast(`已生成技能「${name}」，可以在列表里找到它`);
          }}
        />
      ) : null}
    </section>
  );
}
