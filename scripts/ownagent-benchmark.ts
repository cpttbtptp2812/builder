/**
 * Reproduce the repository-local OwnAgent benchmark fixture.
 *
 * Run:
 *   npx tsx scripts/ownagent-benchmark.ts
 *   npx tsx scripts/ownagent-benchmark.ts --write
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Gate = "PASS" | "WARN" | "BLOCK";

type BenchmarkCase = {
  id: string;
  skillId: string;
  baselineVersion: string;
  candidateVersion: string;
  compileOk: boolean;
  routeDrift: boolean;
  baselinePass: boolean;
  candidatePass: boolean;
  coverage: {
    total: number;
    exact: number;
    sample: number;
    exactPct: number;
  };
  pivotalStepId: string | null;
  pivotalTool: string | null;
  expectedGate: Gate;
  expectedDeltaSuccess: number;
};

type Dataset = {
  schema: "ownagent-benchmark-dataset/1";
  name: string;
  fixture: true;
  cases: BenchmarkCase[];
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const datasetPath = resolve(root, "docs", "benchmark", "dataset.json");
const resultsPath = resolve(root, "docs", "benchmark", "results.json");

function gateFor(c: BenchmarkCase): { gate: Gate; reasons: string[] } {
  if (!c.compileOk) {
    return { gate: "BLOCK", reasons: ["[compile] candidate has a static error"] };
  }

  const regressed = c.baselinePass && !c.candidatePass;
  if (regressed && c.coverage.exactPct >= 80) {
    const pivotal = c.pivotalStepId
      ? `; pivotal=${c.pivotalStepId} (${c.pivotalTool ?? "unknown"})`
      : "";
    return {
      gate: "BLOCK",
      reasons: [`[causal] deterministic outcome regression${pivotal}`],
    };
  }

  if (regressed && c.coverage.exactPct < 80) {
    return {
      gate: "WARN",
      reasons: [
        `[coverage] regression observed with exact ${c.coverage.exactPct}%; incomplete causal evidence cannot BLOCK`,
      ],
    };
  }

  if (c.routeDrift) {
    return {
      gate: "WARN",
      reasons: ["[route] candidate route differs without a demonstrated outcome regression"],
    };
  }

  return { gate: "PASS", reasons: ["compile + fixture outcome passed"] };
}

function validateCase(c: BenchmarkCase): void {
  if (c.coverage.total !== c.coverage.exact + c.coverage.sample) {
    throw new Error(`${c.id}: coverage total must equal exact + sample`);
  }
  const exactPct = c.coverage.total
    ? Math.round((c.coverage.exact / c.coverage.total) * 100)
    : 100;
  if (exactPct !== c.coverage.exactPct) {
    throw new Error(`${c.id}: exactPct must be ${exactPct}`);
  }
  const deltaSuccess = Number(c.candidatePass) - Number(c.baselinePass);
  if (deltaSuccess !== c.expectedDeltaSuccess) {
    throw new Error(`${c.id}: expectedDeltaSuccess must be ${deltaSuccess}`);
  }
}

const datasetRaw = readFileSync(datasetPath, "utf8");
const dataset = JSON.parse(datasetRaw) as Dataset;
if (dataset.schema !== "ownagent-benchmark-dataset/1" || dataset.fixture !== true) {
  throw new Error("Expected an ownagent-benchmark-dataset/1 local fixture");
}

const cases = dataset.cases.map((c) => {
  validateCase(c);
  const deltaSuccess = Number(c.candidatePass) - Number(c.baselinePass);
  const decision = gateFor(c);
  return {
    id: c.id,
    skillId: c.skillId,
    baselineVersion: c.baselineVersion,
    candidateVersion: c.candidateVersion,
    gate: decision.gate,
    expectedGate: c.expectedGate,
    matchesExpected: decision.gate === c.expectedGate && deltaSuccess === c.expectedDeltaSuccess,
    reasons: decision.reasons,
    deltaSuccess,
    pivotalStepId: c.pivotalStepId,
    pivotalTool: c.pivotalTool,
    baselinePass: c.baselinePass,
    candidatePass: c.candidatePass,
    coverage: c.coverage,
  };
});

const matched = cases.filter((c) => c.matchesExpected).length;
const output = {
  schema: "ownagent-benchmark-results/1",
  fixture: true,
  evidenceScope: "reproducible-local-fixture",
  externalClaims: false,
  generatedBy: "scripts/ownagent-benchmark.ts",
  datasetSha256: createHash("sha256").update(datasetRaw).digest("hex"),
  policy: {
    exactBlockThresholdPct: 80,
    note: "Fixture policy only; not an externally validated threshold.",
  },
  summary: {
    cases: cases.length,
    matched,
    mismatched: cases.length - matched,
    fixtureAgreementPct: cases.length ? Math.round((matched / cases.length) * 100) : 100,
  },
  cases,
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(resultsPath, serialized, "utf8");
  console.error(`Wrote ${resultsPath}`);
}
process.stdout.write(serialized);

if (matched !== cases.length) process.exitCode = 1;
