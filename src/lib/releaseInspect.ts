/** 发布前巡检 — 任意 URL：http_probe +（同源）snapshot + 资料库对照 */

import { extractHtmlMeta } from "./htmlProbeMeta";
import { mcpServer } from "./mcpServer";
import { retrieveRagEnhanced, formatRagContext } from "./ragEngine";

export type InspectCheckStatus = "pass" | "warn" | "fail";

export type InspectCheck = {
  id: string;
  label: string;
  status: InspectCheckStatus;
  detail: string;
};

export type ReleaseInspectReport = {
  targetUrl: string;
  overall: InspectCheckStatus;
  checks: InspectCheck[];
  probe?: Record<string, unknown>;
  snapshotSkipped?: boolean;
  knowledgeHits?: number;
  ms: number;
  pageTitle?: string;
  siteSummary?: string;
  external?: boolean;
};

const URL_RE = /https?:\/\/[^\s<>"']+/i;

export function extractUrlFromText(text: string): string | null {
  const m = text.trim().match(URL_RE);
  if (!m) return null;
  return m[0]!.replace(/[，。；,;)]+$/g, "");
}

/** 去掉重复的 /inspect 前缀，避免解析成 https://inspect */
export function normalizeInspectPayload(text: string): string {
  let s = text.trim();
  while (/^\/inspect(\s+|$)/i.test(s)) {
    s = s.replace(/^\/inspect\s*/i, "").trim();
  }
  return s;
}

function resolveInspectUrl(raw: string): string | null {
  const payload = normalizeInspectPayload(raw);
  if (!payload) return null;
  const fromHttp = extractUrlFromText(payload);
  if (fromHttp) return fromHttp;
  const token = payload.split(/\s+/)[0]?.replace(/[，。；,;)]+$/g, "") ?? "";
  if (!token || token.startsWith("/")) return null;
  if (/^https?:\/\//i.test(token)) return token;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(token)) return `https://${token}`;
  return null;
}

export function parseReleaseInspectRequest(text: string): { url: string; query: string } | null {
  const trimmed = text.trim();
  const isInspectCmd = /^\/inspect\b/i.test(trimmed);
  const url = isInspectCmd ? resolveInspectUrl(trimmed) : extractUrlFromText(trimmed);
  if (!url) return null;
  const kw = /巡检|发布|验收|探活|检查|上线|发版|smoke|inspect|release|health/i;
  if (isInspectCmd || kw.test(trimmed) || trimmed.length < 120) {
    return { url, query: trimmed };
  }
  return null;
}

export function formatInspectUserMessage(url: string): string {
  const clean = normalizeInspectPayload(url);
  const target = resolveInspectUrl(clean) ?? clean;
  return target.startsWith("http") ? target : `https://${target}`;
}

