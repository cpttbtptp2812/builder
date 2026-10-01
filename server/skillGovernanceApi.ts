import type { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSkillDependencyGraph,
  propagateReverseImpact,
  reportAmbiguousRoutes,
} from "../src/lib/skillGovernance.ts";
import { SKILL_CATALOG } from "./skills.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASES_FILE = path.join(process.env.OWNAGENT_CONFIG_DIR ?? path.join(ROOT, ".ownagent"), "cases.json");

function score(skill: (typeof SKILL_CATALOG)[number], query: string) {
  const hits = skill.triggers.filter((trigger) => query.includes(trigger.toLowerCase()));
  const nameHit = skill.name.toLowerCase().includes(query) || query.includes(skill.name.toLowerCase());
  return {
    score: hits.reduce((sum, hit) => sum + (hit.length >= 4 ? 2 : 1), 0) + (nameHit ? 3 : 0),
    hits,
  };
}

function caseQueries(): Array<{ id?: string; query: string; source: string }> {
  if (!fs.existsSync(CASES_FILE)) return [];
  try {
    const store = JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as Record<string, Array<{ id?: string; query?: string }>>;
    return Object.values(store)
      .flat()
      .filter((row): row is { id?: string; query: string } => Boolean(row?.query))
      .map((row) => ({ id: row.id, query: row.query, source: "repo-case" }));
  } catch {
    return [];
  }
}

export function registerSkillGovernanceApi(app: Hono) {
  app.get("/api/skill-gate/governance", (c) => {
    const changed = (c.req.query("changed") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const dependencyGraph = buildSkillDependencyGraph(SKILL_CATALOG);
    const ambiguity = reportAmbiguousRoutes(SKILL_CATALOG, caseQueries(), score);
    const impact = propagateReverseImpact(dependencyGraph, changed);
    return c.json({ dependencyGraph, ambiguity, impact });
  });
}
