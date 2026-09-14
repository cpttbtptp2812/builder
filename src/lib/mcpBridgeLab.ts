/** MCP 工具 Schema 定义与参数校验 */

export type McpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
};

export const MCP_TOOLS: McpTool[] = [
  {
    name: "browser_navigate",
    description: "Navigate preview iframe to a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Target URL" },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_snapshot",
    description: "Capture accessibility tree from preview surface (real DOM walk)",
    inputSchema: {
      type: "object",
      properties: {
        compact: { type: "boolean", description: "Omit deep nodes" },
      },
    },
  },
  {
    name: "knowledge_search",
    description: "Search portfolio knowledge corpus (PROJECT_DETAILS)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        topK: { type: "number", description: "Max hits" },
      },
      required: ["query"],
    },
  },
  {
    name: "workflow_run",
    description: "Queue iMean replay workflow from scenarios.ts",
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
    description: "Real fetch health check with latency (same-origin or CORS)",
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
    description: "Search policy handbook; hits include clause id for citation lock",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "制度问句" },
        topK: { type: "number", description: "Max clauses" },
      },
      required: ["query"],
    },
  },
  {
    name: "ticket_draft",
    description: "Dry-run a mutate action as a ticket; does not provision anything",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "vpn.provision 等" },
        title: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "ticket_commit",
    description: "Commit a drafted ticket; rejected unless HITL allow() already happened",
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
    if (!prop) {
      errors.push(`未知字段 "${key}"`);
      continue;
    }
    if (prop.type === "string" && typeof val !== "string") {
      errors.push(`"${key}" 应为 string`);
    }
    if (prop.type === "number" && typeof val !== "number") {
      errors.push(`"${key}" 应为 number`);
    }
    if (prop.type === "boolean" && typeof val !== "boolean") {
      errors.push(`"${key}" 应为 boolean`);
    }
    if (prop.enum && !prop.enum.includes(String(val))) {
      errors.push(`"${key}" 不在 enum [${prop.enum.join(", ")}]`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
