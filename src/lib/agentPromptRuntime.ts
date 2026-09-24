/** Prompt 运行时 — 模板选中态 + system 注入（对齐 JD Prompt 工程） */

import { loadAgentCapabilities } from "./agentCapabilities";
import { listPromptTemplates, type PromptTemplate } from "./promptTemplates";

const KEY = "ownagent-active-prompt-v1";

export function getActivePromptId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActivePromptId(id: string | null) {
  try {
    if (!id) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
    window.dispatchEvent(new CustomEvent("ownagent:prompt-profile"));
    window.dispatchEvent(new CustomEvent("ownagent:config-updated"));
  } catch {
    /* ignore */
  }
}

export function getActivePromptTemplate(): PromptTemplate | null {
  const id = getActivePromptId();
  if (!id) return null;
  return listPromptTemplates().find((t) => t.id === id) ?? null;
}

/** 注入 LLM / Guest 路径的 system 附加段 */
export function getActiveSystemAddon(): string {
  return getActivePromptTemplate()?.systemAddon?.trim() ?? "";
}

export function shouldUseRagRewrite(): boolean {
  if (loadAgentCapabilities().ragRewrite) return true;
  return getActivePromptId() === "rag-rewrite";
}

export function activePromptLabel(): string | null {
  return getActivePromptTemplate()?.name ?? null;
}
