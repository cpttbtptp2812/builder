/** 运行时配置加载 — 默认 TS 配置 + /api/runtime/config 覆盖 */

import {
  DEFAULT_AGENT_RUNTIME_CONFIG,
  mergeRuntimeConfig,
  type AgentRuntimeConfig,
} from "../data/agentRuntimeConfig";
import { apiFetch } from "./apiClient";

let cached: AgentRuntimeConfig | null = null;
let loading: Promise<AgentRuntimeConfig> | null = null;

export function peekRuntimeConfig(): AgentRuntimeConfig {
  return cached ?? DEFAULT_AGENT_RUNTIME_CONFIG;
}

export async function getRuntimeConfig(force = false): Promise<AgentRuntimeConfig> {
  if (cached && !force) return cached;
  if (loading && !force) return loading;

  loading = (async () => {
    const remote = await apiFetch<Partial<AgentRuntimeConfig> & Record<string, unknown>>("/runtime/config");
    cached = mergeRuntimeConfig(DEFAULT_AGENT_RUNTIME_CONFIG, remote ?? undefined);
    return cached;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export function invalidateRuntimeConfig() {
  cached = null;
}
