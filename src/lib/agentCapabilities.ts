/** 高级能力开关 — 保存后立即影响对话运行时 */

const KEY = "ownagent-capabilities-v1";

export type AgentCapabilities = {
  /** RAG Query Rewrite + 多 query 融合检索 */
  ragRewrite: boolean;
};

const DEFAULTS: AgentCapabilities = {
  ragRewrite: false,
};

export function loadAgentCapabilities(): AgentCapabilities {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AgentCapabilities>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAgentCapabilities(cap: AgentCapabilities) {
  localStorage.setItem(KEY, JSON.stringify(cap));
  dispatchAgentConfigUpdated();
}

export function dispatchAgentConfigUpdated() {
  window.dispatchEvent(new CustomEvent("ownagent:config-updated"));
}
