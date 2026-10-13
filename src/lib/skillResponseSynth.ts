import type { AgentSkill, SkillResult } from "./agentSkills";

import { DESK_METAS } from "./deskProgramMeta";

const CUSTOMER_DESK_FINISH_IDS = new Set(["ledger-desk", ...DESK_METAS.map((m) => m.skillId)]);

/** 对话 product-run 办结：一句结论，不把整份 markdown 当正文 */
export function synthesizeProductFinishMessage(skillId: string, result: unknown): string {
  if (!CUSTOMER_DESK_FINISH_IDS.has(skillId)) {
    return "办理完成，请查看下方步骤与文书。";
  }
  const r = result as { summary?: string; detail?: string; markdown?: string };
  if (typeof r.summary === "string" && r.summary.trim()) return r.summary.trim();
  if (typeof r.detail === "string" && r.detail.trim()) {
    const first = r.detail.trim().split(/\n/)[0] ?? "";
    if (first.length <= 320) return first;
    return `${first.slice(0, 300)}…`;
  }
  return "办理完成，请查看下方步骤与文书。";
}

function synthesizeSiteAudit(result: SkillResult, query: string): string {
  const d = result.dashboard as {
    http?: { status?: number; latencyMs?: number; ok?: boolean; url?: string };
    dom?: { a11yNodes?: number };
    perf?: { ttfbMs?: number | null; loadMs?: number | null; resourceCount?: number };
  } | undefined;
  const http = d?.http;
  const perf = d?.perf;

  const problems: string[] = [];
  if (http && !http.ok) problems.push(`HTTP 探活失败（status ${http.status ?? "—"}）`);
  if (perf?.ttfbMs != null && perf.ttfbMs > 200) problems.push(`TTFB ${perf.ttfbMs}ms 偏高`);
  if (perf?.loadMs != null && perf.loadMs > 3000) problems.push(`Load ${perf.loadMs}ms 偏慢`);
  if (perf?.resourceCount != null && perf.resourceCount > 200) problems.push(`资源数 ${perf.resourceCount} 偏多`);

  const ok = problems.length === 0 && (http?.ok ?? true);
  const askedOk = /正不正常|正常吗|能不能打开|打得开|可用吗|检查/.test(query);
  const askedPerf = /性能|ttfb|加载|慢|latency|metrics/.test(query);

  const verdict = askedOk
    ? ok
      ? `**能打开，站点正常。** HTTP ${http?.status ?? "—"}，探活 ${http?.latencyMs ?? "—"}ms。`
      : `**能访问，但有问题：** ${problems.join("；")}。`
    : askedPerf
      ? `**性能快照：** TTFB ${perf?.ttfbMs ?? "—"}ms · Load ${perf?.loadMs ?? "—"}ms · 资源 ${perf?.resourceCount ?? "—"}。`
      : ok
        ? "**探活通过，指标正常。**"
        : `**探活通过，但有 ${problems.length} 项需要注意：** ${problems.join("；")}。`;

  const lines = [verdict, ""];
  if (http) {
    lines.push(`- HTTP 探活：${http.ok ? "通过" : "失败"} · status ${http.status ?? "—"} · ${http.latencyMs ?? "—"}ms`);
    lines.push(`- 目标：${http.url ?? "本站"}`);
  }
  if (perf) {
    lines.push(`- TTFB：${perf.ttfbMs ?? "—"}ms · Load：${perf.loadMs ?? "—"}ms · Resources：${perf.resourceCount ?? "—"}`);
  }
  if (d?.dom) lines.push(`- DOM a11y 节点：${d.dom.a11yNodes ?? "—"}`);
  return lines.join("\n");
}

function synthesizeDomProbe(result: SkillResult): string {
  const p = (result.dashboard as { domProbe?: { totalNodes?: number; interactive?: number; density?: number; byRole?: Record<string, number> } })?.domProbe;
  if (!p) return "当前页 DOM 已抓取，细节在右侧 Trace。";
  const topRoles = Object.entries(p.byRole ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r, n]) => `${r}(${n})`)
    .join("、");
  return [
    `当前页 ${p.totalNodes ?? "—"} 个节点，可交互 ${p.interactive ?? "—"}（密度 ${p.density ?? "—"}%）。`,
    topRoles ? `Role：${topRoles}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function synthesizeWorkflow(result: SkillResult): string {
  const wf = (result.dashboard as { workflow?: { runId?: string; workflowId?: string; status?: string; replaySteps?: number } })?.workflow;
  return [
    `已在本机 MCP 入队 workflow \`${wf?.workflowId ?? "—"}\`（runId ${wf?.runId ?? "—"}，${wf?.replaySteps ?? "—"} 步）。`,
    "这是本站的入队接口，不会去操控外部网站。要看真实浏览器自动化，打开 iMean 产品页。",
  ].join("\n");
}

function synthesizeGeneric(result: SkillResult): string {
  if (result.markdown) return result.markdown;
  if (result.dashboard) {
    return "```json\n" + JSON.stringify(result.dashboard, null, 2).slice(0, 2500) + "\n```";
  }
  if (result.meta?.raw != null) {
    return "```json\n" + JSON.stringify(result.meta.raw, null, 2).slice(0, 2500) + "\n```";
  }
  return "这轮工具已跑完，右侧 Trace 是原始返回。";
}

export function synthesizeResponse(skill: AgentSkill, result: SkillResult, query: string): string {
  switch (skill.id) {
    case "release-inspector":
      return result.markdown ?? synthesizeGeneric(result);
    case "site-analyzer":
      return synthesizeSiteAudit(result, query);
    case "dom-probe":
      return synthesizeDomProbe(result);
    case "workflow-orchestrator":
      return synthesizeWorkflow(result);
    case "policy-desk":
      return result.markdown ?? "制度值班已完成。";
    case "knowledge-lookup":
      return result.markdown ?? synthesizeGeneric(result);
    default:
      return synthesizeGeneric(result);
  }
}
