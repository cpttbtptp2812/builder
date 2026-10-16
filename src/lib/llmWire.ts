/** 上游拒绝时服务端仍可能回 HTTP 200，必须以 body.ok 为准。 */
export function probeVerdict(
  httpOk: boolean,
  body: { ok?: boolean; detail?: string } | null,
  status: number,
): { ok: boolean; detail: string } {
  if (!httpOk || body?.ok === false) {
    return { ok: false, detail: body?.detail || `HTTP ${status}` };
  }
  return { ok: true, detail: body?.detail ?? "" };
}

/** OpenAI 兼容接口的模型列表与流式分片。不含 Key，可在浏览器与服务端共用。 */

export function parseModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as { data?: unknown; models?: unknown };
  const ids: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const id = value.trim();
    if (id) ids.push(id);
  };
  if (Array.isArray(obj.data)) {
    for (const row of obj.data) {
      if (typeof row === "string") push(row);
      else if (row && typeof row === "object") push((row as { id?: unknown }).id);
    }
  }
  if (Array.isArray(obj.models)) {
    for (const row of obj.models) {
      if (typeof row === "string") push(row);
      else if (row && typeof row === "object") {
        const item = row as { id?: unknown; name?: unknown; model?: unknown };
        push(item.id ?? item.name ?? item.model);
      }
    }
  }
  return [...new Set(ids)];
}

/** 从一段尚未收齐的 SSE 缓冲里取出完整 data 行。 */
export function takeSseDataLines(buffer: string): { data: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const data: string[] = [];
  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    data.push(payload);
  }
  return { data, rest };
}

export function deltaTextFromChunk(raw: string): string {
  return readStreamDelta(raw).content;
}

export type StreamDelta = { content: string; reasoning: string };

/** OpenAI / Ollama / DeepSeek：正文在 content，思考在 reasoning_content 或 reasoning。 */
export function readStreamDelta(raw: string): StreamDelta {
  try {
    const parsed = JSON.parse(raw) as {
      choices?: Array<{
        delta?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown };
        message?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown };
      }>;
    };
    const choice = parsed.choices?.[0];
    const delta = choice?.delta ?? choice?.message;
    return {
      content: asText(delta?.content),
      reasoning: asText(delta?.reasoning_content) || asText(delta?.reasoning),
    };
  } catch {
    return { content: "", reasoning: "" };
  }
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export type ThinkPiece = { kind: "reasoning" | "text"; text: string };

/** 有的模型把思考写在正文的 <think> 里。跨分片时把半个标签留到下一段。 */
export function createThinkSplitter(): (content: string) => ThinkPiece[] {
  let inThink = false;
  let carry = "";
  return (content: string) => {
    const pieces: ThinkPiece[] = [];
    let rest = carry + content;
    carry = "";
    const open = "<think>";
    const close = "</think>";
    while (rest) {
      const tag = inThink ? close : open;
      const at = rest.indexOf(tag);
      if (at < 0) {
        const partial = tagSuffix(rest, tag);
        const ready = partial ? rest.slice(0, -partial.length) : rest;
        if (ready) pieces.push({ kind: inThink ? "reasoning" : "text", text: ready });
        carry = partial;
        break;
      }
      if (at > 0) pieces.push({ kind: inThink ? "reasoning" : "text", text: rest.slice(0, at) });
      rest = rest.slice(at + tag.length);
      inThink = !inThink;
    }
    return pieces;
  };
}

function tagSuffix(text: string, tag: string): string {
  const max = Math.min(text.length, tag.length - 1);
  for (let n = max; n > 0; n -= 1) {
    if (tag.startsWith(text.slice(-n))) return text.slice(-n);
  }
  return "";
}
