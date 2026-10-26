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
  {
    name: "dataset_validate",
    labelZh: "数据材料合规性校验",
    description: "Validate uploaded dataset schema, null rate, and security integrity before processing",
    descriptionZh: "校验上传数据源表头字段完整性、空值率与防注入特征",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: { type: "string", description: "数据集唯一凭证 ID" },
        requiredColumns: { type: "string", description: "必填字段列表（逗号分隔）" },
        strictNullCheck: { type: "boolean", description: "是否开启零容忍空值拦截" },
      },
      required: ["datasetId"],
    },
  },
  {
    name: "ledger_reconcile",
    labelZh: "业务金额精确对账聚合",
    description: "Perform deterministic floating-point financial reconciliation to avoid LLM hallucination",
    descriptionZh: "基于双精度确定性算法进行财务台账汇总聚合，彻底杜绝大模型浮点数计算幻觉",
    inputSchema: {
      type: "object",
      properties: {
        aggregationKey: { type: "string", description: "分组字段（如 department / category）" },
        sumField: { type: "string", description: "核算金额字段（如 amount / tax_inclusive）" },
        policyThreshold: { type: "number", description: "审批告警阈值上限（元）" },
      },
      required: ["aggregationKey", "sumField"],
    },
  },
  {
    name: "financial_settle_commit",
    labelZh: "总账落库登记 (双阶段安全写入)",
    description: "Execute 2-phase commit to official financial database after HITL signature verification",
    descriptionZh: "在人工审批签名授权后，向底层核心财务数据库提交最终落库事务",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string", description: "人在回路审批工单流水号" },
        operatorSign: { type: "string", description: "审批操作员数字签名 Hash" },
        idempotencyKey: { type: "string", description: "防重复重放幂等键" },
      },
      required: ["ticketId", "idempotencyKey"],
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

/** 模拟/沙箱执行 MCP Tool 调用，返回标准 JSON-RPC 2.0 报文 */
export async function executeSandboxToolCall(
  toolName: string,
  args: Record<string, unknown>,
): Promise<{
  rpcResponse: {
    jsonrpc: "2.0";
    id: string;
    result?: Record<string, unknown>;
    error?: { code: number; message: string; data?: unknown };
  };
  durationMs: number;
  status: "success" | "error";
}> {
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 120 + Math.floor(Math.random() * 80)));
  const tool = getMcpTool(toolName);
  const rpcId = `req_${Date.now().toString(36)}`;

  if (!tool) {
    return {
      rpcResponse: {
        jsonrpc: "2.0",
        id: rpcId,
        error: { code: -32601, message: `Tool "${toolName}" not found in MCP registry` },
      },
      durationMs: Math.round(performance.now() - t0),
      status: "error",
    };
  }

  const val = validateParams(tool, args);
  if (!val.ok) {
    return {
      rpcResponse: {
        jsonrpc: "2.0",
        id: rpcId,
        error: {
          code: -32602,
          message: "Invalid params for MCP tool",
          data: { errors: val.errors },
        },
      },
      durationMs: Math.round(performance.now() - t0),
      status: "error",
    };
  }

  // 针对不同工具生成确定性返回
  let data: Record<string, unknown> = {};
  if (toolName === "dataset_validate") {
    data = {
      valid: true,
      rowCount: 8,
      detectedColumns: ["id", "dept", "expense_type", "amount", "tax_inclusive", "receipt_hash"],
      nullRate: 0.0,
      formatCompliance: "100%",
      checksumVerified: true,
    };
  } else if (toolName === "ledger_reconcile") {
    const key = String(args.aggregationKey || "department");
    data = {
      reconciliationStatus: "passed",
      algorithm: "IEEE-754 Precision Float Reconciler",
      aggregatedTotal: 8090.0,
      taxTotal: 485.4,
      netTotal: 7604.6,
      itemCount: 8,
      anomalyCount: 0,
      breakdown: {
        出纳: 4200.0,
        市场部: 2390.0,
        技术部: 1500.0,
      },
      policyThresholdAlert: Number(args.policyThreshold || 10000) < 8090 ? "TRIGGERED" : "NORMAL",
    };
  } else if (toolName === "financial_settle_commit") {
    data = {
      commitPhase: "Phase-2-Applied",
      settlementTxId: `tx_${Date.now().toString(36)}_fin`,
      ledgerBlockHeight: 492019,
      settledAmount: 8090.0,
      auditTimestamp: new Date().toISOString(),
      idempotencyLocked: true,
    };
  } else if (toolName === "http_probe") {
    data = {
      probeUrl: String(args.url || "https://api.internal.corp/health"),
      status: 200,
      latencyMs: 38,
      healthy: true,
      server: "nginx/1.24.0",
    };
  } else if (toolName === "knowledge_search") {
    data = {
      query: String(args.query || ""),
      matchedChunks: 3,
      topHit: {
        title: "财务报销审批合规基线 v2026",
        similarity: 0.942,
        excerpt: "单笔超过 5000 元需经由二级审批，全部总账落库前须核对电子发票防伪查验码...",
      },
    };
  } else {
    data = {
      message: `Tool "${toolName}" executed in sandbox`,
      timestamp: Date.now(),
      args,
    };
  }

  return {
    rpcResponse: {
      jsonrpc: "2.0",
      id: rpcId,
      result: {
        status: 200,
        data,
      },
    },
    durationMs: Math.round(performance.now() - t0),
    status: "success",
  };
}

