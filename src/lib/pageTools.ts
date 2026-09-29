/** 当前页面的工具面。浏览器有 WebMCP 时同步到 document.modelContext，没有时仍由本页执行。 */

export type PageToolSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
};

export type PageToolAnnotations = {
  readOnlyHint?: boolean;
  consequentialHint?: boolean;
};

export type PageToolDef = {
  name: string;
  label: string;
  description: string;
  inputSchema: PageToolSchema;
  annotations?: PageToolAnnotations;
  /** 给人看的一句，确认框和对话都用它 */
  explain: (args: Record<string, unknown>) => string;
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

export type PageToolResult = {
  content: unknown;
  isError: boolean;
  denied?: boolean;
};

type ConsentPending = {
  name: string;
  label: string;
  explain: string;
  args: Record<string, unknown>;
  resolve: (allow: boolean) => void;
};

type ModelContextLike = {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: PageToolSchema;
    annotations?: PageToolAnnotations;
    execute: (input: Record<string, unknown>) => Promise<unknown>;
  }) => void;
  unregisterTool?: (name: string) => void;
};

const tools = new Map<string, PageToolDef>();
let snapshot: PageToolDef[] = [];
const listeners = new Set<() => void>();
let consent: ConsentPending | null = null;
const consentListeners = new Set<() => void>();
const nativeNames = new Set<string>();

function modelContext(): ModelContextLike | null {
  if (typeof document === "undefined") return null;
  const ctx = (document as Document & { modelContext?: ModelContextLike }).modelContext;
  if (!ctx || typeof ctx.registerTool !== "function") return null;
  return ctx;
}

function emitTools() {
  snapshot = [...tools.values()];
  listeners.forEach((fn) => fn());
}

function emitConsent() {
  consentListeners.forEach((fn) => fn());
}

export function listPageTools(): PageToolDef[] {
  return snapshot;
}

export function subscribePageTools(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPageTool(name: string): PageToolDef | undefined {
  return tools.get(name);
}

export function currentConsent(): ConsentPending | null {
  return consent;
}

export function subscribeConsent(fn: () => void): () => void {
  consentListeners.add(fn);
  return () => consentListeners.delete(fn);
}

export function respondConsent(allow: boolean) {
  const pending = consent;
  consent = null;
  emitConsent();
  pending?.resolve(allow);
}

function askConsent(tool: PageToolDef, args: Record<string, unknown>): Promise<boolean> {
  return new Promise((resolve) => {
    if (consent) consent.resolve(false);
    consent = { name: tool.name, label: tool.label, explain: tool.explain(args), args, resolve };
    emitConsent();
  });
}

function missingRequired(tool: PageToolDef, args: Record<string, unknown>): string | null {
  for (const key of tool.inputSchema.required ?? []) {
    const value = args[key];
    if (value == null || value === "") return `缺少 ${key}`;
  }
  return null;
}

export function registerPageTool(tool: PageToolDef) {
  tools.set(tool.name, tool);
  emitTools();
  const ctx = modelContext();
  if (!ctx) return;
  try {
    ctx.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      execute: async (input) => {
        const out = await executePageTool(tool.name, input ?? {});
        if (out.denied) throw new Error("用户拒绝了这一步");
        if (out.isError) throw new Error(typeof out.content === "object" && out.content && "error" in out.content ? String((out.content as { error: unknown }).error) : "执行失败");
        return out.content;
      },
    });
    nativeNames.add(tool.name);
  } catch {
    /* 浏览器拒绝注册时，本页注册表仍然可用 */
  }
}

export function unregisterPageTool(name: string) {
  tools.delete(name);
  emitTools();
  const ctx = modelContext();
  if (ctx && nativeNames.has(name)) {
    try {
      ctx.unregisterTool?.(name);
    } catch {
      /* ignore */
    }
    nativeNames.delete(name);
  }
}

export async function executePageTool(name: string, args: Record<string, unknown>): Promise<PageToolResult> {
  const tool = tools.get(name);
  if (!tool) {
    return { content: { error: "这一页没有这个能力", tool: name }, isError: true };
  }
  const missing = missingRequired(tool, args);
  if (missing) return { content: { error: missing }, isError: true };
  if (tool.annotations?.consequentialHint) {
    const allow = await askConsent(tool, args);
    if (!allow) return { content: { error: "你拒绝了", denied: true }, isError: true, denied: true };
  }
  try {
    const content = await tool.execute(args);
    const failed =
      content != null &&
      typeof content === "object" &&
      "error" in content &&
      Boolean((content as { error?: unknown }).error);
    return { content, isError: failed };
  } catch (err) {
    return { content: { error: err instanceof Error ? err.message : "执行失败" }, isError: true };
  }
}
