import { useMemo, useState } from "react";
import { StepShell } from "./StepShell";

const SAMPLES = [
  "对本站做发布前检查，探活并确认关键页面可访问",
  "analyze site metrics and TTFB latency",
  "帮我入队一个网页调研的 workflow",
];

function tokenize(q: string) {
  const raw = q.normalize("NFKC").trim();
  const space = raw.split(/\s+/).filter(Boolean);
  const punct = raw.split(/(\s+|[，。！？、,./:;!?()（）])/).filter((t) => t.trim());
  return {
    raw,
    space,
    punct,
    scripts: {
      cjk: (raw.match(/[\u4e00-\u9fff]/g) ?? []).length,
      latin: (raw.match(/[a-zA-Z]/g) ?? []).length,
      digit: (raw.match(/\d/g) ?? []).length,
    },
    chars: raw.length,
  };
}

function kind(t: string) {
  if (/[\u4e00-\u9fff]/.test(t)) return "cjk";
  if (/[a-zA-Z]/.test(t)) return "latin";
  if (/\d/.test(t)) return "digit";
  return "punct";
}

export function StepNlu() {
  const [q, setQ] = useState(SAMPLES[0]!);
  const parsed = useMemo(() => tokenize(q), [q]);
  const spaceFail = parsed.space.length <= 1 && parsed.scripts.cjk > 0;

  return (
    <StepShell id="nlu">
      <div className="agent-step-samples">
        {SAMPLES.map((s) => (
          <button key={s} type="button" className={q === s ? "on" : ""} onClick={() => setQ(s)}>
            {s.slice(0, 16)}…
          </button>
        ))}
      </div>
      <input className="agent-step-input" value={q} onChange={(e) => setQ(e.target.value)} aria-label="理解问句输入" />

      <div className="step-live-split">
        <div className={spaceFail ? "is-bad" : ""}>
          <b>按空格切 · {parsed.space.length} 块</b>
          <ul className="agent-step-tokens">
            {parsed.space.map((t, i) => (
              <li key={`s-${i}`} data-kind={kind(t)}>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <b>按标点切 · {parsed.punct.length} 词</b>
          <ul className="agent-step-tokens">
            {parsed.punct.map((t, i) => (
              <li key={`p-${i}`} data-kind={kind(t)}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="agent-step-sample">
        NFKC {parsed.chars} 字 · CJK {parsed.scripts.cjk} · Latin {parsed.scripts.latin} · digit {parsed.scripts.digit}
        {spaceFail ? " · 空格切失败，后面意图表会对空" : ""}
      </p>
    </StepShell>
  );
}
