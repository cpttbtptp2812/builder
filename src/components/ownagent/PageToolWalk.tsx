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

export type PageWalkResult = {
  lines: { label: string; ok: boolean; detail: string }[];
  verdict: string;
  ok: boolean;
};

export async function runPageToolWalk(skillId: string, draftRaw: string): Promise<PageWalkResult> {
  const skill = hydrateFromRaw(draftRaw, skillId, skillId);
  const query = releaseQuestions(skillId)[0] ?? skill.triggers[0] ?? "测试";
  const probeUrl = extractUrlFromText(query) ?? (typeof window !== "undefined" ? window.location.origin : "https://example.com");
  const { trace } = await runSkill(skill, query, undefined, { preferPageTools: true, probeUrl });
  const lines = trace.map((row) => ({
    label: row.label,
    ok: row.ok,
    detail: brief(row.result),
  }));
  const missing = lines.some((row) => row.detail.includes("这一页没有这个能力"));
  const denied = lines.some((row) => row.detail.includes("你拒绝了"));
  let verdict: string;
  let ok = false;
  if (missing) verdict = "有一步这一页做不了，先别发。";
  else if (denied) verdict = "你拒绝了其中一步，这次没有走完。";
  else if (lines.length && lines.every((row) => row.ok)) {
    verdict = "这一页把技能的步骤都做完了。";
    ok = true;
  } else verdict = "有一步没做成，先别发。";
  return { lines, verdict, ok };
}

/** 发版检查：用这一页此刻注册的工具，把技能步骤真跑一遍。 */
export function PageToolWalk({
  skillId,
  draftRaw,
  embedded = false,
  result,
}: {
  skillId: string;
  draftRaw: string;
  embedded?: boolean;
  result?: PageWalkResult | null;
}) {
  const tools = useSyncExternalStore(subscribePageTools, listPageTools, listPageTools);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<{ label: string; ok: boolean; detail: string }[] | null>(null);
  const [verdict, setVerdict] = useState("");

  const shown = result ?? (lines ? { lines, verdict, ok: verdict.includes("都做完") } : null);

  async function walk() {
    setBusy(true);
    setLines(null);
    setVerdict("");
    try {
      const r = await runPageToolWalk(skillId, draftRaw);
      setLines(r.lines);
      setVerdict(r.verdict);
    } finally {
      setBusy(false);
    }
  }

  if (embedded && result) {
    return (
      <div className="own-page-walk-inline">
        <p className={result.ok ? "is-ok" : "is-bad"}>{result.verdict}</p>
        <ol>
          {result.lines.map((row, i) => (
            <li key={i} className={row.ok ? "is-ok" : "is-bad"}>
              {row.label}
              <span>{row.detail}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <section className="own-page-walk">
      {!embedded ? (
        <>
          <h3>在这个页面上走一遍</h3>
          <p>技能的步骤调用的是这一页现在注册的功能。只读的直接做完，会改数据的先问你。这一页没有的功能，这一版发不出去。</p>
        </>
      ) : null}
      <ul className="own-page-tools">
        {tools.map((tool) => (
          <li key={tool.name}>
            {tool.label}
            <em>{tool.annotations?.consequentialHint ? "要确认" : "只读"}</em>
          </li>
        ))}
      </ul>
      {!embedded ? (
        <button type="button" onClick={() => void walk()} disabled={busy}>
          {busy ? "这一页正在做…" : "在这个页面上走一遍"}
        </button>
      ) : null}
      {shown ? (
        <ol>
          {shown.lines.map((row, i) => (
            <li key={i} className={row.ok ? "is-ok" : "is-bad"}>
              {row.label}
              <span>{row.detail}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {shown && !embedded ? <p className={shown.ok ? "is-ok" : "is-bad"}>{shown.verdict}</p> : null}
    </section>
  );
}
