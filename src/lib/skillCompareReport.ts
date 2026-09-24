/** 全量对比 + 差异报告 — Skill 整包 v0.10 vs v0.11 */

import { AGENT_SKILLS, type AgentSkill } from "./agentSkills";
import { attachCompileToManifest, hydrateSkill } from "./skillMarkdown";
import { diagLabel } from "../components/ownagent/skillDevLabels";
import { effectLabel } from "./skillSemcompiler";
import type { SkillDiagnostic } from "./skillSemcompiler";
import { runSkillCompare, type CompareVerdict, type SkillCompareResult } from "./skillCompareEngine";
import { SKILL_TRACE_CASES } from "./provingGround";
import { extractUrlFromText } from "./releaseInspect";

export type RiskItem = {
  level: "high" | "medium" | "low";
  title: string;
  detail: string;
};

export type QueryCompareRow = {
  query: string;
  verdictLevel: CompareVerdict["level"];
  routeBaseline: string | null;
  routeCandidate: string | null;
  routeDrift: boolean;
  traceChanged: boolean;
  traceSummary: string;
  note: string;
};

export type StructuralDiff = {
  descriptionChanged: boolean;
  baselineDescription: string;
  candidateDescription: string;
  triggers: { added: string[]; removed: string[]; unchanged: number };
  tools: { added: string[]; removed: string[] };
  steps: {
    baselineChain: string;
    candidateChain: string;
    added: string[];
    removed: string[];
    changed: { id: string; from: string; to: string }[];
  };
  effectBaseline?: string;
  effectCandidate?: string;
};

export type SkillFullCompareReport = {
  skillId: string;
  skillName: string;
  baselineVersion: string;
  candidateVersion: string;
  generatedAt: string;
  structural: StructuralDiff;
  compile: {
    baselineOk: boolean;
    candidateOk: boolean;
    baselineIssueCount: number;
    candidateIssueCount: number;
    newWarnings: SkillDiagnostic[];
    newErrors: SkillDiagnostic[];
  };
  queryResults: QueryCompareRow[];
  risks: RiskItem[];
  verdict: CompareVerdict;
  markdown: string;
};

const EXTRA_QUERIES: Record<string, string[]> = {
  "release-inspector": ["发布前验收 example.com", "上线前健康检查"],
  "site-analyzer": ["站点探活 metrics", "页面加载慢不慢"],
  "knowledge-lookup": ["查一下知识库里的 API 说明"],
  "policy-desk": ["VPN 权限怎么申请"],
};

function hydrateFromRaw(raw: string, skillId: string, label: string): AgentSkill {
  const core = hydrateSkill(raw, { id: skillId, skillPath: `compare://${label}` });
  const peers = AGENT_SKILLS.filter((s) => s.id !== skillId).map((s) => ({ id: s.id, triggers: s.triggers }));
  return attachCompileToManifest(core, { skillId, env: "browser", peers }) as AgentSkill;
}

function stepChain(skill: AgentSkill): string {
  return skill.steps.map((s) => s.id).join(" → ") || "（无步骤）";
}

export function buildStructuralDiff(baseline: AgentSkill, candidate: AgentSkill): StructuralDiff {
  const bt = new Set(baseline.triggers);
  const ct = new Set(candidate.triggers);
  const bTools = new Set(baseline.tools);
  const cTools = new Set(candidate.tools);

  const baseSteps = new Map(baseline.steps.map((s) => [s.id, s.tool]));
  const candSteps = new Map(candidate.steps.map((s) => [s.id, s.tool]));

  const added = [...candSteps.keys()].filter((id) => !baseSteps.has(id));
  const removed = [...baseSteps.keys()].filter((id) => !candSteps.has(id));
  const changed: StructuralDiff["steps"]["changed"] = [];
  for (const [id, tool] of candSteps) {
    const prev = baseSteps.get(id);
    if (prev != null && prev !== tool) changed.push({ id, from: prev, to: tool });
  }

  return {
    descriptionChanged: baseline.description.trim() !== candidate.description.trim(),
    baselineDescription: baseline.description,
    candidateDescription: candidate.description,
    triggers: {
      added: [...ct].filter((t) => !bt.has(t)),
      removed: [...bt].filter((t) => !ct.has(t)),
      unchanged: [...bt].filter((t) => ct.has(t)).length,
    },
    tools: {
      added: [...cTools].filter((t) => !bTools.has(t)),
      removed: [...bTools].filter((t) => !cTools.has(t)),
    },
    steps: {
      baselineChain: stepChain(baseline),
      candidateChain: stepChain(candidate),
      added,
      removed,
      changed,
    },
    effectBaseline: baseline.effectUpperBound ? effectLabel(baseline.effectUpperBound) : undefined,
    effectCandidate: candidate.effectUpperBound ? effectLabel(candidate.effectUpperBound) : undefined,
  };
}

