import { useState } from "react";
import { flipIfBroken, releaseQuestions, stepLabels } from "../../lib/skillSentence";

/** 发版实验：弄坏一步，看哪些客户的话会从过变成不过 */
export function SkillBreakPanel({ skillId, draftRaw }: { skillId: string; draftRaw: string }) {
  const steps = stepLabels(draftRaw);
  const [busy, setBusy] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ flipped: string[]; held: string[]; cold: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function hit(index: number) {
    setBusy(index);
    setPicked(index);
    setErr(null);
    try {
      const queries = releaseQuestions(skillId);
      setResult(await flipIfBroken(draftRaw, skillId, index, queries));
    } catch (e) {
      setResult(null);
      setErr(e instanceof Error ? e.message : "这一步没跑完");
    } finally {
      setBusy(null);
    }
  }

  const label = picked != null ? steps[picked]?.label : "";

  return (
    <section className="own-break">
      <h3>弄坏一步，看哪些话会挂</h3>
      <p>点一个步骤，把它弄坏。原来能答对的话如果翻成不过，这一步就是先别发的原因。</p>
      <div className="own-break-steps">
        {steps.map((s, i) => (
          <button key={s.id || i} type="button" className={picked === i ? "on" : ""} disabled={busy != null} onClick={() => void hit(i)}>
            {busy === i ? "正在弄坏…" : s.label}
          </button>
        ))}
      </div>
      {err ? <p className="own-break-bad">{err}</p> : null}
      {result && picked != null && busy == null ? (
        <div className="own-break-out">
          {result.flipped.length ? (
            <>
              <p className="own-break-bad">弄坏「{label}」之后，这 {result.flipped.length} 句从过变成不过。先别发。</p>
              <ul>
                {result.flipped.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>弄坏「{label}」并没有把原来能过的话弄挂。</p>
          )}
          {result.held.length ? <p className="own-qbank-count">还有 {result.held.length} 句照样能过。</p> : null}
          {!result.flipped.length && !result.held.length ? <p className="own-qbank-count">这些话现在就过不了，先不用靠弄坏步骤来判断。</p> : null}
        </div>
      ) : null}
    </section>
  );
}
