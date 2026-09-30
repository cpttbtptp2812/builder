/** 一次工具调用的帧：参数路径、环境、嵌套调用、有没有进入结论。 */

export type NestedCall = {
  tool: string;
  key: string;
  reads: string[];
};

export type CallFrame = {
  tool: string;
  continuation: "value" | "cut";
  reads: string[];
  determining: string[];
  dropped: string[];
  dead: string[];
  ambient: {
    origin: string;
    now: number;
    corpusEpoch?: number;
    sameOrigin: boolean;
  };
  nested: NestedCall[];
  comparableHash: string;
};

export type FrameTrace = {
  reads: Map<string, string>;
  foldReads: string[];
  dead: string[];
  nested: NestedCall[];
  ambient: CallFrame["ambient"];
};

const OVERALL_PATHS = new Set([
  "probe.ok",
  "probe.status",
  "probe.error",
  "probe.latencyMs",
  "probe.body.preview",
  "probe.body.statusOk",
  "probe.body.hasSearchInput",
]);

export function createFrameTrace(now: number, origin: string, sameOrigin: boolean): FrameTrace {
  return {
    reads: new Map(),
    foldReads: [],
    dead: [],
    nested: [],
    ambient: { origin, now, sameOrigin },
  };
}

export function membrane(base: string, value: unknown, trace: FrameTrace): unknown {
  if (value === null || typeof value !== "object") return value;
  const boxed = value as object & { __frame?: true };
  if (boxed.__frame) return value;
  return new Proxy(boxed, {
    get(target, prop, recv) {
      if (prop === "__frame") return true;
      if (typeof prop === "symbol") return Reflect.get(target, prop, recv);
      const raw = Reflect.get(target, prop, recv);
      if (typeof raw === "function") return raw;
      const path = base ? `${base}.${String(prop)}` : String(prop);
      const leaf = raw === null || raw === undefined || typeof raw !== "object";
      trace.reads.set(path, leaf ? String(raw) : "");
      if (!leaf) return membrane(path, raw, trace);
      return raw;
    },
  });
}

export function finishFrame(trace: FrameTrace, continuation: "value" | "cut"): CallFrame {
  const reads = [...trace.reads.keys()];
  const determining = [
    ...new Set([
      ...reads.filter((path) => OVERALL_PATHS.has(path)),
      ...trace.foldReads.filter((path) => /\.(http|html|site)\.status$/.test(path)),
    ]),
  ];
  const determiningSet = new Set(determining);
  const dropped = [...reads.filter((path) => !determiningSet.has(path)), ...trace.foldReads.filter((path) => !determiningSet.has(path))];
  const payload = determining
    .slice()
    .sort()
    .map((path) => `${path}=${trace.reads.get(path) ?? ""}`);
  let hash = 2166136261;
  const text = payload.join("|");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return {
    tool: "__compose_release_report__",
    continuation,
    reads,
    determining,
    dropped: [...new Set(dropped)],
    dead: trace.dead,
    ambient: trace.ambient,
    nested: trace.nested,
    comparableHash: (hash >>> 0).toString(16),
  };
}
