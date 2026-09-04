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

export function mcpToolsToOpenAi(): OpenAiTool[] {
  return MCP_TOOLS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
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
  ctx?: { snapshotRoot?: Element | null },
): Promise<{ content: unknown; isError: boolean; ms: number }> {
  const t0 = performance.now();
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

export function buildAgentSystemPrompt(): string {
  const probeUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${import.meta.env.BASE_URL}index.html`
      : "/index.html";

  return [
    "你是 UniAgent，王旭个人作品站的内置 AI Agent。",
    "你可以调用 MCP 工具完成真实任务，不要编造工具返回的数据。",
    "",
    "可用工具：",
    "- http_probe：对 URL 发真实 fetch，返回 status / latency",
    "- knowledge_search：检索本站项目知识库（PROJECT_DETAILS）",
    "- browser_snapshot：抓取当前页面的 a11y DOM 树",
    "- workflow_run：将 iMean 自动化流程入队",
    "- browser_navigate：导航预览 iframe",
    "",
    `本站入口 URL：${probeUrl}`,
    "发布前检查类请求：先用 http_probe 探活，再 knowledge_search 查相关项目，必要时 browser_snapshot。",
    "回答简洁专业，中文为主。工具失败时说明原因并给建议。",
  ].join("\n");
}
