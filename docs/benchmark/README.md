# OwnAgent Change-Safety Benchmark

This directory contains a **reproducible local fixture**, not an external benchmark.

It demonstrates how OwnAgent protocol fields produce `PASS`, `WARN`, and `BLOCK` decisions under six synthetic scenarios. The data is repository-authored, does not contain production traces, and does not support claims about real-world incident prevention, accuracy against another product, or industry performance.

## Files

- `dataset.json` — synthetic baseline/candidate cases using OwnAgent fields.
- `results.json` — deterministic output generated from the dataset.
- `../../scripts/ownagent-benchmark.ts` — validator and fixture evaluator.

## Reproduce

From the repository root:

```bash
npx tsx scripts/ownagent-benchmark.ts
```

To regenerate the checked-in result:

```bash
npx tsx scripts/ownagent-benchmark.ts --write
```

No `package.json` script is required. The command uses the repository's existing `tsx` development dependency.

The process exits nonzero if:

- a coverage total is inconsistent;
- `exactPct` is not reproducible from `exact / total`;
- `expectedDeltaSuccess` differs from `candidatePass - baselinePass`;
- the derived gate differs from `expectedGate`.

## Fixture policy

The evaluator intentionally mirrors the release-safety semantics already used by OwnAgent:

1. A compile error is `BLOCK`.
2. A baseline pass to candidate fail regression is `BLOCK` when `exactPct >= 80`.
3. The same regression is `WARN` below 80% exact coverage, because incomplete causal evidence cannot justify a causal block.
4. Route drift without a demonstrated outcome regression is `WARN`.
5. Otherwise the fixture is `PASS`.

The 80% threshold is a local policy value, not an externally validated universal threshold.

## Protocol fields exercised

Each result preserves:

- `skillId`
- `baselineVersion`
- `candidateVersion`
- `gate`
- `reasons`
- `deltaSuccess`
- `pivotalStepId`
- `pivotalTool`
- `baselinePass`
- `candidatePass`
- `coverage.total`, `coverage.exact`, `coverage.sample`, `coverage.exactPct`

`results.json` is explicitly marked with:

```json
{
  "fixture": true,
  "evidenceScope": "reproducible-local-fixture",
  "externalClaims": false
}
```

`fixtureAgreementPct` reports agreement between this fixture's expected labels and its deterministic policy implementation. It is not model accuracy and must not be presented as external evidence.
