import type { SSEEvent, UIPart } from "./streams";
import { parseUIMessageChunk } from "./streams";

export type PipelineStage = "source" | "decode" | "sse-parse" | "ui-map" | "done";

/** TransformStream：SSE 文本块 → 结构化事件 */
export function createSSEParserTransform() {
  let buffer = "";
  return new TransformStream<string, SSEEvent>({
    transform(chunk, controller) {
      buffer += chunk;
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
        controller.enqueue({ event, data: dataLines.join("\n") });
      }
    },
    flush(controller) {
      if (buffer.trim()) {
        controller.enqueue({ data: buffer.trim() });
      }
    },
  });
}

/** TransformStream：SSEEvent → UIPart */
export function createUIMapperTransform() {
  return new TransformStream<SSEEvent, UIPart>({
    transform(ev, controller) {
      const part = parseUIMessageChunk(ev.data);
      if (part) controller.enqueue(part);
    },
  });
}

export function supportsTextDecoderStream() {
  return typeof TextDecoderStream !== "undefined";
}

export async function runStreamPipeline(
  byteStream: ReadableStream<Uint8Array>,
  onStage: (stage: PipelineStage) => void,
  onPart: (part: UIPart) => void,
  onRaw: (line: string) => void,
) {
  onStage("source");

  let textStream: ReadableStream<string>;
  if (supportsTextDecoderStream()) {
    onStage("decode");
    textStream = byteStream.pipeThrough(new TextDecoderStream()) as ReadableStream<string>;
  } else {
    const decoder = new TextDecoder();
    textStream = byteStream.pipeThrough(
      new TransformStream<Uint8Array, string>({
        transform(chunk, controller) {
          controller.enqueue(decoder.decode(chunk, { stream: true }));
        },
        flush(controller) {
          controller.enqueue(decoder.decode());
        },
      }),
    );
  }

  onStage("sse-parse");
  const sseStream = textStream.pipeThrough(createSSEParserTransform());

  onStage("ui-map");
  const uiStream = sseStream.pipeThrough(createUIMapperTransform());

  const reader = uiStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onPart(value);
    onRaw(JSON.stringify(value));
  }
  onStage("done");
}
