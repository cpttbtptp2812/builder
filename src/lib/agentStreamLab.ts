import type { PipelineStage } from "./streamPipeline";
import {
  createSSEParserTransform,
  createUIMapperTransform,
  supportsTextDecoderStream,
} from "./streamPipeline";
import { AGENT_SSE_LINES, type UIPart, parseUIMessageChunk } from "./streams";

function dataFromSseBlock(block: string): string | null {
  for (const line of block.split("\n")) {
    if (line.startsWith("data:")) return line.slice(5).trim();
  }
  return null;
}

export type TechLogEntry = {
  id: number;
  api: string;
  detail: string;
  kind: "stage" | "io" | "abort" | "resume" | "storage" | "render";
};

let logId = 0;
export function techLog(
  api: string,
  detail: string,
  kind: TechLogEntry["kind"] = "io",
): TechLogEntry {
  return { id: ++logId, api, detail, kind };
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      if (signal.aborted) reject(new DOMException("Aborted", "AbortError"));
      else resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** 可 Abort + 断点续传的 SSE 管道（Agent 技术演示） */
export async function runAgentStreamLab(opts: {
  startChunk: number;
  signal: AbortSignal;
  resume: boolean;
  knownTurnId?: string | null;
  onStage: (s: PipelineStage) => void;
  onChunk: (line: string, index: number) => void;
  onPart: (part: UIPart) => void;
  onLog: (entry: TechLogEntry) => void;
}): Promise<{ stoppedChunk: number; turnId: string | null; stage: PipelineStage }> {
  const { startChunk, signal, resume, knownTurnId, onStage, onChunk, onPart, onLog } = opts;
  let chunkIndex = startChunk;
  let turnId: string | null = knownTurnId ?? null;
  let stage: PipelineStage = "source";

  const push = (api: string, detail: string, kind: TechLogEntry["kind"] = "io") => {
    onLog(techLog(api, detail, kind));
  };

  if (resume) {
    push("useAutoResume", "检测到 localStorage.pendingTurnId，进入 Provider resume 模式", "resume");
    push("GET /api/chat/resume", `?turnId=${turnId ?? "…"} · 从 chunk #${startChunk} 续读 SSE`, "resume");
    push("node:http.request", "Provider 用 native http 读流（非 undici fetch，避免长 SSE 截断）", "resume");
    push("TransformStream", "sse-parse buffer 保留未完成帧 · 续传 chunk 拼进 buffer", "resume");
  } else {
    push("GraphQL Provider", "POST /graphql · subscription @stream SSE", "io");
    push("ReadableStream", "createSSEByteStream() · Uint8Array 字节源", "stage");
  }

  onStage("source");
  stage = "source";

  const encoder = new TextEncoder();
  const byteStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (chunkIndex >= AGENT_SSE_LINES.length) {
        controller.close();
        return;
      }
      await delay(520, signal);
      const line = AGENT_SSE_LINES[chunkIndex]!;
      onChunk(line, chunkIndex);
      const data = dataFromSseBlock(line);
      if (data) {
        const part = parseUIMessageChunk(data);
        if (part?.type === "start") turnId = part.turnId;
      }
      push("ReadableStream.enqueue", `chunk #${chunkIndex} · ${line.slice(0, 48)}…`, "io");
      controller.enqueue(encoder.encode(`${line}\n\n`));
      chunkIndex += 1;
    },
    cancel(reason) {
      push("ReadableStream.cancel", String(reason ?? "user abort"), "abort");
    },
  });

  try {
    onStage("decode");
    stage = "decode";
    push(
      supportsTextDecoderStream() ? "TextDecoderStream" : "TransformStream + TextDecoder",
      supportsTextDecoderStream()
        ? "byteStream.pipeThrough(new TextDecoderStream())"
        : "降级：手动 TransformStream 解码 UTF-8",
      "stage",
    );

    const textStream = supportsTextDecoderStream()
      ? byteStream.pipeThrough(new TextDecoderStream())
      : byteStream.pipeThrough(
          new TransformStream<Uint8Array, string>({
            transform(chunk, c) {
              c.enqueue(new TextDecoder().decode(chunk, { stream: true }));
            },
          }),
        );

    onStage("sse-parse");
    stage = "sse-parse";
    push("TransformStream", "createSSEParserTransform() · buffer 按 \\n\\n 切 SSE 帧", "stage");

    const sseStream = (textStream as ReadableStream<string>).pipeThrough(createSSEParserTransform());

    onStage("ui-map");
    stage = "ui-map";
    push("TransformStream", "createUIMapperTransform() · SSEEvent → AI SDK UIMessage part", "stage");

    const uiStream = sseStream.pipeThrough(createUIMapperTransform());

    push("ReadableStreamDefaultReader", "uiStream.getReader() · 开始 async read 循环", "io");
    const reader = uiStream.getReader();

    while (true) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      onPart(value);
      push("reader.read() → UIMessage", `{ type: "${value.type}" }`, "render");
      if (value.type === "done") break;
    }

    onStage("done");
    stage = "done";
    push("stream.close", "SSE [DONE] · reader.releaseLock()", "stage");
    return { stoppedChunk: chunkIndex, turnId, stage: "done" };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      push("AbortController.abort()", `signal.aborted=true · 管道在「${stage}」阶段被切断`, "abort");
      push("ReadableStreamDefaultReader", "read() 抛出 AbortError · 释放 reader lock", "abort");
      if (turnId) {
        push("localStorage.setItem", `'pendingTurnId' → '${turnId}'`, "storage");
      }
      push("UI 状态", `已收 ${chunkIndex} 个 chunk · 半条 assistant 消息保留在 React state`, "abort");
      onStage(stage);
      return { stoppedChunk: chunkIndex, turnId, stage };
    }
    throw e;
  }
}

export const PIPELINE_TECH: {
  id: PipelineStage;
  label: string;
  api: string;
}[] = [
  { id: "source", label: "字节源", api: "ReadableStream<Uint8Array>" },
  { id: "decode", label: "解码", api: "TextDecoderStream" },
  { id: "sse-parse", label: "SSE 解析", api: "TransformStream → SSEEvent" },
  { id: "ui-map", label: "UI 映射", api: "TransformStream → UIMessage" },
  { id: "done", label: "完成", api: "reader.releaseLock()" },
];
