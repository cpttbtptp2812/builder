/**
 * 文本向量 — 两档：
 * - semantic：浏览器内跑 bge-small-zh（量化 ONNX，约 24MB，首次下载后走浏览器缓存），换说法也认得出
 * - lexical：字符 n-gram 哈希向量，零下载，语义模型没加载好时兜底
 */

export type EmbedderKind = "semantic" | "lexical";

export type Embedder = {
  kind: EmbedderKind;
  label: string;
  embed: (texts: string[]) => Promise<Float32Array[]>;
};

const DIM = 2048;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i]! /= n;
  return v;
}

function lexicalVector(text: string): Float32Array {
  const v = new Float32Array(DIM);
  const t = text.toLowerCase().replace(/https?:\/\/\S+/g, " url ");
  for (const w of t.match(/[a-z][a-z0-9_-]+/g) ?? []) v[hash(`w:${w}`) % DIM] += 1.5;
  for (const run of t.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i + n <= run.length; i++) v[hash(`${n}:${run.slice(i, i + n)}`) % DIM] += n === 1 ? 0.3 : n;
    }
  }
  return normalize(v);
}

export const lexicalEmbedder: Embedder = {
  kind: "lexical",
  label: "字符模型",
  embed: async (texts) => texts.map(lexicalVector),
};

const MODEL = "Xenova/bge-small-zh-v1.5";
const HOSTS = ["https://huggingface.co/", "https://hf-mirror.com/"];

export type LoadProgress = { loaded: number; total: number };

let semantic: Promise<Embedder> | null = null;

export function loadSemanticEmbedder(onProgress?: (p: LoadProgress) => void): Promise<Embedder> {
  semantic ??= (async () => {
    const tf = await import("@huggingface/transformers");
    tf.env.allowLocalModels = false;
    let lastErr: unknown;
    for (const host of HOSTS) {
      try {
        tf.env.remoteHost = host;
        const files = new Map<string, LoadProgress>();
        const extractor = await tf.pipeline("feature-extraction", MODEL, {
          dtype: "q8",
          device: "wasm",
          progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
            if (p.status !== "progress" || !p.file) return;
            files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
            let loaded = 0;
            let total = 0;
            for (const f of files.values()) {
              loaded += f.loaded;
              total += f.total;
            }
            onProgress?.({ loaded, total });
          },
        });
        return {
          kind: "semantic" as const,
          label: "语义模型 bge-small-zh",
          embed: async (texts: string[]) => {
            const out: Float32Array[] = [];
            for (let i = 0; i < texts.length; i += 32) {
              const batch = texts.slice(i, i + 32);
              const t = await extractor(batch, { pooling: "cls", normalize: true });
              const [n, d] = t.dims as [number, number];
              const data = t.data as Float32Array;
              for (let k = 0; k < n; k++) out.push(data.slice(k * d, (k + 1) * d));
            }
            return out;
          },
        };
      } catch (e) {
        lastErr = e;
      }
    }
    semantic = null;
    throw lastErr instanceof Error ? lastErr : new Error("语义模型加载失败");
  })();
  return semantic;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}
