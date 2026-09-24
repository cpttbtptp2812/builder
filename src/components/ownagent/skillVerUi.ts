/** 版本更新页 — 给人看的文案，不是给编译器看的 */

import type { AgentSkill } from "../../lib/agentSkills";
import type { SkillFullCompareReport } from "../../lib/skillCompareReport";

export function skillDisplayTitle(skill: Pick<AgentSkill, "name" | "description">): string {
  const head = skill.description.split(/[—–\-]/)[0]?.trim();
  if (head && head.length >= 2 && head.length <= 24) return head;
  return skill.name;
}

export function skillSubtitle(skill: Pick<AgentSkill, "description">): string {
  const parts = skill.description.split(/[—–\-]/);
  return parts.length > 1 ? parts.slice(1).join("—").trim() : skill.description;
}

export function sampleTriggers(triggers: string[], max = 4): string[] {
  return triggers.filter((t) => t.length >= 2).slice(0, max);
}

export function stepShortLabel(step: { id: string; label: string }): string {
  const head = step.label.split(" · ")[0]?.trim();
  return head && head.length <= 20 ? head : step.id;
}

export function stepPipelineText(steps: { id: string; label: string }[]): string {
  return steps.map(stepShortLabel).join(" → ") || "（无步骤）";
}

export const SKILL_SAMPLE_QUERIES: Record<string, string> = {
  "release-inspector": "帮我巡检 https://example.com 能否上线",
  "site-analyzer": "分析本站性能和探活情况",
  "knowledge-lookup": "检索产品文档里的常见问题",
  "policy-desk": "满一年年假有几天",
  "dom-probe": "分析页面 DOM 结构",
  "workflow-orchestrator": "执行自动化 workflow 回放",
};

export function defaultSampleQuery(skillId: string, triggers: string[]): string {
  return SKILL_SAMPLE_QUERIES[skillId] ?? (triggers[0] ? `请帮我${triggers[0]}` : "请帮我处理一下");
}

export function fmtUpdatedAt(iso: string | undefined): string {
  if (!iso) return "尚未单独发布过（使用内置配置）";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "刚刚更新";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前更新`;
  if (diff < 86_400_000) return `今天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新`;
  if (diff < 172_800_000) return "昨天更新";
  return `${d.toLocaleDateString("zh-CN")} 更新`;
}

export function humanVerdict(level: SkillFullCompareReport["verdict"]["level"]) {
  if (level === "approve") {
    return { title: "可以发布", hint: "常见问法下，新版和现在的表现一致或更好。" };
  }
  if (level === "warn") {
    return { title: "建议再看一眼", hint: "有些场景可能和现版不一样，确认符合预期再发。" };
  }
  return { title: "先别发布", hint: "新版可能答错、漏答，或用户说法对不上。请继续改。" };
}

export function plainDiffLines(report: SkillFullCompareReport): string[] {
  const lines: string[] = [];
  const s = report.structural;
  if (s.descriptionChanged) lines.push("技能说明文字有改动");
  if (s.triggers.added.length) lines.push(`多了这些说法：${s.triggers.added.slice(0, 6).join("、")}`);
  if (s.triggers.removed.length) lines.push(`少了这些说法：${s.triggers.removed.slice(0, 6).join("、")}`);
  if (s.steps.removed.length) lines.push("回答步骤变少，可能漏内容");
  if (s.steps.added.length) lines.push("回答步骤变多");
  if (s.steps.changed.length) lines.push("某些步骤用的工具换了");
  if (!s.steps.baselineChain.includes(s.steps.candidateChain.split(" → ")[0] ?? "") && s.steps.baselineChain !== s.steps.candidateChain) {
    if (!lines.some((l) => l.includes("步骤"))) lines.push("回答顺序或步骤有变化");
  }
  const badTests = report.queryResults.filter((q) => q.routeDrift || q.traceChanged);
  if (badTests.length) lines.push(`${badTests.length} 条常见问法下，新版和现版表现不一致`);
  if (!lines.length) lines.push("内容和现版基本一致");
  return lines;
}
