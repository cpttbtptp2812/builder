import { useMemo, useState } from "react";
import { explainDiscovery } from "../../../lib/agentSkills";
import { StepShell } from "./StepShell";

const SAMPLES = [
  "对本站做发布前检查，探活并确认关键页面可访问",
  "打开 https://example.com 做性能审计",
  "检索 SkillForge 的 MCP 流水线",
];

function extractSlots(q: string) {
  const url = q.match(/https?:\/\/\S+/)?.[0] ?? (typeof window !== "undefined" ? window.location.origin : "");
  const actions = ["检查", "探活", "分析", "审计", "检索", "打开"].filter((v) => q.includes(v));
  const target = q.includes("本站") ? "site:self" : url ? `url:${url}` : "unspecified";
  return [
    { slot: "url", value: url },
    { slot: "target", value: target },
    { slot: "actions", value: actions.join(", ") || "—" },
    { slot: "skillHint", value: explainDiscovery(q)[0]?.skill.id ?? "—" },
  ];
}

export function StepEntity() {
  const [q, setQ] = useState(SAMPLES[0]!);
  const slots = useMemo(() => extractSlots(q), [q]);
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
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>slot</th>
            <th>value</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
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
