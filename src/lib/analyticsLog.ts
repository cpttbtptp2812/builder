/** 对话分析上报 — 供管理后台运营台 / 分析使用 */

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export async function logChatSession(input: {
  sessionId: string;
  query: string;
  answerPreview?: string;
  answerLength?: number;
  groundedness?: number;
  hitCount?: number;
  latencyMs?: number;
  mode?: string;
  plazaHit?: boolean;
  published?: boolean;
}) {
  try {
    await fetch(`${API}/api/analytics/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch { /* 离线不影响对话 */ }
}

export async function markQueryPublished(query: string) {
  try {
    await fetch(`${API}/api/analytics/published`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
  } catch { /* ignore */ }
}
