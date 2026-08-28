import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AGENTS, id, type ChatMsg, type Session } from "./data/demo";

type State = {
  user: string;
  sessions: Record<string, Session>;
  activeId: string | null;
  replayStep: number;
  replayActive: boolean;
  showcaseReady: boolean;
  pendingChatPrompt: string | null;
  pendingProjectIds: string[];
  initShowcase: () => void;
  setPendingChat: (prompt: string | null, projectIds?: string[]) => void;
  consumePendingChat: () => { prompt: string | null; projectIds: string[] };
  openChat: (agentId?: string) => string;
  switchAgent: (sid: string, agentId: string) => void;
  setActive: (id: string) => void;
  push: (sid: string, msg: ChatMsg) => void;
  patch: (sid: string, mid: string, p: Partial<ChatMsg>) => void;
  removeMsg: (sid: string, mid: string) => void;
  remove: (sid: string) => void;
  setReplayStep: (step: number) => void;
  setReplayActive: (active: boolean) => void;
  resetDemo: () => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      user: "访客演示",
      sessions: {},
      activeId: null,
      replayStep: -1,
      replayActive: false,
      showcaseReady: false,
      pendingChatPrompt: null,
      pendingProjectIds: [],

      setPendingChat: (prompt, projectIds = []) =>
        set({ pendingChatPrompt: prompt, pendingProjectIds: projectIds }),

      consumePendingChat: () => {
        const { pendingChatPrompt, pendingProjectIds } = get();
        set({ pendingChatPrompt: null, pendingProjectIds: [] });
        return { prompt: pendingChatPrompt, projectIds: pendingProjectIds };
      },

      initShowcase: () => {
        if (get().showcaseReady && get().activeId) return;
        const sid = get().openChat("master");
        set({ showcaseReady: true, activeId: sid });
      },

      openChat: (agentId = "master") => {
        const agent = AGENTS.find((a) => a.id === agentId) ?? AGENTS[0]!;
        const sid = id();
        const session: Session = {
          id: sid,
          title: "技术演示",
          agentId: agent.id,
          agentName: agent.name,
          updatedAt: Date.now(),
          messages: [
            {
              id: id(),
              kind: "assistant",
              text: "直接输入或点下方按钮 — 可聊全部 6 个项目、技术演示、架构难点，支持长对话",
              t: Date.now(),
            },
          ],
        };
        set((s) => ({
          sessions: { ...s.sessions, [sid]: session },
          activeId: sid,
        }));
        return sid;
      },

      switchAgent: (sid, agentId) => {
        const agent = AGENTS.find((a) => a.id === agentId) ?? AGENTS[0]!;
        set((s) => {
          const cur = s.sessions[sid];
          if (!cur) return s;
          return {
            sessions: {
              ...s.sessions,
              [sid]: {
                ...cur,
                agentId: agent.id,
                agentName: agent.name,
                messages: [
                  ...cur.messages,
                  {
                    id: id(),
                    kind: "assistant",
                    text: `已切换 · ${agent.name}：${agent.opening}`,
                    t: Date.now(),
                  },
                ],
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      setActive: (id) => set({ activeId: id }),

      push: (sid, msg) =>
        set((s) => {
          const cur = s.sessions[sid];
          if (!cur) return s;
          const title =
            msg.kind === "user" && cur.title === "技术演示"
              ? msg.text.slice(0, 28)
              : cur.title;
          return {
            sessions: {
              ...s.sessions,
              [sid]: {
                ...cur,
                title,
                messages: [...cur.messages, msg],
                updatedAt: Date.now(),
              },
            },
          };
        }),

      patch: (sid, mid, p) =>
        set((s) => {
          const cur = s.sessions[sid];
          if (!cur) return s;
          return {
            sessions: {
              ...s.sessions,
              [sid]: {
                ...cur,
                messages: cur.messages.map((m) =>
                  m.id === mid ? ({ ...m, ...p } as ChatMsg) : m,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeMsg: (sid, mid) =>
        set((s) => {
          const cur = s.sessions[sid];
          if (!cur) return s;
          return {
            sessions: {
              ...s.sessions,
              [sid]: {
                ...cur,
                messages: cur.messages.filter((m) => m.id !== mid),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      remove: (sid) =>
        set((s) => {
          const { [sid]: _, ...rest } = s.sessions;
          return {
            sessions: rest,
            activeId: s.activeId === sid ? null : s.activeId,
          };
        }),

      setReplayStep: (step) => set({ replayStep: step }),
      setReplayActive: (active) => set({ replayActive: active, replayStep: active ? 0 : -1 }),

      resetDemo: () =>
        set({
          sessions: {},
          activeId: null,
          showcaseReady: false,
          replayStep: -1,
          replayActive: false,
        }),
    }),
    {
      name: "ai-showcase-v2",
      partialize: (s) => ({
        sessions: s.sessions,
        activeId: s.activeId,
        showcaseReady: s.showcaseReady,
      }),
    },
  ),
);
