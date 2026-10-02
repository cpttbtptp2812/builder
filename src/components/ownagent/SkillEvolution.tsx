import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const seenOrphans = useRef(new Set<string>());

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

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!report?.orphans.length) return;
    const fresh = report.orphans.slice(0, 8).filter((o) => !seenOrphans.current.has(o.q));
    if (!fresh.length) return;
    for (const o of fresh) seenOrphans.current.add(o.q);
    setPicked((prev) => {
      const next = new Set(prev);
      for (const o of fresh) next.add(o.q);
      return next;
    });
  }, [report]);

  if (!report) return null;

  const suggestions = report.suggestions.filter((s) => !dismissed.has(keyOf(s)));
  const orphans = report.orphans.slice(0, 8);
  const total = suggestions.length + (orphans.length ? 1 : 0);
  const onlyOrphans = suggestions.length === 0 && orphans.length > 0;
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
    <>
      <button type="button" className="own-skm-batch-btn own-skm-batch-btn--pop" onClick={() => setOpen(true)}>
        可以改进 ({total})
      </button>
      {open
        ? createPortal(
            <div className="oa-modal-backdrop" role="dialog" aria-modal="true" aria-label="可以改进" onClick={() => setOpen(false)}>
              <div className="oa-modal oa-modal--wide own-evo-dialog" onClick={(event) => event.stopPropagation()}>
                <header>
                  <strong>{onlyOrphans ? `${report.orphans.length} 句话没有技能能接` : `${total} 处可以改进`}</strong>
                  <button type="button" className="own-skm-batch-btn" onClick={() => setOpen(false)}>
                    关闭
                  </button>
                </header>
        <div className="own-evo-body">
          {onlyOrphans ? (
            <p className="own-evo-lead">句子已经勾上。直接点下面的紫色按钮，用它们做成一个新技能。</p>
          ) : (
            <p className="own-evo-sub">
              来自{report.usingSamples ? "示例提问，真实提问还不够多" : "最近的真实提问"}
              {suggestions.length ? ` · ${suggestions.length} 条说法建议` : ""}
              {orphans.length ? ` · ${report.orphans.length} 句没有技能能接` : ""}
            </p>
          )}
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
              {onlyOrphans ? null : <p>下面这些话，现在没有技能能接。勾上要处理的句子，再做成一个新技能。</p>}
              <ul>
                {orphans.map((o) => (
                  <li key={o.q}>
                    <label>
                      <input type="checkbox" checked={picked.has(o.q)} onChange={() => togglePick(o.q)} />
                      <span>「{o.q}」</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {orphans.length ? (
          <footer className="own-evo-foot">
            <button
              type="button"
              className="own-evo-make"
              onClick={() => {
                if (!picked.size) {
                  onToast("先勾上一句，再做成新技能");
                  return;
                }
                newSkillFromOrphans();
              }}
            >
              {picked.size ? `用这 ${picked.size} 句做成新技能` : "先勾上一句"}
            </button>
          </footer>
        ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}

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
    </>
  );
}
