/** 版本更新页 — 给人看的文案，不是给编译器看的 */

import type { AgentSkill } from "../../lib/agentSkills";
import type { QueryCompareRow, SkillFullCompareReport } from "../../lib/skillCompareReport";

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
  const [head = "", ...rest] = step.label.split(" · ").map((s) => s.trim());
  const tail = rest.join(" · ");
  const name = /^[a-z_]+$/i.test(head) && tail ? tail : head;
  return name && name.length <= 20 ? name : step.id;
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

export function verdictTone(level: SkillFullCompareReport["verdict"]["level"]) {
  if (level === "approve") return "ok";
  if (level === "warn") return "warn";
  return "fail";
}

const ROUTE_NONE = "没有技能接手";

/** 逐句对比：状态 + 路由一行展示（与清单共用，避免再开一张表） */
export function queryComparePresentation(q: QueryCompareRow): {
  tone: "ok" | "warn" | "bad";
  badge: string;
  routeLine: string;
  detail: string | null;
} {
  const rb = q.routeBaseline ?? ROUTE_NONE;
  const rc = q.routeCandidate ?? ROUTE_NONE;
  let tone: "ok" | "warn" | "bad" = "ok";
  let badge = "过";
  if (q.verdictLevel === "reject") {
    tone = "bad";
    badge = "不过";
  } else if (q.routeDrift) {
    tone = "warn";
    badge = "路由变";
  } else if (q.traceChanged) {
    tone = "warn";
    badge = "步骤变";
  } else if (q.verdictLevel === "warn") {
    tone = "warn";
    badge = "注意";
  }

  let routeLine: string;
  if (q.routeDrift) routeLine = `${rb} → ${rc}`;
  else if (q.traceChanged) routeLine = `${rc} · ${q.traceSummary || "步骤与现用版不同"}`;
  else routeLine = `${rc} · 一致`;

  const note = q.note?.trim() || null;
  const detail = tone === "bad" || tone === "warn" ? note || (q.traceChanged ? q.traceSummary : null) : null;
  return { tone, badge, routeLine, detail };
}

export function humanVerdict(level: SkillFullCompareReport["verdict"]["level"]) {
  if (level === "approve") {
    return { title: "可以发", gate: "PASS", hint: "这些问法都过了，和现用版一样。" };
  }
  if (level === "warn") {
    return { title: "先看一眼再发", gate: "WARN", hint: "问法还能答上，有一处发之前要看一眼。" };
  }
  return { title: "先别发", gate: "BLOCK", hint: "有问法过不了，改完再检查。" };
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
