/** 被测对象适配 — 接口模板渲染、响应取值、SSE 解析、常见平台预设 */

import type { EvalTarget, HttpTargetConfig, InvokeResult, OpenAiTargetConfig } from "./types";

export type HttpPreset = {
  id: string;
  label: string;
  hint: string;
  http: HttpTargetConfig;
};

export const HTTP_PRESETS: HttpPreset[] = [
  {
    id: "openai-app",
    label: "OpenAI 兼容接口",
    hint: "自建服务 / FastGPT / One API 等，按 /chat/completions 格式收发",
    http: {
      url: "https://your-app.example.com/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer sk-xxx" },
      bodyTemplate: '{\n  "model": "default",\n  "stream": false,\n  "messages": [{ "role": "user", "content": "{{question}}" }]\n}',
      answerPath: "choices.0.message.content",
    },
  },
  {
    id: "dify",
    label: "Dify 应用",
    hint: "应用 → 访问 API，Key 以 app- 开头；引用取自检索命中",
    http: {
      url: "https://api.dify.ai/v1/chat-messages",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer app-xxx" },
      bodyTemplate: '{\n  "inputs": {},\n  "query": "{{question}}",\n  "response_mode": "blocking",\n  "user": "eval-bot"\n}',
      answerPath: "answer",
      citationsPath: "metadata.retriever_resources",
      citationField: "content",
    },
  },
  {
    id: "coze",
    label: "扣子 Coze 智能体",
    hint: "填 bot_id 和个人令牌（pat_ 开头），按流式读取回答",
    http: {
      url: "https://api.coze.cn/v3/chat",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer pat_xxx" },
      bodyTemplate:
        '{\n  "bot_id": "你的 bot_id",\n  "user_id": "eval-bot",\n  "stream": true,\n  "auto_save_history": false,\n  "additional_messages": [{ "role": "user", "content": "{{question}}", "content_type": "text" }]\n}',
      answerPath: "content",
      stream: true,
      streamMode: "delta",
      streamEvent: "conversation.message.delta",
    },
  },
  {
    id: "custom",
    label: "自定义接口",
    hint: "任意 JSON 接口：写好请求模板，再告诉我们答案在返回里的哪个字段",
    http: {
      url: "https://your-app.example.com/api/ask",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      bodyTemplate: '{\n  "question": "{{question}}"\n}',
      answerPath: "answer",
      citationsPath: "sources",
    },
  },
];

export const DEFAULT_OPENAI_TARGET: OpenAiTargetConfig = {
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: "",
  systemPrompt: "你是公司内部助手，回答要简洁准确；不确定时直接说不知道。",
  temperature: 0.3,
};

/** 把 {{question}} 填进模板；模板是 JSON 时按 JSON 字符串转义 */
export function renderTemplate(template: string, question: string): string {
  const quoted = JSON.stringify(question);
  const escaped = quoted.slice(1, -1);
  return template.replace(/\{\{\s*question\s*\}\}/g, (_m, offset: number) => {
    let inString = false;
    for (let i = 0; i < offset; i++) {
      if (template[i] === "\\") i++;
      else if (template[i] === '"') inString = !inString;
    }
    return inString ? escaped : quoted;
  });
}

/** 按路径取值：answer / data.items.0.text / choices[0].message.content */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) cur = cur[Number(p)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function extractCitations(obj: unknown, path?: string, field?: string): string[] {
  if (!path) return [];
  const v = getByPath(obj, path);
  if (!Array.isArray(v)) return v == null ? [] : [asText(v)];
  return v
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const picked = (field && rec[field]) ?? rec.content ?? rec.text ?? rec.title ?? rec.document_name;
        return asText(picked ?? item);
      }
      return asText(item);
    })
    .map((s) => s.slice(0, 600))
    .filter(Boolean);
}

/** 内置 Agent：从工具调用结果里的检索命中取引用 */
export function citationsFromTraces(traces: unknown): string[] {
  const out: string[] = [];
  for (const step of Array.isArray(traces) ? traces : []) {
    for (const tool of (step as { tools?: { result?: unknown }[] })?.tools ?? []) {
      const hits = (tool.result as { hits?: { title?: string; excerpt?: string }[] } | undefined)?.hits;
      for (const h of Array.isArray(hits) ? hits : []) {
        const s = [h.title, h.excerpt].filter(Boolean).join("：");
        if (s && !out.includes(s)) out.push(s.slice(0, 600));
      }
    }
  }
  return out;
}

type SseEvent = { event?: string; data: string };

export function parseSse(text: string): SseEvent[] {
  const out: SseEvent[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    let event: string | undefined;
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length) out.push({ event, data: data.join("\n") });
  }
  return out;
}

