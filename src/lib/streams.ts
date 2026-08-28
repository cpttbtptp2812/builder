/** Web Streams — SSE 字节流生成与解析 */

export type SSEEvent = { event?: string; data: string };

export function createSSEByteStream(
  lines: string[],
  delayMs = 380,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= lines.length) {
        controller.close();
        return;
      }
      await new Promise((r) => window.setTimeout(r, delayMs));
      controller.enqueue(encoder.encode(`${lines[i]}\n\n`));
      i += 1;
    },
  });
}

export async function readSSEStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (ev: SSEEvent) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      let event: string | undefined;
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      onEvent({ event, data: dataLines.join("\n") });
    }
  }
}

export type UIPart =
  | { type: "start"; turnId: string }
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }
  | { type: "tool-call"; name: string }
  | { type: "tool-result"; hits: number }
  | { type: "done" };

export function parseUIMessageChunk(data: string): UIPart | null {
  if (data === "[DONE]") return { type: "done" };
  try {
    const o = JSON.parse(data) as Record<string, unknown>;
    if (o.type === "start") return { type: "start", turnId: String(o.turnId) };
    if (o.type === "reasoning-delta") return { type: "reasoning", text: String(o.text) };
    if (o.type === "text-delta") return { type: "text", text: String(o.text) };
    if (o.type === "tool-call") return { type: "tool-call", name: String(o.name) };
    if (o.type === "tool-result") return { type: "tool-result", hits: Number(o.hits) };
  } catch {
    /* ignore */
  }
  return null;
}

export const AGENT_SSE_LINES = [
  'event: message\ndata: {"type":"start","turnId":"t-8f2a"}',
  'data: {"type":"reasoning-delta","text":"解析发布前检查意图…"}',
  'data: {"type":"tool-call","name":"HTTP Probe","id":"tc-1"}',
  'data: {"type":"tool-result","toolCallId":"tc-1","hits":200}',
  'data: {"type":"tool-call","name":"VNC Snapshot","id":"tc-2"}',
  'data: {"type":"tool-result","toolCallId":"tc-2","hits":1}',
  'data: {"type":"text-delta","text":"检查通过"}',
  'event: done\ndata: [DONE]',
];
