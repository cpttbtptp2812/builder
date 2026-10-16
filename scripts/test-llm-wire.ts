import { createThinkSplitter, deltaTextFromChunk, parseModelIds, probeVerdict, readStreamDelta, takeSseDataLines } from "../src/lib/llmWire.ts";

function fail(message: string): never {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

const openai = parseModelIds({ data: [{ id: "gpt-oss:120b" }, { id: "qwen3:8b" }, { id: "  " }] });
if (openai.join(",") !== "gpt-oss:120b,qwen3:8b") fail(`OpenAI 模型列表解析错误: ${openai.join(",")}`);

const ollama = parseModelIds({ models: [{ name: "qwen2.5:7b" }, { model: "llama3.1" }] });
if (!ollama.includes("qwen2.5:7b") || !ollama.includes("llama3.1")) fail("Ollama 模型列表解析错误");

const mixed = parseModelIds({ data: [{ id: "a" }], models: [{ name: "a" }, { id: "b" }] });
if (mixed.join(",") !== "a,b") fail("重复模型没有合并");
console.log("PASS  model list");

const first = takeSseDataLines('data: {"choices":[{"delta":{"content":"你"}}]}\n');
if (first.rest !== "" || first.data.length !== 1) fail("完整 SSE 行没有取出");
const partial = takeSseDataLines('data: {"choices":[{"delta":{"content":"好');
if (partial.data.length !== 0 || !partial.rest.startsWith("data:")) fail("半行应留在缓冲");
const done = takeSseDataLines("data: [DONE]\n");
if (done.data.length !== 0) fail("[DONE] 不应当成正文");
console.log("PASS  sse buffer");

const text = deltaTextFromChunk(first.data[0]!);
if (text !== "你") fail(`流式正文解析错误: ${text}`);
if (deltaTextFromChunk("not-json") !== "") fail("坏分片应忽略");
console.log("PASS  delta text");

const thought = readStreamDelta(
  JSON.stringify({ choices: [{ delta: { reasoning_content: "先看材料", content: "合计" } }] }),
);
if (thought.reasoning !== "先看材料" || thought.content !== "合计") fail("reasoning_content 没有分开");
const ollamaThought = readStreamDelta(
  JSON.stringify({ choices: [{ delta: { reasoning: "核对行数" } }] }),
);
if (ollamaThought.reasoning !== "核对行数") fail("reasoning 字段没有读到");
console.log("PASS  reasoning delta");

const split = createThinkSplitter();
const head = split("<thi");
if (head.length !== 0) fail("半个 think 标签不应进正文");
const mid = split("nk>先算\n</thi");
if (mid.map((p) => p.text).join("") !== "先算\n") fail("思考正文被截断");
const tail = split("nk>办结");
if (tail.length !== 1 || tail[0]?.kind !== "text" || tail[0].text !== "办结") fail("<think> 结束后的正文没有分开");
console.log("PASS  think tag");

const rejected = probeVerdict(true, { ok: false, detail: "HTTP 401 · ollama.com: Unauthorized" }, 200);
if (rejected.ok) fail("上游拒绝不能算连上");
if (!rejected.detail.includes("401")) fail("应保留上游拒绝原因");
const accepted = probeVerdict(true, { ok: true, detail: "已连通 gpt-oss:120b" }, 200);
if (!accepted.ok) fail("真实连通应通过");
console.log("PASS  probe verdict");
