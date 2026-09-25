import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { parseSkillMarkdown } from "../../lib/skillMarkdown";
import { setTriggers } from "../../lib/skillFormEdit";
import { NL_EDIT_EXAMPLES, planNlEdit, type NlEditPlan } from "../../lib/skillNlEdit";
import { analyzeImpact, catalogWith, findWeakTriggers, type RouteShift, type SkillImpact } from "../../lib/skillImpact";
import { mineTriggerSuggestions } from "../../lib/skillTriggerMiner";
import { routeQuery, skillLabel } from "../../lib/skillRouter";
import { QUERY_LOG_EVENT, skillQueryStats } from "../../lib/skillQueryLog";
import { isLlmConfigured, loadLlmConfig } from "../../lib/llmConfig";
import { OaBtn } from "./OaUi";

function SourceTag({ source, count }: { source: "real" | "sample"; count: number }) {
  return source === "real" ? (
    <span className="own-si-tag own-si-tag--real">真实提问{count > 1 ? ` ×${count}` : ""}</span>
  ) : (
    <span className="own-si-tag">示例</span>
  );
}

/* ───────── 一句话改技能 ───────── */

export function NlEditBox({ raw, onApply }: { raw: string; onApply: (next: string, summary: string) => void }) {
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<NlEditPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const llm = isLlmConfigured(loadLlmConfig());

  useEffect(() => () => abort.current?.abort(), []);

  async function parse() {
    if (!text.trim()) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true);
    try {
      setPlan(await planNlEdit(raw, text, abort.current.signal));
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!plan?.ops.length) return;
    onApply(plan.result, plan.lines.join("；"));
    setPlan(null);
    setText("");
  }

  return (
    <section className="own-si-nl">
      <header>
        <strong>一句话修改</strong>
        <span>用平常说话的方式告诉它要改什么，先预览再应用。{llm ? "已接入大模型解析。" : "当前用内置规则解析，接入大模型后能听懂更多说法。"}</span>
      </header>
      <div className="own-si-nl-row">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPlan(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void parse();
            }
          }}
          placeholder="例如：加上说法：预发、staging；把资料库对照挪到最前面"
        />
        <OaBtn onClick={() => void parse()} disabled={busy || !text.trim()}>
          {busy ? "解析中…" : "预览修改"}
        </OaBtn>
      </div>
      {!plan ? (
        <div className="own-si-nl-examples">
          试试：
          {NL_EDIT_EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setText(ex); setPlan(null); }}>
              {ex}
            </button>
          ))}
        </div>
      ) : (
        <div className="own-si-nl-plan">
          {plan.lines.length ? (
            <>
              <p>
                将做以下修改（{plan.engine === "llm" ? "大模型解析" : "内置规则解析"}）：
              </p>
              <ol>
                {plan.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            </>
          ) : (
            <p>没有识别出可以执行的修改。</p>
          )}
          {plan.unknown.length ? (
            <p className="own-si-warn">
              这几句没看懂，没有执行：{plan.unknown.map((u) => `「${u}」`).join("")}
              。可以换个说法，或在下面表单里手动改。
            </p>
          ) : null}
          <div className="own-si-nl-actions">
            <OaBtn onClick={apply} disabled={!plan.ops.length}>
              应用到草稿
            </OaBtn>
            <button type="button" className="own-skill-inline-btn" onClick={() => setPlan(null)}>
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────── 说法建议 + 说法体检 ───────── */

export function TriggerAdvice({
  skillId,
  raw,
  onAdd,
}: {
  skillId: string;
  raw: string;
  onAdd: (phrase: string) => void;
}) {
  const deferred = useDeferredValue(raw);
  const mining = useMemo(() => mineTriggerSuggestions(skillId, deferred), [skillId, deferred]);
  const weak = useMemo(() => findWeakTriggers(skillId, catalogWith(skillId, deferred)), [skillId, deferred]);
  const [open, setOpen] = useState<string | null>(null);

  const tooShort = weak.filter((w) => w.reason.startsWith("只有"));
  const taken = weak.filter((w) => !w.reason.startsWith("只有"));

  return (
    <div className="own-si-advice">
      {mining.suggestions.length ? (
        <div className="own-si-suggest">
          <p className="own-si-advice-title">
            建议添加的说法
            <small>
              从{mining.usingSamples ? "示例提问（真实提问还不够多）" : "最近的真实提问"}里找出 {mining.missed.length} 句没有技能接手、但内容像这个技能的话，并逐个预演过效果
            </small>
          </p>
          <ul>
            {mining.suggestions.map((s) => (
              <li key={s.phrase}>
                <button type="button" className="own-si-suggest-add" onClick={() => onAdd(s.phrase)}>
                  + {s.phrase}
                </button>
                <span className="own-si-gain">能多接住 {s.captured.length} 句</span>
                {s.stolen.length ? (
                  <span className="own-si-warn-inline">会抢走其他技能 {s.stolen.length} 句</span>
                ) : (
                  <span className="own-si-muted">不影响其他技能</span>
                )}
                <button type="button" className="own-skill-inline-btn" onClick={() => setOpen(open === s.phrase ? null : s.phrase)}>
                  {open === s.phrase ? "收起" : "看是哪几句"}
                </button>
                {open === s.phrase ? (
                  <ul className="own-si-examples">
                    {s.captured.map((c) => (
                      <li key={c.q}>
                        「{c.q}」 <SourceTag source={c.source} count={c.count} />
                      </li>
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
        </div>
      ) : null}

      {taken.length ? (
        <p className="own-si-warn">
          {taken.map((w) => `「${w.trigger}」${w.reason}`).join("；")}。用户只说这些词时，不会用到这个技能。
        </p>
      ) : null}
      {tooShort.length ? (
        <p className="own-si-muted">
          说法太短、单独说不会触发：{tooShort.map((w) => w.trigger).join("、")}。它们要和别的说法一起出现才算数；想让用户只说一个词就触发，请写成 4 个字以上，例如「上线检查」。
        </p>
      ) : null}
    </div>
  );
}

/* ───────── 影响范围 ───────── */

function ShiftList({ items, tone, render }: { items: RouteShift[]; tone: "gain" | "lose" | "other"; render: (s: RouteShift) => string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 5);
  return (
    <ul className={`own-si-shifts own-si-shifts--${tone}`}>
      {shown.map((s) => (
        <li key={s.q}>
          <span>「{s.q}」</span>
          <SourceTag source={s.source} count={s.count} />
          <em>{render(s)}</em>
        </li>
      ))}
      {items.length > 5 ? (
        <li>
          <button type="button" className="own-skill-inline-btn" onClick={() => setAll((v) => !v)}>
            {all ? "收起" : `还有 ${items.length - 5} 句`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

export function useSkillImpact(skillId: string, online: string, draft: string): SkillImpact {
  const deferred = useDeferredValue(draft);
  const [logTick, setLogTick] = useState(0);
  useEffect(() => {
    const on = () => setLogTick((n) => n + 1);
    window.addEventListener(QUERY_LOG_EVENT, on);
    return () => window.removeEventListener(QUERY_LOG_EVENT, on);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => analyzeImpact(skillId, online, deferred), [skillId, online, deferred, logTick]);
}

export function ImpactPanel({ impact }: { impact: SkillImpact }) {
  const { gained, lost, others, ambiguous, handled, realHandled } = impact;
  const nothing = !gained.length && !lost.length && !others.length;

  return (
    <section className="own-compare-report-section own-si-impact">
      <h3>影响范围 · 改完后用户的话会交给谁</h3>
      <p className="own-si-muted">
        用 {impact.corpusSize} 句话（{impact.realCount ? `${impact.realCount} 句是「问 AI」里的真实提问` : "还没有真实提问记录"}
        {impact.usingSamples ? "，加上示例提问" : ""}，以及各技能的说法）分别走一遍线上版和草稿版的路由，逐句比较去向。不用点按钮，改动后自动重算。
      </p>
      <div className="own-si-stats">
        <div>
          <strong>
            {handled.before} → {handled.after}
          </strong>
          <span>这个技能接手的句数</span>
        </div>
        <div>
          <strong>
            {realHandled.before} → {realHandled.after}
          </strong>
          <span>其中真实提问</span>
        </div>
        <div className={gained.length ? "is-gain" : ""}>
          <strong>+{gained.length}</strong>
          <span>新接手</span>
        </div>
        <div className={lost.length ? "is-lose" : ""}>
          <strong>−{lost.length}</strong>
          <span>不再接手</span>
        </div>
      </div>

      {nothing ? <p className="own-si-ok">所有句子的去向都和线上一样，这次修改不会改变「哪句话交给哪个技能」。</p> : null}

      {lost.length ? (
        <>
          <p className="own-si-subtitle own-si-subtitle--lose">不再由这个技能处理（{lost.length}）</p>
          <ShiftList items={lost} tone="lose" render={(s) => `→ 改由「${s.toLabel}」处理`} />
        </>
      ) : null}
      {gained.length ? (
        <>
          <p className="own-si-subtitle own-si-subtitle--gain">新接手（{gained.length}）</p>
          <ShiftList items={gained} tone="gain" render={(s) => `原来：${s.fromLabel}`} />
        </>
      ) : null}
      {others.length ? (
        <>
          <p className="own-si-subtitle">连带影响其他技能（{others.length}）</p>
          <ShiftList items={others} tone="other" render={(s) => `${s.fromLabel} → ${s.toLabel}`} />
        </>
      ) : null}
      {ambiguous.length ? (
        <>
          <p className="own-si-subtitle own-si-subtitle--warn">分数打平、容易交错技能（{ambiguous.length}）</p>
          <ul className="own-si-shifts own-si-shifts--other">
            {ambiguous.slice(0, 5).map((a) => (
              <li key={a.q}>
                <span>「{a.q}」</span>
                <SourceTag source={a.source} count={a.count} />
                <em>{a.rivals.map((r) => r.label).join(" 和 ")} 同分（{a.rivals[0]!.score} 分）</em>
              </li>
            ))}
          </ul>
          <p className="own-si-muted">打平时靠内置规则或排序决定，结果不稳定。可以给其中一个技能加更具体的说法拉开差距。</p>
        </>
      ) : null}
    </section>
  );
}

/* ───────── 路由试一试 + 近期提问 ───────── */

export function RouteProbe({ skillId, initial, onCompare }: { skillId: string; initial: string; onCompare: (q: string) => void }) {
  const [q, setQ] = useState(initial);
  const d = useMemo(() => (q.trim() ? routeQuery(q) : null), [q]);
  const mine = d?.skillId === skillId;
  const ranked = d?.ranked.filter((r) => r.score > 0).slice(0, 3) ?? [];

  return (
    <div className="own-si-probe">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入一句用户可能说的话" />
      {d ? (
        <div className={mine ? "own-si-probe-result is-mine" : "own-si-probe-result"}>
          <p>
            会交给：<strong>{d.label}</strong>
            {mine ? "（就是这个技能）" : ""}
          </p>
          <p className="own-si-muted">原因：{d.rule}</p>
          {ranked.length ? (
            <p className="own-si-muted">
              说法得分：
              {ranked.map((r) => `${skillLabel(r.skill)} ${r.score} 分（${r.hits.join("、")}）`).join("；")}
              。满 2 分且领先才会直接接手。
            </p>
          ) : null}
          <button type="button" className="own-skill-inline-btn" onClick={() => onCompare(q)}>
            用这句话对比改动前后 →
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RecentQueries({ skillId }: { skillId: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener(QUERY_LOG_EVENT, on);
    return () => window.removeEventListener(QUERY_LOG_EVENT, on);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => skillQueryStats(skillId), [skillId, tick]);

  if (!stats.total) {
    return <p className="own-si-muted">还没有真实提问记录。在「问 AI」里提问后，这里会显示哪些话交给了这个技能，改技能时也会用这些话检查影响。</p>;
  }
  return (
    <div>
      <p>
        最近 7 天共 {stats.total} 句提问，这个技能接手了 <strong>{stats.handled}</strong> 句。
      </p>
      {stats.latest.length ? (
        <ul className="own-si-examples">
          {stats.latest.map((e) => (
            <li key={e.at}>
              「{e.q}」<span className="own-si-muted"> {new Date(e.at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function addTriggerTo(raw: string, phrase: string): string {
  const doc = parseSkillMarkdown(raw);
  return doc.triggers.includes(phrase) ? raw : setTriggers(raw, [...doc.triggers, phrase]);
}
