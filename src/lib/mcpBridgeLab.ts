/** MCP 工具 Schema 定义与参数校验 */

export type McpTool = {
  name: string;
  /** 中文短名 — 产品 UI */
  labelZh: string;
  description: string;
  descriptionZh: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
};

export const MCP_TOOLS: McpTool[] = [
  {
    name: "browser_navigate",
    labelZh: "页面导航",
    description: "Navigate preview iframe to a URL",
    descriptionZh: "把预览 iframe 导航到指定 URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "目标 URL" },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_snapshot",
    labelZh: "页面快照",
    description: "Capture accessibility tree from preview surface (real DOM walk)",
    descriptionZh: "抓取当前页可访问性树（真实 DOM 遍历）",
    inputSchema: {
      type: "object",
      properties: {
        compact: { type: "boolean", description: "省略深层节点" },
      },
    },
  },
  {
    name: "knowledge_search",
    labelZh: "知识检索",
    description: "Search portfolio knowledge corpus (PROJECT_DETAILS)",
    descriptionZh: "检索作品站知识库（项目 / 架构 / 难点）",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "检索问句" },
        topK: { type: "number", description: "最多命中数" },
      },
      required: ["query"],
    },
  },
  {
    name: "workflow_run",
    labelZh: "工作流入队",
    description: "Queue iMean replay workflow from scenarios.ts",
    descriptionZh: "将 iMean 回放工作流写入本机队列（预演）",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string" },
        mode: { type: "string", enum: ["local", "cloud", "remote"] },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "http_probe",
    labelZh: "站点探活",
    description: "Real fetch health check with latency (same-origin or CORS)",
    descriptionZh: "真实 fetch 探活，返回状态码与延迟",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string", enum: ["GET", "HEAD"] },
      },
      required: ["url"],
    },
  },
  {
    name: "policy_search",
    labelZh: "制度检索",
    description: "Search policy handbook; hits include clause id for citation lock",
    descriptionZh: "检索制度手册；命中含条款 ID，可做引用锁",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "制度问句" },
        topK: { type: "number", description: "最多条款数" },
      },
      required: ["query"],
    },
  },
  {
    name: "ticket_draft",
    labelZh: "起草工单",
    description: "Dry-run a mutate action as a ticket; does not provision anything",
    descriptionZh: "把变更动作预演成工单，不会真正开通任何资源",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "如 vpn.provision" },
        title: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "ticket_commit",
    labelZh: "提交工单",
    description: "Commit a drafted ticket; rejected unless HITL allow() already happened",
    descriptionZh: "提交已起草工单；未人工允许一律拒绝（HITL）",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string" },
      },
      required: ["ticketId"],
    },
  },
];

export function getMcpTool(name: string) {
  return MCP_TOOLS.find((t) => t.name === name);
}

export function validateParams(
  tool: McpTool,
  params: Record<string, unknown>,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const key of tool.inputSchema.required ?? []) {
    if (params[key] === undefined || params[key] === "") {
      errors.push(`缺少必填字段 "${key}"`);
    }
  }
  for (const [key, val] of Object.entries(params)) {
    const prop = tool.inputSchema.properties[key];
    if (!prop) continue;
    if (prop.enum && typeof val === "string" && !prop.enum.includes(val)) {
      errors.push(`"${key}" 取值不在枚举内`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
