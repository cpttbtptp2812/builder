/** OwnAgent 多会话 — 本机 localStorage */

import type { AgentChatMessage } from "./agentRuntime";
import type { MultiAgentStep } from "./multiAgentRuntime";
import type { PipelineStage, WorkingSet } from "./workingSet";
import type { FlowJournalNode } from "./turnFlowJournal";
import type { TicketDraft } from "./policyDesk";
import type { FollowUpPrompt, InlineEvalView, PolicyTrustView, RouteScoreView } from "./chatFrontier";
import type { AnswerInsight } from "./answerInsight";
import type { ChatArtifact } from "./chatArtifacts";

export type OwnToolChip = {
  id: string;
  name: string;
  state: "loading" | "ok" | "error";
  ms?: number;
  preview?: string;
};

export type OwnChatMessage = {
  id: string;
  role: "user" | "assistant";
  createdAt?: number;
  content: string;
  reasoning?: string;
  mode?: "guest" | "llm" | "multi" | "eval" | "sheet";
  tools?: OwnToolChip[];
  ms?: number;
  pipeline?: PipelineStage[];
  flowJournal?: FlowJournalNode[];
  hitl?: TicketDraft;
  multiAgent?: MultiAgentStep[];
  workingHint?: string;
  workingSet?: WorkingSet;
  policyTrust?: PolicyTrustView;
  route?: RouteScoreView;
  inlineEval?: InlineEvalView;
  followUps?: FollowUpPrompt[] | string[];
  answerInsight?: AnswerInsight;
  artifacts?: ChatArtifact[];
};

export type OwnSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: OwnChatMessage[];
  history: AgentChatMessage[];
};

const KEY = "ownagent-sessions-v1";
const LEGACY = "ownagent-chat-v1";

function uid() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function titleFromMessages(messages: OwnChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content.trim() ?? "";
  if (!first) return "未命名会话";
  return first.replace(/\s+/g, " ").slice(0, 22);
}

export function emptySession(): OwnSession {
  const now = new Date().toISOString();
  return { id: uid(), title: "新会话", updatedAt: now, messages: [], history: [] };
}

type Store = { activeId: string; sessions: OwnSession[] };

function migrateLegacy(): Store | null {
  try {
    const raw = localStorage.getItem(LEGACY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { messages?: OwnChatMessage[]; history?: AgentChatMessage[] };
    const session: OwnSession = {
      id: uid(),
      title: titleFromMessages(parsed.messages ?? []),
      updatedAt: new Date().toISOString(),
      messages: parsed.messages ?? [],
      history: parsed.history ?? [],
    };
    localStorage.removeItem(LEGACY);
    return { activeId: session.id, sessions: [session] };
  } catch {
    return null;
  }
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed.sessions?.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  const migrated = migrateLegacy();
  if (migrated) {
    writeStore(migrated);
    return migrated;
  }
  const fresh = emptySession();
  return { activeId: fresh.id, sessions: [fresh] };
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      activeId: store.activeId,
      sessions: store.sessions.slice(0, 24).map((s) => ({
        ...s,
        messages: s.messages.slice(-40),
        history: s.history.slice(-40),
      })),
    }));
  } catch {
    /* quota */
  }
}

export function loadSessionStore(): Store {
  return readStore();
}

export function persistSessionStore(store: Store) {
  writeStore(store);
}

export function upsertActive(store: Store, patch: Partial<OwnSession>): Store {
  const sessions = store.sessions.map((s) => {
    if (s.id !== store.activeId) return s;
    const next = { ...s, ...patch, updatedAt: new Date().toISOString() };
    if (patch.messages) next.title = titleFromMessages(patch.messages) || s.title;
    return next;
  });
  return { ...store, sessions };
}

export function sessionToMarkdown(session: OwnSession): string {
  const lines = [`# ${session.title}`, "", `_OwnAgent · ${session.updatedAt}_`, ""];
  for (const m of session.messages) {
    lines.push(m.role === "user" ? `## 你` : `## OwnAgent`);
    if (m.tools?.length) {
      lines.push(m.tools.map((t) => `\`${t.name}\`${t.ms != null ? ` ${t.ms}ms` : ""}`).join(" · "));
    }
    lines.push(m.content, "");
  }
  return lines.join("\n");
}
