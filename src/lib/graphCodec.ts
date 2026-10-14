/**
 * 引擎状态检查点编码：JSON 不能装 Map / Set / 共享引用 / NaN，直接 JSON.stringify 会让分叉后的引擎拿到“长得像但不是同一个”的状态。
 * 这里把对象图拍平成节点表：每个对象只出现一次，其他位置用编号引用，解码时按编号还原同一引用。
 */

type Enc = number | string | boolean | null | { "#": "r"; i: number } | { "#": "u" } | { "#": "n"; v: string } | { "#": "b"; v: string };
type Node =
  | { t: "a"; v: Enc[] }
  | { t: "o"; v: Record<string, Enc> }
  | { t: "m"; v: [Enc, Enc][] }
  | { t: "s"; v: Enc[] };

export type EncodedGraph = { v: 1; root: Enc; nodes: Node[] };

export function encodeGraph(root: unknown): EncodedGraph {
  const ids = new Map<object, number>();
  const nodes: (Node | null)[] = [];
  const enc = (value: unknown): Enc => {
    if (value === null) return null;
    if (value === undefined) return { "#": "u" };
    switch (typeof value) {
      case "number":
        if (Object.is(value, -0)) return { "#": "n", v: "-0" };
        return Number.isFinite(value) ? value : { "#": "n", v: String(value) };
      case "string":
      case "boolean":
        return value;
      case "bigint":
        return { "#": "b", v: value.toString() };
      case "function":
      case "symbol":
        throw new TypeError(`检查点里不能有 ${typeof value}`);
    }
    const obj = value as object;
    const seen = ids.get(obj);
    if (seen !== undefined) return { "#": "r", i: seen };
    const id = nodes.length;
    ids.set(obj, id);
    nodes.push(null);
    if (Array.isArray(obj)) nodes[id] = { t: "a", v: obj.map(enc) };
    else if (obj instanceof Map) nodes[id] = { t: "m", v: [...obj].map(([k, v]) => [enc(k), enc(v)] as [Enc, Enc]) };
    else if (obj instanceof Set) nodes[id] = { t: "s", v: [...obj].map(enc) };
    else {
      const proto = Object.getPrototypeOf(obj);
      if (proto !== Object.prototype && proto !== null) throw new TypeError(`检查点里不能有 ${proto?.constructor?.name ?? "未知"} 实例`);
      const out: Record<string, Enc> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = enc(v);
      nodes[id] = { t: "o", v: out };
    }
    return { "#": "r", i: id };
  };
  const rootEnc = enc(root);
  return { v: 1, root: rootEnc, nodes: nodes as Node[] };
}

export function decodeGraph<T = unknown>(graph: EncodedGraph): T {
  const made: unknown[] = graph.nodes.map((n) => (n.t === "a" ? [] : n.t === "m" ? new Map() : n.t === "s" ? new Set() : {}));
  const dec = (e: Enc): unknown => {
    if (e === null || typeof e !== "object") return e;
    switch (e["#"]) {
      case "r":
        return made[e.i];
      case "u":
        return undefined;
      case "n":
        return Number(e.v);
      case "b":
        return BigInt(e.v);
    }
  };
  graph.nodes.forEach((n, i) => {
    const target = made[i];
    if (n.t === "a") for (const v of n.v) (target as unknown[]).push(dec(v));
    else if (n.t === "m") for (const [k, v] of n.v) (target as Map<unknown, unknown>).set(dec(k), dec(v));
    else if (n.t === "s") for (const v of n.v) (target as Set<unknown>).add(dec(v));
    else for (const [k, v] of Object.entries(n.v)) (target as Record<string, unknown>)[k] = dec(v);
  });
  return dec(graph.root) as T;
}
