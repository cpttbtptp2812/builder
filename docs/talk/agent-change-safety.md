---
marp: true
title: "Agent Change Safety"
description: "A protocol for causal release gates"
paginate: true
---

# Agent Change Safety

## From “what changed?” to “is it safe to ship?”

OwnAgent protocol and reproducible local fixture

---

# The review gap

A source diff can tell us:

- a trigger changed;
- a tool changed;
- a step disappeared.

It cannot tell us:

- which customer query now routes elsewhere;
- whether the outcome flips;
- which step caused the flip.

---

# The release question

> For the same customer cases, what is different between the baseline and candidate, what is the consequence, and should the change ship?

OwnAgent answers with:

1. structure;
2. replayed behavior;
3. causal consequence;
4. evidence-aware gate.

---

# One case, two versions

```text
query
  ├─ baselineVersion → route → trace → baselinePass
  └─ candidateVersion → route → trace → candidatePass
```

Trace protocol:

```text
stepId · tool · ok · result · ms
```

The comparison keeps the query and grader fixed.

---

# Consequence, not just difference

```text
deltaSuccess = candidate score - baseline score
```

For deterministic pass/fail fixtures:

- `0`: no outcome change
- `-1`: pass → fail
- `+1`: fail → pass

This is a finite-case score delta, not a population estimate.

---

# Find the pivotal step

Replay with explicit interventions:

- `do(observation)` — inject a step result
- `skip` — remove a step
- `swap_tool` — replace a tool

If the outcome flips, report:

```text
pivotalStepId · pivotalTool
```

---

# Confidence must be visible

Every step is:

- `exact` — deterministic implementation or sufficient recorded trace
- `sample` — observed or incomplete substitute

Coverage:

```text
exactPct = exact / total
```

Low coverage cannot honestly support a high-confidence causal block.

---

# PASS / WARN / BLOCK

**PASS**

No material regression in compiled, evaluated cases.

**WARN**

Behavior changed or evidence is incomplete.

**BLOCK**

High-confidence evidence shows a regression.

---

# Machine-readable gate

```json
{
  "schema": "ownagent-skill-gate/1",
  "gate": {
    "gate": "BLOCK",
    "reasons": ["deterministic outcome regression"],
    "deltaSuccess": -1,
    "pivotalStepId": "probe",
    "pivotalTool": "http_probe",
    "baselinePass": true,
    "candidatePass": false
  }
}
```

---

# Release witness

`ownagent-release-witness/1` can preserve:

- manifest SHA-256;
- gate result and checked queries;
- route drift;
- live-probe usage;
- shadow replay and route-fuzz summaries;
- witness content hash.

A witness records the evidence used. It does not prove that no unknown failure exists.

---

# Local benchmark fixture

The repository includes six synthetic scenarios:

- unchanged safe change;
- exact outcome regression;
- low-coverage regression;
- route-drift regression;
- route drift without regression;
- compile error.

```bash
npx tsx scripts/ownagent-benchmark.ts
```

---

# Read the number correctly

The checked-in fixture currently reports complete agreement with its expected labels.

That means:

- the fixture and deterministic policy agree;
- the dataset hash and output are reproducible.

It does **not** mean:

- 100% production accuracy;
- externally validated incident prevention;
- superiority over another system.

---

# Threats to validity

- missing customer cases;
- unrealistic mocks;
- incomplete graders;
- omitted session state;
- nondeterministic tools;
- organization-specific thresholds.

The response is not false certainty. It is explicit coverage, versioned policy, and auditable evidence.

---

# Adoption loop

```text
baseline
   ↓
change → compile → replay → intervene → gate
                                      ↓
                              release witness
                                      ↓
                         production failure case
                                      └──→ regression set
```

---

# The narrow promise

Make agent changes reviewable as behavioral releases.

**What changed?**  
**What consequence did it cause?**  
**Which step is pivotal?**  
**Is the evidence strong enough to merge?**

---

# References in this repository

- `docs/whitepaper/agent-change-safety.md`
- `docs/benchmark/README.md`
- `docs/benchmark/dataset.json`
- `docs/benchmark/results.json`
- `scripts/ownagent-benchmark.ts`