/** 从 SSE 文本里拼出答案与引用 */
export function readStreamAnswer(text: string, cfg: HttpTargetConfig): { answer: string; citations: string[] } {
  let answer = "";
  let citations: string[] = [];
  for (const ev of parseSse(text)) {
    if (ev.data === "[DONE]") continue;
    if (cfg.streamEvent && ev.event && ev.event !== cfg.streamEvent) {
      if (cfg.citationsPath) {
        try {
          const c = extractCitations(JSON.parse(ev.data), cfg.citationsPath, cfg.citationField);
          if (c.length) citations = c;
        } catch { /* 非 JSON 事件 */ }
      }
      continue;
    }
    let obj: unknown;
    try {
      obj = JSON.parse(ev.data);
    } catch {
      continue;
    }
    const piece = asText(getByPath(obj, cfg.answerPath));
    if (piece) answer = cfg.streamMode === "final" ? piece : answer + piece;
    const c = extractCitations(obj, cfg.citationsPath, cfg.citationField);
    if (c.length) citations = c;
  }
  return { answer, citations };
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function invokeHttp(
  cfg: HttpTargetConfig,
  question: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; rewriteUrl?: (url: string) => string } = {},
): Promise<InvokeResult> {
  const t0 = Date.now();
  const fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
  try {
    const url = (opts.rewriteUrl ?? ((u) => u))(renderTemplate(cfg.url, encodeURIComponent(question)));
    const init: RequestInit = { method: cfg.method, headers: cfg.headers, signal: ctrl.signal };
    if (cfg.method !== "GET") {
      const body = renderTemplate(cfg.bodyTemplate, question);
      try {
        JSON.parse(body);
      } catch {
        return { answer: "", citations: [], latencyMs: 0, error: "请求模板不是合法 JSON，检查引号和逗号" };
      }
      init.body = body;
    }
    const res = await fetchImpl(url, init);
    const text = await res.text();
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { answer: "", citations: [], latencyMs, error: `接口返回 HTTP ${res.status}：${text.slice(0, 160)}` };

    const looksSse = cfg.stream || /^(event|data):/m.test(text.slice(0, 200));
    if (looksSse) {
      const r = readStreamAnswer(text, cfg);
      if (!r.answer) return { ...r, latencyMs, error: `流式返回里没取到答案，检查答案字段「${cfg.answerPath}」` };
      return { ...r, latencyMs };
    }
    let obj: unknown;
    try {
      obj = JSON.parse(text);
    } catch {
      return { answer: text.slice(0, 4000), citations: [], latencyMs };
    }
    const answer = asText(getByPath(obj, cfg.answerPath));
    const citations = extractCitations(obj, cfg.citationsPath, cfg.citationField);
    if (!answer) {
      return { answer: "", citations, latencyMs, error: `返回里没有字段「${cfg.answerPath}」。返回内容：${text.slice(0, 160)}` };
    }
    return { answer, citations, latencyMs };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      answer: "",
      citations: [],
      latencyMs: Date.now() - t0,
      error: aborted ? "超时（60 秒没有返回）" : `调用失败：${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function openAiToHttp(cfg: OpenAiTargetConfig): HttpTargetConfig {
  const messages = [
    ...(cfg.systemPrompt.trim() ? [{ role: "system", content: cfg.systemPrompt }] : []),
    { role: "user", content: "__Q__" },
  ];
  const body = JSON.stringify({ model: cfg.model, temperature: cfg.temperature, stream: false, messages }, null, 2);
  return {
    url: `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : {}),
    },
    bodyTemplate: body.replace('"__Q__"', '"{{question}}"'),
    answerPath: "choices.0.message.content",
  };
}

/** 调用 OpenAI 兼容接口拿纯文本（裁判 / 出题用） */
export async function callChat(
  judge: { baseUrl: string; model: string; apiKey: string },
  messages: { role: string; content: string }[],
  opts: { fetchImpl?: FetchLike; rewriteUrl?: (url: string) => string; temperature?: number } = {},
): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const url = (opts.rewriteUrl ?? ((u) => u))(`${judge.baseUrl.replace(/\/$/, "")}/chat/completions`);
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(judge.apiKey ? { Authorization: `Bearer ${judge.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: judge.model, messages, temperature: opts.temperature ?? 0, stream: false }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`裁判模型 HTTP ${res.status}：${text.slice(0, 160)}`);
  const obj = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
  return obj.choices?.[0]?.message?.content ?? "";
}

export function targetSummary(t: EvalTarget): string {
  if (t.kind === "builtin") return t.builtin?.variant === "kb-only" ? "本系统 · 只查资料库" : "本系统 · 技能 + 资料库";
  if (t.kind === "openai") return `模型直连 · ${t.openai?.model ?? ""}`;
  const preset = HTTP_PRESETS.find((p) => p.id === t.preset);
  let host = "";
  try {
    host = new URL(t.http?.url ?? "").host;
  } catch { /* 地址未填好 */ }
  return `${preset?.label ?? "接口"}${host ? ` · ${host}` : ""}`;
}

const SECRET_HEADER = /authorization|api[-_]?key|token|secret/i;
export const MASK_PREFIX = "••••";

/** 列表返回时隐藏密钥，只露后 4 位 */
export function maskTarget(t: EvalTarget): EvalTarget {
  const out: EvalTarget = JSON.parse(JSON.stringify(t));
  if (out.http) {
    for (const k of Object.keys(out.http.headers)) {
      const v = out.http.headers[k] ?? "";
      if (SECRET_HEADER.test(k) && v.length > 8) out.http.headers[k] = `${MASK_PREFIX}${v.slice(-4)}`;
    }
  }
  if (out.openai?.apiKey && out.openai.apiKey.length > 4) out.openai.apiKey = `${MASK_PREFIX}${out.openai.apiKey.slice(-4)}`;
  return out;
}

/** 保存时：仍是掩码的字段沿用旧值 */
export function unmaskTarget(next: EvalTarget, prev: EvalTarget | undefined): EvalTarget {
  if (!prev) return next;
  const out: EvalTarget = JSON.parse(JSON.stringify(next));
  if (out.http && prev.http) {
    for (const k of Object.keys(out.http.headers)) {
      if (out.http.headers[k]?.startsWith(MASK_PREFIX)) out.http.headers[k] = prev.http.headers[k] ?? "";
    }
  }
  if (out.openai?.apiKey.startsWith(MASK_PREFIX) && prev.openai) out.openai.apiKey = prev.openai.apiKey;
  return out;
}
