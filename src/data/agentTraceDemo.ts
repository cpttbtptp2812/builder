/** Agent Trace 演示数据 — 一轮对话的语义链路 */

export type TraceSpanKind =
  | "user"
  | "intent"
  | "plan"
  | "tool"
  | "stream"
  | "reply"
  | "error";

export type TraceSpan = {
  id: string;
  kind: TraceSpanKind;
  label: string;
  detail: string;
  ms: number;
  status: "ok" | "warn" | "err";
  payload?: Record<string, unknown>;
};

export type TraceSession = {
  id: string;
  title: string;
  query: string;
  totalMs: number;
  spans: TraceSpan[];
};

export const DEMO_TRACES: TraceSession[] = [
  {
    id: "health-check",
    title: "站点健康检查",
    query: "帮我检查一下 example.com 能不能正常打开",
    totalMs: 4280,
    spans: [
      {
        id: "s1",
        kind: "user",
        label: "用户输入",
        detail: "帮我检查一下 example.com 能不能正常打开",
        ms: 0,
        status: "ok",
      },
      {
        id: "s2",
        kind: "intent",
        label: "意图识别",
        detail: "site_health_check · 置信度 0.92",
        ms: 180,
        status: "ok",
        payload: { intent: "site_health_check", entities: { url: "example.com" } },
      },
      {
        id: "s3",
        kind: "plan",
        label: "任务规划",
        detail: "3 步：解析 URL → HTTP 探针 → 汇总报告",
        ms: 320,
        status: "ok",
        payload: { steps: ["normalize_url", "http_probe", "summarize"] },
      },
      {
        id: "s4",
        kind: "tool",
        label: "tool · http_probe",
        detail: "GET https://example.com → 200 · TTFB 142ms",
        ms: 890,
        status: "ok",
        payload: { status: 200, ttfb: 142, size: 1256 },
      },
      {
        id: "s5",
        kind: "tool",
        label: "tool · browser_snapshot",
        detail: "无 VNC · 跳过（未配置远程浏览器）",
        ms: 45,
        status: "warn",
        payload: { skipped: true, reason: "no_vnc_session" },
      },
      {
        id: "s6",
        kind: "stream",
        label: "流式生成",
        detail: "text-delta × 24 · 首 token 380ms",
        ms: 2100,
        status: "ok",
        payload: { firstTokenMs: 380, chunks: 24 },
      },
      {
        id: "s7",
        kind: "reply",
        label: "最终回复",
        detail: "站点可访问，HTTP 200，响应正常。",
        ms: 745,
        status: "ok",
      },
    ],
  },
  {
    id: "workflow-match",
    title: "工作流匹配",
    query: "把上周的报表导出来发邮件",
    totalMs: 6120,
    spans: [
      {
        id: "w1",
        kind: "user",
        label: "用户输入",
        detail: "把上周的报表导出来发邮件",
        ms: 0,
        status: "ok",
      },
      {
        id: "w2",
        kind: "intent",
        label: "意图识别",
        detail: "workflow_run · 置信度 0.88",
        ms: 210,
        status: "ok",
      },
      {
        id: "w3",
        kind: "plan",
        label: "工作流匹配",
        detail: "命中「周报导出 + 邮件发送」· score 0.91",
        ms: 540,
        status: "ok",
        payload: { workflowId: "weekly-report-mail", score: 0.91 },
      },
      {
        id: "w4",
        kind: "tool",
        label: "tool · workflow_enqueue",
        detail: "入队 5 步 · 等待用户确认",
        ms: 120,
        status: "ok",
      },
      {
        id: "w5",
        kind: "error",
        label: "用户取消",
        detail: "确认卡片 · 用户点击取消",
        ms: 0,
        status: "err",
        payload: { code: "USER_CANCELLED" },
      },
    ],
  },
];

export function getTrace(id: string) {
  return DEMO_TRACES.find((t) => t.id === id);
}