function buildTestQueries(skillId: string, skill: AgentSkill): string[] {
  const out = new Set<string>();
  for (const c of SKILL_TRACE_CASES.filter((x) => x.skillId === skillId)) out.add(c.query);
  for (const q of EXTRA_QUERIES[skillId] ?? []) out.add(q);
  for (const t of skill.triggers.slice(0, 4)) {
    if (t.length >= 2) out.add(`用户说：${t}，请处理`);
  }
  return [...out].slice(0, 10);
}

function compileDiff(baseline: AgentSkill, candidate: AgentSkill) {
  const baseErr = baseline.diagnostics.filter((d) => d.level === "error");
  const candErr = candidate.diagnostics.filter((d) => d.level === "error");
  const baseWarn = baseline.diagnostics.filter((d) => d.level === "warning");
  const candWarn = candidate.diagnostics.filter((d) => d.level === "warning");

  const errKey = (d: SkillDiagnostic) => `${d.code}:${d.message}`;
  const baseErrSet = new Set(baseErr.map(errKey));
  const baseWarnSet = new Set(baseWarn.map(errKey));

  return {
    baselineOk: baseline.compileOk,
    candidateOk: candidate.compileOk,
    baselineIssueCount: baseline.diagnostics.filter((d) => d.level !== "info").length,
    candidateIssueCount: candidate.diagnostics.filter((d) => d.level !== "info").length,
    newErrors: candErr.filter((d) => !baseErrSet.has(errKey(d))),
    newWarnings: candWarn.filter((d) => !baseWarnSet.has(errKey(d))),
  };
}

function buildRisks(
  structural: StructuralDiff,
  compile: SkillFullCompareReport["compile"],
  queryResults: QueryCompareRow[],
): RiskItem[] {
  const risks: RiskItem[] = [];

  if (compile.newErrors.length) {
    risks.push({
      level: "high",
      title: "新版存在静态错误",
      detail: compile.newErrors.map((e) => e.message).join("；"),
    });
  }
  if (structural.steps.removed.length) {
    risks.push({
      level: "high",
      title: "工具链少了步骤",
      detail: `移除：${structural.steps.removed.join("、")}，可能导致回答缺内容。`,
    });
  }
  const routeDrifts = queryResults.filter((r) => r.routeDrift);
  if (routeDrifts.length) {
    risks.push({
      level: "high",
      title: "部分用户说法会进错技能",
      detail: `${routeDrifts.length}/${queryResults.length} 条测试句路由与现用版不一致。`,
    });
  }
  if (structural.triggers.removed.length) {
    risks.push({
      level: "medium",
      title: "触发词被删除",
      detail: `用户可能再说「${structural.triggers.removed.slice(0, 4).join("」「")}」时不再触发。`,
    });
  }
  if (structural.triggers.added.length) {
    risks.push({
      level: "medium",
      title: "新增触发词可能误伤",
      detail: `新增：${structural.triggers.added.slice(0, 5).join("、")}，可能与其他技能抢话。`,
    });
  }
  if (structural.steps.changed.length) {
    risks.push({
      level: "medium",
      title: "同一步骤换了工具",
      detail: structural.steps.changed.map((c) => `${c.id}：${c.from} → ${c.to}`).join("；"),
    });
  }
  if (structural.effectBaseline !== structural.effectCandidate && structural.effectCandidate) {
    risks.push({
      level: "medium",
      title: "权限级别可能变化",
      detail: `现用版 ${structural.effectBaseline ?? "—"} → 新版 ${structural.effectCandidate}。`,
    });
  }
  const traceChanges = queryResults.filter((r) => r.traceChanged);
  if (traceChanges.length && !structural.steps.removed.length) {
    risks.push({
      level: "low",
      title: "部分场景工具链表现不同",
      detail: `${traceChanges.length} 条测试句执行路径与现用版不同，请查看全量测试表。`,
    });
  }
  if (compile.newWarnings.length) {
    risks.push({
      level: "low",
      title: "新版有新的提醒项",
      detail: compile.newWarnings.slice(0, 3).map((w) => w.message).join("；"),
    });
  }
  if (!risks.length) {
    risks.push({
      level: "low",
      title: "未发现明显风险",
      detail: "配置差异在可接受范围内，仍建议浏览全量测试后再批准。",
    });
  }
  return risks;
}

function aggregateVerdict(risks: RiskItem[], queryResults: QueryCompareRow[]): CompareVerdict {
  if (risks.some((r) => r.level === "high")) {
    return {
      level: "reject",
      title: "不建议上线",
      bullets: risks.filter((r) => r.level === "high").map((r) => `${r.title}：${r.detail}`),
    };
  }
  if (risks.some((r) => r.level === "medium")) {
    return {
      level: "warn",
      title: "有风险，请人工确认",
      bullets: risks.filter((r) => r.level === "medium").map((r) => `${r.title}：${r.detail}`),
    };
  }
  const failQueries = queryResults.filter((r) => r.verdictLevel === "reject").length;
  if (failQueries > 0) {
    return {
      level: "warn",
      title: "部分测试句未通过",
      bullets: [`${failQueries}/${queryResults.length} 条测试句对比未通过，请查看明细。`],
    };
  }
  return {
    level: "approve",
    title: "建议批准上线",
    bullets: ["全量对比未发现高风险项，可考虑将新版设为现用版。"],
  };
}

