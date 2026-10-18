/** 用户端把一句话放进已打开的办理输入框，不直接发送。 */

type DraftJob = { text: string };

let pending: DraftJob | null = null;

export function queueUserDeskDraft(query: string) {
  const text = query.trim();
  if (!text || typeof window === "undefined") return;
  pending = { text };
  window.dispatchEvent(new CustomEvent("ownagent:user-desk-run"));
}

export function takeUserDeskRun(): DraftJob | null {
  const job = pending;
  pending = null;
  return job;
}
