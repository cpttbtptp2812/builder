/** Working Set — 对齐理论「context · 整理上下文」 */

import { getMemorySnapshot, type MemoryEntry } from "./agentMemory";
import { explainDiscovery } from "./agentSkills";

export type WorkingSet = {
  query: string;
  skillHint: string | null;
  memoryBlock: string;
  budgetTokens: number;
  usedTokens: number;
  longTermKeys: string[];
};

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 2.2));
}

export async function buildWorkingSet(query: string, budgetTokens = 1800): Promise<WorkingSet> {
  const snap = await getMemorySnapshot();
  const top = explainDiscovery(query)[0];
  const skillHint =
    top && top.score > 0 ? `${top.skill.name}（${top.score} 分 · ${top.hits.slice(0, 3).join("、") || "触发"}）` : null;

  const longTerm = snap.longTerm.slice(0, 8);
  const turns = snap.sessionTurns.slice(-6);
  const parts: string[] = [];
  if (skillHint) parts.push(`【技能提示】${skillHint}`);
  if (longTerm.length) {
    parts.push("【长期记忆】\n" + longTerm.map((m: MemoryEntry) => `- ${m.key}: ${m.value}`).join("\n"));
  }
  if (turns.length) {
    parts.push(
      "【近期对话】\n" +
        turns.map((t) => `${t.role === "user" ? "用户" : "助手"}: ${t.text.slice(0, 140)}`).join("\n"),
    );
  }

  let memoryBlock = parts.join("\n\n");
  let used = estimateTokens(memoryBlock + query);
  while (used > budgetTokens && memoryBlock.length > 200) {
    memoryBlock = memoryBlock.slice(0, Math.floor(memoryBlock.length * 0.75));
    used = estimateTokens(memoryBlock + query);
  }

  return {
    query,
    skillHint,
    memoryBlock: memoryBlock || "（工作集为空）",
    budgetTokens,
    usedTokens: used,
    longTermKeys: longTerm.map((m) => m.key),
  };
}

/** 对齐理论四段流水线的可展示阶段 */
export type PipelineStage = {
  id: string;
  lane: "理解" | "编排" | "运行" | "能力";
  label: string;
  status: "pending" | "active" | "done";
};

/** 与理论能力全景同构的 14 步 */
export function initialPipeline(): PipelineStage[] {
  return [
    { id: "nlu", lane: "理解", label: "理解问句", status: "pending" },
    { id: "intent", lane: "理解", label: "辨认意图", status: "pending" },
    { id: "entity", lane: "理解", label: "抽出实体", status: "pending" },
    { id: "plan", lane: "理解", label: "规划任务", status: "pending" },
    { id: "context", lane: "理解", label: "整理上下文", status: "pending" },
    { id: "dsl", lane: "编排", label: "流程定义", status: "pending" },
    { id: "manage", lane: "编排", label: "流程管理", status: "pending" },
    { id: "pattern", lane: "编排", label: "执行模式", status: "pending" },
    { id: "engine", lane: "运行", label: "运行内核", status: "pending" },
    { id: "mech", lane: "运行", label: "落地机制", status: "pending" },
    { id: "ctrl", lane: "运行", label: "运行管控", status: "pending" },
    { id: "browser", lane: "能力", label: "浏览器", status: "pending" },
    { id: "mcp", lane: "能力", label: "MCP", status: "pending" },
    { id: "kb", lane: "能力", label: "知识 / 制度", status: "pending" },
  ];
}

export function advancePipeline(stages: PipelineStage[], upToId: string): PipelineStage[] {
  const ids = stages.map((s) => s.id);
  const idx = ids.indexOf(upToId);
  return stages.map((s, i) => {
    if (i < idx) return { ...s, status: "done" };
    if (i === idx) return { ...s, status: "active" };
    return { ...s, status: s.status === "done" ? "done" : "pending" };
  });
}

export function completePipeline(stages: PipelineStage[]): PipelineStage[] {
  return stages.map((s) => ({ ...s, status: "done" }));
}
