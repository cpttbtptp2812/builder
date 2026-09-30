/** 发布巡检 — 客户可读的「验收快照」（底层仍走 callFrame 追踪） */

import { mcpServer } from "./mcpServer";
import { composeReleaseReportTraced, extractUrlFromText, type InspectCheck, type InspectCheckStatus } from "./releaseInspect";

export type AcceptanceMetric = {
  id: string;
  label: string;
  value: string;
  status: InspectCheckStatus;
};

export type ReleaseDependencyProof = {
  query: string;
  targetUrl: string;
  overall: InspectCheckStatus;
  headline: string;
  checks: InspectCheck[];
  metrics: AcceptanceMetric[];
  pagePreview?: string;
  pageTitle?: string;
  via?: string;
  liveProbe: boolean;
  /** 仅审计折叠区展示 */
  auditHash?: string;
};

const PATH_LABEL: Record<string, string> = {
  "probe.ok": "HTTP 是否成功",
  "probe.status": "HTTP 状态码",
  "probe.latencyMs": "响应耗时",
  "probe.error": "探活错误信息",
  "probe.body.preview": "页面 HTML 摘要",
  "probe.body.statusOk": "页面状态标记",
  "probe.body.hasSearchInput": "是否有搜索框",
};

export function labelDependencyPath(path: string): string {
  return PATH_LABEL[path] ?? path;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("探活超时")), ms);
    }),
  ]);
}

function metricsFromProbe(probe: Record<string, unknown>): AcceptanceMetric[] {
  const ok = Boolean(probe.ok);
  const status = typeof probe.status === "number" ? probe.status : null;
  const latencyMs = typeof probe.latencyMs === "number" ? probe.latencyMs : null;
  const body = probe.body as Record<string, unknown> | undefined;
  const preview = typeof body?.preview === "string" ? body.preview : "";
  const pageTitle = typeof body?.pageTitle === "string" ? body.pageTitle : "";
  const statusOk = Boolean(body?.statusOk);
  const hasSearch = Boolean(body?.hasSearchInput);
  const err = typeof probe.error === "string" ? probe.error : "";

  const httpStatus: InspectCheckStatus = err || !ok || (status != null && status >= 400) ? "fail" : "pass";

  const rows: AcceptanceMetric[] = [
    {
      id: "http",
      label: "HTTP 可达",
      value: err ? "不可达" : ok ? "成功" : "失败",
      status: httpStatus,
    },
    {
      id: "status",
      label: "状态码",
      value: status != null ? String(status) : "—",
      status: httpStatus,
    },
    {
      id: "latency",
      label: "响应耗时",
      value: latencyMs != null ? `${latencyMs} ms` : "—",
      status: latencyMs != null && latencyMs > 3000 ? "warn" : httpStatus === "fail" ? "fail" : "pass",
    },
    {
      id: "title",
      label: "页面标题",
      value: pageTitle ? pageTitle.slice(0, 48) : preview ? "（已从 HTML 解析）" : "—",
      status: pageTitle || preview ? "pass" : ok ? "warn" : "fail",
    },
    {
      id: "health",
      label: "页面健康度",
      value: statusOk ? "未见明显错误页信号" : ok ? "需人工看一眼 HTML" : "—",
      status: statusOk ? "pass" : ok ? "warn" : "fail",
    },
    {
      id: "search",
      label: "搜索入口",
      value: hasSearch ? "检测到搜索框" : "未检测到",
      status: "pass",
    },
  ];

  if (err) {
    rows.push({
      id: "error",
      label: "说明",
      value: err.length > 96 ? `${err.slice(0, 96)}…` : err,
      status: "fail",
    });
  }

  return rows;
}

/** 对带 URL 的问句做一次 live 探活，输出客户可读验收快照 */
export async function buildReleaseDependencyProof(query: string): Promise<ReleaseDependencyProof | null> {
  const url = extractUrlFromText(query);
  if (!url) return null;

  const probeOut = await withTimeout(mcpServer.callTool("http_probe", { url, method: "GET" }), 12_000);
  const probe = (probeOut.content ?? {}) as Record<string, unknown>;
  const { report, frame } = composeReleaseReportTraced({
    targetUrl: url,
    probe,
    snapshotSkipped: true,
    knowledgeQuery: query,
    knowledge: { hits: [] },
  });

  const body = probe.body as { preview?: string; pageTitle?: string } | undefined;
  const previewRaw = body?.preview ?? "";
  const pagePreview = previewRaw
    ? previewRaw.replace(/\s+/g, " ").trim().slice(0, 220)
    : undefined;

  return {
    query,
    targetUrl: url,
    overall: report.overall,
    headline: report.siteSummary ?? report.targetUrl,
    checks: report.checks,
    metrics: metricsFromProbe(probe),
    pagePreview,
    pageTitle: report.pageTitle,
    via: typeof probe.via === "string" ? probe.via : undefined,
    liveProbe: true,
    auditHash: frame.comparableHash,
  };
}
