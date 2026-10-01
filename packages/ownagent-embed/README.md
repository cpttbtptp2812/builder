# `@ownagent/embed`

A framework-neutral adapter for embedding the OwnAgent skill gate in an OEM
application. The package contains only TypeScript and has no runtime
dependencies. It does not perform network, database, filesystem, or UI work
unless the host supplies an adapter that does so.

This directory is a source artifact in this repository. It is not evidence
that a package has been published to a registry.

## Host contract

`createOwnAgentGate` requires four adapters:

- `catalog`: resolves the host's skill metadata and candidate artifact.
- `executor`: evaluates a candidate and returns either
  the canonical `ownagent-check/2` report. Legacy
  `ownagent-skill-gate-api/1` and `ownagent-skill-gate/1` remain readable
  during migration.
- `storage`: loads baselines and saves completed gate runs.
- `notifications`: forwards completion/failure events to the host UI, webhook,
  message bus, or a no-op implementation.

The gate orchestrates these adapters in this order:

1. resolve the skill;
2. load its baseline;
3. execute the injected evaluator;
4. validate and normalize the protocol decision;
5. persist the run;
6. emit a notification.

Notification failures are non-fatal by default. Pass
`{ notificationErrors: "throw" }` if delivery is part of the host's
transaction boundary.

## Example

```ts
import { createOwnAgentGate } from "@ownagent/embed";

const gate = createOwnAgentGate<string>({
  catalog: {
    async get(id) {
      return id === "release-inspector"
        ? { id, name: "Release Inspector", artifact: candidateMarkdown }
        : null;
    },
    async list() {
      return [];
    },
  },
  executor: {
    async execute({ skill, candidate }) {
      const response = await fetch("/api/skill-gate/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillId: skill.id, raw: candidate }),
      });
      if (!response.ok) throw new Error(`Gate failed: ${response.status}`);
      return response.json();
    },
  },
  storage: {
    async getBaseline() {
      return null;
    },
    async saveRun(run) {
      await auditStore.put(run);
    },
  },
  notifications: {
    async notify(event) {
      eventBus.emit(event.type, event);
    },
  },
});

const result = await gate.check({
  skillId: "release-inspector",
  actor: "oem-console",
});

if (result.run.decision === "BLOCK") {
  // Keep deployment or publication disabled in the host application.
}
```

## Integration notes

- This package evaluates and records a decision; it deliberately does not
  publish, deploy, or mutate a baseline.
- The generic `TArtifact` may be SKILL.md text, an AST, or a host-specific
  bundle. `TContext` carries tenant/request metadata to adapters unchanged.
- `candidate` defaults to the artifact returned by the catalog.
- The executor's report is retained unchanged in the stored run so consumers
  can use protocol fields beyond the stable gate summary.
- The root repository does not currently declare workspaces. Consume this
  source by a local file dependency, a dedicated build pipeline, or after
  adding workspace wiring in a separate change.
