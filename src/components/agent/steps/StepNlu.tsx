import { useMemo, useState } from "react";
import { StepShell } from "./StepShell";

const SAMPLES = [
  "对本站做发布前检查，探活并确认关键页面可访问",
  "analyze site metrics and TTFB latency",
  "帮我入队一个改价上架的 workflow",
];

function tokenize(q: string) {
  const raw = q.normalize("NFKC").trim();
  const tokens = raw.split(/(\s+|[，。！？、,./:;!?()（）])/).filter((t) => t.trim());
  return {
    tokens,
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
      <ul className="agent-step-tokens">
        {parsed.tokens.map((t, i) => (
          <li key={`${t}-${i}`} data-kind={kind(t)}>
            {t}
          </li>
        ))}
      </ul>
      <p className="agent-step-sample">
        CJK {parsed.scripts.cjk} · Latin {parsed.scripts.latin} · digit {parsed.scripts.digit} · chars {parsed.chars}
      </p>
    </StepShell>
  );
}
