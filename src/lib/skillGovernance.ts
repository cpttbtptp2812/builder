/** Cross-Skill governance: dependency topology, route ambiguity, and change impact. */

import type { SkillManifest } from "./skillMarkdown";

export type GovernedSkill = Pick<SkillManifest, "id" | "name" | "tools" | "ir"> & {
  depends?: readonly string[];
};

export type SkillDependencyReason =
  | { kind: "tool"; tool: string }
  | { kind: "data"; slots: string[] };

export type SkillDependencyEdge = {
  /** The Skill that consumes the dependency. */
  from: string;
  /** The Skill being depended upon. */
  to: string;
  reasons: SkillDependencyReason[];
};

export type SkillDependencyGraph = {
  nodes: string[];
  /** Edges point consumer -> dependency. */
  edges: SkillDependencyEdge[];
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
  toolConsumers: Record<string, string[]>;
  cycles: string[][];
};

export type SkillScore = {
  score: number;
  hits?: string[];
  breakdown?: unknown;
};

export type SkillScorer<TSkill extends GovernedSkill = GovernedSkill> = (
  skill: TSkill,
  normalizedQuery: string,
) => SkillScore;

export type GovernanceQuery = string | {
  query: string;
  id?: string;
  weight?: number;
  source?: string;
};

export type AmbiguousRoute = {
  query: string;
  queryId?: string;
  source?: string;
  weight: number;
  topScore: number;
  rivals: Array<{ skillId: string; skillName: string; score: number; hits: string[] }>;
};

export type AmbiguousRoutePair = {
  skills: [string, string];
  queryCount: number;
  weightedCount: number;
  queries: string[];
};

export type AmbiguousRouteReport = {
  queryCount: number;
  ambiguousCount: number;
  weightedAmbiguousCount: number;
  routes: AmbiguousRoute[];
  pairs: AmbiguousRoutePair[];
};

export type ImpactedSkill = {
  skillId: string;
  distance: number;
  changed: boolean;
  /** Dependency chain from a changed Skill to this downstream consumer. */
  path: string[];
};

export type ReverseImpactReport = {
  changed: string[];
  unknownChanged: string[];
  impacted: ImpactedSkill[];
};

function normalizedRef(value: string): string {
  return value
    .trim()
    .replace(/^\$/, "")
    .replace(/^vars\./, "");
}

