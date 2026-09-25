/** 技能对比引擎 — 现用版 vs 新版，输出运维可读结论 */

import { AGENT_SKILLS, allRunnableSkills, runSkill, type AgentSkill } from "./agentSkills";
import { routeQuery } from "./skillRouter";
import { attachCompileToManifest, hydrateSkill } from "./skillMarkdown";
import { diffTrace, MOCK_PROFILES, type TraceDiff } from "./provingGround";
import type { SkillTraceStep } from "./agentSkills";

export type CompareSide = {
  versionLabel: string;
  skillName: string;
  routedSkillId: string | null;
  routedSkillName: string | null;
  routeScore: number;
  steps: { id: string; tool: string; label: string }[];
  trace: SkillTraceStep[];
  traceOk: boolean;
  answerPreview: string;
  triggerCount: number;
};

export type CompareVerdict = {
  level: "approve" | "warn" | "reject";
  title: string;
  bullets: string[];
};

export type SkillCompareResult = {
  skillId: string;
  query: string;
  baseline: CompareSide;
  candidate: CompareSide;
  traceDiff: TraceDiff;
  triggerDiff: { added: string[]; removed: string[] };
  verdict: CompareVerdict;
};

export function hydrateFromRaw(raw: string, skillId: string, label: string): AgentSkill {
  const core = hydrateSkill(raw, { id: skillId, skillPath: `compare://${label}` });
  const peers = AGENT_SKILLS.filter((s) => s.id !== skillId).map((s) => ({ id: s.id, triggers: s.triggers }));
  return attachCompileToManifest(core, { skillId, env: "browser", peers }) as AgentSkill;
}

function triggerDiff(base: AgentSkill, cand: AgentSkill) {
  const b = new Set(base.triggers);
  const c = new Set(cand.triggers);
  return {
    added: [...c].filter((t) => !b.has(t)),
    removed: [...b].filter((t) => !c.has(t)),
  };
}

function answerPreview(trace: SkillTraceStep[], result: unknown): string {
  if (result && typeof result === "object") {
    const o = result as { markdown?: string };
    if (typeof o.markdown === "string" && o.markdown.trim()) {
      return o.markdown.trim().slice(0, 280) + (o.markdown.length > 280 ? "…" : "");
    }
  }
  const last = trace[trace.length - 1];
  if (!last) return "（未产生输出）";
  if (!last.ok) return "（执行失败）";
  return `完成 ${trace.length} 步 · 最后一步 ${last.tool}`;
}

function buildVerdict(
  skillId: string,
  traceDiff: TraceDiff,
  triggers: { added: string[]; removed: string[] },
  baseline: CompareSide,
  candidate: CompareSide,
): CompareVerdict {
  const bullets: string[] = [];
  let level: CompareVerdict["level"] = "approve";

  if (baseline.routedSkillId !== candidate.routedSkillId) {
    level = "reject";
    bullets.push(
      `同一句测试话，现用版会交给「${baseline.routedSkillName ?? "无"}」，新版环境下会交给「${candidate.routedSkillName ?? "无"}」，存在进错技能风险。`,
    );
  } else if (baseline.routedSkillId !== skillId) {
    level = level === "approve" ? "warn" : level;
    bullets.push(`测试话未优先命中「${skillId}」，请换一句更接近业务的问法再比。`);
  }

  if (traceDiff.removedSteps.length) {
    level = "reject";
    bullets.push(`新版少了步骤：${traceDiff.removedSteps.join("、")}，可能影响回答完整性。`);
  }
  if (traceDiff.addedSteps.length) {
    bullets.push(`新版多了步骤：${traceDiff.addedSteps.join("、")}。`);
    if (level === "approve") level = "warn";
  }
  if (!traceDiff.sameSkeleton && !traceDiff.removedSteps.length && traceDiff.changedSteps.length) {
    bullets.push(`工具链顺序或工具有变化：${traceDiff.summary}。`);
    if (level === "approve") level = "warn";
  }
  if (triggers.removed.length) {
    bullets.push(`新版删掉了 ${triggers.removed.length} 个触发词，可能导致用户说不触发。`);
    if (level === "approve") level = "warn";
  }
  if (triggers.added.length) {
    bullets.push(`新版新增触发词：${triggers.added.slice(0, 5).join("、")}${triggers.added.length > 5 ? "…" : ""}。`);
  }
  if (!candidate.traceOk) {
    level = "reject";
    bullets.push("新版在该测试句下执行失败，不建议上线。");
  }

  if (bullets.length === 0) {
    bullets.push("工具链与现用版一致，路由未漂移，可考虑批准上线。");
  }

  const title =
    level === "approve" ? "建议批准上线" : level === "warn" ? "有风险，请人工确认" : "不建议上线";

  return { level, title, bullets };
}

async function runSide(
  skill: AgentSkill,
  versionLabel: string,
  query: string,
  catalog: AgentSkill[],
  probeUrl?: string,
): Promise<CompareSide> {
  const mockProfile = MOCK_PROFILES[skill.id];
  const route = routeQuery(query, catalog);
  const { trace, output } = await runSkill(skill, query, undefined, {
    probeUrl,
    mockProfile: mockProfile ?? undefined,
  });
  return {
    versionLabel,
    skillName: skill.name,
    routedSkillId: route.skillId,
    routedSkillName: route.label,
    routeScore: route.score,
    steps: skill.steps.map((s) => ({ id: s.id, tool: s.tool, label: s.label })),
    trace,
    traceOk: trace.every((t) => t.ok),
    answerPreview: answerPreview(trace, output),
    triggerCount: skill.triggers.length,
  };
}

export async function runSkillCompare(opts: {
  skillId: string;
  baselineRaw: string;
  candidateRaw: string;
  query: string;
  probeUrl?: string;
}): Promise<SkillCompareResult> {
  const { skillId, baselineRaw, candidateRaw, query, probeUrl } = opts;
  const baselineSkill = hydrateFromRaw(baselineRaw, skillId, "baseline");
  const candidateSkill = hydrateFromRaw(candidateRaw, skillId, "candidate");

  const live = allRunnableSkills();
  const catalogBase = live.map((s) => (s.id === skillId ? baselineSkill : s));
  const catalogCand = live.map((s) => (s.id === skillId ? candidateSkill : s));

  const [baseline, candidate] = await Promise.all([
    runSide(baselineSkill, "现用版", query, catalogBase, probeUrl),
    runSide(candidateSkill, "待上线新版", query, catalogCand, probeUrl),
  ]);

  const traceDiff = diffTrace(baseline.trace, candidate.trace);
  const triggers = triggerDiff(baselineSkill, candidateSkill);
  const verdict = buildVerdict(skillId, traceDiff, triggers, baseline, candidate);

  return { skillId, query, baseline, candidate, traceDiff, triggerDiff: triggers, verdict };
}
