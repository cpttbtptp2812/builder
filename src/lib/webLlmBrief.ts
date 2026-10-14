/** 浏览器里跑小模型写办结说明。只有用户点下载才拉取模型，数字对不上就丢掉说明。 */

import { briefMatchesLockedNumbers, extractLockedNumbers } from "./llmProductBrief";

export const WEBLLM_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export function webLlmSupport(): { ok: true } | { ok: false; reason: string } {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return { ok: false, reason: "这台浏览器没有 WebGPU，不能在本机跑模型。" };
  }
  return { ok: true };
}

type Engine = {
  chat: { completions: { create: (body: unknown) => Promise<{ choices?: { message?: { content?: string } }[]; usage?: { completion_tokens?: number } }> } };
  interruptGenerate?: () => void;
};

let enginePromise: Promise<Engine> | null = null;

export async function loadWebLlm(onProgress?: (text: string) => void): Promise<{ ok: true } | { ok: false; reason: string }> {
  const support = webLlmSupport();
  if (!support.ok) return support;
  try {
    if (!enginePromise) {
      enginePromise = (async () => {
        const spec = "@mlc-ai/web-llm";
        const webllm = (await import(/* @vite-ignore */ spec)) as {
          CreateMLCEngine: (model: string, opts: { initProgressCallback?: (report: { text: string }) => void }) => Promise<Engine>;
        };
        return webllm.CreateMLCEngine(WEBLLM_MODEL, {
          initProgressCallback: (report: { text: string }) => onProgress?.(report.text),
        });
      })();
    }
    await enginePromise;
    return { ok: true };
  } catch (err) {
    enginePromise = null;
    const reason = err instanceof Error ? err.message : "本地模型没有加载起来";
    return { ok: false, reason: /failed to fetch|cannot find|404/i.test(reason) ? "本地模型组件还没装进这个项目。装上 @mlc-ai/web-llm 后才能下载。" : reason };
  }
}

export async function writeBriefLocally(summary: string): Promise<{ ok: true; brief: string; tokensPerSec: number; ttftMs: number } | { ok: false; reason: string }> {
  const loaded = await loadWebLlm();
  if (!loaded.ok) return loaded;
  const locked = extractLockedNumbers(summary);
  const engine = await enginePromise!;
  const started = performance.now();
  let ttftMs = 0;
  try {
    const res = await engine.chat.completions.create({
      messages: [
        { role: "system", content: "你只把下面的计算结论写成人话。必须原样保留所有数字，不要新增数字，不要改结论。" },
        { role: "user", content: summary },
      ],
      temperature: 0,
      max_tokens: 280,
    });
    ttftMs = Math.round(performance.now() - started);
    const brief = res.choices?.[0]?.message?.content?.trim() ?? "";
    if (!brief) return { ok: false, reason: "本地模型没有写出说明。" };
    if (!briefMatchesLockedNumbers(brief, locked)) {
      return { ok: false, reason: "本机模型写的说明和计算结果对不上，已丢弃，仍用引擎结论。" };
    }
    const tokens = res.usage?.completion_tokens ?? 0;
    const seconds = Math.max(0.001, (performance.now() - started) / 1000);
    return { ok: true, brief, tokensPerSec: tokens ? Math.round((tokens / seconds) * 10) / 10 : 0, ttftMs };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "本地模型没有写完" };
  }
}