function toQueryRow(query: string, result: SkillCompareResult): QueryCompareRow {
  return {
    query,
    verdictLevel: result.verdict.level,
    routeBaseline: result.baseline.routedSkillName,
    routeCandidate: result.candidate.routedSkillName,
    routeDrift: result.baseline.routedSkillId !== result.candidate.routedSkillId,
    traceChanged: !result.traceDiff.sameSkeleton,
    traceSummary: result.traceDiff.summary,
    note: result.verdict.bullets[0] ?? "",
  };
}

export function reportToMarkdown(r: SkillFullCompareReport): string {
  const lines: string[] = [
    `# Skill 对比报告`,
    ``,
    `- 技能：**${r.skillName}**（\`${r.skillId}\`）`,
    `- 版本：**v${r.baselineVersion}** → **v${r.candidateVersion}**`,
    `- 生成时间：${new Date(r.generatedAt).toLocaleString()}`,
    `- 结论：**${r.verdict.title}**`,
    ``,
    `## 可能的问题`,
    ...r.risks.map((x) => `- [${x.level}] **${x.title}**：${x.detail}`),
    ``,
    `## 配置差异`,
    `- 说明变更：${r.structural.descriptionChanged ? "是" : "否"}`,
    `- 触发词：+${r.structural.triggers.added.length} / -${r.structural.triggers.removed.length}`,
    r.structural.triggers.added.length ? `  - 新增：${r.structural.triggers.added.join("、")}` : "",
    r.structural.triggers.removed.length ? `  - 删除：${r.structural.triggers.removed.join("、")}` : "",
    `- 工具链：`,
    `  - 现用版：${r.structural.steps.baselineChain}`,
    `  - 新版：${r.structural.steps.candidateChain}`,
    r.structural.steps.removed.length ? `  - 少步骤：${r.structural.steps.removed.join("、")}` : "",
    r.structural.steps.added.length ? `  - 多步骤：${r.structural.steps.added.join("、")}` : "",
    ``,
    `## 静态检查`,
    `- 现用版：${r.compile.baselineOk ? "通过" : "有问题"}（${r.compile.baselineIssueCount} 条）`,
    `- 新版：${r.compile.candidateOk ? "通过" : "有问题"}（${r.compile.candidateIssueCount} 条）`,
    ...r.compile.newErrors.map((e) => `- 新错误 [${diagLabel(e.code)}] ${e.message}`),
    ...r.compile.newWarnings.map((e) => `- 新提醒 [${diagLabel(e.code)}] ${e.message}`),
    ``,
    `## 全量测试（${r.queryResults.length} 条）`,
    `| 测试句 | 现用路由 | 新版路由 | 路由漂移 | 工具链变化 |`,
    `| --- | --- | --- | --- | --- |`,
    ...r.queryResults.map(
      (q) =>
        `| ${q.query.replace(/\|/g, "\\|").slice(0, 40)} | ${q.routeBaseline ?? "—"} | ${q.routeCandidate ?? "—"} | ${q.routeDrift ? "是" : "否"} | ${q.traceChanged ? q.traceSummary : "否"} |`,
    ),
    ``,
  ];
  return lines.filter(Boolean).join("\n");
}

export async function runFullSkillCompare(opts: {
  skillId: string;
  skillName: string;
  baselineRaw: string;
  candidateRaw: string;
  baselineVersion: string;
  candidateVersion: string;
  extraQuery?: string;
}): Promise<SkillFullCompareReport> {
  const baseline = hydrateFromRaw(opts.baselineRaw, opts.skillId, "baseline");
  const candidate = hydrateFromRaw(opts.candidateRaw, opts.skillId, "candidate");
  const structural = buildStructuralDiff(baseline, candidate);
  const compile = compileDiff(baseline, candidate);

  const queries = buildTestQueries(opts.skillId, baseline);
  if (opts.extraQuery?.trim()) queries.unshift(opts.extraQuery.trim());

  const queryResults: QueryCompareRow[] = [];
  for (const query of queries) {
    const probeUrl = extractUrlFromText(query) ?? undefined;
    const result = await runSkillCompare({
      skillId: opts.skillId,
      baselineRaw: opts.baselineRaw,
      candidateRaw: opts.candidateRaw,
      query,
      probeUrl,
    });
    queryResults.push(toQueryRow(query, result));
  }

  const risks = buildRisks(structural, compile, queryResults);
  const verdict = aggregateVerdict(risks, queryResults);
  const generatedAt = new Date().toISOString();
  const report: SkillFullCompareReport = {
    skillId: opts.skillId,
    skillName: opts.skillName,
    baselineVersion: opts.baselineVersion,
    candidateVersion: opts.candidateVersion,
    generatedAt,
    structural,
    compile,
    queryResults,
    risks,
    verdict,
    markdown: "",
  };
  report.markdown = reportToMarkdown(report);
  return report;
}
