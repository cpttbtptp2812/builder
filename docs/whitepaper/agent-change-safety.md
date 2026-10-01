# Agent Change Safety: From Diff Review to Causal Release Gates

## Abstract

Agent behavior is assembled from routing rules, skill manifests, tools, prompts, and stateful execution. A text diff can show what changed, but not whether a customer query now routes elsewhere, whether a required step disappears, or which changed step causes an outcome to flip.

OwnAgent treats an agent change as a release-safety question:

> For a fixed set of customer cases, what changes between the baseline and candidate, what is the consequence, which step is pivotal, and should the change ship?

The protocol combines static compilation, deterministic trace replay, structural comparison, causal interventions, and explicit coverage. Its output is a machine-readable `PASS`, `WARN`, or `BLOCK` decision with reasons. This document describes that protocol and its limits; it does not claim external production validation.

## 1. Why ordinary review is insufficient

A skill change can fail without looking suspicious in source:

- a removed trigger sends a known query to another skill;
- a new trigger captures a neighboring query;
- a tool substitution preserves the step name but changes its result;
- deleting one step leaves syntactically valid output with an invalid outcome;
- an unavailable mock makes a causal conclusion look more certain than the evidence permits.

Agent change safety therefore needs three layers:

1. **Structure:** what manifest, trigger, tool, or step changed?
2. **Behavior:** what route and trace occur for the same case on each version?
3. **Consequence:** does the evaluated outcome change, and which intervention explains the change?

## 2. Unit of analysis

OwnAgent compares a baseline skill and candidate skill against versioned cases. Each case contains a user query and an expected trace or outcome grader. Execution emits ordered trace rows using the existing fields:

- `stepId`
- `tool`
- `ok`
- `result`
- `ms`

The comparison report identifies the skill with `skillId` and records `baselineVersion`, `candidateVersion`, and `generatedAt`. It evaluates:

- compilation diagnostics;
- trigger, tool, and step structure;
- route drift;
- trace changes;
- outcome pass/fail;
- deterministic propagation coverage.

## 3. Causal consequence protocol

### 3.1 Baseline and candidate

For query \(q\), let \(Y_b(q)\) and \(Y_c(q)\) be the grader scores for baseline and candidate. OwnAgent reports:

\[
\Delta P(\mathrm{pass}) = Y_c(q) - Y_b(q)
\]

The name is retained as the protocol field `deltaSuccess`. In the current deterministic fixture it is an observed score delta over a finite case set, not a population estimate.

### 3.2 Interventions

OwnAgent replays a trace under explicit interventions:

- `do(observation)`: inject a step result;
- `skip`: remove a step;
- `swap_tool`: replace a step's tool.

A step is pivotal when an intervention changes the evaluated outcome. The report exposes:

- `pivotalStepId`
- `pivotalTool`
- `baselinePass`
- `candidatePass`
- per-query consequence rows

This turns “the candidate failed” into a testable claim such as “the outcome flips when step `probe` changes.”

### 3.3 Exact versus sample propagation

Every step is labeled `exact` or `sample`. `exact` means the local evaluator has a deterministic implementation or recorded trace sufficient to propagate the intervention. `sample` means the step is represented by an observed or incomplete substitute.

Coverage is reported as:

- `total`
- `exact`
- `sample`
- `exactPct`
- step-level mode
- `mockHints`

When `exactPct` is below 80, OwnAgent does not use incomplete causal evidence as a `BLOCK` basis. It lowers the conclusion to `WARN` and asks for a mock or recorded trace. This is an evidence policy, not a claim that 80% is universally optimal.

## 4. Release gate

The canonical report schema is `ownagent-skill-gate/1`. Its release summary contains:

- `gate`: `PASS`, `WARN`, or `BLOCK`;
- `level`: `pass`, `warn`, or `block`;
- `reasons`;
- `deltaSuccess`;
- `pivotalStepId`;
- `pivotalTool`;
- `baselinePass`;
- `candidatePass`.

The current policy is:

- **PASS:** compilation and evaluated cases show no material regression.
- **WARN:** risk exists, evidence is incomplete, or behavior changed without a demonstrated regression.
- **BLOCK:** high-confidence evidence shows a regression, such as a compile error, route drift that breaks a case, or an outcome flip with adequate exact coverage.

`WARN` is deliberately first-class. Unknown behavior must not be silently converted into either safety or failure.

## 5. Evidence and auditability

A release can produce an `ownagent-release-witness/1` record containing:

- the manifest SHA-256;
- the gate result;
- gate queries and route drift;
- whether a live probe was used;
- shadow replay and route-fuzz summaries;
- a content hash.

The witness records what was checked at publication time. It does not prove the absence of all failures, and a live probe does not transform local cases into external production evidence.

## 6. Benchmark contract

The companion benchmark in `docs/benchmark/` is intentionally local and reproducible. It measures whether a small protocol evaluator derives the expected gate from fixture fields. It is useful for:

- checking schema stability;
- demonstrating coverage-aware gate semantics;
- detecting accidental changes in the benchmark algorithm;
- providing inspectable examples for talks and reviews.

It is not a comparison with other products, a production incident study, or an externally audited efficacy result.

## 7. Threats to validity

1. **Case selection:** unrepresented customer language cannot be protected by the gate.
2. **Mock fidelity:** exact deterministic propagation can still model the wrong behavior.
3. **Grader validity:** a stable grader may encode an incomplete definition of success.
4. **Routing context:** isolated query replay may omit session state.
5. **Tool nondeterminism:** network and model-backed tools require recording, bounded assertions, or repeated evaluation.
6. **Policy thresholds:** gate thresholds are operational choices and should be versioned.

These limits argue for visible coverage and witness records, not for replacing engineering judgment with a single score.

## 8. Adoption path

1. Store baseline manifests under `.ownagent/baselines/{skillId}.json`.
2. Store team-owned cases in `.ownagent/cases.json`.
3. Run static compile and mock trace checks in CI.
4. Require review of `gate`, `reasons`, `deltaSuccess`, and pivotal-step evidence.
5. Publish a release witness with the accepted version.
6. Turn production failures into new regression cases.

The goal is narrow: make agent changes reviewable as behavioral releases, with causal evidence proportional to the coverage actually available.
