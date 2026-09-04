/** 进程内 MCP Server — JSON-RPC 2.0 · 真实工具实现（非 mock 定时器） */

import { matchProject, PROJECT_DETAILS } from "../data/knowledge";
import { REPLAY_STEPS, SCENARIOS } from "../data/scenarios";
import { MCP_TOOLS, validateParams, type McpTool } from "./mcpBridgeLab";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type McpToolResult = {
  content: unknown;
  isError?: boolean;
};

export type McpTraceSpan = {
  method: string;
  label: string;
  ms: number;
  status: "ok" | "fail";
};

let rpcId = 0;

export function nextRpcId() {
  rpcId += 1;
  return rpcId;
}

export function searchKnowledgeCorpus(query: string, topK = 3) {
  const q = query.trim().toLowerCase();
  const direct = matchProject(query);

  const hits = PROJECT_DETAILS.map((p) => {
    const corpus = `${p.name} ${p.desc} ${p.narrative} ${p.stack.join(" ")} ${p.interviewTopics.join(" ")}`.toLowerCase();
    let score = 0;
    for (const word of q.split(/\s+/).filter((w) => w.length > 1)) {
      if (corpus.includes(word)) score += 0.12;
    }
    if (direct?.id === p.id) score += 0.45;
    if (p.name.toLowerCase().includes(q) || q.includes(p.id)) score += 0.35;
    return {
      title: p.name,
      projectId: p.id,
      score: Math.min(0.99, score),
      excerpt: p.desc,
      topics: p.interviewTopics.slice(0, 2),
    };
  })
    .filter((h) => h.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    query,
    topK,
    hits,
    source: "portfolio-knowledge.ts · PROJECT_DETAILS",
  };
}

function buildA11ySnapshot(root: Element, compact = false) {
  const nodes: { role: string; name: string; tag: string }[] = [];

  function walk(el: Element, depth: number) {
    if (compact && depth > 4) return;
    const role =
      el.getAttribute("role") ??
      ({ BUTTON: "button", A: "link", INPUT: "textbox", TEXTAREA: "textbox" } as Record<string, string>)[
        el.tagName
      ] ??
      "generic";
    const name =
      el.getAttribute("aria-label") ??
      (el as HTMLElement).innerText?.slice(0, 48).trim() ??
      el.tagName.toLowerCase();
    if (name || role !== "generic") {
      nodes.push({ role, name, tag: el.tagName.toLowerCase() });
    }
    for (const child of el.children) walk(child, depth + 1);
  }

  walk(root, 0);
  return {
    root: root.tagName.toLowerCase(),
    nodeCount: nodes.length,
    nodes: nodes.slice(0, compact ? 24 : 48),
    capturedAt: new Date().toISOString(),
  };
}

async function probeHttp(url: string, method: "GET" | "HEAD" = "GET") {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method, cache: "no-store" });
    const latencyMs = Math.round(performance.now() - t0);
    let body: unknown = null;
    if (method === "GET" && res.headers.get("content-type")?.includes("json")) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    } else if (method === "GET") {
      const text = await res.text();
      body = { bytes: text.length, preview: text.slice(0, 120) };
    }
    return {
      url,
      method,
      status: res.status,
      ok: res.ok,
      latencyMs,
      contentType: res.headers.get("content-type"),
      body,
    };
  } catch (err) {
    return {
      url,
      method,
      ok: false,
      latencyMs: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

export class McpInProcessServer {
  listTools(): McpTool[] {
    return MCP_TOOLS;
  }

  async callTool(name: string, args: Record<string, unknown>, ctx?: { snapshotRoot?: Element | null }) {
    const tool = MCP_TOOLS.find((t) => t.name === name);
    if (!tool) {
      return { content: { error: `Unknown tool: ${name}` }, isError: true } satisfies McpToolResult;
    }

    const valid = validateParams(tool, args);
    if (!valid.ok) {
      return { content: { errors: valid.errors }, isError: true } satisfies McpToolResult;
    }

    switch (name) {
      case "http_probe":
        return {
          content: await probeHttp(String(args.url), (args.method as "GET" | "HEAD") ?? "GET"),
        };

      case "knowledge_search":
        return {
          content: searchKnowledgeCorpus(String(args.query), Number(args.topK ?? 3)),
        };

      case "workflow_run": {
        const wf = SCENARIOS.find((s) => s.id === "execute") ?? SCENARIOS[0]!;
        return {
          content: {
            workflowId: args.workflowId,
            mode: args.mode ?? "local",
            scenario: wf.label,
            prompt: wf.prompt,
            steps: REPLAY_STEPS,
            status: "queued",
            runId: `run-${Date.now().toString(36)}`,
          },
        };
      }

      case "browser_navigate":
        return {
          content: {
            url: args.url,
            navigated: true,
            hint: "iframe 将加载该 URL（受 CORS / X-Frame-Options 限制）",
          },
        };

      case "browser_snapshot": {
        const root =
          ctx?.snapshotRoot ??
          document.querySelector(".agent-product-live") ??
          document.querySelector(".skill-runtime-lab") ??
          document.querySelector(".mcp-preview-surface");
        if (!root) {
          return { content: { error: "snapshot root not found" }, isError: true };
        }
        return {
          content: buildA11ySnapshot(root, Boolean(args.compact)),
        };
      }

      default:
        return { content: { error: "not implemented" }, isError: true };
    }
  }

  async handleRequest(req: JsonRpcRequest, ctx?: { snapshotRoot?: Element | null }) {
    const base = { jsonrpc: "2.0" as const, id: req.id };

    try {
      if (req.method === "tools/list") {
        return {
          ...base,
          result: { tools: this.listTools() },
        } satisfies JsonRpcResponse;
      }

      if (req.method === "tools/call") {
        const name = String(req.params?.name ?? "");
        const arguments_ = (req.params?.arguments ?? {}) as Record<string, unknown>;
        const out = await this.callTool(name, arguments_, ctx);
        if (out.isError) {
          return {
            ...base,
            result: { content: [{ type: "text", text: JSON.stringify(out.content) }], isError: true },
          } satisfies JsonRpcResponse;
        }
        return {
          ...base,
          result: {
            content: [{ type: "text", text: JSON.stringify(out.content, null, 2) }],
            structuredContent: out.content,
          },
        } satisfies JsonRpcResponse;
      }

      return {
        ...base,
        error: { code: -32601, message: `Method not found: ${req.method}` },
      } satisfies JsonRpcResponse;
    } catch (err) {
      return {
        ...base,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : "Server error",
        },
      } satisfies JsonRpcResponse;
    }
  }
}

export const mcpServer = new McpInProcessServer();

export const MCP_SCENARIOS = [
  {
    id: "probe",
    label: "发布前检查",
    query: "检查站点健康状态",
    tool: "http_probe",
    params: {
      url: typeof window !== "undefined" ? `${window.location.origin}${import.meta.env.BASE_URL}index.html` : "/index.html",
      method: "HEAD",
    },
  },
  {
    id: "knowledge",
    label: "知识库检索",
    query: "查 Agent SSE 流式实现",
    tool: "knowledge_search",
    params: { query: "Agent SSE 流式", topK: 3 },
  },
  {
    id: "workflow",
    label: "跑自动化流程",
    query: "执行改价上架流程",
    tool: "workflow_run",
    params: { workflowId: "price-update", mode: "cloud" },
  },
] as const;
