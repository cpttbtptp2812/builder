/** 对话结构化工件 — 表格 / 指标 / 工具轨迹 */

export type ArtifactSurface = "sheet" | "trace" | "cite" | "eval";

export type ArtifactTable = {
  id: string;
  kind: "table";
  title: string;
  columns: string[];
  rows: string[][];
  insight?: string;
  /** 渲染表面：工具轨迹不做表格编辑 */
  surface?: ArtifactSurface;
};

export type ArtifactMetric = {
  id: string;
  kind: "metric";
  title: string;
  items: { label: string; value: string; tone?: "ok" | "warn" | "mute" }[];
};

export type ArtifactTrace = {
  id: string;
  kind: "trace";
  title: string;
  totalMs: number;
  steps: {
    name: string;
    label: string;
    state: "ok" | "error" | "loading";
    ms: number;
    preview: string;
  }[];
};

export type ChatArtifact = ArtifactTable | ArtifactMetric | ArtifactTrace;

/** 解析 GFM 管道表格 */
export function parseMarkdownTables(text: string): ArtifactTable[] {
  const lines = text.split("\n");
  const out: ArtifactTable[] = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const header = lines[i] ?? "";
    const sep = lines[i + 1] ?? "";
    if (
      header.includes("|") &&
      /^\s*\|?[\s-:|]+\|?\s*$/.test(sep) &&
      sep.includes("-")
    ) {
      const columns = splitRow(header);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? "").includes("|")) {
        rows.push(splitRow(lines[i]!));
        i += 1;
      }
      if (columns.length && rows.length) {
        n += 1;
        out.push({
          id: `md-table-${n}`,
          kind: "table",
          title: `结构化表 ${n}`,
          columns,
          rows,
          insight: `自动识别 ${rows.length} 行 × ${columns.length} 列`,
          surface: "sheet",
        });
      }
      continue;
    }
    i += 1;
  }
  return out;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function stripMarkdownTables(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines[i] ?? "";
    const sep = lines[i + 1] ?? "";
    if (
      header.includes("|") &&
      /^\s*\|?[\s-:|]+\|?\s*$/.test(sep) &&
      sep.includes("-")
    ) {
      i += 2;
      while (i < lines.length && (lines[i] ?? "").includes("|")) i += 1;
      continue;
    }
    kept.push(lines[i]!);
    i += 1;
  }
  return kept.join("\n").trim();
}

const TOOL_LABEL: Record<string, string> = {
  knowledge_search: "知识检索",
  http_probe: "站点探活",
  browser_snapshot: "页面快照",
  browser_navigate: "页面导航",
  policy_search: "制度检索",
  ticket_draft: "起草工单",
  ticket_commit: "提交工单",
  workflow_run: "工作流入队",
};

