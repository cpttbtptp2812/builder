/** __compose_steps__ — 通用汇总：把前面各步结果整理成可读回答（浏览器与服务端共用，纯函数） */

type Hit = { title?: string; chunkId?: string; excerpt?: string; text?: string; score?: number };

const LABELS: Record<string, string> = {
  probe: "站点探活",
  snapshot: "页面快照",
  search: "资料检索",
  policy: "制度检索",
};

function hitsOf(v: unknown): Hit[] | null {
  if (Array.isArray(v)) return v as Hit[];
  if (v && typeof v === "object" && Array.isArray((v as { hits?: unknown }).hits)) return (v as { hits: Hit[] }).hits;
  return null;
}

function describe(key: string, v: unknown): string[] {
  const label = LABELS[key] ?? key;
  if (v == null) return [`**${label}**：没有拿到结果。`];
  const o = v as Record<string, unknown>;

  if (typeof o.status === "number" || "latencyMs" in o) {
    const ok = o.ok !== false && Number(o.status) < 400;
    const where = o.url ? `\`${o.url}\` ` : "";
    const ms = o.latencyMs != null ? `，耗时 ${o.latencyMs}ms` : "";
    const err = !o.error
      ? ""
      : /failed to fetch|fetch failed/i.test(String(o.error)) && o.status == null
        ? "（浏览器不允许直接访问其他网站，需要后端代理；也可能是网址本身打不开）"
        : `（${o.error}）`;
    return [`**${label}**：${where}${ok ? "可以访问" : "访问异常"}，状态码 ${o.status ?? "—"}${ms}${err}。`];
  }

  if (Array.isArray(o.nodes) || typeof o.nodeCount === "number") {
    const nodes = (o.nodes as { role?: string }[] | undefined) ?? [];
    const count = (o.nodeCount as number | undefined) ?? nodes.length;
    const by = (role: string) => nodes.filter((n) => n.role === role).length;
    return [`**${label}**：共 ${count} 个可访问节点，按钮 ${by("button")} 个、链接 ${by("link")} 个、输入框 ${by("textbox")} 个。`];
  }

  const hits = hitsOf(v);
  if (hits) {
    if (!hits.length) return [`**${label}**：没有找到相关内容。`];
    const top = hits.slice(0, 3).map((h, i) => {
      const title = h.title ?? h.chunkId ?? `第 ${i + 1} 条`;
      const body = (h.excerpt ?? h.text ?? "").replace(/\s+/g, " ").slice(0, 120);
      return `${i + 1}. **${title}**${body ? ` — ${body}` : ""}`;
    });
    return [`**${label}**：找到 ${hits.length} 条，最相关的：`, ...top];
  }

  if (typeof o.markdown === "string") return [`**${label}**：`, o.markdown];
  return [`**${label}**：`, "```json", JSON.stringify(v, null, 2).slice(0, 800), "```"];
}

export function composeStepsMarkdown(args: Record<string, unknown>): string {
  const query = typeof args.query === "string" ? args.query : "";
  const lines: string[] = [];
  if (query) lines.push(`针对「${query}」，按步骤处理结果如下：`, "");
  for (const [key, value] of Object.entries(args)) {
    if (key === "query") continue;
    lines.push(...describe(key, value), "");
  }
  return lines.join("\n").trim();
}
