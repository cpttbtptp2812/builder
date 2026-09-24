import type { GuestForce } from "./guestAgentRuntime";

export type SlashSpec = {
  id: GuestForce | "eval" | "sheet" | "inspect";
  token: string;
  label: string;
  hint: string;
  example: string;
};

export const SLASH_COMMANDS: SlashSpec[] = [
  {
    id: "inspect",
    token: "/inspect",
    label: "发布前巡检",
    hint: "任意 URL 探活 + 资料库对照",
    example: "/inspect https://example.com",
  },
  { id: "knowledge", token: "/search", label: "检索知识库", hint: "项目 / 难点 / 架构", example: "/search iMean 难点" },
  { id: "probe", token: "/probe", label: "HTTP 探活", hint: "本站或粘贴 URL", example: "/probe" },
  { id: "dom", token: "/dom", label: "当前页 DOM", hint: "可交互节点与 role", example: "/dom" },
  { id: "policy", token: "/policy", label: "制度检索", hint: "年假 / VPN / 加班", example: "/policy 满一年年假几天" },
  { id: "eval", token: "/eval", label: "对话内评测", hint: "policy · router · knowledge", example: "/eval knowledge" },
  { id: "sheet", token: "/sheet", label: "AI 表格引擎", hint: "对比 / 矩阵", example: "/sheet 年假制度" },
];

export function parseSlash(raw: string): {
  force?: GuestForce;
  evalKind?: "policy" | "router" | "knowledge";
  query: string;
  matched?: SlashSpec;
} {
  const trimmed = raw.trim();
  for (const spec of SLASH_COMMANDS) {
    if (trimmed === spec.token || trimmed.startsWith(`${spec.token} `) || trimmed.startsWith(`${spec.token}\n`)) {
      const rest = trimmed.slice(spec.token.length).trim();
      if (spec.id === "eval") {
        const lower = rest.toLowerCase();
        const kind = lower.startsWith("router")
          ? "router"
          : lower.startsWith("knowledge") || lower.startsWith("rag")
            ? "knowledge"
            : "policy";
        return { evalKind: kind, query: rest || kind, matched: spec };
      }
      if (spec.id === "sheet") {
        const topic = rest || "年假制度";
        return { query: `用表格对比${topic}`, matched: spec };
      }
      if (spec.id === "inspect") {
        let body = rest.trim();
        while (/^\/inspect\s*/i.test(body)) {
          body = body.replace(/^\/inspect\s*/i, "").trim();
        }
        return { query: body ? `/inspect ${body}` : "/inspect", matched: spec };
      }
      let query = rest;
      if (spec.id === "probe" && !query) {
        query = typeof location !== "undefined" ? location.origin : "";
      }
      if (spec.id === "dom" && !query) query = "分析当前页面的 DOM 结构";
      if (spec.id === "policy" && !query) query = "制度";
      if (spec.id === "knowledge" && !query) query = trimmed;
      return { force: spec.id, query, matched: spec };
    }
  }
  return { query: raw };
}

export function slashSuggestions(input: string): SlashSpec[] {
  const q = input.trim().toLowerCase();
  if (!q.startsWith("/")) return [];
  return SLASH_COMMANDS.filter((s) => s.token.startsWith(q.split(/\s/)[0] ?? q));
}