function explicitSkillReference(tool: string, skillIds: Set<string>): string | null {
  const raw = tool.trim();
  const candidates = [
    raw,
    raw.replace(/^skill(?::|\/)/i, ""),
    raw.replace(/^@skill\//i, ""),
  ];
  return candidates.find((candidate) => skillIds.has(candidate)) ?? null;
}

function addReason(
  edgeReasons: Map<string, SkillDependencyReason[]>,
  from: string,
  to: string,
  reason: SkillDependencyReason,
): void {
  if (from === to) return;
  const key = `${from}\0${to}`;
  const reasons = edgeReasons.get(key) ?? [];
  if (reason.kind === "tool") {
    if (!reasons.some((item) => item.kind === "tool" && item.tool === reason.tool)) reasons.push(reason);
  } else {
    const previous = reasons.find((item): item is Extract<SkillDependencyReason, { kind: "data" }> => item.kind === "data");
    if (previous) previous.slots = [...new Set([...previous.slots, ...reason.slots])].sort();
    else reasons.push({ kind: "data", slots: [...new Set(reason.slots)].sort() });
  }
  edgeReasons.set(key, reasons);
}

function findCycles(nodes: string[], dependencies: Record<string, string[]>): string[][] {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycles = new Map<string, string[]>();

  const visit = (node: string): void => {
    state.set(node, 1);
    stack.push(node);
    for (const next of dependencies[node] ?? []) {
      if (state.get(next) === 1) {
        const start = stack.lastIndexOf(next);
        const cycle = [...stack.slice(start), next];
        const body = cycle.slice(0, -1);
        const rotations = body.map((_, index) => [...body.slice(index), ...body.slice(0, index)]);
        rotations.sort((a, b) => a.join("\0").localeCompare(b.join("\0")));
        const canonical = rotations[0]!;
        cycles.set(canonical.join("\0"), [...canonical, canonical[0]!]);
      } else if (!state.get(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 2);
  };

  for (const node of nodes) if (!state.get(node)) visit(node);
  return [...cycles.values()].sort((a, b) => a.join("\0").localeCompare(b.join("\0")));
}

/**
 * Builds a Skill-only graph. A consumer points to its dependency.
 *
 * Dependencies come from:
 * - `depends:` listing another Skill id;
 * - tools named as another Skill (`id`, `skill:id`, `skill/id`, `@skill/id`);
 * - qualified dataflow sources such as `producer-id.output`.
 *
 * Unqualified slots and shared tool names never create cross-Skill edges.
 */
export function buildSkillDependencyGraph(skills: readonly GovernedSkill[]): SkillDependencyGraph {
  const nodes = [...new Set(skills.map((skill) => skill.id))].sort();
  const skillIds = new Set(nodes);
  const edgeReasons = new Map<string, SkillDependencyReason[]>();
  const toolConsumersMap = new Map<string, Set<string>>();

  for (const skill of skills) {
    for (const tool of skill.tools) {
      const consumers = toolConsumersMap.get(tool) ?? new Set<string>();
      consumers.add(skill.id);
      toolConsumersMap.set(tool, consumers);
      const dependency = explicitSkillReference(tool, skillIds);
      if (dependency) addReason(edgeReasons, skill.id, dependency, { kind: "tool", tool });
    }
    for (const dependency of skill.depends ?? []) {
      if (skillIds.has(dependency)) {
        addReason(edgeReasons, skill.id, dependency, { kind: "tool", tool: `skill:${dependency}` });
      }
    }
  }

  for (const consumer of skills) {
    for (const flow of consumer.ir?.dataFlow ?? []) {
      const from = normalizedRef(flow.from);
      for (const producerId of nodes) {
        if (producerId !== consumer.id && from.startsWith(`${producerId}.`)) {
          addReason(edgeReasons, consumer.id, producerId, { kind: "data", slots: [from] });
        }
      }
    }
  }

  const edges = [...edgeReasons.entries()]
    .map(([key, reasons]) => {
      const [from, to] = key.split("\0");
      return { from: from!, to: to!, reasons };
    })
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const dependencies = Object.fromEntries(nodes.map((node) => [node, [] as string[]]));
  const dependents = Object.fromEntries(nodes.map((node) => [node, [] as string[]]));
  for (const edge of edges) {
    dependencies[edge.from]!.push(edge.to);
    dependents[edge.to]!.push(edge.from);
  }
  for (const values of [...Object.values(dependencies), ...Object.values(dependents)]) values.sort();

  const toolConsumers = Object.fromEntries(
    [...toolConsumersMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tool, consumers]) => [tool, [...consumers].sort()]),
  );

  return {
    nodes,
    edges,
    dependencies,
    dependents,
    toolConsumers,
    cycles: findCycles(nodes, dependencies),
  };
}

/**
 * Scores every query against every Skill and reports global top-score ties.
 * Pass `scoreSkillDetailed` directly; the loose result contract intentionally
 * also supports isolated tests and alternate routers.
 */
export function reportAmbiguousRoutes<TSkill extends GovernedSkill>(
  skills: readonly TSkill[],
  queries: readonly GovernanceQuery[],
  scorer: SkillScorer<TSkill>,
  options: { minTopScore?: number; epsilon?: number } = {},
): AmbiguousRouteReport {
  const minTopScore = options.minTopScore ?? 1;
  const epsilon = options.epsilon ?? 0;
  const routes: AmbiguousRoute[] = [];

  for (const entry of queries) {
    const item = typeof entry === "string" ? { query: entry } : entry;
    const normalizedQuery = item.query.trim().toLowerCase();
    if (!normalizedQuery) continue;
    const ranked = skills
      .map((skill) => ({ skill, result: scorer(skill, normalizedQuery) }))
      .sort((a, b) => b.result.score - a.result.score || a.skill.id.localeCompare(b.skill.id));
    const topScore = ranked[0]?.result.score ?? 0;
    if (topScore < minTopScore) continue;
    const rivals = ranked
      .filter((row) => Math.abs(row.result.score - topScore) <= epsilon)
      .map((row) => ({
        skillId: row.skill.id,
        skillName: row.skill.name,
        score: row.result.score,
        hits: [...(row.result.hits ?? [])],
      }));
    if (rivals.length < 2) continue;
    routes.push({
      query: item.query,
      queryId: item.id,
      source: item.source,
      weight: item.weight ?? 1,
      topScore,
      rivals,
    });
  }

  const pairMap = new Map<string, AmbiguousRoutePair>();
  for (const route of routes) {
    for (let left = 0; left < route.rivals.length; left += 1) {
      for (let right = left + 1; right < route.rivals.length; right += 1) {
        const skillsPair = [route.rivals[left]!.skillId, route.rivals[right]!.skillId].sort() as [string, string];
        const key = skillsPair.join("\0");
        const pair = pairMap.get(key) ?? {
          skills: skillsPair,
          queryCount: 0,
          weightedCount: 0,
          queries: [],
        };
        pair.queryCount += 1;
        pair.weightedCount += route.weight;
        pair.queries.push(route.query);
        pairMap.set(key, pair);
      }
    }
  }

  return {
    queryCount: queries.length,
    ambiguousCount: routes.length,
    weightedAmbiguousCount: routes.reduce((total, route) => total + route.weight, 0),
    routes,
    pairs: [...pairMap.values()].sort(
      (a, b) => b.weightedCount - a.weightedCount || a.skills.join("\0").localeCompare(b.skills.join("\0")),
    ),
  };
}

/** Traverses the graph backwards, from changed dependencies to all consumers. */
export function propagateReverseImpact(
  graph: SkillDependencyGraph,
  changedSkillIds: readonly string[],
): ReverseImpactReport {
  const nodeSet = new Set(graph.nodes);
  const changed = [...new Set(changedSkillIds.filter((id) => nodeSet.has(id)))].sort();
  const unknownChanged = [...new Set(changedSkillIds.filter((id) => !nodeSet.has(id)))].sort();
  const best = new Map<string, ImpactedSkill>();
  const queue: ImpactedSkill[] = changed.map((skillId) => ({
    skillId,
    distance: 0,
    changed: true,
    path: [skillId],
  }));

  for (const seed of queue) best.set(seed.skillId, seed);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    for (const dependent of graph.dependents[current.skillId] ?? []) {
      const candidate: ImpactedSkill = {
        skillId: dependent,
        distance: current.distance + 1,
        changed: false,
        path: [...current.path, dependent],
      };
      const previous = best.get(dependent);
      if (previous && previous.distance <= candidate.distance) continue;
      best.set(dependent, candidate);
      queue.push(candidate);
    }
  }

  return {
    changed,
    unknownChanged,
    impacted: [...best.values()].sort(
      (a, b) => a.distance - b.distance || a.skillId.localeCompare(b.skillId),
    ),
  };
}
