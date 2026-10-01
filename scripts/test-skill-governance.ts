import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hydrateSkill } from "../src/lib/skillMarkdown.ts";
import {
  buildSkillDependencyGraph,
  propagateReverseImpact,
  reportAmbiguousRoutes,
  type GovernedSkill,
  type SkillScorer,
} from "../src/lib/skillGovernance.ts";

function skill(
  id: string,
  triggers: string[],
  options: {
    tools?: string[];
    reads?: string[];
    writes?: string[];
    flows?: Array<{ from: string; to: string; stepId: string }>;
  } = {},
): GovernedSkill & { triggers: string[] } {
  const tools = options.tools ?? [];
  return {
    id,
    name: id,
    triggers,
    tools,
    ir: {
      skillId: id,
      name: id,
      triggers,
      declaredTools: tools,
      steps: [{
        id: `${id}-step`,
        tool: tools[0] ?? "__test__",
        toolKind: "internal",
        reads: options.reads ?? [],
        writes: options.writes ?? [],
        effect: "pure",
      }],
      effectUpperBound: "pure",
      dataFlow: options.flows ?? [],
      triggerInterference: [],
    },
  };
}

const producer = skill("producer", ["ship"], {
  tools: ["http_probe"],
  writes: ["releasePayload"],
});
const transformer = skill("transformer", ["transform"], {
  tools: ["skill:producer", "http_probe"],
  reads: ["$releasePayload"],
  writes: ["transformedPayload"],
});
const publisher = skill("publisher", ["ship", "release"], {
  reads: ["transformedPayload"],
  flows: [{ from: "transformer.transformedPayload", to: "publisher-step", stepId: "publisher-step" }],
});
const skills = [producer, transformer, publisher];

const graph = buildSkillDependencyGraph(skills);
assert.deepEqual(graph.dependencies.producer, []);
assert.deepEqual(graph.dependencies.transformer, ["producer"]);
assert.deepEqual(graph.dependencies.publisher, ["transformer"]);
assert.deepEqual(graph.dependents.producer, ["transformer"]);
assert.deepEqual(graph.toolConsumers.http_probe, ["producer", "transformer"]);
assert.deepEqual(graph.cycles, []);

const transformerEdge = graph.edges.find((edge) => edge.from === "transformer" && edge.to === "producer");
assert(transformerEdge);
assert(transformerEdge.reasons.some((reason) => reason.kind === "tool"));

const impact = propagateReverseImpact(graph, ["producer", "missing"]);
assert.deepEqual(impact.changed, ["producer"]);
assert.deepEqual(impact.unknownChanged, ["missing"]);
assert.deepEqual(
  impact.impacted.map(({ skillId, distance, path }) => ({ skillId, distance, path })),
  [
    { skillId: "producer", distance: 0, path: ["producer"] },
    { skillId: "transformer", distance: 1, path: ["producer", "transformer"] },
    { skillId: "publisher", distance: 2, path: ["producer", "transformer", "publisher"] },
  ],
);

// Same contract as scoreSkillDetailed; injected to keep this script independent
// from the browser catalog's import.meta.glob loading.
const scorer: SkillScorer<(typeof skills)[number]> = (candidate, query) => {
  const hits = candidate.triggers.filter((trigger) => query.includes(trigger.toLowerCase()));
  return {
    score: hits.reduce((total, trigger) => total + (trigger.length >= 4 ? 2 : 1), 0),
    hits,
  };
};

const ambiguity = reportAmbiguousRoutes(
  skills,
  [
    { id: "q1", query: "ship this", source: "test", weight: 3 },
    "release notes",
    "unmatched",
  ],
  scorer,
);
assert.equal(ambiguity.queryCount, 3);
assert.equal(ambiguity.ambiguousCount, 1);
assert.equal(ambiguity.weightedAmbiguousCount, 3);
assert.deepEqual(ambiguity.routes[0]?.rivals.map((rival) => rival.skillId), ["producer", "publisher"]);
assert.deepEqual(ambiguity.pairs[0], {
  skills: ["producer", "publisher"],
  queryCount: 1,
  weightedCount: 3,
  queries: ["ship this"],
});

const skillsDir = path.resolve(import.meta.dirname, "../src/skills");
const catalog = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
  .map((entry) => hydrateSkill(fs.readFileSync(path.join(skillsDir, entry.name, "SKILL.md"), "utf8"), {
    id: entry.name,
    skillPath: entry.name,
  }));
const catalogGraph = buildSkillDependencyGraph(catalog);
assert.deepEqual(
  catalogGraph.edges.map((edge) => `${edge.from}->${edge.to}`),
  [
    "release-inspector->dom-probe",
    "release-inspector->knowledge-lookup",
    "site-analyzer->dom-probe",
    "skill-router->dom-probe",
    "skill-router->knowledge-lookup",
    "skill-router->policy-desk",
    "skill-router->release-inspector",
    "skill-router->site-analyzer",
    "skill-router->workflow-orchestrator",
    "workflow-orchestrator->dom-probe",
  ],
);
const domImpact = propagateReverseImpact(catalogGraph, ["dom-probe"]);
assert.deepEqual(
  domImpact.impacted.filter((row) => row.distance === 1).map((row) => row.skillId),
  ["release-inspector", "site-analyzer", "skill-router", "workflow-orchestrator"],
);

console.log(`skillGovernance: dependency, ambiguity, and reverse-impact checks passed (${catalogGraph.edges.length} catalog edges)`);
