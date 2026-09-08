import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { STEP_IDS, STEP_REGISTRY, isStepId, type StepId } from "../components/agent/steps/registry";

export type HubNodeData = {
  label: string;
  sub: string;
  color: string;
  bind: StepId;
  custom?: boolean;
  onPick?: (id: StepId) => void;
};

export type HubFlowFile = {
  version: 1;
  nodes: Array<{
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: { label: string; sub: string; color: string; bind: StepId; custom?: boolean };
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
};

export type HubAiDraft = {
  summary: string;
  nodes: Array<{ id: string; bind: StepId; label?: string }>;
  edges: Array<{ from: string; to: string }>;
};

export const HUB_STORAGE_KEY = "ua-hub-xyflow-v5";

export const LANE_X = [28, 248, 468, 688];
export const STEP_Y = [64, 156, 248, 340, 432];

export const LANES = [
  { id: "lane-nlu", label: "1 · 理解", hint: "读懂问句", x: LANE_X[0]!, ids: ["nlu", "intent", "entity", "plan", "context"] as StepId[] },
  { id: "lane-flow", label: "2 · 编排", hint: "定怎么做", x: LANE_X[1]!, ids: ["dsl", "manage", "pattern"] as StepId[] },
  { id: "lane-run", label: "3 · 运行", hint: "真正执行", x: LANE_X[2]!, ids: ["engine", "mech", "ctrl"] as StepId[] },
  { id: "lane-skill", label: "4 · 能力", hint: "用哪些工具", x: LANE_X[3]!, ids: ["browser", "mcp", "kb"] as StepId[] },
];

const PLACES: Record<StepId, { c: number; r: number }> = {
  nlu: { c: 0, r: 0 },
  intent: { c: 0, r: 1 },
  entity: { c: 0, r: 2 },
  plan: { c: 0, r: 3 },
  context: { c: 0, r: 4 },
  dsl: { c: 1, r: 0 },
  manage: { c: 1, r: 1 },
  pattern: { c: 1, r: 2 },
  engine: { c: 2, r: 0 },
  mech: { c: 2, r: 1 },
  ctrl: { c: 2, r: 2 },
  browser: { c: 3, r: 0 },
  mcp: { c: 3, r: 1 },
  kb: { c: 3, r: 2 },
};

const VERTICAL_EDGES: [string, string][] = [
  ["nlu", "intent"],
  ["intent", "entity"],
  ["entity", "plan"],
  ["plan", "context"],
  ["dsl", "manage"],
  ["manage", "pattern"],
  ["engine", "mech"],
  ["mech", "ctrl"],
  ["browser", "mcp"],
  ["mcp", "kb"],
];

const HORIZONTAL_EDGES: [string, string][] = [
  ["nlu", "dsl"],
  ["dsl", "engine"],
  ["engine", "browser"],
];

const DOWN_EDGES = new Set(VERTICAL_EDGES.map(([from, to]) => `${from}→${to}`));

export const EDGE_COLOR = "#94a3b8";
export const EDGE_FLOW = "#4f46e5";

export function isLaneId(id: string) {
  return id.startsWith("lane-");
}

export function bindOf(id: string, data?: HubNodeData): StepId {
  if (data?.bind && isStepId(data.bind)) return data.bind;
  return isStepId(id) ? id : "nlu";
}

export function isDownEdge(from: string, to: string) {
  if (DOWN_EDGES.has(`${from}→${to}`)) return true;
  const a = isStepId(from) ? PLACES[from] : null;
  const b = isStepId(to) ? PLACES[to] : null;
  return Boolean(a && b && a.c === b.c && b.r > a.r);
}

export function edgeLook(from: string, to: string, animated = false): Partial<Edge> {
  const down = isDownEdge(from, to);
  return {
    type: "straight",
    animated,
    sourceHandle: down ? "out-down" : "out",
    targetHandle: down ? "in-top" : "in",
    style: { stroke: animated ? EDGE_FLOW : EDGE_COLOR, strokeWidth: animated ? 2.4 : 1.4 },
    markerEnd: { type: MarkerType.ArrowClosed, color: animated ? EDGE_FLOW : EDGE_COLOR, width: 14, height: 14 },
  };
}

export function laneNodes(): Node<HubNodeData>[] {
  return LANES.map((lane) => ({
    id: lane.id,
    type: "hubLane",
    position: { x: lane.x, y: 8 },
    draggable: false,
    selectable: false,
    connectable: false,
    data: { label: lane.label, sub: lane.hint, color: "#94a3b8", bind: "nlu" },
  }));
}

export function withLanes(nodes: Node<HubNodeData>[]): Node<HubNodeData>[] {
  return [...laneNodes(), ...nodes.filter((n) => n.type !== "hubLane" && !isLaneId(n.id))];
}

export function defaultStepNodes(): Node<HubNodeData>[] {
  return STEP_IDS.map((id) => {
    const s = STEP_REGISTRY[id];
    const at = PLACES[id];
    return {
      id,
      type: "hubStep",
      position: { x: LANE_X[at.c]!, y: STEP_Y[at.r]! },
      data: { label: s.label, sub: s.sub, color: s.color, bind: id },
    };
  });
}

export function defaultNodes(): Node<HubNodeData>[] {
  return withLanes(defaultStepNodes());
}

export function defaultEdges(): Edge[] {
  return [...HORIZONTAL_EDGES, ...VERTICAL_EDGES].map(([from, to]) => ({
    id: `${from}-${to}`,
    source: from,
    target: to,
    ...edgeLook(from, to, false),
  }));
}

export function slimFlow(nodes: Node<HubNodeData>[], edges: Edge[]): HubFlowFile {
  return {
    version: 1,
    nodes: nodes
      .filter((n) => n.type !== "hubLane" && !isLaneId(n.id))
      .map(({ id, type, position, data }) => ({
        id,
        type: type ?? "hubStep",
        position,
        data: { label: data.label, sub: data.sub, color: data.color, bind: data.bind, custom: data.custom },
      })),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
  };
}

export function parseFlow(raw: unknown): { nodes: Node<HubNodeData>[]; edges: Edge[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const file = raw as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(file.nodes) || !Array.isArray(file.edges)) return null;
  const nodes: Node<HubNodeData>[] = [];
  for (const item of file.nodes) {
    if (!item || typeof item !== "object") return null;
    const n = item as Node<HubNodeData> & { bind?: string };
    const id = String((n as { id?: string }).id ?? "");
    if (!id || isLaneId(id) || (n as { type?: string }).type === "hubLane") continue;
    const data = (n as { data?: HubNodeData }).data;
    const bindRaw = data?.bind ?? (n as { bind?: string }).bind ?? id;
    const bind = isStepId(bindRaw) ? bindRaw : isStepId(id) ? id : "nlu";
    const meta = STEP_REGISTRY[bind];
    const pos = (n as { position?: { x?: number; y?: number } }).position;
    const at = PLACES[bind];
    nodes.push({
      id,
      type: "hubStep",
      position: {
        x: Number(pos?.x) || LANE_X[at.c]!,
        y: Number(pos?.y) || STEP_Y[at.r]!,
      },
      data: {
        label: data?.label || meta.label,
        sub: data?.sub || meta.sub,
        color: data?.color || meta.color,
        bind,
        custom: Boolean(data?.custom),
      },
    });
  }
  if (nodes.length === 0) return null;
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = file.edges.flatMap((item, i) => {
    if (!item || typeof item !== "object") return [];
    const e = item as { id?: string; source?: string; target?: string; from?: string; to?: string };
    const source = String(e.source ?? e.from ?? "");
    const target = String(e.target ?? e.to ?? "");
    if (!source || !target || !ids.has(source) || !ids.has(target)) return [];
    return [{ id: String(e.id || `${source}-${target}-${i}`), source, target, ...edgeLook(source, target, false) }];
  });
  return { nodes: withLanes(nodes), edges };
}

export function hydrateDraft(
  draft: HubAiDraft,
  current: Node<HubNodeData>[] = [],
): { nodes: Node<HubNodeData>[]; edges: Edge[] } | null {
  const prev = new Map(current.filter((n) => n.type === "hubStep").map((n) => [n.id, n]));
  const used = new Set<string>();
  const nodes: Node<HubNodeData>[] = [];
  draft.nodes.forEach((item, i) => {
    if (!isStepId(item.bind)) return;
    const meta = STEP_REGISTRY[item.bind];
    const id = item.id && !used.has(item.id) ? item.id : `${item.bind}-${i}`;
    used.add(id);
    const at = PLACES[item.bind];
    const old = prev.get(id);
    nodes.push({
      id,
      type: "hubStep",
      position: old?.position ?? { x: LANE_X[at.c]!, y: STEP_Y[at.r]! },
      data: {
        label: item.label || old?.data.label || meta.label,
        sub: old?.data.sub || meta.sub,
        color: old?.data.color || meta.color,
        bind,
        custom: old?.data.custom,
      },
    });
  });
  if (nodes.length === 0) return null;
  const extras = new Map<StepId, number>();
  for (const n of nodes) {
    const count = extras.get(n.data.bind) ?? 0;
    if (count > 0) {
      n.position = { x: n.position.x + count * 24, y: n.position.y + count * 18 };
      n.data.custom = true;
    }
    extras.set(n.data.bind, count + 1);
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = draft.edges.flatMap((e, i) => {
    if (!ids.has(e.from) || !ids.has(e.to)) return [];
    return [{ id: `${e.from}-${e.to}-${i}`, source: e.from, target: e.to, ...edgeLook(e.from, e.to, false) }];
  });
  return { nodes: withLanes(nodes), edges };
}

export function loadSaved(): { nodes: Node<HubNodeData>[]; edges: Edge[] } | null {
  try {
    const raw = localStorage.getItem(HUB_STORAGE_KEY);
    if (!raw) return null;
    return parseFlow(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function persistFlow(nodes: Node<HubNodeData>[], edges: Edge[]) {
  try {
    localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(slimFlow(nodes, edges)));
  } catch {
    /* ignore */
  }
}

/** 从起点沿边走到当前节点的最短路径（只动这一路） */
export function edgeIdsOnPath(edges: Array<{ id: string; source: string; target: string }>, targetId: string, startId = "nlu"): Set<string> {
  if (!targetId || targetId === startId) return new Set();
  const adj = new Map<string, Array<{ to: string; id: string }>>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push({ to: e.target, id: e.id });
    adj.set(e.source, list);
  }
  const starts = edges.some((e) => e.source === startId || e.target === startId)
    ? [startId]
    : [...new Set(edges.map((e) => e.source).filter((s) => !edges.some((e) => e.target === s)))];

  for (const start of starts) {
    const prev = new Map<string, { from: string; id: string }>();
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const cur = q.shift()!;
      if (cur === targetId) {
        const ids = new Set<string>();
        let n = targetId;
        while (prev.has(n)) {
          const p = prev.get(n)!;
          ids.add(p.id);
          n = p.from;
        }
        return ids;
      }
      for (const nxt of adj.get(cur) ?? []) {
        if (seen.has(nxt.to)) continue;
        seen.add(nxt.to);
        prev.set(nxt.to, { from: cur, id: nxt.id });
        q.push(nxt.to);
      }
    }
  }
  return new Set();
}

export function nodesOnPath(edges: Array<{ id: string; source: string; target: string }>, flowing: Set<string>, targetId: string): Set<string> {
  const ids = new Set<string>([targetId]);
  for (const e of edges) {
    if (flowing.has(e.id)) {
      ids.add(e.source);
      ids.add(e.target);
    }
  }
  return ids;
}

const LABEL_ALIAS: Array<[RegExp, StepId]> = STEP_IDS.map((id) => [new RegExp(STEP_REGISTRY[id].label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), id]);

export function stepsMentioned(text: string): StepId[] {
  const hits: Array<{ id: StepId; i: number }> = [];
  for (const [re, id] of LABEL_ALIAS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) hits.push({ id, i: m.index });
  }
  for (const id of STEP_IDS) {
    const i = text.toLowerCase().indexOf(id);
    if (i >= 0 && !hits.some((h) => h.id === id)) hits.push({ id, i });
  }
  return hits.sort((a, b) => a.i - b.i).map((h) => h.id);
}

function chainDraft(ids: StepId[], summary: string): HubAiDraft {
  const unique = [...new Set(ids)];
  return {
    summary,
    nodes: unique.map((id) => ({ id, bind: id, label: STEP_REGISTRY[id].label })),
    edges: unique.slice(1).map((id, i) => ({ from: unique[i]!, to: id })),
  };
}

function defaultDraft(summary = "恢复默认：理解 → 编排 → 运行 → 能力"): HubAiDraft {
  return {
    summary,
    nodes: STEP_IDS.map((id) => ({ id, bind: id, label: STEP_REGISTRY[id].label })),
    edges: [...HORIZONTAL_EDGES, ...VERTICAL_EDGES].map(([from, to]) => ({ from, to })),
  };
}

/** 没接 LLM 时：按口令改当前图，始终给出可应用 JSON */
export function proposeFlowFromPrompt(prompt: string, current: HubFlowFile): HubAiDraft {
  const text = prompt.trim();
  const mentioned = stepsMentioned(text);

  if (/恢复默认|重置|四列|默认图/.test(text)) return defaultDraft();

  const fromTo = text.match(/从\s*(.+?)\s*(?:连|接到|到|→|->)\s*(.+?)(?:$|[，。！？\s])/);
  if (fromTo) {
    const a = stepsMentioned(fromTo[1] ?? "")[0];
    const b = stepsMentioned(fromTo[2] ?? "")[0];
    if (a && b) {
      const nodes = current.nodes.length
        ? current.nodes.map((n) => ({ id: n.id, bind: n.data.bind, label: n.data.label }))
        : STEP_IDS.map((id) => ({ id, bind: id, label: STEP_REGISTRY[id].label }));
      const ids = new Set(nodes.map((n) => n.id));
      if (!ids.has(a)) nodes.push({ id: a, bind: a, label: STEP_REGISTRY[a].label });
      if (!ids.has(b)) nodes.push({ id: b, bind: b, label: STEP_REGISTRY[b].label });
      const edges = current.edges.map((e) => ({ from: e.source, to: e.target }));
      if (!edges.some((e) => e.from === a && e.to === b)) edges.push({ from: a, to: b });
      return { summary: `加上 ${STEP_REGISTRY[a].label} → ${STEP_REGISTRY[b].label}`, nodes, edges };
    }
  }

  if (/发布|探活|检查/.test(text)) {
    return chainDraft(["nlu", "intent", "entity", "plan", "browser", "ctrl"], "发布前检查：理解问句走到浏览器探活，再进运行管控");
  }
  if (/知识|检索|项目/.test(text)) {
    return chainDraft(["nlu", "intent", "kb", "ctrl"], "知识检索：问句 → 意图 → 知识库 → 管控");
  }
  if (/并行|三路|分叉/.test(text)) {
    return {
      summary: "执行模式后三路并行：浏览器 / 协议 / 知识",
      nodes: STEP_IDS.map((id) => ({ id, bind: id, label: STEP_REGISTRY[id].label })),
      edges: [
        ...HORIZONTAL_EDGES.map(([from, to]) => ({ from, to })),
        ...VERTICAL_EDGES.filter(([from]) => from !== "browser" && from !== "mcp").map(([from, to]) => ({ from, to })),
        { from: "ctrl", to: "browser" },
        { from: "ctrl", to: "mcp" },
        { from: "ctrl", to: "kb" },
      ],
    };
  }
  if (mentioned.length >= 2 && /线|串|顺序|一条/.test(text)) {
    return chainDraft(mentioned, `按你点名的步骤串成一条：${mentioned.map((id) => STEP_REGISTRY[id].label).join(" → ")}`);
  }
  if (mentioned.length >= 1) {
    const keep = new Set(mentioned);
    const nodes = current.nodes
      .filter((n) => keep.has(n.data.bind))
      .map((n) => ({ id: n.id, bind: n.data.bind, label: n.data.label }));
    for (const id of mentioned) {
      if (!nodes.some((n) => n.bind === id)) nodes.push({ id, bind: id, label: STEP_REGISTRY[id].label });
    }
    const ids = new Set(nodes.map((n) => n.id));
    const edges = current.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ from: e.source, to: e.target }));
    if (edges.length === 0 && nodes.length > 1) {
      for (let i = 1; i < nodes.length; i++) edges.push({ from: nodes[i - 1]!.id, to: nodes[i]!.id });
    }
    return { summary: `只保留你提到的步骤：${mentioned.map((id) => STEP_REGISTRY[id].label).join("、")}`, nodes, edges };
  }

  return {
    summary: "按当前图画了一版可改的 JSON。可以说「恢复默认」或「从规划任务连到知识检索」。",
    nodes: current.nodes.map((n) => ({ id: n.id, bind: n.data.bind, label: n.data.label })),
    edges: current.edges.map((e) => ({ from: e.source, to: e.target })),
  };
}

export function draftToPretty(draft: HubAiDraft) {
  return JSON.stringify(draft, null, 2);
}

export function coerceDraft(raw: unknown): HubAiDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { summary?: string; nodes?: unknown; edges?: unknown };
  if (!Array.isArray(o.nodes) || !Array.isArray(o.edges)) return null;
  const nodes: HubAiDraft["nodes"] = [];
  for (const item of o.nodes) {
    if (!item || typeof item !== "object") continue;
    const n = item as { id?: string; bind?: string; label?: string };
    let bind = n.bind;
    if (!isStepId(bind) && n.label) bind = stepsMentioned(n.label)[0];
    if (!isStepId(bind) && n.id && isStepId(n.id)) bind = n.id;
    if (!isStepId(bind)) continue;
    nodes.push({ id: String(n.id || bind), bind, label: n.label });
  }
  const edges = o.edges.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const e = item as { from?: string; to?: string; source?: string; target?: string };
    const from = String(e.from ?? e.source ?? "");
    const to = String(e.to ?? e.target ?? "");
    if (!from || !to) return [];
    return [{ from, to }];
  });
  if (nodes.length === 0) return null;
  return { summary: o.summary?.trim() || "已生成一版工作流", nodes, edges };
}
