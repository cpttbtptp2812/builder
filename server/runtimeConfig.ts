/** 服务端运行时配置 — 合并 TS 默认 + app_config */

import { dbAll } from "./db.ts";
import {
  DEFAULT_AGENT_RUNTIME_CONFIG,
  mergeRuntimeConfig,
  type AgentRuntimeConfig,
} from "../src/data/agentRuntimeConfig.ts";

const CONFIG_KEYS = [
  "plaza_match_threshold",
  "plaza_hint_threshold",
  "prefer_server_rag",
  "prefer_server_guest",
  "prefer_server_multi_agent",
  "prefer_server_eval",
  "router_eval_cases_json",
];

export function loadRuntimeConfig(): AgentRuntimeConfig {
  const rows = dbAll<{ key: string; value: string }>(
    `SELECT key, value FROM app_config WHERE key IN (${CONFIG_KEYS.map(() => "?").join(",")})`,
    CONFIG_KEYS,
  );
  const kv = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  let routerCases = DEFAULT_AGENT_RUNTIME_CONFIG.eval.routerCases;
  if (kv.router_eval_cases_json) {
    try {
      const parsed = JSON.parse(kv.router_eval_cases_json) as AgentRuntimeConfig["eval"]["routerCases"];
      if (Array.isArray(parsed) && parsed.length > 0) routerCases = parsed;
    } catch { /* keep default */ }
  }

  return mergeRuntimeConfig(DEFAULT_AGENT_RUNTIME_CONFIG, {
    features: {
      preferServerRag: kv.prefer_server_rag !== "false",
      preferServerGuest: kv.prefer_server_guest !== "false",
      preferServerMultiAgent: kv.prefer_server_multi_agent !== "false",
      preferServerEval: kv.prefer_server_eval !== "false",
    },
    plaza: {
      matchThreshold: Number(kv.plaza_match_threshold ?? DEFAULT_AGENT_RUNTIME_CONFIG.plaza.matchThreshold),
      hintThreshold: Number(kv.plaza_hint_threshold ?? DEFAULT_AGENT_RUNTIME_CONFIG.plaza.hintThreshold),
    },
    eval: { routerCases },
    plaza_match_threshold: kv.plaza_match_threshold,
    plaza_hint_threshold: kv.plaza_hint_threshold,
  });
}
