import { useState, useSyncExternalStore } from "react";
import { runSkill } from "../../lib/agentSkills";
import { hydrateFromRaw } from "../../lib/skillCompareEngine";
import { listPageTools, subscribePageTools } from "../../lib/pageTools";
import { extractUrlFromText } from "../../lib/releaseInspect";
import { releaseQuestions } from "../../lib/skillSentence";

function brief(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const row = result as { error?: string; status?: number; nodeCount?: number; hits?: unknown[]; overall?: string };
  if (row.error) return row.error;
  if (typeof row.status === "number") return `状态 ${row.status}`;
  if (Array.isArray(row.hits)) return `${row.hits.length} 条资料`;
  if (typeof row.nodeCount === "number") return `读到这个页面的 ${row.nodeCount} 个节点`;
  if (row.overall) return `结论 ${row.overall}`;
  return "做完了";
}

/** 发版检查：用这一页此刻注册的工具，把技能步骤真跑一遍。 */
export function PageToolWalk({ skillId, draftRaw }: { skillId: string; draftRaw: string }) {
  const tools = useSyncExternalStore(subscribePageTools, listPageTools, listPageTools);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<{ label: string; ok: boolean; detail: string }[] | null>(null);
  const [verdict, setVerdict] = useState("");

  async function walk() {
    setBusy(true);
    setLines(null);
    setVerdict("");
    try {
      const skill = hydrateFromRaw(draftRaw, skillId, skillId);
      const query = releaseQuestions(skillId)[0] ?? skill.triggers[0] ?? "测试";
      const probeUrl = extractUrlFromText(query) ?? window.location.origin;
      const { trace } = await runSkill(skill, query, undefined, { preferPageTools: true, probeUrl });
      const next = trace.map((row) => ({
        label: row.label,
        ok: row.ok,
        detail: brief(row.result),
      }));
      setLines(next);
      const missing = next.some((row) => row.detail.includes("这一页没有这个能力"));
      const denied = next.some((row) => row.detail.includes("你拒绝了"));
      if (missing) setVerdict("有一步这一页做不了，先别发。");
      else if (denied) setVerdict("你拒绝了其中一步，这次没有走完。");
      else if (next.length && next.every((row) => row.ok)) setVerdict("这一页把技能的步骤都做完了。");
      else setVerdict("有一步没做成，先别发。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="own-page-walk">
      <h3>在这个页面上走一遍</h3>
      <p>技能的步骤调用的是这一页现在注册的功能。只读的直接做完，会改数据的先问你。这一页没有的功能，这一版发不出去。</p>
      <ul className="own-page-tools">
        {tools.map((tool) => (
          <li key={tool.name}>
            {tool.label}
            <em>{tool.annotations?.consequentialHint ? "要确认" : "只读"}</em>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void walk()} disabled={busy}>
        {busy ? "这一页正在做…" : "在这个页面上走一遍"}
      </button>
      {lines ? (
        <ol>
          {lines.map((row, i) => (
            <li key={i} className={row.ok ? "is-ok" : "is-bad"}>
              {row.label}
              <span>{row.detail}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {verdict ? <p className={verdict.includes("都做完") ? "is-ok" : "is-bad"}>{verdict}</p> : null}
    </section>
  );
}
