/** 平行路线 — 同一问题强制走不同决策路径并重跑 */

import { explainDiscovery, runSkill } from "./agentSkills";
import { runGuestAgentTurn } from "./guestAgentRuntime";
import { matchPlaza } from "./plazaFeed";
import { formatRagContext, retrieveRagEnhanced } from "./ragEngine";

export type ForkId = "plaza" | "guest" | "skill" | "rag";

export type ForkSpec = {
  id: ForkId;
  label: string;
  desc: string;
};

export const FORK_SPECS: ForkSpec[] = [
  { id: "plaza", label: "广场直出", desc: "强制只查知识广场，命中则直接返回" },
  { id: "guest", label: "AI 全链路", desc: "跳过广场，走 Guest Agent 路由 + 工具" },
  { id: "skill", label: "Skill 专跑", desc: "锁定 Top-1 Skill，逐步执行 MCP" },
  { id: "rag", label: "RAG 重写", desc: "Query Rewrite 检索，纯资料库合成" },
];

export type ForkRunResult = {
  id: ForkId;
  label: string;
  answer: string;
  routeLabel: string;
  ms: number;
  error?: string;
};

function skillAnswer(result: { markdown?: string; dashboard?: unknown; meta?: unknown }): string {
  if (result.markdown?.trim()) return result.markdown.trim();
  if (result.dashboard) {
    return "```json\n" + JSON.stringify(result.dashboard, null, 2).slice(0, 2800) + "\n```";
  }
  return "Skill 执行完成，见结构化返回。";
}

function ragSynthesis(query: string): ForkRunResult {
  const t0 = performance.now();
  const rag = retrieveRagEnhanced(query, 4, { rewrite: true });
  const ms = Math.max(1, Math.round(performance.now() - t0));
  if (!rag.hits.length) {
    return {
      id: "rag",
      label: "RAG 重写",
      answer: "资料库未命中相关内容。",
      routeLabel: "RAG · 0 hits",
      ms,
    };
  }
  const lead = rag.hits[0]!;
  const body = formatRagContext(rag);
  return {
    id: "rag",
    label: "RAG 重写",
    answer: `**检索结论**（${lead.projectName} · ${lead.section}，score ${lead.score.toFixed(2)}）\n\n${lead.text.slice(0, 520)}${lead.text.length > 520 ? "…" : ""}\n\n<details><summary>引用片段</summary>\n\n${body}\n\n</details>`,
    routeLabel: `RAG · ${rag.hits.length} hits · ${rag.latencyMs}ms`,
    ms,
  };
}

export async function runCounterfactualFork(query: string, forkId: ForkId): Promise<ForkRunResult> {
  const q = query.trim();
  const spec = FORK_SPECS.find((s) => s.id === forkId)!;
  const t0 = performance.now();

  try {
    if (forkId === "plaza") {
      const m = await matchPlaza(q);
      const ms = Math.max(1, Math.round(performance.now() - t0));
      if (!m || m.score < 40) {
        return {
          id: forkId,
          label: spec.label,
          answer: "广场未命中（score < 40），此路线不会产生回答。",
          routeLabel: "广场 · miss",
          ms,
        };
      }
      return {
        id: forkId,
        label: spec.label,
        answer: m.item.answer.trim(),
        routeLabel: `广场 · ${m.score}% · ${m.item.author}`,
        ms,
      };
    }

    if (forkId === "guest") {
      let text = "";
      const guest = await runGuestAgentTurn(q, {}, (ev) => {
        if (ev.type === "text-delta") text += ev.text;
      });
      const ms = Math.max(1, Math.round(performance.now() - t0));
      const answer = text.trim() || guest.assistantText.trim();
      const routeLabel = guest.route
        ? `${guest.route.skillName}${guest.route.hits[0] ? ` · ${guest.route.hits[0]}` : ""}`
        : "Guest Agent";
      return {
        id: forkId,
        label: spec.label,
        answer: answer || "（Guest 未生成文本）",
        routeLabel,
        ms,
      };
    }

    if (forkId === "skill") {
      const top = explainDiscovery(q)[0];
      if (!top || top.score <= 0) {
        return {
          id: forkId,
          label: spec.label,
          answer: "无 Skill 触发匹配，此路线无法执行。",
          routeLabel: "Skill · none",
          ms: Math.max(1, Math.round(performance.now() - t0)),
        };
      }
      const { result } = await runSkill(top.skill, q);
      const ms = Math.max(1, Math.round(performance.now() - t0));
      return {
        id: forkId,
        label: spec.label,
        answer: skillAnswer(result),
        routeLabel: `Skill · ${top.skill.name} (${top.score.toFixed(1)})`,
        ms,
      };
    }

    return ragSynthesis(q);
  } catch (err) {
    return {
      id: forkId,
      label: spec.label,
      answer: "",
      routeLabel: "错误",
      ms: Math.max(1, Math.round(performance.now() - t0)),
      error: err instanceof Error ? err.message : "执行失败",
    };
  }
}

/** 并行跑全部平行路线 */
export async function runAllCounterfactuals(
  query: string,
  onPartial?: (row: ForkRunResult) => void,
): Promise<ForkRunResult[]> {
  const jobs = FORK_SPECS.map(async (spec) => {
    const row = await runCounterfactualFork(query, spec.id);
    onPartial?.(row);
    return row;
  });
  return Promise.all(jobs);
}

/** 粗粒度差异 — 提取 B 相对 A 多出的句子 */
export function diffExtraSentences(base: string, other: string): string[] {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const split = (s: string) =>
    norm(s)
      .split(/(?<=[。！？.!?])\s*/)
      .map((x) => x.trim())
      .filter((x) => x.length > 8);
  const aSet = new Set(split(base));
  return split(other).filter((s) => !aSet.has(s)).slice(0, 6);
}