export function isSameOriginUrl(url: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 是否为本项目相关站点（才做资料库对照） */
export function isProjectInspectUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1") return true;
    if (typeof window !== "undefined" && h === window.location.hostname) return true;
    if (/github\.io$/i.test(h) || /yanshengxing\.com$/i.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

function pageMetaFromProbe(probe: Record<string, unknown>, preview?: string) {
  const body = probe.body as Record<string, unknown> | undefined;
  const pageTitle =
    (typeof body?.pageTitle === "string" && body.pageTitle) ||
    (typeof probe.pageTitle === "string" && probe.pageTitle) ||
    null;
  const pageDescription =
    typeof body?.pageDescription === "string" ? body.pageDescription : null;
  const statusOk = Boolean(body?.statusOk);
  const hasSearchInput = Boolean(body?.hasSearchInput);
  if (pageTitle) {
    return { title: pageTitle, description: pageDescription, statusOk, hasSearchInput };
  }
  if (preview) {
    const m = extractHtmlMeta(preview);
    return {
      title: m.title,
      description: m.description,
      statusOk: m.statusOk,
      hasSearchInput: m.hasSearchInput,
    };
  }
  return { title: null, description: null, statusOk: false, hasSearchInput: false };
}

function formatProbeError(raw: string, via?: string): string {
  const low = raw.toLowerCase();
  if (
    low.includes("connection") ||
    low.includes("failed to fetch") ||
    low.includes("network") ||
    low.includes("aborted")
  ) {
    const hint =
      via === "browser"
        ? "。跨域 URL 需启动 API 服务（npm run dev:server 或 dev:full）以走服务端探活"
        : "。请确认目标服务已启动且公网可访问";
    return `网络不可达：${raw}${hint}`;
  }
  return raw;
}

function probeDetailSuffix(via?: unknown): string {
  if (via === "server") return " · 服务端探活";
  if (via === "browser") return " · 浏览器直连";
  return "";
}

function htmlRedFlags(preview: string | undefined): string[] {
  if (!preview) return [];
  const low = preview.toLowerCase();
  const flags: string[] = [];
  if (/404|not found|页面不存在|找不到/.test(low)) flags.push("页面含 404 / Not Found 信号");
  if (/500|internal server error|服务异常|系统错误/.test(low)) flags.push("页面含 5xx / 错误页信号");
  if (preview.length < 80) flags.push("HTML 内容过短");
  return flags;
}

export function composeReleaseReport(opts: {
  targetUrl: string;
  probe: Record<string, unknown>;
  snapshot?: Record<string, unknown> | null;
  snapshotSkipped?: boolean;
  knowledgeQuery?: string;
}): ReleaseInspectReport {
  const checks: InspectCheck[] = [];
  const probe = opts.probe;
  const ok = Boolean(probe.ok);
  const status = typeof probe.status === "number" ? probe.status : 0;
  const latencyMs = typeof probe.latencyMs === "number" ? probe.latencyMs : null;
  const body = probe.body as {
    preview?: string;
    bytes?: number;
    pageTitle?: string;
    pageDescription?: string;
    statusOk?: boolean;
    hasSearchInput?: boolean;
  } | undefined;
  const preview = body?.preview;
  const via = typeof probe.via === "string" ? probe.via : undefined;
  const viaTag = probeDetailSuffix(via);
  const external = opts.snapshotSkipped ?? !isProjectInspectUrl(opts.targetUrl);
  const host = hostnameOf(opts.targetUrl);
  const pageMeta = pageMetaFromProbe(probe, preview);

  if (probe.error) {
    checks.push({
      id: "http",
      label: "HTTP 探活",
      status: "fail",
      detail: formatProbeError(String(probe.error), via) + viaTag,
    });
  } else if (!ok || status >= 400) {
    checks.push({
      id: "http",
      label: "HTTP 探活",
      status: "fail",
      detail: `HTTP ${status} · ${latencyMs ?? "—"}ms${viaTag}`,
    });
  } else if (latencyMs != null && latencyMs > 3000) {
    checks.push({
      id: "http",
      label: "HTTP 探活",
      status: "warn",
      detail: `HTTP ${status} · 偏慢 ${latencyMs}ms${viaTag}`,
    });
  } else {
    checks.push({
      id: "http",
      label: "HTTP 探活",
      status: "pass",
      detail: `HTTP ${status} · ${latencyMs ?? "—"}ms${viaTag}`,
    });
  }

  if (ok && !probe.error) {
    const parts: string[] = [host];
    if (pageMeta.title) parts.push(`「${pageMeta.title.slice(0, 48)}」`);
    if (body?.bytes) parts.push(`${Math.round(body.bytes / 1024)}KB`);
    if (latencyMs != null) parts.push(`${latencyMs}ms`);
    checks.unshift({
      id: "site",
      label: "站点概况",
      status: "pass",
      detail: parts.join(" · "),
    });
  }

  const flags = htmlRedFlags(preview);
  if (flags.length) {
    checks.push({
      id: "html",
      label: "页面内容",
      status: flags.some((f) => f.includes("404") || f.includes("5xx")) ? "fail" : "warn",
      detail: flags.join("；"),
    });
  } else if (preview || pageMeta.title) {
    const hints: string[] = [];
    if (pageMeta.statusOk) hints.push("检测到 STATUS OK");
    if (pageMeta.hasSearchInput) hints.push("含搜索框");
    if (pageMeta.description) hints.push(pageMeta.description.slice(0, 72));
    checks.push({
      id: "html",
      label: "页面内容",
      status: "pass",
      detail:
        pageMeta.title
          ? `${pageMeta.title.slice(0, 64)}${hints.length ? ` · ${hints.join(" · ")}` : ""}`
          : `已抓取 ${body?.bytes ?? preview?.length ?? 0} 字节 HTML`,
    });
  }

  if (opts.snapshotSkipped) {
    checks.push({
      id: "dom",
      label: "页面结构",
      status: "pass",
      detail: external
        ? `外链 ${host} · 已通过 HTML 抓取分析（浏览器内无法快照第三方 DOM）`
        : "已通过 HTML 预览分析",
    });
  } else if (opts.snapshot) {
    const nodes = (opts.snapshot.nodeCount as number) ?? (opts.snapshot.nodes as unknown[] | undefined)?.length ?? 0;
    const interactive = (opts.snapshot.nodes as { role?: string }[] | undefined)?.filter((n) =>
      ["button", "link", "textbox"].includes(n.role ?? ""),
    ).length;
    if (nodes < 3) {
      checks.push({
        id: "dom",
        label: "DOM 结构",
        status: "warn",
        detail: `可访问性节点 ${nodes} 个，页面可能为空`,
      });
    } else {
      checks.push({
        id: "dom",
        label: "DOM 结构",
        status: "pass",
        detail: `${nodes} 个节点 · 可交互约 ${interactive ?? "—"} 个`,
      });
    }
  }

  let knowledgeHits = 0;
  if (isProjectInspectUrl(opts.targetUrl)) {
    const kq = opts.knowledgeQuery ?? opts.targetUrl;
    try {
      const rag = retrieveRagEnhanced(kq, 3, { rewrite: true });
      knowledgeHits = rag.hits.length;
      if (knowledgeHits === 0) {
        checks.push({
          id: "docs",
          label: "项目资料库",
          status: "warn",
          detail: "未命中本项目文档，不影响外链可用性判断",
        });
      } else {
        const top = rag.hits[0]!;
        checks.push({
          id: "docs",
          label: "项目资料库",
          status: "pass",
          detail: `命中 ${knowledgeHits} 条 · ${top.projectName} · ${top.section}`,
        });
      }
    } catch {
      /* 资料库可选 */
    }
  }

  const core = checks.filter((c) => c.id === "http" || c.id === "html" || c.id === "site");
  const overall: InspectCheckStatus = core.some((c) => c.status === "fail")
    ? "fail"
    : core.some((c) => c.status === "warn")
      ? "warn"
      : "pass";

  const siteSummary =
    pageMeta.title && ok
      ? `${host} 返回正常，页面标题「${pageMeta.title}」`
      : ok
        ? `${host} 返回 HTTP ${status}`
        : `${host} 暂不可达`;

  return {
    targetUrl: opts.targetUrl,
    overall,
    checks,
    probe,
    snapshotSkipped: opts.snapshotSkipped,
    knowledgeHits,
    ms: 0,
    pageTitle: pageMeta.title ?? undefined,
    siteSummary,
    external,
  };
}

export function releaseReportMarkdown(report: ReleaseInspectReport): string {
  const icon = report.overall === "pass" ? "✅" : report.overall === "warn" ? "⚠️" : "❌";
  const host = hostnameOf(report.targetUrl);
  const lines = [
    `## ${icon} ${host} 发布前巡检`,
    "",
    report.siteSummary ?? `目标：${report.targetUrl}`,
    "",
    `**结论：** ${
      report.overall === "pass"
        ? "页面可访问，未发现明显错误信号"
        : report.overall === "warn"
          ? "页面可访问，但有性能或内容注意项"
          : "页面不可达或返回错误"
    }`,
    "",
    "| 检查项 | 状态 | 说明 |",
    "| --- | --- | --- |",
    ...report.checks.map((c) => {
      const s = c.status === "pass" ? "通过" : c.status === "warn" ? "注意" : "失败";
      return `| ${c.label} | ${s} | ${c.detail.replace(/\|/g, "\\|")} |`;
    }),
  ];
  if (report.knowledgeHits && report.knowledgeHits > 0 && isProjectInspectUrl(report.targetUrl)) {
    try {
      const rag = retrieveRagEnhanced(report.targetUrl, 2, { rewrite: true });
      if (rag.hits.length) {
        lines.push("", "### 项目资料库引用", "", formatRagContext(rag).slice(0, 800));
      }
    } catch {
      /* ignore */
    }
  }
  return lines.join("\n");
}

export async function runReleaseInspect(
  targetUrl: string,
  contextQuery: string,
  opts?: { snapshotRoot?: Element | null },
): Promise<ReleaseInspectReport> {
  const t0 = performance.now();
  let url = resolveInspectUrl(targetUrl) ?? targetUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/+/, "")}`;
  }
  try {
    const parsed = new URL(url);
    const h = parsed.hostname.replace(/^\[|\]$/g, "");
    const okHost =
      h.length > 0 &&
      (h.includes(".") || h === "localhost" || h === "127.0.0.1" || h === "::1");
    if (!okHost) throw new Error("hostname");
  } catch {
    throw new Error(`URL 无效：${targetUrl}（请使用完整地址，如 https://www.baidu.com）`);
  }

  const probeOut = await mcpServer.callTool("http_probe", { url, method: "GET" }, opts);
  const probe = (probeOut.content ?? {}) as Record<string, unknown>;

  const sameOrigin = isSameOriginUrl(url);
  let snapshot: Record<string, unknown> | null = null;
  let snapshotSkipped = !sameOrigin;

  if (sameOrigin) {
    const snapOut = await mcpServer.callTool("browser_snapshot", { compact: true }, opts);
    if (!snapOut.isError) {
      snapshot = (snapOut.content ?? {}) as Record<string, unknown>;
      snapshotSkipped = false;
    }
  }

  const report = composeReleaseReport({
    targetUrl: url,
    probe,
    snapshot,
    snapshotSkipped,
    knowledgeQuery: contextQuery || url,
  });
  report.ms = Math.max(1, Math.round(performance.now() - t0));
  return report;
}
