/** MCP 工具 → OpenAI function tools + 执行桥接 */

import { MCP_TOOLS } from "./mcpBridgeLab";
import { mcpServer } from "./mcpServer";

export type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export function mcpToolsToOpenAi(enabled?: string[]): OpenAiTool[] {
  const list = enabled?.length ? MCP_TOOLS.filter((t) => enabled.includes(t.name)) : MCP_TOOLS;
  return list.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: `${t.labelZh} — ${t.descriptionZh}`,
      parameters: {
        type: t.inputSchema.type,
        properties: t.inputSchema.properties,
        required: t.inputSchema.required ?? [],
      },
    },
  }));
}

export async function executeAgentTool(
  name: string,
  argsJson: string,
  ctx?: { snapshotRoot?: Element | null; enabledTools?: string[] },
): Promise<{ content: unknown; isError: boolean; ms: number }> {
  const t0 = performance.now();
  if (ctx?.enabledTools?.length && !ctx.enabledTools.includes(name)) {
    return { content: { error: `${name} is disabled` }, isError: true, ms: 0 };
  }
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    return {
      content: { error: "invalid tool arguments JSON" },
      isError: true,
      ms: Math.round(performance.now() - t0),
    };
  }

  if (name === "http_probe" && !args.url) {
    args.url =
      typeof window !== "undefined"
        ? `${window.location.origin}${import.meta.env.BASE_URL}index.html`
        : "/index.html";
    args.method = args.method ?? "HEAD";
  }

  const out = await mcpServer.callTool(name, args, ctx);
  return {
    content: out.content,
    isError: Boolean(out.isError),
    ms: Math.round(performance.now() - t0),
  };
}

export function buildAgentSystemPrompt(opts?: { memoryBlock?: string; enabledTools?: string[] }): string {
  const probeUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${import.meta.env.BASE_URL}index.html`
      : "/index.html";

  const tools = opts?.enabledTools?.length
    ? MCP_TOOLS.filter((t) => opts.enabledTools!.includes(t.name))
    : MCP_TOOLS;

  const toolLines = tools.map((t) => `- ${t.name}（${t.labelZh}）：${t.descriptionZh}`);

  return [
    "你是 OwnAgent，王旭个人作品站里真正能用的 AI Agent。",
    "对齐产品流水线：理解 → 编排 → 运行 → 能力。先想要不要调工具，再作答。",
    "用户会随便问，不要只认固定演示句。只用工具返回的事实作答，不要编造。",
    "",
    "可用 MCP 工具：",
    ...toolLines,
    "",
    "安全规则：",
    "- ticket_draft 只起草，不落地；ticket_commit 必须在用户已 HITL 允许之后。",
    "- policy_search 命中要带条款 ID；冲突时说明冲突，不要合成一句假制度。",
    "- mutate（开通 VPN 等）一律走工单，禁止假装已开通。",
    "",
    `本站入口 URL：${probeUrl}`,
    "发布前检查：先 http_probe，再 knowledge_search，必要时 browser_snapshot。",
    "回答简洁专业，中文为主。工具失败时说明原因并给建议。",
    opts?.memoryBlock ? `\n【工作集 / 记忆】\n${opts.memoryBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
