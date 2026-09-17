import { useMemo, useState } from "react";
import { explainDiscovery } from "../../../lib/agentSkills";
import { StepShell } from "./StepShell";

const SAMPLES = [
  "对本站做发布前检查，探活并确认关键页面可访问",
  "打开 https://example.com 做性能审计",
  "检索 SkillForge 的 MCP 流水线",
];

const ACTION_WORDS = ["检查", "探活", "分析", "审计", "检索", "打开"] as const;

function extractSlots(q: string) {
  const urlHit = q.match(/https?:\/\/\S+/)?.[0] ?? null;
  const self = q.includes("本站");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = urlHit ?? (self || !urlHit ? origin : "");
  const actions = ACTION_WORDS.filter((v) => q.includes(v));
  const target = self ? "site:self" : urlHit ? `url:${urlHit}` : url ? "site:self" : "unspecified";
  const scans = [
    { k: "http(s) 正则", v: urlHit ?? "未命中" },
    { k: "「本站」", v: self ? "命中 → site:self" : "未写" },
    { k: "origin 回落", v: urlHit ? "不需要" : origin || "—" },
    { k: "动作词", v: actions.join(" · ") || "一个都没有" },
  ];
  return {
    scans,
    slots: [
      { slot: "url", value: url || "—" },
      { slot: "target", value: target },
      { slot: "actions", value: actions.join(", ") || "—" },
      { slot: "skillHint", value: explainDiscovery(q)[0]?.skill.id ?? "—" },
    ],
  };
}

export function StepEntity() {
  const [q, setQ] = useState(SAMPLES[0]!);
  const parsed = useMemo(() => extractSlots(q), [q]);
  return (
    <StepShell id="entity">
      <div className="agent-step-samples">
        {SAMPLES.map((s) => (
          <button key={s} type="button" className={q === s ? "on" : ""} onClick={() => setQ(s)}>
            {s.slice(0, 18)}…
          </button>
        ))}
      </div>
      <input className="agent-step-input" value={q} onChange={(e) => setQ(e.target.value)} aria-label="抽出实体输入" />
      <ol className="step-live-scan">
        {parsed.scans.map((s) => (
          <li key={s.k}>
            <em>{s.k}</em>
            <code>{s.v}</code>
          </li>
        ))}
      </ol>
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>slot</th>
            <th>写入变量</th>
          </tr>
        </thead>
        <tbody>
          {parsed.slots.map((s) => (
            <tr key={s.slot}>
              <td>
                <code>{s.slot}</code>
              </td>
              <td>{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StepShell>
  );
}