/** 从评测 / 制度 / 工具结果合成工件 */
export function buildTurnArtifacts(opts: {
  content: string;
  inlineEval?: {
    kind: string;
    accuracy: number;
    pass: number;
    total: number;
    rows: { id: string; query: string; pass: boolean; detail: string }[];
  };
  policyTrust?: {
    outcome: string;
    citations: { id: string; text: string; status: string; value?: string }[];
  };
  tools?: { name: string; preview?: string; ms?: number; state: string }[];
  ms?: number;
}): ChatArtifact[] {
  const arts: ChatArtifact[] = [];

  for (const t of parseMarkdownTables(opts.content)) arts.push(t);

  if (opts.inlineEval) {
    arts.push({
      id: "eval-table",
      kind: "table",
      title: opts.inlineEval.kind === "policy" ? "制度评测矩阵" : "路由评测矩阵",
      columns: ["用例", "问句", "结果", "期望 → 预测"],
      rows: opts.inlineEval.rows.map((r) => [
        r.id,
        r.query,
        r.pass ? "PASS" : "FAIL",
        r.detail,
      ]),
      insight: `准确率 ${opts.inlineEval.accuracy}% · ${opts.inlineEval.pass}/${opts.inlineEval.total}`,
      surface: "eval",
    });
    arts.push({
      id: "eval-metric",
      kind: "metric",
      title: "评测仪表",
      items: [
        { label: "准确率", value: `${opts.inlineEval.accuracy}%`, tone: opts.inlineEval.accuracy >= 80 ? "ok" : "warn" },
        { label: "通过", value: `${opts.inlineEval.pass}/${opts.inlineEval.total}`, tone: "ok" },
        { label: "类型", value: opts.inlineEval.kind, tone: "mute" },
      ],
    });
  }

  if (opts.policyTrust?.citations?.length) {
    arts.push({
      id: "cite-table",
      kind: "table",
      title: opts.policyTrust.outcome === "POLICY_CONFLICT" ? "冲突条款对照" : "出处锁条款表",
      columns: ["条款 ID", "状态", "取值", "原文"],
      rows: opts.policyTrust.citations.map((c) => [
        c.id,
        c.status === "abolished" ? "废止" : "现行",
        c.value ?? "—",
        c.text,
      ]),
      insight:
        opts.policyTrust.outcome === "POLICY_CONFLICT"
          ? "冲突熔断：并列展示，禁止合成一句"
          : "出处锁：答案只能引用表内条款",
      surface: "cite",
    });
  }

  if (opts.tools?.length) {
    arts.push({
      id: "tool-trace",
      kind: "trace",
      title: "工具因果轨",
      totalMs: opts.ms ?? opts.tools.reduce((s, t) => s + (t.ms ?? 0), 0),
      steps: opts.tools.map((t) => ({
        name: t.name,
        label: TOOL_LABEL[t.name] ?? t.name,
        state: t.state === "error" ? "error" : t.state === "loading" ? "loading" : "ok",
        ms: t.ms ?? 0,
        preview: t.preview ?? "—",
      })),
    });
  }

  return arts;
}

/** 演示用：AI 表格分析问句 → 合成对比表 */
export function synthesizeCompareTable(query: string): { markdown: string; artifact: ArtifactTable } | null {
  if (!/对比|表格|表格式|矩阵|sheet|table/i.test(query)) return null;
  if (/年假|休假|制度/.test(query)) {
    const artifact: ArtifactTable = {
      id: "ai-leave-compare",
      kind: "table",
      title: "年假制度对照（AI 结构化）",
      columns: ["条件", "现行天数", "废止条文", "能力信封", "可否直接回答"],
      rows: [
        ["司龄 ≥ 1 年", "10 天", "5 天（已废止）", "read", "是 · 仅现行"],
        ["司龄 ≥ 5 年", "15 天", "—", "read", "是"],
        ["开通 VPN", "—", "—", "mutate", "否 · 须 HITL"],
        ["上市时间", "—", "—", "abstain", "否 · 拒答"],
      ],
      insight: "AI 表格引擎：把制度知识压成可审计矩阵，而非散文",
      surface: "sheet",
    };
    const markdown = [
      "已用 **AI 表格引擎** 把制度压成对照矩阵。",
      "答案不再是散文，而是可排序、可审计的结构化工件（见下方）。",
    ].join("\n\n");
    return { markdown, artifact };
  }
  if (/工具|mcp|探活|http/.test(query) || /对比.*工具|工具.*对比/.test(query)) {
    const artifact: ArtifactTable = {
      id: "ai-tool-matrix",
      kind: "table",
      title: "MCP 能力矩阵",
      columns: ["工具", "层", "副作用", "客户价值"],
      rows: [
        ["http_probe", "能力", "只读", "真实延迟与状态码"],
        ["knowledge_search", "能力", "只读", "项目知识带 chunkId"],
        ["policy_search", "能力", "只读", "出处锁条款"],
        ["ticket_draft", "能力", "预演", "mutate 不落地"],
        ["ticket_commit", "能力", "受 HITL 门控", "人工允许后才提交"],
      ],
      insight: "工具不是列表，是可审计的副作用矩阵",
      surface: "sheet",
    };
    return {
      markdown: "MCP 能力已结构化为副作用矩阵（见工件）。",
      artifact,
    };
  }
  return null;
}
