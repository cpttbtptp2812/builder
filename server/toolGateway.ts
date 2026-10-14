/** 工具调用的统一入口：权限、超时、耗时。业务结果仍由原来的工具函数产生。 */

import type { GatewayMeta, ToolCapability } from "../src/lib/platformProtocol.ts";

export type { GatewayMeta };

const NETWORK = new Set(["http_probe", "knowledge_search", "workflow_run", "browser_snapshot"]);
const MODEL = new Set(["__llm_product_brief__"]);

export function toolCapability(name: string, declared?: ToolCapability): ToolCapability {
  if (declared) return declared;
  if (MODEL.has(name) || name.includes("llm")) return "model";
  if (NETWORK.has(name)) return "network";
  return "read";
}

export function toolTimeoutMs(name: string, declared?: number): number {
  if (declared && declared > 0) return declared;
  if (MODEL.has(name) || name.includes("llm")) return 60_000;
  if (NETWORK.has(name)) return 15_000;
  return 30_000;
}

export async function invokeThroughGateway(opts: {
  name: string;
  grant: ToolCapability[];
  declaredCapability?: ToolCapability;
  timeoutMs?: number;
  run: () => Promise<{ content: unknown; isError?: boolean }>;
}): Promise<{ content: unknown; isError?: boolean; gateway: GatewayMeta }> {
  const capability = toolCapability(opts.name, opts.declaredCapability);
  const timeoutMs = toolTimeoutMs(opts.name, opts.timeoutMs);
  const started = performance.now();
  const base = { capability, timeoutMs, retries: 0 };
  if (!opts.grant.includes(capability)) {
    return {
      content: { error: `这一步需要「${capabilityLabel(capability)}」权限，当前办理没有授予，没有执行。`, code: "TOOL_DENIED" },
      isError: true,
      gateway: { ...base, allowed: false, ms: Math.round(performance.now() - started) },
    };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const out = await Promise.race([
      opts.run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return { ...out, gateway: { ...base, allowed: true, ms: Math.max(1, Math.round(performance.now() - started)) } };
  } catch (err) {
    const timedOut = err instanceof Error && err.message === "timeout";
    return {
      content: { error: timedOut ? `这一步超过 ${Math.round(timeoutMs / 1000)} 秒，已停下。` : err instanceof Error ? err.message : "工具调用失败", code: timedOut ? "TOOL_TIMEOUT" : "TOOL_FAILED" },
      isError: true,
      gateway: { ...base, allowed: true, ms: Math.round(performance.now() - started) },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function capabilityLabel(capability: ToolCapability): string {
  if (capability === "network") return "访问网络";
  if (capability === "model") return "调用模型";
  if (capability === "write") return "写入数据";
  return "读取材料";
}

export function productGrant(extra: ToolCapability[] = []): ToolCapability[] {
  return [...new Set<ToolCapability>(["read", "write", "model", ...extra])];
}
