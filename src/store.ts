import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AGENTS, id, type ChatMsg, type Session } from "./data/demo";

type State = {
  user: string | null;
  sessions: Record<string, Session>;
  activeId: string | null;
  login: (name: string) => void;
  logout: () => void;
  openChat: (agentId?: string) => string;
  setActive: (id: string) => void;
  push: (sid: string, msg: ChatMsg) => void;
  patch: (sid: string, mid: string, p: Partial<ChatMsg>) => void;
  remove: (sid: string) => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      sessions: {},
      activeId: null,

      login: (name) => set({ user: name }),
      logout: () => set({ user: null, sessions: {}, activeId: null }),

      openChat: (agentId = "master") => {
        const agent = AGENTS.find((a) => a.id === agentId) ?? AGENTS[0]!;
        const sid = id();
        const session: Session = {
          id: sid,
          title: "新对话",
          agentId: agent.id,
          agentName: agent.name,
          updatedAt: Date.now(),
          messages: [
            { id: id(), kind: "assistant", text: agent.opening, t: Date.now() },
          ],
        };
        set((s) => ({
          sessions: { ...s.sessions, [sid]: session },
          activeId: sid,
        }));
        return sid;
      },

      setActive: (id) => set({ activeId: id }),

      push: (sid, msg) =>
        set((s) => {
          const cur = s.sessions[sid];
          if (!cur) return s;
          const title =
            msg.kind === "user" && cur.title === "新对话"
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

      remove: (sid) =>
        set((s) => {
          const { [sid]: _, ...rest } = s.sessions;
          return {
            sessions: rest,
            activeId: s.activeId === sid ? null : s.activeId,
          };
        }),
    }),
    {
      name: "ai-showcase",
      partialize: (s) => ({
        user: s.user,
        sessions: s.sessions,
        activeId: s.activeId,
      }),
    },
  ),
);
